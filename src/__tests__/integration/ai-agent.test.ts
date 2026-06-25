import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { applyAgentDecision } from '../../utils/aiAgent'
import { resolveSlugs } from '../../utils/slugs'

const slugs = resolveSlugs({ users: 'users' })
const PW = 'test-pw-12345'

/**
 * Autonomous AI agent (P2 #8). The LLM decision is runtime-only; here we test the
 * DETERMINISTIC execution of a decision: a `reply` posts a public AI answer, an
 * `escalate` flags the ticket and records an internal note.
 */
describe('AI agent — decision execution (P2 #8)', () => {
  it('reply decision posts a public answer attributed to the AI assistant', async () => {
    const payload = await buildTestPayload()
    const c = await payload.create({ collection: 'support-clients', data: { email: 'aiagent@example.com', password: PW, firstName: 'A', lastName: 'I', company: 'C' }, overrideAccess: true })
    const t = await payload.create({ collection: 'tickets', data: { subject: 'reset password', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    const res = await applyAgentDecision(payload, slugs, t.id, { action: 'reply', reply: 'Cliquez sur « Mot de passe oublié » sur la page de connexion.', confidence: 0.95 })
    expect(res.acted).toBe('reply')
    expect(res.messageId).toBeTruthy()

    const msgs = await payload.find({ collection: 'ticket-messages', where: { ticket: { equals: t.id } }, overrideAccess: true })
    const aiMsg = msgs.docs.find((m) => (m as { fromAlias?: string }).fromAlias === 'Assistant IA') as { body?: string; isInternal?: boolean } | undefined
    expect(aiMsg).toBeTruthy()
    expect(aiMsg?.body).toContain('Mot de passe oublié')
    expect(aiMsg?.isInternal).toBe(false)
  }, 60_000)

  it('escalate decision flags the ticket and adds an internal note', async () => {
    const payload = await buildTestPayload()
    const c = await payload.create({ collection: 'support-clients', data: { email: 'aiagent2@example.com', password: PW, firstName: 'A', lastName: 'I', company: 'C' }, overrideAccess: true })
    const t = await payload.create({ collection: 'tickets', data: { subject: 'legal question', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    const res = await applyAgentDecision(payload, slugs, t.id, { action: 'escalate', reason: 'Question juridique', confidence: 0.2 })
    expect(res.acted).toBe('escalate')

    const reread = await payload.findByID({ collection: 'tickets', id: t.id, overrideAccess: true })
    expect(reread.status).toBe('escalated')

    const msgs = await payload.find({ collection: 'ticket-messages', where: { and: [{ ticket: { equals: t.id } }, { isInternal: { equals: true } }] }, overrideAccess: true })
    const note = msgs.docs.find((m) => ((m as { body?: string }).body || '').includes('[Agent IA]'))
    expect(note).toBeTruthy()
  }, 60_000)
})
