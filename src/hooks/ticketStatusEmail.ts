import type { CollectionAfterChangeHook } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { emailWrapper, emailButton, emailParagraph, escapeHtml } from '../utils/emailTemplate'

/**
 * Status labels in French — maps status value to display label
 */
const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert',
  waiting_client: 'En attente client',
  resolved: 'Resolu',
}

/**
 * Resolve the client's email and first name from the ticket's `client` relationship.
 * Returns null if the client cannot be resolved or has no email.
 */
async function resolveClient(
  doc: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: { findByID: (args: any) => Promise<any> },
  clientSlug: string,
): Promise<{ email: string; firstName: string; notifyOnStatusChange: boolean } | null> {
  const client = doc.client as Record<string, unknown> | number | null | undefined

  if (!client) return null

  // If client is already populated (object with email)
  if (typeof client === 'object' && client !== null && typeof client.email === 'string') {
    return {
      email: client.email,
      firstName: (client.firstName as string) || '',
      notifyOnStatusChange: client.notifyOnStatusChange !== false,
    }
  }

  // If client is an ID, fetch it
  const clientId = typeof client === 'number' ? client : (client as Record<string, unknown>)?.id
  if (!clientId) return null

  try {
    const clientData = await payload.findByID({
      collection: clientSlug,
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })
    if (!clientData?.email) return null
    return {
      email: clientData.email,
      firstName: clientData.firstName || '',
      notifyOnStatusChange: clientData.notifyOnStatusChange !== false,
    }
  } catch {
    return null
  }
}

/**
 * Factory: Send email notification to the client when a ticket is created
 * or when its status changes to `waiting_client`.
 *
 * Note: Resolved notifications are handled by the existing
 * `notifyClientOnResolve` hook, so this hook skips those transitions.
 */
export function createTicketStatusEmail(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    const { payload } = req
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
    const supportEmail = process.env.SUPPORT_EMAIL || ''

    // --- Ticket creation: send confirmation email ---
    if (operation === 'create') {
      try {
        const client = await resolveClient(doc, payload, slugs.supportClients)
        if (!client?.email) return doc

        const ticketNumber = doc.ticketNumber || 'TK-????'
        const subject = doc.subject || 'Support'
        const ticketUrl = `${baseUrl}/support/tickets/${doc.id}`

        await payload.sendEmail({
          to: client.email,
          ...(supportEmail ? { replyTo: supportEmail } : {}),
          subject: `[${ticketNumber}] Demande enregistree — ${subject}`,
          html: emailWrapper(`Votre demande a ete enregistree`, [
            emailParagraph(`Bonjour <strong>${escapeHtml(client.firstName)}</strong>,`),
            emailParagraph(`Nous avons bien recu votre demande de support. Voici les details :`),
            `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">N&deg; Ticket</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;"><strong>${escapeHtml(String(ticketNumber))}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">Sujet</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;">${escapeHtml(String(subject))}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">Statut</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;">${STATUS_LABELS[doc.status] || doc.status}</td>
              </tr>
            </table>`,
            emailParagraph('Notre equipe vous repondra dans les meilleurs delais.'),
            emailButton('Consulter le ticket', ticketUrl),
          ].join('')),
        })

        payload.logger.info(`[tickets] Creation notification sent to ${client.email} for ${ticketNumber}`)
      } catch (error) {
        payload.logger.error(`[tickets] Failed to send creation email: ${error}`)
      }

      return doc
    }

    // --- Status change on update ---
    if (operation === 'update' && previousDoc?.status !== doc.status) {
      // Skip resolved — handled by notifyClientOnResolve hook
      if (doc.status === 'resolved') return doc

      try {
        const client = await resolveClient(doc, payload, slugs.supportClients)
        if (!client?.email) return doc

        // Respect client notification preferences
        if (!client.notifyOnStatusChange) return doc

        const ticketNumber = doc.ticketNumber || 'TK-????'
        const subject = doc.subject || 'Support'
        const statusLabel = STATUS_LABELS[doc.status] || doc.status
        const previousStatusLabel = STATUS_LABELS[previousDoc?.status] || previousDoc?.status || 'N/A'
        const ticketUrl = `${baseUrl}/support/tickets/${doc.id}`

        // Contextual message based on new status
        let contextMessage = ''
        if (doc.status === 'waiting_client') {
          contextMessage = emailParagraph(
            'Nous avons besoin d\'informations supplementaires de votre part pour continuer le traitement de votre demande. Merci de consulter le ticket et de nous repondre.',
          )
        }

        await payload.sendEmail({
          to: client.email,
          ...(supportEmail ? { replyTo: supportEmail } : {}),
          subject: `[${ticketNumber}] Statut mis a jour : ${statusLabel}`,
          html: emailWrapper(`Mise a jour de votre ticket`, [
            emailParagraph(`Bonjour <strong>${escapeHtml(client.firstName)}</strong>,`),
            emailParagraph(`Le statut de votre ticket a ete mis a jour :`),
            `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">N&deg; Ticket</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;"><strong>${escapeHtml(String(ticketNumber))}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">Sujet</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;">${escapeHtml(String(subject))}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">Ancien statut</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;">${escapeHtml(String(previousStatusLabel))}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">Nouveau statut</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;"><strong>${escapeHtml(String(statusLabel))}</strong></td>
              </tr>
            </table>`,
            contextMessage,
            emailButton('Consulter le ticket', ticketUrl),
          ].join('')),
        })

        payload.logger.info(`[tickets] Status change notification sent to ${client.email} for ${ticketNumber} (${previousDoc?.status} -> ${doc.status})`)
      } catch (error) {
        payload.logger.error(`[tickets] Failed to send status change email: ${error}`)
      }
    }

    return doc
  }
}
