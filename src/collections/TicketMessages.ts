import type { CollectionConfig, CollectionBeforeChangeHook, CollectionAfterChangeHook, Where } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { escapeHtml } from '../utils/emailTemplate'
import { fireWebhooks } from '../utils/fireWebhooks'

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
      const ticketNumber = (ticket.ticketNumber as string) || 'TK-????'
      const subject = (ticket.subject as string) || 'Support'
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
      const preview = doc.body?.length > 500 ? doc.body.slice(0, 500) + '...' : doc.body
      await req.payload.sendEmail({
        to: client.email,
        subject: `Re: [${ticketNumber}] ${subject}`,
        html: `<p>Bonjour ${escapeHtml(client.firstName || '')},</p><p>Notre équipe a répondu à votre ticket <strong>${escapeHtml(ticketNumber)}</strong>.</p><blockquote style="border-left:4px solid #2563eb;padding:12px;margin:16px 0;background:#f8fafc;">${escapeHtml(preview)}</blockquote><p><a href="${baseUrl}/support/tickets/${ticketId}">Consulter le ticket</a></p>`,
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

export function createTicketMessagesCollection(slugs: CollectionSlugs): CollectionConfig {
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
        name: 'attachments', type: 'array', label: 'Pièces jointes',
        fields: [{ name: 'file', type: 'upload', relationTo: slugs.media, required: true, label: 'Fichier' }],
      },
      { name: 'isInternal', type: 'checkbox', defaultValue: false, label: 'Note interne', admin: { position: 'sidebar' } },
      { name: 'isSolution', type: 'checkbox', defaultValue: false, label: 'Réponse solution', admin: { position: 'sidebar' } },
      { name: 'skipNotification', type: 'checkbox', defaultValue: false, label: 'Sans notification', admin: { position: 'sidebar', condition: (data) => data?.skipNotification === true } },
      { name: 'scheduledAt', type: 'date', label: 'Programmé pour', admin: { date: { pickerAppearance: 'dayAndTime' }, position: 'sidebar', condition: (data) => !!data?.scheduledAt } },
      { name: 'scheduledSent', type: 'checkbox', defaultValue: false, admin: { hidden: true } },
      { name: 'editedAt', type: 'date', label: 'Modifié le', admin: { hidden: true } },
      { name: 'deletedAt', type: 'date', label: 'Supprimé le', admin: { hidden: true } },
      { name: 'emailSentAt', type: 'date', label: 'Email envoyé le', admin: { hidden: true } },
      { name: 'emailSentTo', type: 'text', label: 'Email envoyé à', admin: { hidden: true } },
      { name: 'emailOpenedAt', type: 'date', label: 'Email ouvert le', admin: { hidden: true } },
    ],
    hooks: {
      beforeChange: [createAssignAuthor(slugs)],
      afterChange: [createAutoUpdateStatus(slugs), createNotifyClient(slugs), createTrackFirstResponse(slugs), createFireMessageWebhooks(slugs)],
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
