import type { CollectionAfterChangeHook, Payload } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { createAdminNotification } from '../utils/adminNotification'
import { emailWrapper, emailButton, emailParagraph } from '../utils/emailTemplate'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDoc = any

/**
 * Calculate a business-hours deadline from a start date.
 * Business hours: Mon-Fri, 9:00-18:00 (Europe/Paris).
 * @param start - start date
 * @param minutes - number of business-hour minutes to add
 * @returns deadline date
 */
export function calculateBusinessHoursDeadline(start: Date, minutes: number): Date {
  const BUSINESS_START = 9
  const BUSINESS_END = 18

  let remaining = minutes
  const current = new Date(start)

  // If start is outside business hours, move to next business period
  current.setMilliseconds(0)
  current.setSeconds(0)
  moveToBusinessHours(current, BUSINESS_START, BUSINESS_END)

  while (remaining > 0) {
    const day = current.getDay() // 0=Sun, 6=Sat

    // Skip weekends
    if (day === 0) {
      current.setDate(current.getDate() + 1)
      current.setHours(BUSINESS_START, 0, 0, 0)
      continue
    }
    if (day === 6) {
      current.setDate(current.getDate() + 2)
      current.setHours(BUSINESS_START, 0, 0, 0)
      continue
    }

    // Calculate remaining minutes in the current business day
    const currentMinuteOfDay = current.getHours() * 60 + current.getMinutes()
    const endOfDayMinute = BUSINESS_END * 60
    const minutesLeftToday = Math.max(0, endOfDayMinute - currentMinuteOfDay)

    if (remaining <= minutesLeftToday) {
      // Deadline falls within today
      current.setMinutes(current.getMinutes() + remaining)
      remaining = 0
    } else {
      // Consume the rest of today and move to next business day
      remaining -= minutesLeftToday
      current.setDate(current.getDate() + 1)
      current.setHours(BUSINESS_START, 0, 0, 0)
    }
  }

  return current
}

/**
 * Move a date forward to the next business-hours period if currently outside.
 */
function moveToBusinessHours(date: Date, startHour: number, endHour: number): void {
  const day = date.getDay()
  const hour = date.getHours()

  // Weekend -> next Monday
  if (day === 0) {
    date.setDate(date.getDate() + 1)
    date.setHours(startHour, 0, 0, 0)
    return
  }
  if (day === 6) {
    date.setDate(date.getDate() + 2)
    date.setHours(startHour, 0, 0, 0)
    return
  }

  // Before business hours -> move to start
  if (hour < startHour) {
    date.setHours(startHour, 0, 0, 0)
    return
  }

  // After business hours -> next business day
  if (hour >= endHour) {
    date.setDate(date.getDate() + 1)
    date.setHours(startHour, 0, 0, 0)
    // Skip weekend if needed
    const newDay = date.getDay()
    if (newDay === 6) {
      date.setDate(date.getDate() + 2)
    } else if (newDay === 0) {
      date.setDate(date.getDate() + 1)
    }
  }
}

/**
 * Calculate a simple calendar-time deadline.
 */
function calculateCalendarDeadline(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60 * 1000)
}

/**
 * Safely read a field from a doc that may be a Payload typed object.
 */
function field(doc: AnyDoc, key: string): unknown {
  return doc?.[key] ?? undefined
}

/**
 * Extract numeric ID from a value that can be a number, object with id, or null.
 */
function resolveId(value: unknown): number | string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'object') return (value as AnyDoc).id as number | string | null
  return null
}

/**
 * Resolve the SLA policy for a ticket.
 * Priority: explicit slaPolicy > default policy matching priority > null
 */
