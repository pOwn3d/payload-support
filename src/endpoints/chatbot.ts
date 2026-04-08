import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

/**
 * POST /api/support/chatbot
 * AI chatbot that answers from the knowledge base before creating a ticket.
 * Public endpoint (accessible from the support portal).
 */
export function createChatbotEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/chatbot',
    method: 'post',
    handler: async (req) => {
      try {
        const { question } = (await req.json!()) as { question: string }

        if (!question?.trim() || question.trim().length < 5) {
          return Response.json({ error: 'Question too short' }, { status: 400 })
        }

        const payload = req.payload

        const articles = await payload.find({
          collection: slugs.knowledgeBase as any,
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
