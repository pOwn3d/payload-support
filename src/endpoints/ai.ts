import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { readSupportSettings, type SupportSettings } from '../utils/readSettings'

function getClient(aiSettings: SupportSettings['ai']) {
  // Dynamic import to avoid hard dependency
  const Anthropic = require('@anthropic-ai/sdk').default
  if (aiSettings.provider === 'ollama') {
    const baseURL = process.env.OLLAMA_API_URL || 'https://ollama.orkelis.app/v1'
    return new Anthropic({ apiKey: 'ollama', baseURL })
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function getModel(aiSettings: SupportSettings['ai']): string {
  return aiSettings.model || 'claude-haiku-4-5-20251001'
}

type AiAction = 'sentiment' | 'synthesis' | 'suggest_reply' | 'rewrite'

/**
 * POST /api/support/ai
 * Admin-only endpoint for AI features in support.
 */
export function createAiEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/ai',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const settings = await readSupportSettings(payload)
        const aiSettings = settings.ai
        let body: Record<string, unknown>
        try {
          body = await req.json!()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
        const { action } = body as { action: AiAction }

        const anthropic = getClient(aiSettings)
        const model = getModel(aiSettings)

        if (action === 'sentiment') {
          if (!aiSettings.enableSentiment) {
            return Response.json({ sentiment: 'neutre', disabled: true })
          }
          const { text } = body as { text: string }
          if (!text) return Response.json({ error: 'text required' }, { status: 400 })

          const res = await anthropic.messages.create({
            model,
            max_tokens: 20,
            messages: [
              {
                role: 'user',
                content: `Analyse le sentiment de ce message de support client. Réponds UNIQUEMENT par un seul mot parmi : frustré, mécontent, neutre, satisfait, urgent. Pas d'explication.\n\nMessage : "${text.slice(0, 500)}"`,
              },
            ],
          })

          const raw = (res.content[0].type === 'text' ? res.content[0].text : '').toLowerCase().trim()
          return Response.json({ sentiment: raw })
        }

        if (action === 'synthesis') {
          if (!aiSettings.enableSynthesis) {
            return Response.json({ synthesis: '', disabled: true })
          }
          const { messages: msgs, ticketSubject, clientName, clientCompany } = body as {
            messages: Array<{ authorType: string; body: string; createdAt: string }>
            ticketSubject: string
            clientName?: string
            clientCompany?: string
          }

          const conversation = msgs
            .map((m) => {
              const author = m.authorType === 'admin' ? 'Support' : 'Client'
              const date = new Date(m.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Paris',
              })
              return `[${date}] ${author}: ${m.body}`
            })
            .join('\n\n')

          const prompt = `Tu es un agent de support technique senior. Analyse cette conversation de support et génère une synthèse structurée.

Sujet du ticket : ${ticketSubject}
Client : ${clientName || 'Inconnu'}${clientCompany ? ` — ${clientCompany}` : ''}

Conversation :
${conversation}

Génère une synthèse avec ces sections (en markdown) :
## Résumé
2-3 phrases résumant la situation

## Chronologie
- Points clés de la conversation

## Problème principal
Description du problème ou de la demande

## Actions
- Ce qui a été fait
- Prochaines étapes

## Notes importantes
Points d'attention éventuels`

          const res = await anthropic.messages.create({
            model,
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
          })

          const text = res.content[0].type === 'text' ? res.content[0].text : ''
          return Response.json({ synthesis: text })
        }

        if (action === 'suggest_reply') {
          if (!aiSettings.enableSuggestion) {
            return Response.json({ reply: '', disabled: true })
          }
          const { messages: msgs, clientName, clientCompany } = body as {
            messages: Array<{ authorType: string; body: string }>
            clientName?: string
            clientCompany?: string
          }

          const conversation = msgs
            .slice(-10)
            .map((m) => {
              const author = m.authorType === 'admin' ? 'Support' : 'Client'
              return `${author}: ${m.body}`
            })
            .join('\n\n')

          const prompt = `Tu es un agent de support technique. Tu réponds de manière professionnelle, chaleureuse et concise en français.

Contexte client : ${clientCompany || ''} — ${clientName || 'client'}

Conversation récente :
${conversation}

Rédige une réponse appropriée au dernier message du client. Sois concis (3-5 phrases max), professionnel mais chaleureux. Tutoie si le client tutoie, vouvoie sinon. Ne mets pas de signature.`

          const res = await anthropic.messages.create({
            model,
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }],
          })

          const text = res.content[0].type === 'text' ? res.content[0].text : ''
          return Response.json({ reply: text })
        }

        if (action === 'rewrite') {
          if (!aiSettings.enableRewrite) {
            return Response.json({ rewritten: '', disabled: true })
          }
          const { text } = body as { text: string }
          if (!text?.trim()) return Response.json({ error: 'text required' }, { status: 400 })

          const prompt = `Tu es un agent de support technique professionnel. Reformule le texte ci-dessous de manière plus professionnelle et corrige les fautes d'orthographe/grammaire. Garde le même sens et le même ton (tutoiement/vouvoiement). Ne change pas le fond du message, améliore uniquement la forme. Réponds UNIQUEMENT avec le texte reformulé, sans commentaire ni explication.

Texte original :
${text}`

          const res = await anthropic.messages.create({
            model,
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }],
          })

          const rewritten = res.content[0].type === 'text' ? res.content[0].text : ''
          return Response.json({ rewritten })
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[support/ai] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
