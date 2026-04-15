import type {
  CollectionConfig,
  CollectionBeforeChangeHook,
  CollectionAfterChangeHook,
  CollectionBeforeDeleteHook,
  Field,
} from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { escapeHtml } from '../utils/emailTemplate'
import { fireWebhooks } from '../utils/fireWebhooks'
import { createAdminNotification } from '../utils/adminNotification'
import { dispatchWebhook } from '../utils/webhookDispatcher'
import { readSupportSettings } from '../utils/readSettings'
import { createTicketStatusEmail } from '../hooks/ticketStatusEmail'
import { createAssignSlaDeadlines, createCheckSlaOnResolve } from '../hooks/checkSLA'

// ─── Hooks ───────────────────────────────────────────────

function createAssignTicketNumber(slugs: CollectionSlugs): CollectionBeforeChangeHook {
  return async ({ data, operation, req }) => {
    if (operation === 'create') {
      // Retry loop to handle unique constraint collisions (e.g. concurrent inserts in SQLite).
      let retries = 3
      while (retries > 0) {
        try {
          const countResult = await req.payload.count({
            collection: slugs.tickets,
            overrideAccess: true,
          })
          const baseNumber = countResult.totalDocs + 1
          data.ticketNumber = `TK-${String(baseNumber).padStart(4, '0')}`

          // Double-check: if this number already exists, append a timestamp suffix
          const existing = await req.payload.find({
            collection: slugs.tickets,
            where: { ticketNumber: { equals: data.ticketNumber } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          if (existing.docs.length > 0) {
            const suffix = Date.now() % 10000
            data.ticketNumber = `TK-${String(baseNumber + suffix).padStart(4, '0')}`
          }
          break
        } catch (error: any) {
          if (
            retries > 1 &&
            (error?.message?.includes('UNIQUE') ||
              error?.message?.includes('unique') ||
              error?.code === 'SQLITE_CONSTRAINT')
          ) {
            retries--
            continue
          }
          throw error
        }
      }
    }
    return data
  }
}

function createAssignClientOnCreate(slugs: CollectionSlugs): CollectionBeforeChangeHook {
  return async ({ data, operation, req }) => {
    if (operation === 'create' && req.user?.collection === slugs.supportClients && !data.client) {
      data.client = req.user.id
    }
    return data
  }
}

const autoPaidAt: CollectionBeforeChangeHook = async ({ data, operation, originalDoc }) => {
  if (operation !== 'update') return data
  if (data.paymentStatus === 'paid' && originalDoc?.paymentStatus !== 'paid' && !data.paidAt) {
    data.paidAt = new Date().toISOString()
  }
  return data
}

function createRestrictClientUpdates(slugs: CollectionSlugs): CollectionBeforeChangeHook {
  return async ({ data, operation, req, originalDoc }) => {
    if (operation !== 'update') return data
    if (req.user?.collection !== slugs.supportClients) return data
    const allowedStatuses = ['open', 'resolved']
    const newData: Record<string, unknown> = {}
    if (data.status && allowedStatuses.includes(data.status as string)) {
      newData.status = data.status
    }
    return { ...originalDoc, ...newData }
  }
}

function createAutoAssignAdmin(slugs: CollectionSlugs): CollectionBeforeChangeHook {
  return async ({ data, operation, req }) => {
    if (operation === 'create' && !data.assignedTo) {
      const { payload } = req
      let roundRobinEnabled = false
      try {
        const prefs = await payload.find({
          collection: 'payload-preferences',
          where: { key: { equals: 'support-round-robin' } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (prefs.docs.length > 0) {
          roundRobinEnabled = (prefs.docs[0].value as { enabled?: boolean })?.enabled === true
        }
      } catch (err) { console.warn('[support] Failed to read round-robin preferences:', err) }

      const admins = await payload.find({
        collection: slugs.users,
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      if (admins.docs.length === 0) return data

      if (roundRobinEnabled && admins.docs.length > 1) {
        const counts = await Promise.all(
          admins.docs.map(async (admin) => {
            const result = await payload.count({
              collection: slugs.tickets,
              where: { assignedTo: { equals: admin.id }, status: { in: ['open', 'waiting_client'] } },
              overrideAccess: true,
            })
            return { id: admin.id, count: result.totalDocs }
          }),
        )
        counts.sort((a, b) => a.count - b.count)
        data.assignedTo = counts[0].id
      } else {
        data.assignedTo = admins.docs[0].id
      }
    }
    return data
  }
}

function createTrackSLA(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== 'update') return doc
    const statusChanged = previousDoc?.status !== doc.status
    if (statusChanged && doc.status === 'resolved' && !doc.resolvedAt) {
      await req.payload.update({
        collection: slugs.tickets,
        id: doc.id,
        data: { resolvedAt: new Date().toISOString() },
        overrideAccess: true,
      })
    }
    return doc
  }
}

function createLogTicketActivity(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== 'update' || !previousDoc) return doc
    const changes: { field: string; oldValue: string; newValue: string }[] = []
    const trackedFields = ['status', 'priority', 'category', 'assignedTo'] as const
    const displayVal = (val: unknown): string => {
      if (val === null || val === undefined || val === '') return '(vide)'
      if (typeof val === 'object') {
        const obj = val as Record<string, unknown>
        return String(obj.email || obj.name || obj.title || obj.id || JSON.stringify(val))
      }
      return String(val)
    }
    for (const field of trackedFields) {
      const oldVal = previousDoc[field]
      const newVal = doc[field]
      const oldId = typeof oldVal === 'object' && oldVal !== null ? (oldVal as Record<string, unknown>).id : oldVal
      const newId = typeof newVal === 'object' && newVal !== null ? (newVal as Record<string, unknown>).id : newVal
      if (oldId !== newId) {
        changes.push({ field, oldValue: displayVal(oldVal), newValue: displayVal(newVal) })
      }
    }
    if (changes.length === 0) return doc
    const actorType = req.user?.collection === slugs.users ? 'admin' : 'client'
    for (const change of changes) {
      try {
        await req.payload.create({
          collection: slugs.ticketActivityLog,
          data: {
            ticket: doc.id,
            action: `${change.field}_changed`,
            detail: `${change.field}: ${change.oldValue || '(vide)'} → ${change.newValue}`,
            actorType,
            actorEmail: req.user?.email || 'system',
          },
          overrideAccess: true,
        })
      } catch (err) {
        console.error('[support] Failed to log activity:', err)
      }
    }
    return doc
  }
}

function createNotifyOnAssignment(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== 'update' || !previousDoc) return doc
    const oldAssigned = typeof previousDoc.assignedTo === 'object' ? previousDoc.assignedTo?.id : previousDoc.assignedTo
    const newAssigned = typeof doc.assignedTo === 'object' ? doc.assignedTo?.id : doc.assignedTo
    if (!newAssigned || oldAssigned === newAssigned) return doc
    try {
      const assignee = typeof doc.assignedTo === 'object' && doc.assignedTo?.email
        ? doc.assignedTo
        : await req.payload.findByID({ collection: slugs.users, id: newAssigned, depth: 0, overrideAccess: true })
      if (!assignee?.email) return doc
      const settings = await readSupportSettings(req.payload)
      const ticketNumber = doc.ticketNumber || 'TK-????'
      const subject = doc.subject || 'Support'
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
      const replyTo = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || ''
      await req.payload.sendEmail({
        to: assignee.email,
        ...(replyTo ? { replyTo } : {}),
        subject: `Ticket assigne : [${ticketNumber}] ${subject}`,
        html: `<p>Le ticket <strong>${escapeHtml(ticketNumber)}</strong> — <em>${escapeHtml(subject)}</em> — vous a ete assigne.</p><p><a href="${baseUrl}/admin/collections/${slugs.tickets}/${doc.id}">Ouvrir le ticket</a></p>`,
      })
    } catch (err) {
      console.error('[support] Failed to notify on assignment:', err)
    }
    return doc
  }
}

function createNotifyClientOnResolve(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== 'update' || !previousDoc) return doc
    if (previousDoc.status === doc.status || doc.status !== 'resolved') return doc
    try {
      const client = typeof doc.client === 'object' ? doc.client : null
      const clientId = typeof doc.client === 'number' ? doc.client : client?.id
      const clientData = client?.email ? client : (clientId ? await req.payload.findByID({
        collection: slugs.supportClients,
        id: clientId,
        depth: 0,
        overrideAccess: true,
      }) : null)
      if (!clientData?.email || clientData.notifyOnStatusChange === false) return doc
      const settings = await readSupportSettings(req.payload)
      const ticketNumber = doc.ticketNumber || 'TK-????'
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
      const replyTo = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || ''
      await req.payload.sendEmail({
        to: clientData.email,
        ...(replyTo ? { replyTo } : {}),
        subject: `[${ticketNumber}] Ticket resolu`,
        html: `<p>Bonjour ${escapeHtml(clientData.firstName || '')},</p><p>Votre ticket <strong>${escapeHtml(ticketNumber)}</strong> a ete resolu.</p><p><a href="${baseUrl}/support/tickets/${doc.id}">Consulter le ticket</a></p>`,
      })
    } catch (err) {
      console.error('[support] Failed to notify client on resolve:', err)
    }
    return doc
  }
}

