import type { CollectionConfig, CollectionBeforeChangeHook, CollectionAfterChangeHook, Where } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { escapeHtml, emailWrapper, emailButton, emailQuote, emailParagraph, emailRichContent, emailTrackingPixel } from '../utils/emailTemplate'
import { fireWebhooks } from '../utils/fireWebhooks'
import { createAdminNotification } from '../utils/adminNotification'
import { dispatchWebhook } from '../utils/webhookDispatcher'
import { createCheckSlaOnReply } from '../hooks/checkSLA'

function createAssignAuthor(slugs: CollectionSlugs): CollectionBeforeChangeHook {
  return async ({ data, operation, req }) => {
    if (operation === 'create' && req.user?.collection === slugs.supportClients) {
      data.authorType = 'client'
      data.authorClient = req.user.id
      data.isInternal = false
    }
    return data
  }
}

function createAutoUpdateStatus(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc
    if (doc.scheduledAt && !doc.scheduledSent) return doc
    try {
      const ticketId = typeof doc.ticket === 'object' ? doc.ticket.id : doc.ticket
      const ticket = await req.payload.findByID({ collection: slugs.tickets, id: ticketId, depth: 0, overrideAccess: true })
      if (!ticket) return doc
      const updateData: Record<string, unknown> = {}
      if (!doc.isInternal) {
        if (doc.authorType === 'admin') {
          updateData.status = 'waiting_client'
        } else if (doc.authorType === 'client' || doc.authorType === 'email') {
          updateData.lastClientMessageAt = new Date().toISOString()
          if (ticket.status && ['waiting_client', 'resolved'].includes(ticket.status as string)) {
            updateData.status = 'open'
          }
        }
      }
      await req.payload.update({ collection: slugs.tickets, id: ticketId, data: updateData, overrideAccess: true })
    } catch (err) {
      console.error('[support] Failed to auto-update ticket status:', err)
    }
    return doc
  }
}

function createNotifyClient(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc
    if (doc.authorType !== 'admin' || doc.isInternal || doc.skipNotification) return doc
    if (doc.scheduledAt && !doc.scheduledSent) return doc
    try {
      const ticketId = typeof doc.ticket === 'object' ? doc.ticket.id : doc.ticket
      const ticket = await req.payload.findByID({ collection: slugs.tickets, id: ticketId, depth: 1, overrideAccess: true })
      if (!ticket) return doc
      const client = typeof ticket.client === 'object' ? ticket.client : null
      if (!client?.email) return doc

      // Respect client notification preferences
      if (client.notifyOnReply === false) return doc

      const ticketNumber = (ticket.ticketNumber as string) || 'TK-????'
      const subject = (ticket.subject as string) || 'Support'
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
      const supportEmail = process.env.SUPPORT_EMAIL || ''
      const portalUrl = `${baseUrl}/support/tickets/${ticketId}`

      // Use rich HTML content if available, otherwise plain text preview
      const rawContent = doc.bodyHtml
        ? emailRichContent(doc.bodyHtml)
        : emailQuote(doc.body?.length > 500 ? doc.body.slice(0, 500) + '...' : doc.body)

      await req.payload.sendEmail({
        to: client.email,
        ...(supportEmail ? { replyTo: supportEmail } : {}),
        subject: `Re: [${ticketNumber}] ${subject}`,
        html: emailWrapper(`Nouvelle reponse — ${ticketNumber}`, [
          emailParagraph(`Bonjour <strong>${escapeHtml(client.firstName || '')}</strong>,`),
          emailParagraph(`Notre equipe a apporte une reponse a votre ticket <strong>${escapeHtml(ticketNumber)}</strong> — <em>${escapeHtml(subject)}</em>.`),
          rawContent,
          emailButton('Consulter le ticket', portalUrl),
          emailParagraph('<span style="font-size: 13px; color: #6b7280;">Vous pouvez egalement repondre directement a cet email. Votre message sera automatiquement ajoute au ticket.</span>'),
          emailTrackingPixel(ticketId, doc.id),
        ].join('')),
      })

      await req.payload.update({
        collection: slugs.ticketMessages,
        id: doc.id,
        data: { emailSentAt: new Date().toISOString(), emailSentTo: client.email },
        overrideAccess: true,
      })
    } catch (err) {
      console.error('[support] Failed to notify client:', err)
    }
    return doc
  }
}

function createTrackFirstResponse(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create' || doc.authorType !== 'admin' || doc.isInternal) return doc
    try {
      const ticketId = typeof doc.ticket === 'object' ? doc.ticket.id : doc.ticket
      const ticket = await req.payload.findByID({ collection: slugs.tickets, id: ticketId, depth: 0, overrideAccess: true })
      if (ticket && !ticket.firstResponseAt) {
        await req.payload.update({ collection: slugs.tickets, id: ticketId, data: { firstResponseAt: new Date().toISOString() }, overrideAccess: true })
      }
    } catch (err) {
      console.error('[support] Failed to track first response:', err)
    }
    return doc
  }
}

