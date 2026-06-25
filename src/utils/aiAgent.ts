import type { Payload } from 'payload'
import type { CollectionSlugs } from './slugs'
import { readSupportSettings, type SupportSettings } from './readSettings'
import { dbFind, dbFindByID, dbCreate, dbUpdate } from './db'

export interface AgentDecision {
  action: 'reply' | 'escalate'
  reply?: string
  reason?: string
  confidence?: number
}

export interface AgentResult {
  acted: 'reply' | 'escalate'
  messageId?: number | string
  confidence?: number
}

/**
 * Execute an AI agent decision on a ticket. DETERMINISTIC (no LLM) — this is the
 * tested core: a `reply` posts a public answer (attributed to the AI assistant),
 * an `escalate` records an internal note with the reasoning and flags the ticket.
 */
export async function applyAgentDecision(
  payload: Payload,
  slugs: CollectionSlugs,
  ticketId: number | string,
  decision: AgentDecision,
): Promise<AgentResult> {
  if (decision.action === 'reply' && decision.reply && decision.reply.trim()) {
    const msg = await dbCreate(payload, slugs.ticketMessages, {
      data: {
        ticket: ticketId,
        body: decision.reply.trim(),
        authorType: 'admin',
        isInternal: false,
        fromAlias: 'Assistant IA',
      },
      overrideAccess: true,
    })
    return { acted: 'reply', messageId: (msg as { id: number | string }).id, confidence: decision.confidence }
  }

  // Escalate: leave an internal note + flag the ticket for a human.
  await dbCreate(payload, slugs.ticketMessages, {
    data: {
      ticket: ticketId,
      body: `[Agent IA] Escalade vers un humain. Raison : ${decision.reason || 'non déterminée'} (confiance ${Math.round((decision.confidence ?? 0) * 100)} %).`,
      authorType: 'admin',
      isInternal: true,
      skipNotification: true,
    },
    overrideAccess: true,
  })
  await dbUpdate(payload, slugs.tickets, { id: ticketId, data: { status: 'escalated' }, overrideAccess: true })
  return { acted: 'escalate', confidence: decision.confidence }
}

// ─── LLM decision (runtime only — not unit-tested) ───────────────────

function getClient(aiSettings: SupportSettings['ai']) {
  const Anthropic = require('@anthropic-ai/sdk').default
  if (aiSettings.provider === 'ollama') {
    return new Anthropic({ apiKey: 'ollama', baseURL: process.env.OLLAMA_API_URL || 'https://ollama.orkelis.app/v1' })
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseDecision(text: string): AgentDecision {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const obj = JSON.parse(match[0])
      return {
        action: obj.action === 'reply' ? 'reply' : 'escalate',
        reply: typeof obj.reply === 'string' ? obj.reply : undefined,
        reason: typeof obj.reason === 'string' ? obj.reason : undefined,
        confidence: typeof obj.confidence === 'number' ? obj.confidence : 0,
      }
    }
  } catch { /* fall through */ }
  return { action: 'escalate', reason: 'Réponse IA non interprétable', confidence: 0 }
}

/**
 * Run the autonomous AI agent on a ticket: builds context (ticket + thread + KB),
 * asks the LLM for a structured decision, applies a confidence threshold, then
 * executes it via {@link applyAgentDecision}. Requires an AI provider at runtime.
 */
export async function runAiAgent(
  payload: Payload,
  slugs: CollectionSlugs,
  ticketId: number | string,
  opts?: { confidenceThreshold?: number },
): Promise<AgentResult> {
  const settings = await readSupportSettings(payload)
  const threshold = opts?.confidenceThreshold ?? 0.7

  const ticket = await dbFindByID(payload, slugs.tickets, { id: ticketId, depth: 0, overrideAccess: true })
  const messages = await dbFind(payload, slugs.ticketMessages, { where: { ticket: { equals: ticketId } }, sort: 'createdAt', limit: 50, depth: 0, overrideAccess: true })
  const kb = await dbFind(payload, slugs.knowledgeBase, { where: { published: { equals: true } }, limit: 20, depth: 0, overrideAccess: true })

  const conversation = messages.docs.map((m) => `${(m as { authorType?: string }).authorType}: ${(m as { body?: string }).body || ''}`).join('\n')
  const kbText = kb.docs
    .map((a) => `# ${(a as { title?: string }).title || ''}\n${stripHtml(String((a as { content?: unknown }).content ?? ''))}`)
    .join('\n\n')
    .slice(0, 8000)

  const prompt = `Tu es un agent de support IA. À partir du ticket et de la base de connaissances ci-dessous, décide :
- "reply" si tu peux répondre avec certitude UNIQUEMENT à partir de la base de connaissances ;
- "escalate" sinon (question hors KB, ambiguë, sensible, ou nécessitant une action humaine).
Réponds en JSON STRICT, sans texte autour : {"action":"reply"|"escalate","reply":"<réponse au client si reply>","reason":"<courte raison>","confidence":<0 à 1>}.

TICKET : ${(ticket as { subject?: string }).subject || ''}
CONVERSATION :
${conversation}

BASE DE CONNAISSANCES :
${kbText || '(vide)'}`

  let decision: AgentDecision
  try {
    const client = getClient(settings.ai)
    const resp = await client.messages.create({
      model: settings.ai.model || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = resp?.content?.[0]?.text || ''
    decision = parseDecision(text)
  } catch (err) {
    console.error('[support] AI agent decision failed:', err)
    decision = { action: 'escalate', reason: 'Erreur du fournisseur IA', confidence: 0 }
  }

  // Confidence gate: only auto-reply when the model is confident enough.
  const finalDecision: AgentDecision =
    decision.action === 'reply' && (decision.confidence ?? 0) >= threshold
      ? decision
      : { action: 'escalate', reason: decision.reason || 'Confiance insuffisante pour une réponse automatique', confidence: decision.confidence }

  return applyAgentDecision(payload, slugs, ticketId, finalDecision)
}