function createAutoCalculateSLA(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc
    try {
      const { payload } = req
      const ticketPriority = doc.priority || 'normal'

      // Try to find a SLA policy matching the ticket's priority first
      let policy: any = null
      const byPriority = await payload.find({
        collection: slugs.slaPolicies as any,
        where: { priority: { equals: ticketPriority } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (byPriority.docs.length > 0) {
        policy = byPriority.docs[0]
      } else {
        // Fall back to the default policy
        const defaults = await payload.find({
          collection: slugs.slaPolicies as any,
          where: { isDefault: { equals: true } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (defaults.docs.length > 0) {
          policy = defaults.docs[0]
        }
      }

      if (!policy) return doc

      // SLA fields are in minutes (firstResponseTime, resolutionTime)
      const now = new Date()
      const firstResponseMinutes = policy.firstResponseTime || 240 // default 4h
      const resolutionMinutes = policy.resolutionTime || 1440 // default 24h
      const firstResponseDue = new Date(now.getTime() + firstResponseMinutes * 60000)
      const resolutionDue = new Date(now.getTime() + resolutionMinutes * 60000)

      await payload.update({
        collection: slugs.tickets as any,
        id: doc.id,
        data: {
          slaPolicy: policy.id,
          slaFirstResponseDue: firstResponseDue.toISOString(),
          slaResolutionDue: resolutionDue.toISOString(),
        },
        overrideAccess: true,
      })
    } catch (err) {
      console.error('[support] Failed to auto-calculate SLA:', err)
    }
    return doc
  }
}

function createFireTicketWebhooks(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    const { payload } = req

    if (operation === 'create') {
      // ticket_created
      fireWebhooks(payload, slugs, 'ticket_created', {
        id: doc.id,
        ticketNumber: doc.ticketNumber,
        subject: doc.subject,
        status: doc.status,
        priority: doc.priority,
        category: doc.category,
      })
      return doc
    }

    if (operation === 'update' && previousDoc) {
      // ticket_resolved
      if (previousDoc.status !== doc.status && doc.status === 'resolved') {
        fireWebhooks(payload, slugs, 'ticket_resolved', {
          id: doc.id,
          ticketNumber: doc.ticketNumber,
          subject: doc.subject,
          previousStatus: previousDoc.status,
        })

        // Invalidate client summary cache so it refreshes on next view
        const clientId = typeof doc.client === 'object' ? doc.client?.id : doc.client
        if (clientId) {
          payload.update({
            collection: 'client-summaries',
            where: { client: { equals: clientId } },
            data: { generatedAt: new Date(0).toISOString() }, // Force cache expiry
            overrideAccess: true,
          }).catch(() => { /* silent — collection might not exist yet */ })
        }
      }

      // ticket_assigned
      const oldAssigned = typeof previousDoc.assignedTo === 'object' ? previousDoc.assignedTo?.id : previousDoc.assignedTo
      const newAssigned = typeof doc.assignedTo === 'object' ? doc.assignedTo?.id : doc.assignedTo
      if (newAssigned && oldAssigned !== newAssigned) {
        fireWebhooks(payload, slugs, 'ticket_assigned', {
          id: doc.id,
          ticketNumber: doc.ticketNumber,
          subject: doc.subject,
          assignedTo: newAssigned,
        })
      }
    }

    return doc
  }
}

function createNotifyAdminOnNewTicket(slugs: CollectionSlugs, notificationSlug: string): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc

    try {
      const ticketNumber = doc.ticketNumber || 'TK-????'
      const subject = doc.subject || 'Support'

      await createAdminNotification(req.payload, {
        title: `Nouveau ticket : ${ticketNumber}`,
        message: `${ticketNumber} — ${subject}`,
        type: 'new_ticket',
        link: `/admin/collections/${slugs.tickets}/${doc.id}`,
      }, notificationSlug)
    } catch (err) {
      console.error('[support] Failed to create admin notification on new ticket:', err)
    }

    return doc
  }
}

function createDispatchWebhookOnTicket(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation === 'create') {
      dispatchWebhook(
        { ticketId: doc.id, ticketNumber: doc.ticketNumber, subject: doc.subject },
        'ticket_created',
        req.payload,
        slugs,
      )
    }

    if (operation === 'update' && previousDoc?.status !== doc.status && doc.status === 'resolved') {
      dispatchWebhook(
        { ticketId: doc.id, ticketNumber: doc.ticketNumber, subject: doc.subject },
        'ticket_resolved',
        req.payload,
        slugs,
      )
    }

    return doc
  }
}

