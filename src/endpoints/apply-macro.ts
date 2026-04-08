import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

interface MacroAction {
  type: 'set_status' | 'set_priority' | 'add_tag' | 'send_reply' | 'assign'
  value: string
}

/**
 * POST /api/support/apply-macro
 * Apply a macro (multi-action shortcut) to a ticket. Admin-only.
 */
export function createApplyMacroEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/apply-macro',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const body = await req.json!()
        const { macroId, ticketId } = body

        if (!macroId || !ticketId) {
          return Response.json({ error: 'macroId and ticketId are required' }, { status: 400 })
        }

        const macro = await payload.findByID({
          collection: slugs.macros as any,
          id: macroId,
          depth: 0,
          overrideAccess: true,
        }) as any

        if (!macro) return Response.json({ error: 'Macro not found' }, { status: 404 })
        if (!macro.isActive) return Response.json({ error: 'Macro is disabled' }, { status: 400 })

        const ticket = await payload.findByID({
          collection: slugs.tickets as any,
          id: ticketId,
          depth: 0,
          overrideAccess: true,
        }) as any

        if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 })

        const appliedActions: { type: string; value: string; success: boolean; error?: string }[] = []
        const actions: MacroAction[] = macro.actions || []

        for (const action of actions) {
          try {
            switch (action.type) {
              case 'set_status':
                await payload.update({
                  collection: slugs.tickets as any,
                  id: ticketId,
                  data: { status: action.value },
                  overrideAccess: true,
                })
                appliedActions.push({ type: action.type, value: action.value, success: true })
                break

              case 'set_priority':
                await payload.update({
                  collection: slugs.tickets as any,
                  id: ticketId,
                  data: { priority: action.value },
                  overrideAccess: true,
                })
                appliedActions.push({ type: action.type, value: action.value, success: true })
                break

              case 'add_tag': {
                const currentTags = Array.isArray(ticket.tags) ? [...ticket.tags] : []
                if (!currentTags.includes(action.value)) {
                  currentTags.push(action.value)
                }
                await payload.update({
                  collection: slugs.tickets as any,
                  id: ticketId,
                  data: { tags: currentTags },
                  overrideAccess: true,
                })
                appliedActions.push({ type: action.type, value: action.value, success: true })
                break
              }

              case 'send_reply':
                await payload.create({
                  collection: slugs.ticketMessages as any,
                  data: {
                    ticket: ticketId,
                    body: action.value,
                    authorType: 'admin',
                    isInternal: false,
                  },
                  overrideAccess: true,
                })
                appliedActions.push({ type: action.type, value: action.value, success: true })
                break

              case 'assign': {
                const userId = parseInt(action.value, 10)
                if (isNaN(userId)) {
                  appliedActions.push({ type: action.type, value: action.value, success: false, error: 'Invalid user ID' })
                  break
                }
                await payload.update({
                  collection: slugs.tickets as any,
                  id: ticketId,
                  data: { assignedTo: userId },
                  overrideAccess: true,
                })
                appliedActions.push({ type: action.type, value: action.value, success: true })
                break
              }

              default:
                appliedActions.push({ type: action.type, value: action.value, success: false, error: 'Unknown action type' })
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err)
            appliedActions.push({ type: action.type, value: action.value, success: false, error: errorMsg })
          }
        }

        return Response.json({
          applied: true,
          macroName: macro.name,
          ticketId,
          actions: appliedActions,
        })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[apply-macro] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
