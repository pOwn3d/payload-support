import type {
  CollectionConfig,
  CollectionBeforeChangeHook,
  CollectionAfterChangeHook,
  CollectionBeforeDeleteHook,
} from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { escapeHtml } from '../utils/emailTemplate'

// ─── Hooks ───────────────────────────────────────────────

function createAssignTicketNumber(slugs: CollectionSlugs): CollectionBeforeChangeHook {
  return async ({ data, operation, req }) => {
    if (operation === 'create') {
      const existing = await req.payload.find({
        collection: slugs.tickets,
        sort: '-ticketNumber',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      let nextNumber = 1
      if (existing.docs.length > 0 && existing.docs[0]?.ticketNumber) {
        const match = (existing.docs[0].ticketNumber as string).match(/TK-(\d+)/)
        if (match) nextNumber = parseInt(match[1], 10) + 1
      }
      data.ticketNumber = `TK-${String(nextNumber).padStart(4, '0')}`
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
      } catch { /* fallback */ }

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
      const ticketNumber = doc.ticketNumber || 'TK-????'
      const subject = doc.subject || 'Support'
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
      await req.payload.sendEmail({
        to: assignee.email,
        subject: `Ticket assigné : [${ticketNumber}] ${subject}`,
        html: `<p>Le ticket <strong>${escapeHtml(ticketNumber)}</strong> — <em>${escapeHtml(subject)}</em> — vous a été assigné.</p><p><a href="${baseUrl}/admin/collections/${slugs.tickets}/${doc.id}">Ouvrir le ticket</a></p>`,
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
      const ticketNumber = doc.ticketNumber || 'TK-????'
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
      await req.payload.sendEmail({
        to: clientData.email,
        subject: `[${ticketNumber}] Ticket résolu`,
        html: `<p>Bonjour ${escapeHtml(clientData.firstName || '')},</p><p>Votre ticket <strong>${escapeHtml(ticketNumber)}</strong> a été résolu.</p><p><a href="${baseUrl}/support/tickets/${doc.id}">Consulter le ticket</a></p>`,
      })
    } catch (err) {
      console.error('[support] Failed to notify client on resolve:', err)
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

export function createTicketsCollection(slugs: CollectionSlugs): CollectionConfig {
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
      { name: 'subject', type: 'text', required: true, label: 'Sujet' },
      {
        type: 'row',
        fields: [
          {
            name: 'status', type: 'select', defaultValue: 'open', label: 'Statut',
            options: [
              { label: 'Ouvert', value: 'open' },
              { label: 'En attente client', value: 'waiting_client' },
              { label: 'Résolu', value: 'resolved' },
            ],
            admin: { width: '50%' },
          },
          {
            name: 'priority', type: 'select', defaultValue: 'normal', label: 'Priorité',
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
      // SLA & Délais
      {
        type: 'collapsible', label: 'SLA & Délais',
        admin: { initCollapsed: true },
        fields: [
          {
            type: 'row',
            fields: [
              { name: 'firstResponseAt', type: 'date', label: 'Première réponse', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
              { name: 'resolvedAt', type: 'date', label: 'Date de résolution', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
            ],
          },
          {
            type: 'row',
            fields: [
              { name: 'slaFirstResponseDue', type: 'date', label: 'Échéance 1ère réponse (SLA)', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
              { name: 'slaResolutionDue', type: 'date', label: 'Échéance résolution (SLA)', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
            ],
          },
          {
            type: 'row',
            fields: [
              { name: 'slaFirstResponseBreached', type: 'checkbox', label: '1ère réponse dépassée', admin: { readOnly: true, width: '50%' } },
              { name: 'slaResolutionBreached', type: 'checkbox', label: 'Résolution dépassée', admin: { readOnly: true, width: '50%' } },
            ],
          },
        ],
      },
      // Système
      {
        type: 'collapsible', label: 'Système',
        admin: { initCollapsed: true },
        fields: [
          { name: 'chatSession', type: 'text', label: 'Session Chat', admin: { readOnly: true } },
          {
            type: 'row',
            fields: [
              { name: 'lastClientReadAt', type: 'date', label: 'Dernière lecture client', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
              { name: 'lastAdminReadAt', type: 'date', label: 'Dernière lecture admin', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
              { name: 'lastClientMessageAt', type: 'date', label: 'Dernier message client', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
            ],
          },
          { name: 'mergedInto', type: 'relationship', relationTo: slugs.tickets, label: 'Fusionné dans', admin: { readOnly: true } },
          { name: 'autoCloseRemindedAt', type: 'date', label: 'Rappel auto-close envoyé', admin: { readOnly: true, date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
        ],
      },
      // Sidebar
      { name: 'ticketNumber', type: 'text', unique: true, label: 'N° Ticket', admin: { readOnly: true, position: 'sidebar' } },
      { name: 'slaPolicy', type: 'relationship', relationTo: slugs.slaPolicies, label: 'Politique SLA', admin: { position: 'sidebar' } },
      {
        name: 'category', type: 'select', label: 'Catégorie',
        options: [
          { label: 'Bug / Dysfonctionnement', value: 'bug' },
          { label: 'Modification de contenu', value: 'content' },
          { label: 'Nouvelle fonctionnalité', value: 'feature' },
          { label: 'Question / Aide', value: 'question' },
          { label: 'Hébergement / Domaine', value: 'hosting' },
        ],
        admin: { position: 'sidebar' },
      },
      { name: 'assignedTo', type: 'relationship', relationTo: slugs.users, label: 'Assigné à', admin: { position: 'sidebar' } },
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
          { label: 'Évolution', value: 'evolution' },
          { label: 'Maintenance', value: 'maintenance' },
        ],
        admin: { position: 'sidebar' },
      },
      { name: 'relatedTickets', type: 'relationship', relationTo: slugs.tickets, hasMany: true, label: 'Tickets liés', admin: { position: 'sidebar' } },
      { name: 'snoozeUntil', type: 'date', label: 'Snoozé jusqu\'au', admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' } } },
      // Billing
      { name: 'billable', type: 'checkbox', defaultValue: true, label: 'Facturable', admin: { position: 'sidebar' } },
      { name: 'showTimeToClient', type: 'checkbox', defaultValue: true, label: 'Afficher le temps au client', admin: { position: 'sidebar' } },
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
        createLogTicketActivity(slugs),
        createNotifyOnAssignment(slugs),
        createNotifyClientOnResolve(slugs),
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
