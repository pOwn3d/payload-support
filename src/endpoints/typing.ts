import type { Endpoint, PayloadRequest } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { dbFindByID } from '../utils/db'

/**
 * Ephemeral "someone is typing" state, process-local.
 *
 * Three properties this map MUST keep, because it is fed by an HTTP endpoint:
 *  - keys are shaped like ticket ids, never a caller-supplied blob;
 *  - a key is only created by a principal that can actually READ that ticket;
 *  - the map is bounded, and expired entries are reclaimed without depending on
 *    a matching GET (`cleanExpired` used to run only on the read path, for the
 *    single id being read — nothing ever swept the rest).
 */
const typingState = new Map<string, { admin?: number; client?: number; adminName?: string; clientName?: string }>()

const TYPING_TTL = 5000 // 5 seconds
/** Hard ceiling on distinct ticket ids held at once — the state lives 5s. */
const MAX_TYPING_KEYS = 500

/**
 * Ids are integers on SQL adapters and hex ObjectIds on Mongo, so the shape is
 * validated rather than the type: printable id characters, bounded length. This
 * caps the key SIZE; the access check below caps their NUMBER.
 */
const TICKET_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function normalizeTicketId(raw: unknown): string | null {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw > 0 ? String(raw) : null
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  return TICKET_ID_PATTERN.test(value) ? value : null
}

function cleanExpired(ticketId: string) {
  const state = typingState.get(ticketId)
  if (!state) return
  const now = Date.now()
  if (state.admin && now - state.admin > TYPING_TTL) {
    state.admin = undefined
    state.adminName = undefined
  }
  if (state.client && now - state.client > TYPING_TTL) {
    state.client = undefined
    state.clientName = undefined
  }
  if (!state.admin && !state.client) typingState.delete(ticketId)
}

/** Reclaims every expired entry — the map is at most MAX_TYPING_KEYS long. */
function sweepExpired() {
  for (const key of Array.from(typingState.keys())) cleanExpired(key)
}

/** Oldest signal first, so the ceiling evicts the least recently active ticket. */
function evictOldest() {
  let oldestKey: string | null = null
  let oldestTs = Infinity
  for (const [key, state] of typingState) {
    const ts = Math.max(state.admin || 0, state.client || 0)
    if (ts < oldestTs) {
      oldestTs = ts
      oldestKey = key
    }
  }
  if (oldestKey !== null) typingState.delete(oldestKey)
}

/**
 * Can this principal see this ticket? Delegates to the `tickets` collection
 * access rules — the SAME source of truth the rest of the plugin reads through
 * (owner, collaborator, team scoping), instead of a second implementation that
 * would drift from it. Any other auth collection of the host app is refused
 * outright: the endpoint only ever spoke for staff and support-clients.
 */
async function mayAccessTicket(
  req: PayloadRequest,
  slugs: CollectionSlugs,
  ticketId: string,
): Promise<boolean> {
  const collection = (req.user as { collection?: string } | null)?.collection
  if (collection !== slugs.users && collection !== slugs.supportClients) return false
  try {
    const doc = await dbFindByID(req.payload, slugs.tickets, {
      id: ticketId,
      depth: 0,
      overrideAccess: false,
      user: req.user,
    })
    return !!doc
  } catch {
    // Forbidden or NotFound — same answer either way, so no existence oracle.
    return false
  }
}

/**
 * POST /api/support/typing — Signal that user is typing
 */
export function createTypingPostEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/typing',
    method: 'post',
    handler: async (req) => {
      try {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { ticketId } = (await req.json!()) as { ticketId?: unknown }
        const key = normalizeTicketId(ticketId)
        if (!key) {
          return Response.json({ error: 'ticketId required' }, { status: 400 })
        }

        if (!(await mayAccessTicket(req, slugs, key))) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        const state = typingState.get(key) || {}

        if (!typingState.has(key) && typingState.size >= MAX_TYPING_KEYS) {
          sweepExpired()
          if (typingState.size >= MAX_TYPING_KEYS) evictOldest()
        }

        if (req.user.collection === slugs.users) {
          state.admin = Date.now()
          state.adminName = (req.user as any).firstName || 'Support'
        } else {
          state.client = Date.now()
          state.clientName = (req.user as any).firstName || 'Client'
        }

        typingState.set(key, state)
        return Response.json({ ok: true })
      } catch {
        return Response.json({ error: 'Error' }, { status: 500 })
      }
    },
  }
}

/**
 * GET /api/support/typing?ticketId=123 — Check who is typing
 */
export function createTypingGetEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/typing',
    method: 'get',
    handler: async (req) => {
      const idle = { typing: false, name: null }
      try {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(req.url!)
        const key = normalizeTicketId(url.searchParams.get('ticketId'))
        if (!key) {
          return Response.json({ error: 'ticketId required' }, { status: 400 })
        }

        cleanExpired(key)
        const state = typingState.get(key)

        // Nothing to disclose: answer without touching the database. A caller
        // with no right to the ticket gets this exact body too, so "idle" and
        // "not yours" stay indistinguishable — and the 2s poll of every open
        // ticket page costs no query in the common case.
        if (!state) return Response.json(idle)

        // There IS a name to hand out (the agent's first name, historically
        // served to any authenticated caller for any ticket id) — check first.
        if (!(await mayAccessTicket(req, slugs, key))) return Response.json(idle)

        // Admin sees client typing, client sees admin typing
        if (req.user.collection === slugs.users) {
          return Response.json({
            typing: !!state.client,
            name: state.clientName || null,
          })
        } else {
          return Response.json({
            typing: !!state.admin,
            name: state.adminName || null,
          })
        }
      } catch {
        return Response.json(idle)
      }
    },
  }
}

/** Test seam — the module-level map must not leak state across test cases. */
export function __resetTypingStateForTests(): void {
  typingState.clear()
}

/** Test seam — the ceiling is the point of the fix, so it must be observable. */
export function __typingStateSizeForTests(): number {
  return typingState.size
}
