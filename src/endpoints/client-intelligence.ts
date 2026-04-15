import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { readSupportSettings, type SupportSettings } from '../utils/readSettings'

function getClient(aiSettings: SupportSettings['ai']) {
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

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * GET /api/support/client-intelligence?clientId=X
 * Returns cached summary or generates a new one.
 *
 * POST /api/support/client-intelligence?clientId=X
 * Force-refreshes the summary.
 */
export function createClientIntelligenceEndpoint(slugs: CollectionSlugs): Endpoint[] {
  const getHandler = async (req: any) => {
    try {
      requireAdmin(req, slugs)
      const payload = req.payload
      const url = new URL(req.url || '', 'http://localhost')
      const clientId = url.searchParams.get('clientId')
      if (!clientId) return Response.json({ error: 'clientId required' }, { status: 400 })

      // Check cache
      const existing = await payload.find({
        collection: 'client-summaries',
        where: { client: { equals: Number(clientId) } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (existing.docs.length > 0) {
        const cached = existing.docs[0]
        const age = Date.now() - new Date(cached.generatedAt || 0).getTime()
        if (age < CACHE_TTL_MS) {
          return Response.json({ ...cached, fromCache: true })
        }
      }

      // Generate new summary
      return await generateSummary(payload, clientId, slugs, existing.docs[0]?.id)
    } catch (error) {
      const authResponse = handleAuthError(error)
      if (authResponse) return authResponse
      console.error('[client-intelligence] Error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  const postHandler = async (req: any) => {
    try {
      requireAdmin(req, slugs)
      const payload = req.payload
      const body = await req.json?.() || {}
      const clientId = body.clientId
      if (!clientId) return Response.json({ error: 'clientId required' }, { status: 400 })

      // Find existing to update
      const existing = await payload.find({
        collection: 'client-summaries',
        where: { client: { equals: Number(clientId) } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      return await generateSummary(payload, clientId, slugs, existing.docs[0]?.id)
    } catch (error) {
      const authResponse = handleAuthError(error)
      if (authResponse) return authResponse
      console.error('[client-intelligence] Refresh error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  return [
    { path: '/support/client-intelligence', method: 'get', handler: getHandler },
    { path: '/support/client-intelligence', method: 'post', handler: postHandler },
  ]
}

async function generateSummary(
  payload: any,
  clientId: string,
  slugs: CollectionSlugs,
  existingId?: number,
) {
  const aiSettings = (await readSupportSettings(payload)).ai
  if (!aiSettings.enableSynthesis) {
    return Response.json({ error: 'AI synthesis disabled in settings' }, { status: 400 })
  }

  // 1. Fetch client info
  const client = await payload.findByID({
    collection: slugs.supportClients,
    id: Number(clientId),
    depth: 0,
    overrideAccess: true,
  })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const clientName = [client.firstName, client.lastName].filter(Boolean).join(' ') || client.company || client.email

  // 2. Fetch all tickets for this client
  const tickets = await payload.find({
    collection: slugs.tickets,
    where: { client: { equals: Number(clientId) } },
    sort: '-createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  if (tickets.totalDocs === 0) {
    return Response.json({
      summary: 'Aucun ticket pour ce client.',
      recurringTopics: [],
      patterns: [],
      keyFacts: [],
      ticketCount: 0,
      messageCount: 0,
    })
  }

  // 3. Fetch messages for recent tickets (last 20)
  const ticketIds = tickets.docs.slice(0, 20).map((t: any) => t.id)
  const messages = await payload.find({
    collection: slugs.ticketMessages,
    where: { ticket: { in: ticketIds.join(',') } },
    sort: 'createdAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  // 4. Fetch satisfaction surveys
  let avgSatisfaction: number | null = null
  try {
    const surveys = await payload.find({
      collection: slugs.satisfactionSurveys || 'satisfaction-surveys',
      where: { client: { equals: Number(clientId) } },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    if (surveys.totalDocs > 0) {
      const ratings = surveys.docs.filter((s: any) => s.rating).map((s: any) => s.rating)
      if (ratings.length > 0) avgSatisfaction = Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10
    }
  } catch { /* satisfaction collection might not exist */ }

  // 5. Build context for AI
  const ticketSummaries = tickets.docs.map((t: any) => {
    const msgs = messages.docs.filter((m: any) => {
      const mTicket = typeof m.ticket === 'object' ? m.ticket.id : m.ticket
      return mTicket === t.id
    })
    const clientMsgs = msgs.filter((m: any) => m.authorType === 'client' || m.authorType === 'email')
    const adminMsgs = msgs.filter((m: any) => m.authorType === 'admin')
    return `Ticket ${t.ticketNumber} (${t.status}) — "${t.subject}"
  Client: ${clientMsgs.map((m: any) => m.body?.slice(0, 200)).join(' | ')}
  Admin: ${adminMsgs.map((m: any) => m.body?.slice(0, 200)).join(' | ')}`
  }).join('\n\n')

  const prompt = `Tu es un assistant d'analyse CRM pour un support technique. Analyse l'historique complet de ce client et génère un rapport structuré.

CLIENT : ${clientName} (${client.company || 'pas de société'})
Email : ${client.email}
Nombre de tickets : ${tickets.totalDocs}
Satisfaction moyenne : ${avgSatisfaction ?? 'non évaluée'}

HISTORIQUE DES TICKETS :
${ticketSummaries.slice(0, 4000)}

Réponds en JSON strict (pas de markdown, pas de commentaires) avec cette structure :
{
  "summary": "Résumé global du client en 2-3 phrases (qui il est, ce qu'il demande habituellement, son niveau de satisfaction)",
  "recurringTopics": [{"topic": "nom du sujet", "count": N, "lastSeen": "YYYY-MM-DD"}],
  "patterns": ["pattern 1 observé", "pattern 2 observé"],
  "keyFacts": ["fait clé 1 sur le client", "fait clé 2"]
}

Sois factuel. Ne dépasse pas 5 items par tableau. Réponds UNIQUEMENT avec le JSON.`

  // 6. Call AI
  const anthropic = getClient(aiSettings)
  const model = getModel(aiSettings)

  const res = await anthropic.messages.create({
    model,
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = res.content[0].type === 'text' ? res.content[0].text : '{}'

  // 7. Parse AI response
  let parsed: any = {}
  try {
    // Extract JSON from potential markdown fences
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch {
    parsed = { summary: rawText, recurringTopics: [], patterns: [], keyFacts: [] }
  }

  // 8. Save to DB
  const data = {
    client: Number(clientId),
    clientName,
    summary: parsed.summary || 'Résumé non disponible',
    recurringTopics: parsed.recurringTopics || [],
    patterns: parsed.patterns || [],
    keyFacts: parsed.keyFacts || [],
    ticketCount: tickets.totalDocs,
    messageCount: messages.totalDocs,
    averageSatisfaction: avgSatisfaction,
    firstTicketAt: tickets.docs[tickets.docs.length - 1]?.createdAt || null,
    lastTicketAt: tickets.docs[0]?.createdAt || null,
    generatedAt: new Date().toISOString(),
    aiModel: model,
  }

  let saved: any
  if (existingId) {
    saved = await payload.update({
      collection: 'client-summaries',
      id: existingId,
      data,
      overrideAccess: true,
    })
  } else {
    saved = await payload.create({
      collection: 'client-summaries',
      data,
      overrideAccess: true,
    })
  }

  console.log(`[client-intelligence] Generated summary for ${clientName} (${tickets.totalDocs} tickets, ${messages.totalDocs} messages)`)

  return Response.json({ ...saved, fromCache: false })
}
