import type {
  CollectionConfig,
  CollectionBeforeChangeHook,
  CollectionAfterChangeHook,
  CollectionBeforeDeleteHook,
  Field,
  Where,
} from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import type { SupportCapabilities } from '../types'
import { escapeHtml, emailWrapper, emailParagraph, emailButton } from '../utils/emailTemplate'
import { fireWebhooks } from '../utils/fireWebhooks'
import { createAdminNotification } from '../utils/adminNotification'
import { dispatchWebhook } from '../utils/webhookDispatcher'
import { readSupportSettings } from '../utils/readSettings'
import { createTicketStatusEmail } from '../hooks/ticketStatusEmail'
import { createAssignSlaDeadlines, createCheckSlaOnResolve, createPauseSlaOnHold } from '../hooks/checkSLA'
import { createApplyAutomationRules } from '../hooks/automationRules'
import { isTeamScopingEnabled, resolveAgentTeamIds } from '../utils/teamAccess'
import { generateTicketSynthesis } from '../utils/generateTicketSynthesis'
import { dbFind, dbCreate, dbDelete } from '../utils/db'

// ─── Hooks ───────────────────────────────────────────────

const ticketNumberQueues = new Map<string, Promise<void>>()

async function withTicketNumberLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = ticketNumberQueues.get(key) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const queued = previous.then(() => gate)
  ticketNumberQueues.set(key, queued)
  await previous
  try {
    return await operation()
  } finally {
    release()
    if (ticketNumberQueues.get(key) === queued) ticketNumberQueues.delete(key)
  }
}

