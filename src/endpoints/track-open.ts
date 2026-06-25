import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { createHmac } from 'crypto'
import { dbFindByID, dbUpdate, dbCreate } from '../utils/db'

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

/**
 * Generate an HMAC signature for tracking pixel URLs.
 * Use this when building tracking URLs in email templates.
 */
export function generateTrackingToken(ticketId: string, messageId: string, secret: string): string {
  return createHmac('sha256', secret).update(`${ticketId}:${messageId}`).digest('hex').substring(0, 16)
}

/**
 * GET /api/support/track-open?t=<ticketId>&m=<messageId>&sig=<hmac>
 * Tracking pixel for email open detection. No auth required.
 * Validates HMAC signature to prevent enumeration attacks.
 */
export function createTrackOpenEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/track-open',
    method: 'get',
    handler: async (req) => {
      const url = new URL(req.url!)
      const ticketId = url.searchParams.get('t')
      const messageId = url.searchParams.get('m')
      const sig = url.searchParams.get('sig')

      const parsedId = ticketId ? Number(ticketId) : NaN
      const parsedMsgId = messageId ? Number(messageId) : NaN

      // Open-tracking REQUIRES a valid HMAC signature. Without one we never
      // process (no DB writes) — this prevents enumeration/abuse of t/m params
      // and the silent "tracking writes without auth" hole.
      const secret = process.env.PAYLOAD_SECRET || ''
      const validSig =
        !!secret && !!ticketId && !!messageId && !!sig &&
        sig === generateTrackingToken(ticketId, messageId, secret)

      if (!validSig) {
        // Return transparent GIF silently (don't leak information, don't process)
        return new Response(TRANSPARENT_GIF, {
          status: 200,
          headers: {
            'Content-Type': 'image/gif',
            'Content-Length': String(TRANSPARENT_GIF.length),
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        })
      }

      if (ticketId && Number.isInteger(parsedId) && parsedId > 0) {
        try {
          const payload = req.payload

          const ticket = await dbFindByID(payload, slugs.tickets, {
            id: parsedId,
            depth: 0,
            overrideAccess: true,
            select: { lastClientReadAt: true },
          }) as any

          if (ticket) {
            const lastRead = ticket.lastClientReadAt ? new Date(ticket.lastClientReadAt).getTime() : 0
            const fiveMinAgo = Date.now() - 5 * 60 * 1000

            if (lastRead < fiveMinAgo) {
              await dbUpdate(payload, slugs.tickets, {
                id: parsedId,
                data: { lastClientReadAt: new Date().toISOString() },
                overrideAccess: true,
              })
            }
          }

          // Track at message level
          if (Number.isInteger(parsedMsgId) && parsedMsgId > 0) {
            const msg = await dbFindByID(payload, slugs.ticketMessages, {
              id: parsedMsgId,
              depth: 0,
              overrideAccess: true,
              select: { emailOpenedAt: true },
            }) as any

            if (msg && !msg.emailOpenedAt) {
              await dbUpdate(payload, slugs.ticketMessages, {
                id: parsedMsgId,
                data: { emailOpenedAt: new Date().toISOString() },
                overrideAccess: true,
              })

              const ticketInfo = await dbFindByID(payload, slugs.tickets, {
                id: parsedId,
                depth: 1,
                overrideAccess: true,
                select: { ticketNumber: true, subject: true, client: true },
              }) as any

              const clientName = typeof ticketInfo?.client === 'object'
                ? ticketInfo.client?.firstName || 'Client'
                : 'Client'

              // Try to create admin notification (collection may not exist)
              try {
                await dbCreate(payload, 'admin-notifications', {
                  data: {
                    title: `Email ouvert — ${ticketInfo?.ticketNumber || 'TK-????'}`,
                    message: `${clientName} a ouvert votre email pour "${ticketInfo?.subject || 'ticket'}"`,
                    type: 'email_opened',
                    link: `/admin/ticket?id=${parsedId}`,
                  },
                  overrideAccess: true,
                })
              } catch {
                // admin-notifications collection may not exist in the plugin
              }
            }
          }
        } catch (err) {
          console.error('[track-open] Error:', err)
        }
      }

      return new Response(TRANSPARENT_GIF, {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Content-Length': String(TRANSPARENT_GIF.length),
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
    },
  }
}
