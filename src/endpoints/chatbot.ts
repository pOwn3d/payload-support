import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { clientIpRateKey, RateLimiter, type RateLimitStore } from '../utils/rateLimiter'
import { dbFind } from '../utils/db'


/**
 * Global hourly ceiling on chatbot calls, all callers combined.
 *
 * The per-IP window below is keyed on the FIRST hop of `X-Forwarded-For`, a
 * value the caller sends itself: an anonymous client rotating that header gets a
 * fresh window on every request. Unlike `login.ts` — where the account lock is
 * the primary control — this endpoint has no second line of defence, and every
 * accepted call ships ~50 KB of knowledge base to the Anthropic API on the
 * operator's key. This unkeyed ceiling makes the bill bounded even when the
 * per-IP key is bypassed. Raise it with `SUPPORT_CHATBOT_MAX_PER_HOUR` on a
 * high-traffic portal, or pass `maxPerHour` when building the endpoint.
 */
export const DEFAULT_CHATBOT_MAX_PER_HOUR = 200

function resolveMaxPerHour(explicit?: number): number {
  if (typeof explicit === 'number' && explicit > 0) return explicit
  const fromEnv = Number(process.env.SUPPORT_CHATBOT_MAX_PER_HOUR)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_CHATBOT_MAX_PER_HOUR
}

/**
 * POST /api/support/chatbot
 * AI chatbot that answers from the knowledge base before creating a ticket.
 * Public endpoint (accessible from the support portal).
 */
export function createChatbotEndpoint(
  slugs: CollectionSlugs,
  store?: RateLimitStore,
  maxPerHour?: number,
): Endpoint {
  const chatbotLimiter = new RateLimiter(60_000, 10, store, 'chatbot:ip')
  const globalLimiter = new RateLimiter(60 * 60_000, resolveMaxPerHour(maxPerHour), store, 'chatbot:global')
  return {
    path: '/support/chatbot',
    method: 'post',
    handler: async (req) => {
      try {
        const ip = clientIpRateKey(req)
        if (await chatbotLimiter.check(ip, req)) {
          return Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
        }

        let body: { question?: string }
        try {
          body = await req.json!()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
        const { question } = body

        if (!question?.trim() || question.trim().length < 5) {
          return Response.json({ error: 'Question too short' }, { status: 400 })
        }

        // Not keyed on anything the caller controls — see the note above.
        // Placed after validation so malformed requests do not eat the budget.
        //
        // Over budget, the answer DEGRADES, it does not fail: a shared counter
        // that returns 429 hands an anonymous visitor a switch to turn the
        // chatbot off for everybody (the per-IP key above is spoofable, so
        // exhausting the ceiling costs nothing). The deflection path — "no
        // answer here, open a ticket" — is the exact response this endpoint
        // already returns when the knowledge base is empty or the API key is
        // missing, so no caller learns a new shape, and the bill stays capped
        // because the AI call below is never reached.
        if (await globalLimiter.check('all', req)) {
          return Response.json({
            answer: null,
            confidence: 0,
            suggestion: 'create_ticket',
            aiUnavailable: true,
            message: 'L\'assistant est momentanément indisponible. Créez un ticket, un agent vous répondra.',
          })
        }

        const payload = req.payload

        const articles = await dbFind(payload, slugs.knowledgeBase, {
          where: { published: { equals: true } },
          limit: 100,
          depth: 0,
          overrideAccess: true,
        })

        if (articles.docs.length === 0) {
          return Response.json({
            answer: null,
            confidence: 0,
            suggestion: 'create_ticket',
            message: 'Aucun article disponible. Créez un ticket pour obtenir de l\'aide.',
          })
        }

        const knowledgeContext = articles.docs
          .map((a: any) => `## ${a.title}\n${JSON.stringify(a.body || '').slice(0, 500)}`)
          .join('\n\n---\n\n')

        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          return Response.json({
            answer: null,
            confidence: 0,
            suggestion: 'create_ticket',
            message: 'Le chatbot IA n\'est pas configuré.',
          })
        }

        const Anthropic = require('@anthropic-ai/sdk').default
        const anthropic = new Anthropic({ apiKey })

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `Tu es un assistant de support. Tu dois répondre à la question du client en utilisant UNIQUEMENT les articles de la base de connaissances ci-dessous. Si la réponse n'est pas dans la base, dis-le clairement.

BASE DE CONNAISSANCES :
${knowledgeContext}

QUESTION DU CLIENT :
${question}

Réponds en français, de manière concise et utile. Si tu ne trouves pas la réponse dans la base, réponds exactement "INCONNU" et rien d'autre.`,
            },
          ],
        })

        const answer = response.content[0].type === 'text' ? response.content[0].text : ''

        if (answer.trim() === 'INCONNU' || answer.trim().length < 10) {
          return Response.json({
            answer: null,
            confidence: 0,
            suggestion: 'create_ticket',
            message: 'Je n\'ai pas trouvé de réponse dans notre base de connaissances. Souhaitez-vous créer un ticket de support ?',
          })
        }

        return Response.json({
          answer: answer.trim(),
          confidence: 1,
          suggestion: 'resolved',
          message: null,
        })
      } catch (error) {
        console.error('[chatbot] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
