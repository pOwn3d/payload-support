import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { escapeHtml } from '../utils/emailTemplate'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { readSupportSettings } from '../utils/readSettings'

/**
 * POST /api/support/pending-emails/:id/process
 * Admin-only endpoint to process a pending email.
 */
export function createPendingEmailsProcessEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/pending-emails/:id/process',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const id = req.routeParams?.id as string
        const body = await req.json!()
        const { action, ticketId, clientId: overrideClientId } = body as {
          action: string
          ticketId?: number
          clientId?: number
        }

        if (!['create_ticket', 'add_to_ticket', 'ignore'].includes(action)) {
          return Response.json({ error: 'Invalid action' }, { status: 400 })
        }

        const pendingEmail = await payload.findByID({
          collection: slugs.pendingEmails as any,
          id: Number(id),
          depth: 1,
          overrideAccess: true,
        }) as any

        if (!pendingEmail) {
          return Response.json({ error: 'Pending email not found' }, { status: 404 })
        }

        if (pendingEmail.status !== 'pending') {
          return Response.json({ error: 'Email already processed' }, { status: 409 })
        }

        let clientId = overrideClientId || (typeof pendingEmail.client === 'object' ? pendingEmail.client?.id : pendingEmail.client)
        let clientDoc = typeof pendingEmail.client === 'object' ? pendingEmail.client : null

        if (overrideClientId && overrideClientId !== clientDoc?.id) {
          clientDoc = await payload.findByID({
            collection: slugs.supportClients as any,
            id: overrideClientId,
            depth: 0,
            overrideAccess: true,
          })

          await payload.update({
            collection: slugs.pendingEmails as any,
            id: Number(id),
            data: { client: overrideClientId },
            overrideAccess: true,
          })
        }

        const settings = await readSupportSettings(payload)
        const clientEmail = clientDoc?.email || pendingEmail.senderEmail || ''
        const clientName = clientDoc?.firstName || pendingEmail.senderName || clientEmail
        const portalUrl = `${process.env.NEXT_PUBLIC_SERVER_URL || ''}/support/dashboard`

        if (!clientId && action !== 'ignore') {
          return Response.json({ error: 'No client associated with this pending email' }, { status: 400 })
        }

        const attachments = (pendingEmail.attachments as Array<{ file: { id: number } | number }> | undefined)?.map((a: any) => ({
          file: typeof a.file === 'object' ? a.file.id : a.file,
        })) || []

        if (action === 'ignore') {
          await payload.update({
            collection: slugs.pendingEmails as any,
            id: Number(id),
            data: {
              status: 'ignored',
              processedAction: 'ignored',
              processedAt: new Date().toISOString(),
            },
            overrideAccess: true,
          })
          return Response.json({ action: 'ignored', pendingEmailId: Number(id) })
        }

        if (action === 'create_ticket') {
          const newTicket = await payload.create({
            collection: slugs.tickets as any,
            data: {
              subject: pendingEmail.subject,
              client: clientId!,
              status: 'open',
              priority: 'normal',
              category: 'question',
              source: 'email',
            },
            overrideAccess: true,
          }) as any

          await payload.create({
            collection: slugs.ticketMessages as any,
            data: {
              ticket: newTicket.id,
              body: pendingEmail.body,
              authorType: 'email',
              authorClient: clientId,
              isInternal: false,
              ...(attachments.length > 0 && { attachments }),
            },
            overrideAccess: true,
          })

          // Send confirmation email
          try {
            await payload.sendEmail({
              to: clientEmail,
              replyTo: settings.email.replyToAddress || process.env.SUPPORT_REPLY_TO || '',
              subject: `[${newTicket.ticketNumber}] ${pendingEmail.subject}`,
              html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                <p>Bonjour <strong>${escapeHtml(clientName)}</strong>,</p>
                <p>Votre demande a été enregistrée sous le numéro <strong>${newTicket.ticketNumber}</strong>.</p>
                <p>Sujet : ${escapeHtml(pendingEmail.subject)}</p>
                <p><a href="${portalUrl}">Accéder à mon espace</a></p>
                <p style="font-size: 14px; color: #666;">Vous pouvez aussi répondre directement à cet email.</p>
              </div>`,
            })
          } catch (err) {
            console.error('[pending-email-process] Failed to send notification:', err)
          }

          await payload.update({
            collection: slugs.pendingEmails as any,
            id: Number(id),
            data: {
              status: 'processed',
              processedAction: 'ticket_created',
              processedTicket: newTicket.id,
              processedAt: new Date().toISOString(),
            },
            overrideAccess: true,
          })

          return Response.json({
            action: 'ticket_created',
            ticketNumber: newTicket.ticketNumber,
            ticketId: newTicket.id,
          })
        }

        if (action === 'add_to_ticket') {
          if (!ticketId) {
            return Response.json({ error: 'ticketId is required for add_to_ticket' }, { status: 400 })
          }

          const targetTicket = await payload.findByID({
            collection: slugs.tickets as any,
            id: ticketId,
            depth: 0,
            overrideAccess: true,
          }) as any

          if (!targetTicket) {
            return Response.json({ error: 'Target ticket not found' }, { status: 404 })
          }

          await payload.create({
            collection: slugs.ticketMessages as any,
            data: {
              ticket: ticketId,
              body: pendingEmail.body,
              authorType: 'email',
              authorClient: clientId,
              isInternal: false,
              ...(attachments.length > 0 && { attachments }),
            },
            overrideAccess: true,
          })

          if (targetTicket.status === 'resolved') {
            await payload.update({
              collection: slugs.tickets as any,
              id: ticketId,
              data: { status: 'open' },
              overrideAccess: true,
            })
          }

          await payload.update({
            collection: slugs.pendingEmails as any,
            id: Number(id),
            data: {
              status: 'processed',
              processedAction: 'message_added',
              processedTicket: ticketId,
              processedAt: new Date().toISOString(),
            },
            overrideAccess: true,
          })

          return Response.json({
            action: 'message_added',
            ticketNumber: targetTicket.ticketNumber,
            ticketId: targetTicket.id,
          })
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[pending-email-process] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
