import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { FIXED_SLUGS } from '../utils/slugs'
import { requireClient, handleAuthError } from '../utils/auth'
import { dbFind, dbFindByID } from '../utils/db'

const EMPTY = { docs: [] as any[] }

/**
 * GET /api/support/export-data
 * RGPD Data Export — allows support clients to download all their personal data.
 *
 * The payload is split in two. `providedByYou` is what article 20
 * (portability) covers: what the person or their correspondents typed.
 * `derivedData` is what the plugin computed ABOUT them — the AI client
 * summary. Article 20 does not cover derived data; article 15 (access) does,
 * and article 17 (erasure) does too, which is why `delete-account` removes
 * `client-summaries` as well. Merging the two sections would blur that.
 */
export function createExportDataEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/export-data',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireClient(req, slugs)

        // Feature-flagged collections are not registered when their flag is
        // off; addressing one that does not exist throws.
        const isRegistered = (slug: string): boolean =>
          Boolean((payload.collections as Record<string, unknown> | undefined)?.[slug])

        const [
          clientData,
          ticketsResult,
          messagesResult,
          surveysResult,
          chatResult,
          feedbackResult,
          summariesResult,
        ] = await Promise.all([
          dbFindByID(payload, slugs.supportClients, {
            id: req.user.id,
            depth: 0,
            overrideAccess: true,
          }),
          dbFind(payload, slugs.tickets, {
            where: { client: { equals: req.user.id } },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          }),
          dbFind(payload, slugs.ticketMessages, {
            where: {
              'ticket.client': { equals: req.user.id },
              authorType: { equals: 'client' },
            },
            limit: 5000,
            depth: 0,
            overrideAccess: true,
          }),
          dbFind(payload, slugs.satisfactionSurveys, {
            where: { client: { equals: req.user.id } },
            limit: 500,
            depth: 0,
            overrideAccess: true,
          }),
          isRegistered(slugs.chatMessages)
            ? dbFind(payload, slugs.chatMessages, {
              where: { client: { equals: req.user.id } },
              limit: 5000,
              depth: 0,
              overrideAccess: true,
            })
            : EMPTY,
          isRegistered(FIXED_SLUGS.ticketFeedback)
            ? dbFind(payload, FIXED_SLUGS.ticketFeedback, {
              where: { client: { equals: req.user.id } },
              limit: 500,
              depth: 0,
              overrideAccess: true,
            })
            : EMPTY,
          isRegistered(FIXED_SLUGS.clientSummaries)
            ? dbFind(payload, FIXED_SLUGS.clientSummaries, {
              where: { client: { equals: req.user.id } },
              limit: 100,
              depth: 0,
              overrideAccess: true,
            })
            : EMPTY,
        ])

        const ticketIds = ticketsResult.docs.map((t: any) => t.id)

        // Time entries hang off the tickets, not off the client.
        const timeResult = ticketIds.length > 0 && isRegistered(slugs.timeEntries)
          ? await dbFind(payload, slugs.timeEntries, {
            where: { ticket: { in: ticketIds } },
            limit: 5000,
            depth: 0,
            overrideAccess: true,
          })
          : EMPTY

        const c = clientData as any
        const providedByYou = {
          profile: {
            email: c.email,
            firstName: c.firstName,
            lastName: c.lastName,
            company: c.company,
            phone: c.phone || null,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          },
          tickets: ticketsResult.docs.map((t: any) => ({
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            category: t.category,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })),
          messages: messagesResult.docs.map((m: any) => ({
            ticketId: m.ticket,
            body: m.body,
            createdAt: m.createdAt,
          })),
          surveys: surveysResult.docs.map((s: any) => ({
            ticketId: s.ticket,
            rating: s.rating,
            comment: s.comment,
            createdAt: s.createdAt,
          })),
          feedback: feedbackResult.docs.map((f: any) => ({
            ticketId: f.ticket,
            rating: f.rating,
            comment: f.comment,
            submittedFrom: f.submittedFrom,
            createdAt: f.createdAt,
          })),
          chatMessages: chatResult.docs.map((m: any) => ({
            session: m.session,
            senderType: m.senderType,
            message: m.message,
            createdAt: m.createdAt,
          })),
          timeEntries: timeResult.docs.map((e: any) => ({
            ticketId: e.ticket,
            duration: e.duration,
            date: e.date,
            description: e.description,
            billable: e.billable,
          })),
        }

        const exportData = {
          exportDate: new Date().toISOString(),
          exportType: 'RGPD - Export des données personnelles',
          providedByYou: {
            legalBasis: 'Art. 20 RGPD - droit à la portabilité',
            ...providedByYou,
          },
          derivedData: {
            legalBasis: 'Art. 15 RGPD - droit d\'accès (données dérivées, hors portabilité)',
            clientSummaries: summariesResult.docs.map((s: any) => ({
              summary: s.summary,
              recurringTopics: s.recurringTopics,
              patterns: s.patterns,
              keyFacts: s.keyFacts,
              ticketCount: s.ticketCount,
              messageCount: s.messageCount,
              averageSatisfaction: s.averageSatisfaction,
              generatedAt: s.generatedAt,
              aiModel: s.aiModel,
            })),
          },
        }

        const json = JSON.stringify(exportData, null, 2)

        return new Response(json, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="support-export-${req.user.id}-${new Date().toISOString().slice(0, 10)}.json"`,
          },
        })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[export-data] Error:', error)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
