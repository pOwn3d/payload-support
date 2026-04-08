import React from 'react'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { DashboardClient } from './DashboardClient'

export default async function SupportDashboardPage() {
  const payload = await getPayload({ config: configPromise })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) return null

  const tickets = await payload.find({
    collection: 'tickets',
    where: {
      client: { equals: user.id },
    },
    sort: '-updatedAt',
    limit: 200,
    depth: 1,
    overrideAccess: false,
    user,
  })

  // Fetch all messages for these tickets
  const ticketIds = tickets.docs.map((t) => t.id)
  const allMessages = ticketIds.length > 0
    ? await payload.find({
        collection: 'ticket-messages',
        where: {
          ticket: { in: ticketIds },
        },
        sort: '-createdAt',
        limit: 500,
        depth: 0,
        overrideAccess: false,
        user,
      })
    : { docs: [] }

  // Build map of lastClientReadAt per ticket
  const readAtMap: Record<string | number, string | null> = {}
  for (const t of tickets.docs) {
    readAtMap[t.id] = t.lastClientReadAt || null
  }

  // Build message meta per ticket (allMessages sorted by -createdAt, so first entry per ticket is the latest)
  const ticketMeta: Record<string | number, { hasNew: boolean; count: number; lastMessagePreview: string }> = {}
  for (const msg of allMessages.docs) {
    const tid = typeof msg.ticket === 'object' ? msg.ticket.id : msg.ticket
    if (!ticketMeta[tid]) {
      const lastRead = readAtMap[tid]
      const isUnread = msg.authorType === 'admin' && (!lastRead || new Date(msg.createdAt) > new Date(lastRead))
      const preview = (msg.body || '').replace(/\n/g, ' ').slice(0, 80)
      ticketMeta[tid] = { hasNew: isUnread, count: 1, lastMessagePreview: preview }
    } else {
      ticketMeta[tid].count++
    }
  }

  // Serialize tickets for client component
  const serializedTickets = tickets.docs.map((ticket) => {
    const meta = ticketMeta[ticket.id]
    const isClosed = ticket.status === 'resolved'
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      projectName: ticket.project && typeof ticket.project === 'object' ? ticket.project.name : null,
      updatedAt: ticket.updatedAt,
      createdAt: ticket.createdAt,
      hasNewMessage: (meta?.hasNew && !isClosed) || false,
      messageCount: meta?.count || 0,
      totalTimeMinutes: ticket.totalTimeMinutes,
      lastMessagePreview: meta?.lastMessagePreview || null,
    }
  })

  return <DashboardClient tickets={serializedTickets} />
}