function createAssignTicketNumber(
  slugs: CollectionSlugs,
  options?: { prefix?: string; padding?: number },
): CollectionBeforeChangeHook {
  return async ({ data, operation, req }) => {
    if (operation === 'create') {
      const value = await withTicketNumberLock(slugs.tickets, async () => {
        const counterResult = await req.payload.find({
          collection: slugs.counters as any,
          where: { key: { equals: slugs.tickets } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req,
        })
        const counter = counterResult.docs[0] as { id: number | string; nextValue: number } | undefined
        if (counter) {
          const allocated = Number(counter.nextValue)
          await req.payload.update({
            collection: slugs.counters as any,
            id: counter.id,
            data: { nextValue: allocated + 1 },
            overrideAccess: true,
            req,
          })
          return allocated
        }

        const tickets = await req.payload.find({
          collection: slugs.tickets as any,
          limit: 0,
          depth: 0,
          overrideAccess: true,
          select: { ticketNumber: true },
          req,
        })
        const highest = tickets.docs.reduce((max, ticket) => {
          const match = String((ticket as { ticketNumber?: string }).ticketNumber || '').match(/(\d+)$/)
          return match ? Math.max(max, Number(match[1])) : max
        }, 0)
        const allocated = highest + 1
        await req.payload.create({
          collection: slugs.counters as any,
          data: { key: slugs.tickets, nextValue: allocated + 1 },
          overrideAccess: true,
          req,
        })
        return allocated
      })
      data.ticketNumber = `${options?.prefix ?? 'TK-'}${String(value).padStart(options?.padding ?? 4, '0')}`
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
    // Clients may move a ticket to: open / waiting_support (reopen) or resolved (close).
    // 'waiting_support' is required so the reopen button actually puts the ball back
    // in the support team's court instead of being silently rejected.
    const allowedStatuses = ['open', 'waiting_support', 'resolved']
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
        // Single source of truth: the `features` block of the support settings,
        // which also falls back to the legacy `support-round-robin` row.
        const settings = await readSupportSettings(payload)
        roundRobinEnabled = settings.features.roundRobin === true
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

function createTrackAiSummaryOnResolve(
  slugs: CollectionSlugs,
  generator?: SupportCapabilities['aiSummaries'],
): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== 'update' || !previousDoc) return doc
    const wasResolved = previousDoc.status === 'resolved'
    const isResolved = doc.status === 'resolved'

    // Reopening: clear the cached summary so the next resolve regenerates it
    if (wasResolved && !isResolved && doc.aiSummary) {
      try {
        await req.payload.update({
          collection: slugs.tickets,
          id: doc.id,
          data: { aiSummary: null, aiSummaryGeneratedAt: null, aiSummaryStatus: null },
          overrideAccess: true,
        })
      } catch (err) {
        console.error('[support] Failed to clear ai summary on reopen:', err)
      }
      return doc
    }

    // Just resolved: trigger generation if not already cached.
    // Fire-and-forget so the admin UI doesn't block on the LLM call.
    if (!wasResolved && isResolved && !doc.aiSummary) {
      // setImmediate keeps the response snappy; failures are logged inside the util.
      setImmediate(() => {
        const operation = generator
          ? generator.generate(req.payload, doc.id)
          : generateTicketSynthesis({ payload: req.payload, slugs, ticketId: doc.id })
        operation
          .catch((err) => console.error('[support] Background ai synthesis failed:', err))
      })
    }
    return doc
  }
}

function createTrackWaitingSince(): CollectionBeforeChangeHook {
  return ({ data, originalDoc, operation }) => {
    if (operation !== 'update') return data
    const previous = originalDoc?.status
    const next = data.status ?? previous
    if (next === 'waiting_client' && previous !== 'waiting_client') {
      data.waitingSince = new Date().toISOString()
      data.autoCloseRemindedAt = null
    } else if (next !== 'waiting_client' && previous === 'waiting_client') {
      data.waitingSince = null
      data.autoCloseRemindedAt = null
    }
    return data
  }
}

function createGenerateTitleOnCreate(
  generator: NonNullable<SupportCapabilities['aiTitles']>,
): CollectionAfterChangeHook {
  return ({ doc, operation, req }) => {
    if (operation === 'create' && doc?.id && !doc.displayTitle) {
      setImmediate(() => {
        generator.generate(req.payload, doc.id)
          .catch((err) => console.error('[support] Background title generation failed:', err))
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
      // Respect client notification preferences: the dedicated `notifyResolution`
      // toggle, and the legacy global `notifyOnStatusChange`. Strict `=== false`
      // so clients not yet migrated (undefined) keep the default-on behaviour.
      if (!clientData?.email) return doc
      if (clientData.notifyResolution === false || clientData.notifyOnStatusChange === false) return doc

      // TODO digest/batching: if clientData.notificationFrequency !== 'immediate',
      // this resolution should be queued and folded into a daily/weekly digest
      // instead of sending now. Out of scope here — sent immediately for all.

      const settings = await readSupportSettings(req.payload)
      const ticketNumber = doc.ticketNumber || 'TK-????'
      const subject = doc.subject || 'Support'
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
      const replyTo = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || ''
      const ticketUrl = `${baseUrl}/support/tickets/${doc.id}`
      await req.payload.sendEmail({
        to: clientData.email,
        ...(replyTo ? { replyTo } : {}),
        subject: `[${ticketNumber}] Ticket resolu`,
        html: emailWrapper(`Votre ticket a ete resolu`, [
          emailParagraph(`Bonjour <strong>${escapeHtml(clientData.firstName || '')}</strong>,`),
          emailParagraph(`Votre ticket <strong>${escapeHtml(ticketNumber)}</strong> — <em>${escapeHtml(String(subject))}</em> — a ete resolu.`),
          emailParagraph('Si le probleme persiste ou si vous avez une question, repondez simplement a cet email pour rouvrir le ticket.'),
          emailButton('Consulter le ticket', ticketUrl),
        ].join(''), {
          kind: 'system',
          preheader: `Votre ticket ${ticketNumber} a ete resolu.`,
        }),
      })
    } catch (err) {
      console.error('[support] Failed to notify client on resolve:', err)
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
      await dbDelete(req.payload, slug, {
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
  ticketNumber?: { prefix?: string; padding?: number }
  capabilities?: SupportCapabilities
}): CollectionConfig {
  const notificationSlug = options?.notificationSlug || 'admin-notifications'

  // Build dynamic fields
  const dynamicFields: Field[] = []
  const capabilities = options?.capabilities

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

  if (capabilities?.aiTitles) {
    dynamicFields.push(
      {
        name: 'displayTitle',
        type: 'text',
        label: "Titre d'affichage",
        admin: { description: "Titre court suggéré par l'IA, éditable sans modifier le sujet email." },
      },
      {
        name: 'displayTitleStatus',
        type: 'select',
        defaultValue: 'none',
        options: [
          { label: 'Aucun', value: 'none' },
          { label: 'Génération en cours', value: 'pending' },
          { label: 'Suggéré', value: 'suggested' },
          { label: 'Validé', value: 'validated' },
          { label: 'Échec', value: 'error' },
        ],
      },
    )
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

  if (capabilities?.detailedBilling) {
    billingFields.push(
      {
        name: 'billedAt',
        type: 'date',
        label: 'Facturé le',
      },
      {
        name: 'billingLines',
        type: 'array',
        label: 'Lignes de facturation',
        fields: [
          { name: 'period', type: 'text', label: 'Période (AAAA-MM)' },
          { name: 'label', type: 'text', label: 'Libellé' },
          { name: 'amount', type: 'number', label: 'Montant (€)' },
          { name: 'billingType', type: 'select', options: ['hourly', 'flat'], defaultValue: 'flat', label: 'Type' },
          { name: 'billed', type: 'checkbox', defaultValue: false, label: 'Facturé' },
          { name: 'billedAt', type: 'date', label: 'Facturé le' },
        ],
      },
    )
  }

  if (capabilities?.volunteering) {
    billingFields.push(
      { name: 'volunteer', type: 'checkbox', defaultValue: false, label: 'Bénévolat (non facturé)' },
      {
        name: 'volunteerValue',
        type: 'number',
        label: 'Valeur offerte (€)',
        admin: { condition: (data) => Boolean(data?.volunteer) },
      },
    )
  }

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
            name: 'status', type: 'select', index: true, defaultValue: 'open', label: 'Statut',
            options: [
              { label: 'Ouvert', value: 'open' },
              { label: 'En attente client', value: 'waiting_client' },
              { label: 'Resolu', value: 'resolved' },
              { label: 'Ferme', value: 'closed' },
              { label: 'Escalade', value: 'escalated' },
            ],
            admin: { width: '50%' },
          },
          {
            name: 'priority', type: 'select', index: true, defaultValue: 'normal', label: 'Priorite',
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
          { name: 'client', type: 'relationship', relationTo: slugs.supportClients, required: true, index: true, label: 'Client', admin: { width: '50%' } },
        ],
      },
      // Billing collapsible
      {
        type: 'collapsible', label: 'Facturation',
        admin: { initCollapsed: true },
        fields: billingFields,
      },
      // AI Synthesis collapsible — auto-filled when ticket is resolved
      {
        type: 'collapsible', label: 'Synthese IA',
        admin: {
          initCollapsed: true,
          description: 'Recap factuel genere automatiquement au passage en resolu. Sert au copier-coller dans devis/factures.',
        },
        fields: [
          {
            name: 'aiSummary',
            type: 'textarea',
            label: 'Synthese',
            admin: {
              readOnly: true,
              rows: 8,
              description: 'Vide tant que le ticket n\'est pas resolu. Effacee si le ticket est reouvert.',
            },
          },
          {
            type: 'row',
            fields: [
              {
                name: 'aiSummaryGeneratedAt',
                type: 'date',
                label: 'Genere le',
                admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } },
              },
              {
                name: 'aiSummaryStatus',
                type: 'select',
                label: 'Statut',
                options: [
                  { label: 'En cours', value: 'pending' },
                  { label: 'Genere', value: 'done' },
                  { label: 'Erreur', value: 'error' },
                ],
                admin: { readOnly: true, width: '50%' },
              },
            ],
          },
        ],
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
              { name: 'slaFirstResponseDue', type: 'date', index: true, label: 'Echeance 1ere reponse (SLA)', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
              { name: 'slaResolutionDue', type: 'date', index: true, label: 'Echeance resolution (SLA)', admin: { readOnly: true, width: '50%', date: { displayFormat: 'dd/MM/yyyy HH:mm' } } },
            ],
          },
          {
            type: 'row',
            fields: [
              { name: 'slaFirstResponseBreached', type: 'checkbox', label: '1ere reponse depassee', admin: { readOnly: true, width: '50%' } },
              { name: 'slaResolutionBreached', type: 'checkbox', label: 'Resolution depassee', admin: { readOnly: true, width: '50%' } },
              { name: 'slaPausedAt', type: 'date', label: 'SLA en pause depuis', admin: { hidden: true } },
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
          { name: 'autoCloseScheduledAt', type: 'date', index: true, label: 'Fermeture auto programmee', admin: { readOnly: true, date: { displayFormat: 'dd/MM/yyyy HH:mm' }, description: 'Echeance ferme posee par une relance manuelle. Le ticket se ferme apres cette date sans reponse client.' } },
          { name: 'waitingSince', type: 'date', index: true, label: 'En attente depuis', admin: { readOnly: true } },
          {
            name: 'relanceDelayDays',
            type: 'select',
            defaultValue: '2',
            label: 'Délai de relance client',
            options: [
              { label: '1 jour', value: '1' },
              { label: '2 jours', value: '2' },
              { label: '3 jours', value: '3' },
            ],
          },
          { name: 'satisfactionRemindedAt', type: 'date', admin: { hidden: true, readOnly: true } },
        ],
      },
      // Sidebar
      { name: 'ticketNumber', type: 'text', unique: true, label: 'N° Ticket', admin: { position: 'sidebar' } },
      { name: 'slaPolicy', type: 'relationship', relationTo: slugs.slaPolicies, label: 'Politique SLA', admin: { position: 'sidebar' } },
      {
        name: 'category', type: 'select', index: true, label: 'Categorie',
        options: [
          { label: 'Bug / Dysfonctionnement', value: 'bug' },
          { label: 'Modification de contenu', value: 'content' },
          { label: 'Nouvelle fonctionnalite', value: 'feature' },
          { label: 'Question / Aide', value: 'question' },
          { label: 'Hebergement / Domaine', value: 'hosting' },
        ],
        admin: { position: 'sidebar' },
      },
      { name: 'assignedTo', type: 'relationship', relationTo: slugs.users, index: true, label: 'Assigne a', admin: { position: 'sidebar' } },
      { name: 'team', type: 'relationship', relationTo: slugs.supportTeams, index: true, label: 'Equipe', admin: { position: 'sidebar' } },
      {
        name: 'source', type: 'select', defaultValue: 'portal', label: 'Source',
        options: [
          { label: 'Portail client', value: 'portal' },
          { label: 'Chat en direct', value: 'live-chat' },
          { label: 'Email', value: 'email' },
          { label: 'Admin', value: 'admin' },
          { label: 'WhatsApp', value: 'whatsapp' },
          { label: 'Messenger', value: 'messenger' },
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
        createAssignTicketNumber(slugs, options?.ticketNumber),
        createAssignClientOnCreate(slugs),
        createAutoAssignAdmin(slugs),
        autoPaidAt,
        createTrackWaitingSince(),
        createRestrictClientUpdates(slugs),
      ],
      afterChange: [
        createTrackSLA(slugs),
        createTrackAiSummaryOnResolve(slugs, capabilities?.aiSummaries),
        ...(capabilities?.aiTitles ? [createGenerateTitleOnCreate(capabilities.aiTitles)] : []),
        createAssignSlaDeadlines(slugs, notificationSlug),
        createPauseSlaOnHold(slugs),
        createCheckSlaOnResolve(slugs, notificationSlug),
        createLogTicketActivity(slugs),
        createNotifyOnAssignment(slugs),
        createNotifyClientOnResolve(slugs),
        createTicketStatusEmail(slugs),
        createNotifyAdminOnNewTicket(slugs, notificationSlug),
        createFireTicketWebhooks(slugs),
        createDispatchWebhookOnTicket(slugs),
        createApplyAutomationRules(slugs),
      ],
      beforeDelete: [createCascadeDelete(slugs)],
    },
    access: {
      create: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) return true
        return false
      },
      read: async ({ req }) => {
        if (req.user?.collection === slugs.users) {
          if (!isTeamScopingEnabled()) return true
          // Team scoping (opt-in): agents see their teams' tickets + team-less ones.
          const teamIds = await resolveAgentTeamIds(req.payload, slugs, req.user.id)
          return {
            or: [
              { team: { in: teamIds.length > 0 ? teamIds : [-1] } },
              { team: { exists: false } },
            ],
          } as Where
        }
        if (req.user?.collection === slugs.supportClients) {
          // Owner OR collaborator (via ticket-collaborators table).
          // We resolve the collaborator ticket-ids upfront so we keep a single Where
          // expression — Payload's access fns support async returns.
          let collabTicketIds: Array<number | string> = []
          try {
            const rows = await dbFind(req.payload, 'ticket-collaborators', {
              where: { client: { equals: req.user.id } },
              limit: 1000,
              depth: 0,
              overrideAccess: true,
            })
            collabTicketIds = rows.docs
              .map((r: any) => (typeof r.ticket === 'object' ? r.ticket?.id : r.ticket))
              .filter((v: unknown): v is number | string => v !== undefined && v !== null)
          } catch {
            // ticket-collaborators collection may not yet exist on older deployments — fall back to owner-only.
          }
          if (collabTicketIds.length > 0) {
            const where: Where = {
              or: [
                { client: { equals: req.user.id } },
                { id: { in: collabTicketIds } },
              ],
            }
            return where
          }
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
