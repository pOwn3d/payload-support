import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

/**
 * GET /api/support/track-open?t=<ticketId>&m=<messageId>
 * Tracking pixel for email open detection. No auth required.
 */
export function createTrackOpenEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/track-open',
    method: 'get',
    handler: async (req) => {
      const url = new URL(req.url!)
      const ticketId = url.searchParams.get('t')
      const messageId = url.searchParams.get('m')

      const parsedId = ticketId ? Number(ticketId) : NaN
      const parsedMsgId = messageId ? Number(messageId) : NaN

      if (ticketId && Number.isInteger(parsedId) && parsedId > 0) {
        try {
          const payload = req.payload

          const ticket = await payload.findByID({
            collection: slugs.tickets as any,
            id: parsedId,
            depth: 0,
            overrideAccess: true,
            select: { lastClientReadAt: true },
          }) as any

          if (ticket) {
            const lastRead = ticket.lastClientReadAt ? new Date(ticket.lastClientReadAt).getTime() : 0
            const fiveMinAgo = Date.now() - 5 * 60 * 1000

            if (lastRead < fiveMinAgo) {
              await payload.update({
                collection: slugs.tickets as any,
                id: parsedId,
                data: { lastClientReadAt: new Date().toISOString() },
                overrideAccess: true,
              })
            }
          }

          // Track at message level
          if (Number.isInteger(parsedMsgId) && parsedMsgId > 0) {
            const msg = await payload.findByID({
              collection: slugs.ticketMessages as any,
              id: parsedMsgId,
              depth: 0,
              overrideAccess: true,
              select: { emailOpenedAt: true },
            }) as any

            if (msg && !msg.emailOpenedAt) {
              await payload.update({
                collection: slugs.ticketMessages as any,
                id: parsedMsgId,
                data: { emailOpenedAt: new Date().toISOString() },
                overrideAccess: true,
              })

              const ticketInfo = await payload.findByID({
                collection: slugs.tickets as any,
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
                await payload.create({
                  collection: 'admin-notifications' as any,
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