function createSyncTicketReplyToChat(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc
    if (doc.authorType !== 'admin' || doc.isInternal) return doc

    try {
      const { payload } = req
      const ticketId = typeof doc.ticket === 'object' ? doc.ticket.id : doc.ticket

      const ticket = await payload.findByID({
        collection: slugs.tickets,
        id: ticketId,
        depth: 0,
        overrideAccess: true,
      })

      if (!ticket?.chatSession) return doc

      // Check if this message was already synced from admin-chat (skipNotification = true means it came from chat)
      if (doc.skipNotification) return doc

      const clientId = typeof ticket.client === 'object' ? (ticket.client as { id: number | string }).id : ticket.client

      // Create a chat message so the client sees it in the widget
      await payload.create({
        collection: slugs.chatMessages as any,
        data: {
          session: ticket.chatSession,
          client: clientId,
          senderType: 'agent',
          message: doc.body,
          status: 'active',
          ticket: ticketId,
        },
        overrideAccess: true,
      })
    } catch (err) {
      console.error('[support] Failed to sync reply to chat:', err)
    }

    return doc
  }
}

function createNotifyAdminOnClientMessage(slugs: CollectionSlugs, notificationSlug: string): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc
    if (doc.authorType !== 'client' && doc.authorType !== 'email') return doc
    if (doc.skipNotification) return doc

    try {
      const { payload } = req
      const ticketId = typeof doc.ticket === 'object' ? doc.ticket.id : doc.ticket

      const ticket = await payload.findByID({
        collection: slugs.tickets,
        id: ticketId,
        depth: 1,
        overrideAccess: true,
      })

      if (!ticket) return doc

      const client = typeof ticket.client === 'object' ? ticket.client : null
      const clientName = client?.firstName || 'Client'
      const clientEmail = client?.email || 'inconnu'
      const ticketNumber = ticket.ticketNumber || 'TK-????'
      const subject = ticket.subject || 'Support'
      const supportEmail = process.env.SUPPORT_EMAIL || ''
      const contactEmail = process.env.CONTACT_EMAIL || supportEmail
      const assignedAdmin = typeof ticket.assignedTo === 'object' ? ticket.assignedTo : null
      const assignedEmail = assignedAdmin?.email
      const primaryEmail = contactEmail
      const ccEmail = assignedEmail && assignedEmail !== contactEmail ? assignedEmail : undefined
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
      const adminUrl = `${baseUrl}/admin/collections/${slugs.tickets}/${ticketId}`

      // Check if this is the first message (new ticket) or a follow-up
      const messageCount = await payload.count({
        collection: slugs.ticketMessages,
        where: { ticket: { equals: ticketId } },
        overrideAccess: true,
      })
      const isNewTicket = messageCount.totalDocs <= 1

      // Create admin notification for client replies (new tickets already handled by notifyAdminOnNewTicket)
      if (!isNewTicket) {
        await createAdminNotification(payload, {
          title: `Reponse client — ${ticketNumber}`,
          message: `${clientName} a repondu au ticket ${ticketNumber}`,
          type: 'client_message',
          link: `/admin/collections/${slugs.tickets}/${ticketId}`,
        }, notificationSlug)
      }

      const preview = doc.body?.length > 500 ? doc.body.slice(0, 500) + '...' : doc.body
      const headerTitle = isNewTicket ? `Nouveau ticket ${ticketNumber}` : `Nouveau message — ${ticketNumber}`

      if (primaryEmail) {
        await payload.sendEmail({
          to: primaryEmail,
          ...(ccEmail ? { cc: ccEmail } : {}),
          ...(clientEmail !== 'inconnu' ? { replyTo: clientEmail } : (supportEmail ? { replyTo: supportEmail } : {})),
          subject: `${isNewTicket ? 'Nouveau ticket' : 'Reponse client'} [${ticketNumber}] ${subject}`,
          html: emailWrapper(headerTitle, [
            emailParagraph(`<strong>${escapeHtml(clientName)}</strong> (${escapeHtml(clientEmail)}) a ${isNewTicket ? 'ouvert un nouveau ticket' : 'repondu au ticket'} <strong>${escapeHtml(ticketNumber)}</strong> :`),
            `<p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #374151;">Sujet : ${escapeHtml(subject)}</p>`,
            emailQuote(preview, isNewTicket ? '#FFD600' : '#00E5FF'),
            emailButton('Ouvrir dans l\'admin', adminUrl, 'dark'),
          ].join(''), { headerColor: isNewTicket ? 'secondary' : 'primary' }),
        })
      }

      console.log(`[support] Admin notified for ${ticketNumber} (${isNewTicket ? 'new' : 'reply'})`)
    } catch (err) {
      console.error('[support] Failed to notify admin on client message:', err)
    }

    return doc
  }
}

