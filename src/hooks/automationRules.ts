import type { CollectionAfterChangeHook } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { dbFind } from '../utils/db'

interface Condition { field?: string; operator?: string; value?: string }
interface Action { type?: string; value?: string }
interface Rule { matchType?: string; conditions?: Condition[]; actions?: Action[] }

function evaluateConditions(doc: Record<string, unknown>, rule: Rule): boolean {
  const conds = Array.isArray(rule.conditions) ? rule.conditions : []
  if (conds.length === 0) return true
  const results = conds.map((c) => {
    const fieldVal = String(doc[c.field as string] ?? '')
    const v = String(c.value ?? '')
    switch (c.operator) {
      case 'equals': return fieldVal === v
      case 'not_equals': return fieldVal !== v
      case 'contains': return fieldVal.toLowerCase().includes(v.toLowerCase())
      default: return false
    }
  })
  return rule.matchType === 'any' ? results.some(Boolean) : results.every(Boolean)
}

/**
 * Evaluate enabled automation rules against a ticket and apply their actions.
 * Runs as afterChange on the Tickets collection. All matched actions are applied
 * in a SINGLE update flagged `skipAutomation` to avoid re-triggering (no loop).
 */
export function createApplyAutomationRules(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    if (req.context?.skipAutomation) return doc

    const events: string[] = []
    if (operation === 'create') events.push('ticket_created')
    if (operation === 'update') {
      events.push('ticket_updated')
      if (previousDoc && previousDoc.status !== doc.status) events.push('ticket_status_changed')
    }
    if (events.length === 0) return doc

    try {
      const rules = await dbFind<Rule & { actions?: Action[] }>(req.payload, slugs.automationRules, {
        where: { and: [{ enabled: { equals: true } }, { event: { in: events } }] },
        sort: 'order',
        limit: 200,
        depth: 0,
        overrideAccess: true,
      })

      const changes: Record<string, unknown> = {}
      const tags: string[] = Array.isArray(doc.tags) ? [...(doc.tags as string[])] : []
      let tagsTouched = false

      for (const rule of rules.docs) {
        if (!evaluateConditions(doc as Record<string, unknown>, rule)) continue
        for (const a of Array.isArray(rule.actions) ? rule.actions : []) {
          if (!a.value) continue
          switch (a.type) {
            case 'set_status': changes.status = a.value; break
            case 'set_priority': changes.priority = a.value; break
            case 'set_category': changes.category = a.value; break
            case 'assign': changes.assignedTo = a.value; break
            case 'add_tag': if (!tags.includes(a.value)) { tags.push(a.value); tagsTouched = true } break
          }
        }
      }

      if (tagsTouched) changes.tags = tags
      if (Object.keys(changes).length > 0) {
        await req.payload.update({
          collection: slugs.tickets,
          id: doc.id,
          data: changes,
          overrideAccess: true,
          context: { skipAutomation: true },
        })
      }
    } catch (err) {
      console.error('[support] Failed to apply automation rules:', err)
    }
    return doc
  }
}