async function resolveSlaPolicy(
  payload: Payload,
  ticket: AnyDoc,
  slugs: CollectionSlugs,
): Promise<AnyDoc | null> {
  // If ticket has an explicit SLA policy assigned
  const policyRef = field(ticket, 'slaPolicy')
  if (policyRef) {
    const policyId = typeof policyRef === 'object' && policyRef !== null
      ? (policyRef as AnyDoc).id
      : policyRef
    if (policyId) {
      try {
        // If already populated with data, use it directly
        if (typeof policyRef === 'object' && (policyRef as AnyDoc).firstResponseTime) {
          return policyRef
        }
        return await payload.findByID({
          collection: slugs.slaPolicies as any,
          id: policyId as number,
          depth: 0,
          overrideAccess: true,
        })
      } catch {
        // Policy not found, fall through
      }
    }
  }

  // Look for a default policy matching this ticket's priority
  const priority = field(ticket, 'priority') || 'normal'
  try {
    const defaults = await payload.find({
      collection: slugs.slaPolicies as any,
      where: {
        and: [
          { isDefault: { equals: true } },
          { priority: { equals: priority } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (defaults.docs.length > 0) {
      return defaults.docs[0]
    }
  } catch {
    // Collection might not exist yet during migration
  }

  return null
}

/**
 * Handle an SLA breach: create notification and send email if escalation is configured.
 */
async function handleSlaBreach(
  payload: Payload,
  ticket: AnyDoc,
  type: 'first_response' | 'resolution',
  slugs: CollectionSlugs,
  notificationSlug: string,
): Promise<void> {
  const ticketNumber = (ticket.ticketNumber as string) || 'TK-????'
  const subject = (ticket.subject as string) || 'Support'
  const typeLabel = type === 'first_response' ? 'premiere reponse' : 'resolution'

  // Create admin notification
  await createAdminNotification(payload, {
    title: `SLA depasse : ${ticketNumber}`,
    message: `Le delai de ${typeLabel} a ete depasse pour le ticket ${ticketNumber} — ${subject}`,
    type: 'sla_alert',
    link: `/admin/collections/${slugs.tickets}/${ticket.id}`,
  }, notificationSlug)

  // Check if the SLA policy has escalation configured
  const policyRef = field(ticket, 'slaPolicy')
  if (!policyRef) return

  let policy: AnyDoc | null = null
  try {
    const policyId = typeof policyRef === 'object' && policyRef !== null
      ? (policyRef as AnyDoc).id
      : policyRef
    if (!policyId) return

    if (typeof policyRef === 'object' && (policyRef as AnyDoc).escalateOnBreach !== undefined) {
      policy = policyRef
    } else {
      policy = await payload.findByID({
        collection: slugs.slaPolicies as any,
        id: policyId as number,
        depth: 0,
        overrideAccess: true,
      })
    }
  } catch {
    return
  }

  if (!policy?.escalateOnBreach || !policy.escalateTo) return

  // Send escalation email
  try {
    const escalateToId = typeof policy.escalateTo === 'object'
      ? (policy.escalateTo as AnyDoc).id
      : policy.escalateTo
    if (!escalateToId) return

    const escalateUser = typeof policy.escalateTo === 'object' && (policy.escalateTo as AnyDoc).email
      ? policy.escalateTo
      : await payload.findByID({
          collection: slugs.users as any,
          id: escalateToId as number,
          depth: 0,
          overrideAccess: true,
        })

    if (!escalateUser?.email) return

    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
    const adminUrl = `${baseUrl}/admin/collections/${slugs.tickets}/${ticket.id}`
    const supportEmail = process.env.SUPPORT_EMAIL || ''

    await payload.sendEmail({
      to: escalateUser.email as string,
      ...(supportEmail ? { replyTo: supportEmail } : {}),
      subject: `SLA depasse : [${ticketNumber}] ${subject}`,
      html: emailWrapper(`SLA depasse — ${ticketNumber}`, [
        emailParagraph(`Le delai de <strong>${typeLabel}</strong> a ete depasse pour le ticket <strong>${ticketNumber}</strong> — <em>${subject}</em>.`),
        emailParagraph(`Ce ticket necessite une attention immediate.`),
        emailButton('Ouvrir le ticket', adminUrl, 'dark'),
      ].join('')),
    })

    console.log(`[sla] Escalation email sent to ${escalateUser.email} for ${ticketNumber} (${type})`)
  } catch (err) {
    console.error('[sla] Failed to send escalation email:', err)
  }
}

/**
 * Factory: Assign SLA deadlines when a ticket is created or SLA policy changes.
 * Runs as afterChange on tickets collection.
 */
export function createAssignSlaDeadlines(slugs: CollectionSlugs, notificationSlug = 'admin-notifications'): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    const { payload } = req

    // Only compute on create, or when slaPolicy/priority changes on update
    const isCreate = operation === 'create'
    const policyChanged = operation === 'update' && (
      resolveId(field(doc, 'slaPolicy')) !== resolveId(field(previousDoc, 'slaPolicy')) ||
      field(doc, 'priority') !== field(previousDoc, 'priority')
    )

    if (!isCreate && !policyChanged) return doc

    try {
      const policy = await resolveSlaPolicy(payload, doc, slugs)
      if (!policy) return doc

      const createdAt = new Date(doc.createdAt as string)
      const businessOnly = policy.businessHoursOnly as boolean
      const firstResponseMinutes = policy.firstResponseTime as number
      const resolutionMinutes = policy.resolutionTime as number

      const calcDeadline = businessOnly ? calculateBusinessHoursDeadline : calculateCalendarDeadline

      const slaFirstResponseDue = calcDeadline(createdAt, firstResponseMinutes).toISOString()
      const slaResolutionDue = calcDeadline(createdAt, resolutionMinutes).toISOString()

      const updateData: Record<string, unknown> = {
        slaFirstResponseDue,
        slaResolutionDue,
      }

      // Also link default policy if none was explicitly set
      if (!field(doc, 'slaPolicy') && policy.id) {
        updateData.slaPolicy = policy.id
      }

      await payload.update({
        collection: slugs.tickets as any,
        id: doc.id,
        data: updateData,
        overrideAccess: true,
      })
    } catch (err) {
      console.error('[sla] Failed to assign SLA deadlines:', err)
    }

    return doc
  }
}

/**
 * Factory: Check SLA resolution breach when ticket is resolved.
 * Runs as afterChange on tickets collection.
 */
export function createCheckSlaOnResolve(slugs: CollectionSlugs, notificationSlug = 'admin-notifications'): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== 'update') return doc
    if (previousDoc?.status === doc.status) return doc
    if (doc.status !== 'resolved') return doc
    if (!doc.slaResolutionDue) return doc

    // Skip if already checked
    if (doc.slaResolutionBreached !== undefined && doc.slaResolutionBreached !== null) return doc

    try {
      const { payload } = req
      const now = new Date()
      const deadline = new Date(doc.slaResolutionDue as string)
      const breached = now > deadline

      await payload.update({
        collection: slugs.tickets as any,
        id: doc.id,
        data: { slaResolutionBreached: breached },
        overrideAccess: true,
      })

      if (breached) {
        await handleSlaBreach(payload, doc, 'resolution', slugs, notificationSlug)
      }
    } catch (err) {
      console.error('[sla] Failed to check SLA on resolve:', err)
    }

    return doc
  }
}

