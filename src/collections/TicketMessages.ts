import type { CollectionConfig, CollectionBeforeChangeHook, CollectionAfterChangeHook, Where } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { escapeHtml, emailWrapper, emailButton, emailQuote, emailParagraph, emailRichContent, emailTrackingPixel } from '../utils/emailTemplate'
import { fireWebhooks } from '../utils/fireWebhooks'
import { createAdminNotification } from '../utils/adminNotification'
import { dispatchWebhook } from '../utils/webhookDispatcher'
import { readSupportSettings } from '../utils/readSettings'
import { createCheckSlaOnReply } from '../hooks/checkSLA'
import { resolveAccessibleTicketIds } from '../utils/ticketAccess'
import { sanitizeMessageHtml } from '../utils/sanitizeHtml'
import { queueClientNotification } from '../utils/notificationQueue'
import { sendPushToUser } from '../utils/push'
import { dbFind, dbCreate, dbFindByID } from '../utils/db'

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
          // A fresh public reply starts a new waiting window: drop any pending
          // auto-close arming (manual deadline + day-based reminder anchor) so
          // reminders re-arm cleanly from here.
          updateData.autoCloseScheduledAt = null
          updateData.autoCloseRemindedAt = null
        } else if (doc.authorType === 'client' || doc.authorType === 'email') {
          updateData.lastClientMessageAt = new Date().toISOString()
          // The client answered — cancel any pending automatic closure.
          updateData.autoCloseScheduledAt = null
          updateData.autoCloseRemindedAt = null
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

      const settings = await readSupportSettings(req.payload)
      const ticketNumber = (ticket.ticketNumber as string) || 'TK-????'
      const subject = (ticket.subject as string) || 'Support'
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
      const supportEmail = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || ''
      const portalUrl = `${baseUrl}/support/tickets/${ticketId}`

      // Internal archive copy — this email goes TO the client, so any internal
      // address MUST be bcc (never cc): the client must not see internal
      // addresses, and an exposed internal cc/bcc reply chain leaks routing.
      // Use a dedicated archive mailbox via env, NOT support@/noreply@ — those
      // are filtered by the inbound-email anti-loop guard and would re-create a
      // ticket from the copy.
      const internalBcc = process.env.SUPPORT_CLIENT_BCC || undefined

      // Use rich HTML content if available, otherwise plain text preview
      const rawContent = doc.bodyHtml
        ? emailRichContent(doc.bodyHtml)
        : emailQuote(doc.body?.length > 500 ? doc.body.slice(0, 500) + '...' : doc.body)

      const replyPreview = (doc.body || '').replace(/\s+/g, ' ').trim().slice(0, 90)

      // Digest: clients on daily/weekly frequency are queued, not emailed now.
      const freq = (client as { notificationFrequency?: string }).notificationFrequency
      if (freq === 'daily' || freq === 'weekly') {
        await queueClientNotification(req.payload, slugs, {
          client: (client as { id: number | string }).id,
          type: 'reply',
          title: `Nouvelle reponse — ${ticketNumber}`,
          message: replyPreview || `Reponse a votre ticket ${ticketNumber}`,
          ticket: ticketId,
        })
        return doc
      }

      // Fire-and-forget: don't block the reply mutation on the SMTP round-trip
      // (200-500ms). The email + its emailSentAt bookkeeping run detached.
      void (async () => {
        try {
          await req.payload.sendEmail({
            to: client.email,
            ...(supportEmail ? { replyTo: supportEmail } : {}),
            ...(internalBcc ? { bcc: internalBcc } : {}),
            subject: `Re: [${ticketNumber}] ${subject}`,
            html: emailWrapper(`Nouvelle reponse — ${ticketNumber}`, [
              emailParagraph(`Bonjour <strong>${escapeHtml(client.firstName || '')}</strong>,`),
              emailParagraph(`Notre equipe a apporte une reponse a votre ticket <strong>${escapeHtml(ticketNumber)}</strong> — <em>${escapeHtml(subject)}</em>.`),
              rawContent,
              emailButton('Consulter le ticket', portalUrl),
              emailParagraph('<span style="font-size: 13px; color: #6b7280;">Vous pouvez egalement repondre directement a cet email. Votre message sera automatiquement ajoute au ticket.</span>'),
              emailTrackingPixel(ticketId, doc.id),
            ].join(''), {
              kind: 'reply',
              preheader: replyPreview ? `${replyPreview}…` : `Nouvelle reponse a votre ticket ${ticketNumber}`,
            }),
          })

          await req.payload.update({
            collection: slugs.ticketMessages,
            id: doc.id,
            data: { emailSentAt: new Date().toISOString(), emailSentTo: client.email },
            overrideAccess: true,
          })
        } catch (err) {
          console.error('[support] Failed to notify client (async):', err)
        }
      })()
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
      await dbCreate(payload, slugs.chatMessages, {
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
      const settings = await readSupportSettings(payload)
      const clientName = client?.firstName || 'Client'
      const clientEmail = client?.email || 'inconnu'
      const ticketNumber = ticket.ticketNumber || 'TK-????'
      const subject = ticket.subject || 'Support'
      const supportEmail = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || ''
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

      // Browser push to the assigned agent (RUNTIME no-op without VAPID keys).
      const assignedId = assignedAdmin?.id ?? (ticket.assignedTo && typeof ticket.assignedTo !== 'object' ? ticket.assignedTo : undefined)
      if (assignedId) {
        void sendPushToUser(payload, slugs, assignedId, {
          title: headerTitle,
          body: `${clientName}: ${preview || subject}`,
          url: `/admin/collections/${slugs.tickets}/${ticketId}`,
        }).catch(() => { /* best-effort */ })
      }

      if (primaryEmail) {
        await payload.sendEmail({
          // INTERNAL email (to the support team) — recipients are the contact
          // inbox + assigned agent. The cc here is internal→internal and stays
          // a cc on purpose. Do NOT confuse with the client reply email
          // (createNotifyClient), where internal copies must be bcc.
          to: primaryEmail,
          ...(ccEmail ? { cc: ccEmail } : {}),
          ...(clientEmail !== 'inconnu' ? { replyTo: clientEmail } : (supportEmail ? { replyTo: supportEmail } : {})),
          subject: `${isNewTicket ? 'Nouveau ticket' : 'Reponse client'} [${ticketNumber}] ${subject}`,
          html: emailWrapper(headerTitle, [
            emailParagraph(`<strong>${escapeHtml(clientName)}</strong> (${escapeHtml(clientEmail)}) a ${isNewTicket ? 'ouvert un nouveau ticket' : 'repondu au ticket'} <strong>${escapeHtml(ticketNumber)}</strong> :`),
            `<p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #374151;">Sujet : ${escapeHtml(subject)}</p>`,
            emailQuote(preview, isNewTicket ? '#1d2b4d' : '#17807c'),
            emailButton('Ouvrir dans l\'admin', adminUrl, 'dark'),
          ].join(''), { kind: 'system' }),
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

/**
 * Sanitize submitted rich HTML before persistence. `bodyHtml` is rendered via
 * dangerouslySetInnerHTML in the admin & portal, so unsanitized HTML is a
 * stored-XSS vector (→ admin session theft → cross-client access). Runs for
 * every writer (client AND admin) — neither needs to store scripts.
 */
function createSanitizeMessageHtml(): CollectionBeforeChangeHook {
  return ({ data }) => {
    if (data && typeof data.bodyHtml === 'string' && data.bodyHtml) {
      data.bodyHtml = sanitizeMessageHtml(data.bodyHtml)
    }
    return data
  }
}

// Matches `@someone@example.com` mentions inside a message body.
const MENTION_RE = /@([^\s@]+@[^\s@]+\.[^\s@]+)/g

/**
 * Resolve `@email` mentions in the message body to agent (users) IDs, stored on
 * the `mentions` field so the UI can highlight them and we can notify them.
 */
function createResolveMentions(slugs: CollectionSlugs): CollectionBeforeChangeHook {
  return async ({ data, operation, req }) => {
    if (operation !== 'create') return data
    const body = typeof data?.body === 'string' ? data.body : ''
    const emails = Array.from(new Set([...body.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase())))
    if (emails.length === 0) return data
    try {
      const users = await dbFind(req.payload, slugs.users, { where: { email: { in: emails } }, limit: 50, depth: 0, overrideAccess: true })
      const ids = users.docs.map((u) => (u as { id: number | string }).id)
      if (ids.length > 0) data.mentions = ids
    } catch { /* users lookup is best-effort */ }
    return data
  }
}

/** Email the agents mentioned in a freshly-created message. */
function createNotifyMentions(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc
    const mentions: Array<number | string | { id: number | string }> = Array.isArray(doc.mentions) ? doc.mentions : []
    if (mentions.length === 0) return doc
    const ticketId = typeof doc.ticket === 'object' ? doc.ticket.id : doc.ticket
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
    for (const m of mentions) {
      const userId = typeof m === 'object' ? m.id : m
      try {
        const user = await dbFindByID(req.payload, slugs.users, { id: userId, depth: 0, overrideAccess: true })
        if (!user?.email) continue
        await req.payload.sendEmail({
          to: user.email,
          subject: `Vous avez ete mentionne — ticket #${ticketId}`,
          html: emailWrapper('Mention', [
            emailParagraph(`Vous avez ete mentionne dans un message du ticket <strong>#${escapeHtml(String(ticketId))}</strong>.`),
            ...(baseUrl ? [emailButton('Ouvrir le ticket', `${baseUrl}/admin/collections/${slugs.tickets}/${ticketId}`, 'dark')] : []),
          ].join(''), { kind: 'system' }),
        })
      } catch (err) {
        console.error('[support] Failed to notify mention:', err)
      }
    }
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
      { name: 'ticket', type: 'relationship', relationTo: slugs.tickets, required: true, index: true, label: 'Ticket' },
      { name: 'body', type: 'textarea', required: true, label: 'Message' },
      { name: 'bodyHtml', type: 'textarea', label: 'Message HTML', admin: { hidden: true } },
      {
        type: 'row',
        fields: [
          {
            name: 'authorType', type: 'select', index: true, label: 'Type d\'auteur', defaultValue: 'admin',
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
      {
        name: 'fromAlias',
        type: 'text',
        label: 'Alias d\'expéditeur',
        admin: {
          description: 'Si défini, le message est envoyé au nom de cet alias plutôt que de l\'agent authentifié',
          position: 'sidebar',
        },
      },
      { name: 'isInternal', type: 'checkbox', defaultValue: false, label: 'Note interne', admin: { position: 'sidebar' } },
      { name: 'isSolution', type: 'checkbox', defaultValue: false, label: 'Reponse solution', admin: { position: 'sidebar' } },
      { name: 'mentions', type: 'relationship', relationTo: slugs.users, hasMany: true, label: 'Agents mentionnes', admin: { hidden: true } },
      { name: 'skipNotification', type: 'checkbox', defaultValue: false, label: 'Sans notification', admin: { position: 'sidebar', condition: (data) => data?.skipNotification === true } },
      { name: 'scheduledAt', type: 'date', index: true, label: 'Programme pour', admin: { date: { pickerAppearance: 'dayAndTime' }, position: 'sidebar', condition: (data) => !!data?.scheduledAt } },
      { name: 'scheduledSent', type: 'checkbox', defaultValue: false, admin: { hidden: true } },
      { name: 'editedAt', type: 'date', label: 'Modifie le', admin: { hidden: true } },
      { name: 'deletedAt', type: 'date', label: 'Supprime le', admin: { hidden: true } },
      { name: 'emailSentAt', type: 'date', label: 'Email envoye le', admin: { hidden: true } },
      { name: 'emailSentTo', type: 'text', label: 'Email envoye a', admin: { hidden: true } },
      { name: 'emailOpenedAt', type: 'date', label: 'Email ouvert le', admin: { hidden: true } },
    ],
    hooks: {
      beforeChange: [createSanitizeMessageHtml(), createResolveMentions(slugs), createAssignAuthor(slugs)],
      afterChange: [
        createAutoUpdateStatus(slugs),
        createNotifyClient(slugs),
        createTrackFirstResponse(slugs),
        createCheckSlaOnReply(slugs, notificationSlug),
        createSyncTicketReplyToChat(slugs),
        createNotifyAdminOnClientMessage(slugs, notificationSlug),
        createFireMessageWebhooks(slugs),
        createDispatchWebhookOnReply(slugs),
        createNotifyMentions(slugs),
      ],
    },
    access: {
      create: ({ req }) => req.user?.collection === slugs.users || req.user?.collection === slugs.supportClients,
      read: async ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) {
          // Constrain to tickets the client owns or collaborates on, then filter
          // messages by `ticket IN (...)`. We do NOT use a nested relationship
          // filter ('ticket.client') as the security boundary — its behaviour
          // through the SQLite adapter is not guaranteed. Empty set → sentinel
          // id so the IN matches nothing (fail closed).
          const ids = await resolveAccessibleTicketIds(req.payload, slugs, req.user.id)
          return {
            and: [
              { ticket: { in: ids.length > 0 ? ids : [-1] } } as Where,
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