function createFireMessageWebhooks(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc
    // Don't fire for scheduled messages that haven't been sent yet
    if (doc.scheduledAt && !doc.scheduledSent) return doc
    // Don't fire for internal notes
    if (doc.isInternal) return doc

    const ticketId = typeof doc.ticket === 'object' ? doc.ticket.id : doc.ticket
    fireWebhooks(req.payload, slugs, 'ticket_replied', {
      ticketId,
      messageId: doc.id,
      authorType: doc.authorType,
      body: doc.body?.length > 500 ? doc.body.slice(0, 500) + '...' : doc.body,
    })

    return doc
  }
}

function createDispatchWebhookOnReply(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc
    if (doc.isInternal) return doc
    if (doc.scheduledAt && !doc.scheduledSent) return doc

    const ticketId = typeof doc.ticket === 'object' ? doc.ticket.id : doc.ticket
    dispatchWebhook(
      { ticketId, messageId: doc.id, authorType: doc.authorType },
      'ticket_replied',
      req.payload,
      slugs,
    )

    return doc
  }
}

export function createTicketMessagesCollection(slugs: CollectionSlugs, options?: {
  notificationSlug?: string
}): CollectionConfig {
  const notificationSlug = options?.notificationSlug || 'admin-notifications'

  return {
    slug: slugs.ticketMessages,
    labels: { singular: 'Message', plural: 'Messages' },
    admin: { hidden: true, group: 'Support', defaultColumns: ['ticket', 'authorType', 'createdAt'] },
    fields: [
      { name: 'ticket', type: 'relationship', relationTo: slugs.tickets, required: true, label: 'Ticket' },
      { name: 'body', type: 'textarea', required: true, label: 'Message' },
      { name: 'bodyHtml', type: 'textarea', label: 'Message HTML', admin: { hidden: true } },
      {
        type: 'row',
        fields: [
          {
            name: 'authorType', type: 'select', label: 'Type d\'auteur', defaultValue: 'admin',
            options: [
              { label: 'Client', value: 'client' },
              { label: 'Support', value: 'admin' },
              { label: 'Email entrant', value: 'email' },
            ],
            admin: { width: '50%' },
          },
          {
            name: 'authorClient', type: 'relationship', relationTo: slugs.supportClients, label: 'Auteur (client)',
            admin: { width: '50%', condition: (data) => data?.authorType === 'client' || data?.authorType === 'email' },
          },
        ],
      },
      {
        name: 'attachments', type: 'array', label: 'Pieces jointes',
        fields: [{ name: 'file', type: 'upload', relationTo: slugs.media, required: true, label: 'Fichier' }],
      },
      { name: 'isInternal', type: 'checkbox', defaultValue: false, label: 'Note interne', admin: { position: 'sidebar' } },
      { name: 'isSolution', type: 'checkbox', defaultValue: false, label: 'Reponse solution', admin: { position: 'sidebar' } },
      { name: 'skipNotification', type: 'checkbox', defaultValue: false, label: 'Sans notification', admin: { position: 'sidebar', condition: (data) => data?.skipNotification === true } },
      { name: 'scheduledAt', type: 'date', label: 'Programme pour', admin: { date: { pickerAppearance: 'dayAndTime' }, position: 'sidebar', condition: (data) => !!data?.scheduledAt } },
      { name: 'scheduledSent', type: 'checkbox', defaultValue: false, admin: { hidden: true } },
      { name: 'editedAt', type: 'date', label: 'Modifie le', admin: { hidden: true } },
      { name: 'deletedAt', type: 'date', label: 'Supprime le', admin: { hidden: true } },
      { name: 'emailSentAt', type: 'date', label: 'Email envoye le', admin: { hidden: true } },
      { name: 'emailSentTo', type: 'text', label: 'Email envoye a', admin: { hidden: true } },
      { name: 'emailOpenedAt', type: 'date', label: 'Email ouvert le', admin: { hidden: true } },
    ],
    hooks: {
      beforeChange: [createAssignAuthor(slugs)],
      afterChange: [
        createAutoUpdateStatus(slugs),
        createNotifyClient(slugs),
        createTrackFirstResponse(slugs),
        createCheckSlaOnReply(slugs, notificationSlug),
        createSyncTicketReplyToChat(slugs),
        createNotifyAdminOnClientMessage(slugs, notificationSlug),
        createFireMessageWebhooks(slugs),
        createDispatchWebhookOnReply(slugs),
      ],
    },
    access: {
      create: ({ req }) => req.user?.collection === slugs.users || req.user?.collection === slugs.supportClients,
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) {
          return {
            and: [
              { 'ticket.client': { equals: req.user.id } } as Where,
              { isInternal: { equals: false } } as Where,
              { or: [{ scheduledAt: { exists: false } } as Where, { scheduledSent: { equals: true } } as Where] } as Where,
            ],
          }
        }
        return false
      },
      update: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) {
          return { and: [{ authorClient: { equals: req.user.id } } as Where, { authorType: { equals: 'client' } } as Where] }
        }
        return false
      },
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    timestamps: true,
  }
}
