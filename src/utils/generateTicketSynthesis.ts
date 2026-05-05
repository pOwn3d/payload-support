import type { Payload } from 'payload'
import type { CollectionSlugs } from './slugs'
import { readSupportSettings, type SupportSettings } from './readSettings'

function getClient(aiSettings: SupportSettings['ai']) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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

interface TicketMessageDoc {
  authorType?: string
  body?: string
  createdAt?: string
}

interface TicketDoc {
  id: number | string
  subject?: string
  ticketNumber?: string
  client?: number | { id: number; firstName?: string; lastName?: string; company?: string } | null
}

export interface TicketSynthesisResult {
  summary: string
  generatedAt: string
  status: 'done' | 'error' | 'skipped'
  reason?: string
}

/**
 * Generates a billing-oriented bullet-point synthesis for a single support ticket.
 * Persists the result on the ticket (aiSummary, aiSummaryGeneratedAt, aiSummaryStatus).
 * Designed to be called from an HTTP endpoint OR from a Payload hook (async fire-and-forget).
 */
export async function generateTicketSynthesis(args: {
  payload: Payload
  slugs: CollectionSlugs
  ticketId: number | string
}): Promise<TicketSynthesisResult> {
  const { payload, slugs, ticketId } = args

  const settings = await readSupportSettings(payload)
  if (settings.ai.enableSynthesis === false) {
    return { summary: '', generatedAt: new Date().toISOString(), status: 'skipped', reason: 'synthesis disabled' }
  }

  const ticket = await payload.findByID({
    collection: slugs.tickets as any,
    id: ticketId,
    depth: 1,
    overrideAccess: true,
  }) as TicketDoc

  if (!ticket) {
    return { summary: '', generatedAt: new Date().toISOString(), status: 'error', reason: 'ticket not found' }
  }

  // Mark as pending so the UI can show a spinner
  await payload.update({
    collection: slugs.tickets as any,
    id: ticketId,
    data: { aiSummaryStatus: 'pending' },
    overrideAccess: true,
  }).catch(() => { /* non-blocking */ })

  // Load all ticket messages, ordered chronologically
  const messagesResult = await payload.find({
    collection: slugs.ticketMessages as any,
    where: { ticket: { equals: ticketId } },
    sort: 'createdAt',
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  const messages = messagesResult.docs as TicketMessageDoc[]

  if (messages.length === 0) {
    const generatedAt = new Date().toISOString()
    await payload.update({
      collection: slugs.tickets as any,
      id: ticketId,
      data: {
        aiSummary: '(Aucun message dans ce ticket)',
        aiSummaryGeneratedAt: generatedAt,
        aiSummaryStatus: 'done',
      },
      overrideAccess: true,
    })
    return { summary: '(Aucun message dans ce ticket)', generatedAt, status: 'done' }
  }

  const conversation = messages
    .map((m) => {
      const author = m.authorType === 'admin' ? 'Support' : 'Client'
      const date = m.createdAt
        ? new Date(m.createdAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Paris',
          })
        : ''
      return `[${date}] ${author}: ${m.body || ''}`
    })
    .join('\n\n')

  const clientObj = typeof ticket.client === 'object' && ticket.client ? ticket.client : null
  const clientCompany = clientObj?.company || ''
  const clientName = clientObj ? [clientObj.firstName, clientObj.lastName].filter(Boolean).join(' ') : ''

  const prompt = `Tu es un consultant technique qui prepare un recap factuel pour une facturation client.

Sujet du ticket : ${ticket.subject || '(sans sujet)'}
Client : ${clientName || 'Inconnu'}${clientCompany ? ` — ${clientCompany}` : ''}

Conversation complete du ticket :
${conversation}

Genere un recap factuel sous forme d'une liste a puces courtes et actionnables, decrivant CE QUI A ETE FAIT cote support pendant ce ticket. C'est destine a etre colle dans un devis ou une facture.

Regles strictes :
- Une puce = une action realisee, formulee en groupe nominal court (ex : "Diagnostic configuration DNS et authentification Mailchimp")
- Pas de phrases completes, pas de "j'ai fait", pas de pronoms
- Pas de salutations, pas d'introduction, pas de conclusion
- Pas de markdown autre que les puces "- "
- 5 a 10 puces maximum, ordonnees chronologiquement
- Ne mentionne PAS le client par son nom dans les puces
- Si le ticket n'a pas abouti, decris quand meme le travail d'analyse realise

Reponds UNIQUEMENT avec la liste de puces, rien d'autre.`

  const anthropic = getClient(settings.ai)
  const model = getModel(settings.ai)

  try {
    const res = await anthropic.messages.create({
      model,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = res.content[0]?.type === 'text' ? res.content[0].text.trim() : ''
    const generatedAt = new Date().toISOString()

    await payload.update({
      collection: slugs.tickets as any,
      id: ticketId,
      data: {
        aiSummary: summary,
        aiSummaryGeneratedAt: generatedAt,
        aiSummaryStatus: 'done',
      },
      overrideAccess: true,
    })

    return { summary, generatedAt, status: 'done' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await payload.update({
      collection: slugs.tickets as any,
      id: ticketId,
      data: { aiSummaryStatus: 'error' },
      overrideAccess: true,
    }).catch(() => { /* non-blocking */ })
    return { summary: '', generatedAt: new Date().toISOString(), status: 'error', reason: message }
  }
}