function createCascadeDelete(slugs: CollectionSlugs): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    const collections = [slugs.ticketMessages, slugs.ticketActivityLog, slugs.timeEntries, slugs.satisfactionSurveys]
    for (const slug of collections) {
      await req.payload.delete({
        collection: slug as any,
        where: { ticket: { equals: id } },
        overrideAccess: true,
      })
    }
  }
}

// ─── Collection factory ──────────────────────────────────

export function createTicketsCollection(slugs: CollectionSlugs, options?: {
  conversationComponent?: string
  projectCollectionSlug?: string
  documentsCollectionSlug?: string
  notificationSlug?: string
}): CollectionConfig {
  const notificationSlug = options?.notificationSlug || 'admin-notifications'

  // Build dynamic fields
  const dynamicFields: Field[] = []

  // Conversation UI field at the top
  dynamicFields.push({
    name: 'conversation',
    type: 'ui',
    admin: {
      components: {
        Field: options?.conversationComponent || '@consilioweb/payload-support/components/TicketConversation',
      },
    },
  })

  // Project relationship (only if configured)
  if (options?.projectCollectionSlug) {
    dynamicFields.push({
      name: 'project',
      type: 'relationship',
      relationTo: options.projectCollectionSlug,
      label: 'Projet',
      admin: { position: 'sidebar' },
    })
  }

  // Billing collapsible fields
  const billingFields: Field[] = [
    {
      type: 'row',
      fields: [
        {
          name: 'billingType',
          type: 'select',
          label: 'Type de facturation',
          defaultValue: 'hourly',
          options: [
            { label: 'Au temps passé', value: 'hourly' },
            { label: 'Forfait', value: 'flat' },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'flatRateAmount',
          type: 'number',
          label: 'Montant forfait (EUR)',
          admin: {
            width: '33%',
            condition: (data) => data?.billingType === 'flat',
          },
        },
        {
          name: 'billedAmount',
          type: 'number',
          label: 'Montant facturé (EUR)',
          admin: { width: '33%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        ...(options?.documentsCollectionSlug ? [
          {
            name: 'quote',
            type: 'upload' as const,
            relationTo: options.documentsCollectionSlug,
            label: 'Devis',
            admin: { width: '50%' },
          },
          {
            name: 'invoice',
            type: 'upload' as const,
            relationTo: options.documentsCollectionSlug,
            label: 'Facture',
            admin: { width: '50%' },
          },
        ] : []),
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'paymentStatus',
          type: 'select',
          label: 'Statut de paiement',
          defaultValue: 'unpaid',
          options: [
            { label: 'Non payé', value: 'unpaid' },
            { label: 'Paiement partiel', value: 'partial' },
            { label: 'Payé', value: 'paid' },
          ],
          access: { update: ({ req }) => req.user?.collection === 'users' },
          admin: { width: '50%', condition: (data) => !!data?.invoice },
        },
        {
          name: 'paidAt',
          type: 'date',
          label: 'Payé le',
          admin: { width: '33%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } },
        },
      ],
    },
  ]

  return {
    slug: slugs.tickets,
    labels: { singular: 'Ticket', plural: 'Tickets' },
    admin: {
      useAsTitle: 'subject',
      group: 'Support',
      defaultColumns: ['ticketNumber', 'subject', 'status', 'priority', 'category', 'client', 'updatedAt'],
      listSearchableFields: ['ticketNumber', 'subject'],
    },
    fields: [
      // Conversation UI field first
      ...dynamicFields,
      { name: 'subject', type: 'text', required: true, label: 'Sujet' },
      {
        type: 'row',
        fields: [
          {
            name: 'status', type: 'select', defaultValue: 'open', label: 'Statut',
            options: [
              { label: 'Ouvert', value: 'open' },
              { label: 'En attente client', value: 'waiting_client' },
              { label: 'Resolu', value: 'resolved' },
            ],
            admin: { width: '50%' },
          },
          {
            name: 'priority', type: 'select', defaultValue: 'normal', label: 'Priorite',
            options: [
              { label: 'Basse', value: 'low' },
              { label: 'Normale', value: 'normal' },
              { label: 'Haute', value: 'high' },
              { label: 'Urgente', value: 'urgent' },
            ],
            admin: { width: '50%' },
          },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'client', type: 'relationship', relationTo: slugs.supportClients, required: true, label: 'Client', admin: { width: '50%' } },
        ],
      },
      // Billing collapsible
      {
        type: 'collapsible', label: 'Facturation',
        admin: { initCollapsed: true },
        fields: billingFields,
      },
      // SLA & Delais
      {
        type: 'collapsible', label: 'SLA & Delais',
        admin: { initCollapsed: true },
        fields: [
          {
            type: 'row',
            fields: [
              { name: 'firstResponseAt', type: 'date', label: 'Premiere reponse', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
              { name: 'resolvedAt', type: 'date', label: 'Date de resolution', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
            ],
          },
          {
            type: 'row',
            fields: [
              { name: 'slaFirstResponseDue', type: 'date', label: 'Echeance 1ere reponse (SLA)', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
              { name: 'slaResolutionDue', type: 'date', label: 'Echeance resolution (SLA)', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
            ],
          },
          {
            type: 'row',
            fields: [
              { name: 'slaFirstResponseBreached', type: 'checkbox', label: '1ere reponse depassee', admin: { readOnly: true, width: '50%' } },
              { name: 'slaResolutionBreached', type: 'checkbox', label: 'Resolution depassee', admin: { readOnly: true, width: '50%' } },
            ],
          },
        ],
      },
      // Systeme
      {
        type: 'collapsible', label: 'Systeme',
        admin: { initCollapsed: true },
        fields: [
          { name: 'chatSession', type: 'text', label: 'Session Chat', admin: { readOnly: true } },
          {
            type: 'row',
            fields: [
              { name: 'lastClientReadAt', type: 'date', label: 'Derniere lecture client', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
              { name: 'lastAdminReadAt', type: 'date', label: 'Derniere lecture admin', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
              { name: 'lastClientMessageAt', type: 'date', label: 'Dernier message client', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
            ],
          },
          { name: 'mergedInto', type: 'relationship', relationTo: slugs.tickets, label: 'Fusionne dans', admin: { readOnly: true } },
          { name: 'autoCloseRemindedAt', type: 'date', label: 'Rappel auto-close envoye', admin: { readOnly: true, date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
        ],
      },
      // Sidebar
      { name: 'ticketNumber', type: 'text', unique: true, label: 'N° Ticket', admin: { position: 'sidebar' } },
      { name: 'slaPolicy', type: 'relationship', relationTo: slugs.slaPolicies, label: 'Politique SLA', admin: { position: 'sidebar' } },
      {
        name: 'category', type: 'select', label: 'Categorie',
        options: [
          { label: 'Bug / Dysfonctionnement', value: 'bug' },
          { label: 'Modification de contenu', value: 'content' },
          { label: 'Nouvelle fonctionnalite', value: 'feature' },
          { label: 'Question / Aide', value: 'question' },
          { label: 'Hebergement / Domaine', value: 'hosting' },
        ],
        admin: { position: 'sidebar' },
      },
      { name: 'assignedTo', type: 'relationship', relationTo: slugs.users, label: 'Assigne a', admin: { position: 'sidebar' } },
      {
        name: 'source', type: 'select', defaultValue: 'portal', label: 'Source',
        options: [
          { label: 'Portail client', value: 'portal' },
          { label: 'Chat en direct', value: 'live-chat' },
          { label: 'Email', value: 'email' },
          { label: 'Admin', value: 'admin' },
        ],
        admin: { position: 'sidebar' },
      },
      {
        name: 'tags', type: 'select', hasMany: true, label: 'Tags',
        options: [
          { label: 'Urgent client', value: 'urgent-client' },
          { label: 'Facturable', value: 'facturable' },
          { label: 'Bug critique', value: 'bug-critique' },
          { label: 'En attente info', value: 'attente-info' },
          { label: 'Evolution', value: 'evolution' },
          { label: 'Maintenance', value: 'maintenance' },
          { label: 'Design', value: 'design' },
          { label: 'SEO', value: 'seo' },
          { label: 'SMS', value: 'sms' },
          { label: 'WhatsApp', value: 'whatsapp' },
        ],
        admin: { position: 'sidebar' },
      },
      { name: 'relatedTickets', type: 'relationship', relationTo: slugs.tickets, hasMany: true, label: 'Tickets lies', admin: { position: 'sidebar' } },
      { name: 'snoozeUntil', type: 'date', label: 'Snooze jusqu\'au', admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' } } },
      // Billing sidebar
      { name: 'billable', type: 'checkbox', defaultValue: true, label: 'Facturable', admin: { position: 'sidebar' } },
      {
        name: 'showTimeToClient',
        type: 'checkbox',
        defaultValue: true,
        label: 'Afficher le temps au client',
        admin: {
          position: 'sidebar',
          description: 'Auto-désactivé en mode forfait',
          condition: (data) => data?.billingType !== 'flat',
        },
      },
      { name: 'totalTimeMinutes', type: 'number', defaultValue: 0, label: 'Temps total (minutes)', admin: { readOnly: true, position: 'sidebar' } },
    ],
    hooks: {
      beforeChange: [
        createAssignTicketNumber(slugs),
        createAssignClientOnCreate(slugs),
        createAutoAssignAdmin(slugs),
        autoPaidAt,
        createRestrictClientUpdates(slugs),
      ],
      afterChange: [
        createTrackSLA(slugs),
        createAutoCalculateSLA(slugs),
        createAssignSlaDeadlines(slugs, notificationSlug),
        createCheckSlaOnResolve(slugs, notificationSlug),
        createLogTicketActivity(slugs),
        createNotifyOnAssignment(slugs),
        createNotifyClientOnResolve(slugs),
        createTicketStatusEmail(slugs),
        createNotifyAdminOnNewTicket(slugs, notificationSlug),
        createFireTicketWebhooks(slugs),
        createDispatchWebhookOnTicket(slugs),
      ],
      beforeDelete: [createCascadeDelete(slugs)],
    },
    access: {
      create: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) return true
        return false
      },
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) {
          return { client: { equals: req.user.id } }
        }
        return false
      },
      update: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) {
          return { client: { equals: req.user.id } }
        }
        return false
      },
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    timestamps: true,
  }
}