/**
 * Factory: Check SLA breach on first admin response.
 * Runs as afterChange on ticket-messages collection.
 */
export function createCheckSlaOnReply(slugs: CollectionSlugs, notificationSlug = 'admin-notifications'): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc
    if (doc.authorType !== 'admin' || doc.isInternal) return doc

    try {
      const { payload } = req
      const ticketId = typeof doc.ticket === 'object' ? (doc.ticket as AnyDoc).id : doc.ticket

      const ticket = await payload.findByID({
        collection: slugs.tickets as any,
        id: ticketId as number,
        depth: 1,
        overrideAccess: true,
      })

      if (!ticket) return doc

      // Only check first response SLA if not already breached/recorded
      if (ticket.slaFirstResponseBreached !== undefined && ticket.slaFirstResponseBreached !== null) return doc
      if (!ticket.slaFirstResponseDue) return doc

      const now = new Date()
      const deadline = new Date(ticket.slaFirstResponseDue as string)
      const breached = now > deadline

      await payload.update({
        collection: slugs.tickets as any,
        id: ticketId as number,
        data: { slaFirstResponseBreached: breached },
        overrideAccess: true,
      })

      // Notify on breach if escalation is configured
      if (breached) {
        await handleSlaBreach(payload, ticket, 'first_response', slugs, notificationSlug)
      }
    } catch (err) {
      console.error('[sla] Failed to check SLA on reply:', err)
    }

    return doc
  }
}
