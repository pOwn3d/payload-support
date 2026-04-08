import React from 'react'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TicketReplyForm } from './TicketReplyForm'
import { CloseTicketButton } from './CloseTicketButton'
import { ReopenTicketButton } from './ReopenTicketButton'
import { SatisfactionForm } from './SatisfactionForm'
import { CollapsibleMessages } from './CollapsibleMessages'
import { TicketPolling } from './TicketPolling'
import { MarkSolutionButton } from './MarkSolutionButton'
import { PrintButton } from './PrintButton'
import { TypingIndicator } from './TypingIndicator'
import { MessageActions, EditedBadge, DeletedMessage } from './MessageActions'
import { ReadReceipt } from './ReadReceipt'
// Document type for ticket attachments
type PayloadDocument = { filename?: string; title?: string; url?: string }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Ouvert', color: 'text-green-700', bg: 'bg-green-50 text-green-700' },
  waiting_client: { label: 'En attente', color: 'text-amber-700', bg: 'bg-amber-50 text-amber-700' },
  resolved: { label: 'Résolu', color: 'text-blue-700', bg: 'bg-blue-50 text-blue-700' },
}

// Date formatting helpers
const TZ = 'Europe/Paris'

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const todayParis = today.toLocaleDateString('fr-FR', { timeZone: TZ })
  const dateParis = date.toLocaleDateString('fr-FR', { timeZone: TZ })
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayParis = yesterday.toLocaleDateString('fr-FR', { timeZone: TZ })

  if (dateParis === todayParis) return "Aujourd'hui"
  if (dateParis === yesterdayParis) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })
}

function formatMessageDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const todayParis = today.toLocaleDateString('fr-FR', { timeZone: TZ })
  const dateParis = date.toLocaleDateString('fr-FR', { timeZone: TZ })
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayParis = yesterday.toLocaleDateString('fr-FR', { timeZone: TZ })
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })

  if (dateParis === todayParis) return time
  if (dateParis === yesterdayParis) return `Hier, ${time}`
  if (date.getFullYear() === today.getFullYear()) {
    return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: TZ })}, ${time}`
  }
  return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })}, ${time}`
}

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Basse', color: 'text-gray-600', bg: 'bg-gray-100 text-gray-600' },
  normal: { label: 'Normale', color: 'text-blue-600', bg: 'bg-blue-50 text-blue-600' },
  high: { label: 'Haute', color: 'text-orange-600', bg: 'bg-orange-50 text-orange-600' },
  urgent: { label: 'Urgente', color: 'text-red-600', bg: 'bg-red-50 text-red-600' },
}

const categoryLabels: Record<string, string> = {
  bug: 'Bug / Dysfonctionnement',
  content: 'Modification de contenu',
  feature: 'Nouvelle fonctionnalité',
  question: 'Question / Aide',
  hosting: 'Hébergement / Domaine',
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config: configPromise })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) return null

  // Fetch the ticket
  let ticket
  try {
    ticket = await payload.findByID({
      collection: 'tickets',
      id,
      depth: 1,
      overrideAccess: false,
      user,
    })
  } catch {
    notFound()
  }

  if (!ticket) notFound()

  // Mark as read by updating lastClientReadAt
  if (user.collection === 'support-clients') {
    payload.update({
      collection: 'tickets',
      id: ticket.id,
      data: { lastClientReadAt: new Date().toISOString() },
      overrideAccess: true,
    }).catch(() => {})
  }

  // Fetch messages for this ticket
  const messages = await payload.find({
    collection: 'ticket-messages',
    where: {
      ticket: { equals: ticket.id },
    },
    sort: 'createdAt',
    limit: 100,
    depth: 1,
    overrideAccess: false,
    user,
  })

  // Check if satisfaction survey already exists
  let hasSurvey = false
  if (ticket.status === 'resolved') {
    const existingSurvey = await payload.find({
      collection: 'satisfaction-surveys',
      where: { ticket: { equals: ticket.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    hasSurvey = existingSurvey.docs.length > 0
  }

  const status = statusConfig[ticket.status || 'open']
  const priority = priorityConfig[ticket.priority || 'normal']
  const isClosed = ticket.status === 'resolved'

  // Compute client initials for avatar
  const clientInitials = (() => {
    const fn = (user as { firstName?: string }).firstName || ''
    const ln = (user as { lastName?: string }).lastName || ''
    return ((fn[0] || '') + (ln[0] || '')).toUpperCase() || '?'
  })()

  // SLA indicator
  const slaInfo = (() => {
    if (!ticket.createdAt) return null
    const created = new Date(ticket.createdAt)
    const now = new Date()

    if (ticket.firstResponseAt) {
      const firstResponse = new Date(ticket.firstResponseAt)
      const responseTimeMs = firstResponse.getTime() - created.getTime()
      const responseTimeH = Math.floor(responseTimeMs / (1000 * 60 * 60))
      const responseTimeM = Math.floor((responseTimeMs % (1000 * 60 * 60)) / (1000 * 60))
      return {
        label: 'Temps de réponse',
        value: responseTimeH > 0 ? `${responseTimeH}h${String(responseTimeM).padStart(2, '0')}` : `${responseTimeM}min`,
        resolved: ticket.resolvedAt,
      }
    }

    // Waiting for first response
    const waitingMs = now.getTime() - created.getTime()
    const waitingH = Math.floor(waitingMs / (1000 * 60 * 60))
    return {
      label: 'En attente depuis',
      value: waitingH < 1 ? 'Moins d\'1h' : waitingH < 24 ? `${waitingH}h` : `${Math.floor(waitingH / 24)}j`,
      resolved: null,
    }
  })()

  // Sidebar content for XL 2-column layout (ticket metadata)
  const ticketSidebar = (
    <aside className="hidden xl:block">
      <div className="sticky top-4 space-y-4">
        {/* Status & Priority */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Détails</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Statut</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.bg} dark:bg-opacity-20`}>
                {status.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Priorité</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${priority.bg} dark:bg-opacity-20`}>
                {priority.label}
              </span>
            </div>
            {ticket.category && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Catégorie</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{categoryLabels[ticket.category]}</span>
              </div>
            )}
            {slaInfo && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">{slaInfo.label}</span>
                <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">{slaInfo.value}</span>
              </div>
            )}
            {ticket.project && typeof ticket.project === 'object' && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Projet</span>
                <span className="inline-flex items-center rounded-full bg-cyan-50 dark:bg-cyan-900/30 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:text-cyan-400">
                  {ticket.project.name}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Créé le</span>
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                {ticket.createdAt
                  ? new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: TZ,
                    })
                  : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Documents sidebar */}
        {(ticket.quote || ticket.invoice) && (() => {
          const quoteDoc = typeof ticket.quote === 'object' ? ticket.quote as PayloadDocument : null
          const invoiceDoc = typeof ticket.invoice === 'object' ? ticket.invoice as PayloadDocument : null
          return (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-4 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Documents</h2>
              <div className="space-y-2">
                {quoteDoc && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_SERVER_URL || ''}/api/documents/file/${quoteDoc.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm font-medium text-amber-800 dark:text-amber-300 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  >
                    <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs">Devis</span>
                  </a>
                )}
                {invoiceDoc && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_SERVER_URL || ''}/api/documents/file/${invoiceDoc.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-300 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                  >
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs">Facture</span>
                    {(() => {
                      const ps = ticket.paymentStatus
                      if (ps === 'paid') return <span className="ml-auto rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">Payé</span>
                      if (ps === 'partial') return <span className="ml-auto rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">Partiel</span>
                      return <span className="ml-auto rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">Non payé</span>
                    })()}
                  </a>
                )}
              </div>
            </div>
          )
        })()}

        {/* Actions sidebar */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-4 shadow-sm">
          <div className="flex flex-col gap-2">
            <PrintButton />
            {!isClosed && (
              <CloseTicketButton ticketId={ticket.id} />
            )}
          </div>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: 1920, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 32 }}>
      {/* Print styles for PDF export */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          header, nav, .no-print, button, form, [role="link"] { display: none !important; }
          .print-show { display: block !important; }
          body { background: white !important; }
          * { border-color: #e5e7eb !important; }
        }
      `}} />

      {/* Main column */}
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 64px)' }}>
        {/* Auto-refresh polling */}
        <TicketPolling ticketId={ticket.id} messageCount={messages.docs.length} />

        {/* Non-scrollable header area */}
        <div className="flex-shrink-0">
          {/* Breadcrumb */}
          <div className="mb-5">
            <Link
              href="/support/dashboard"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Retour aux tickets
            </Link>
          </div>

          {/* Ticket header card */}
          <div className="mb-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-5 sm:p-6 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                {/* Ticket number + badges row */}
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{ticket.ticketNumber}</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.bg} dark:bg-opacity-20`}>
                    {status.label}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold xl:hidden ${priority.bg} dark:bg-opacity-20`}>
                    {priority.label}
                  </span>
                  {slaInfo && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 xl:hidden">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span className="font-mono">{slaInfo.label} : {slaInfo.value}</span>
                    </span>
                  )}
                </div>
                {/* Title */}
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-snug sm:text-xl">{ticket.subject}</h1>
                {/* Metadata -- hidden on XL (shown in sidebar) */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 xl:hidden">
                  {ticket.category && (
                    <span className="inline-flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                      {categoryLabels[ticket.category]}
                    </span>
                  )}
                  {ticket.project && typeof ticket.project === 'object' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 dark:bg-cyan-900/30 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:text-cyan-400">
                      {ticket.project.name}
                    </span>
                  )}
                  <span className="font-mono">
                    Créé le{' '}
                    {ticket.createdAt
                      ? new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: TZ,
                        })
                      : ''}
                  </span>
                </div>
              </div>
              {/* Actions -- hidden on XL (shown in sidebar) */}
              <div className="flex flex-shrink-0 items-center gap-2 xl:hidden">
                <PrintButton />
                {!isClosed && (
                  <CloseTicketButton ticketId={ticket.id} />
                )}
              </div>
            </div>
          </div>

          {/* Documents -- visible below XL only (on XL they are in the sidebar) */}
          <div className="xl:hidden">
            {(ticket.quote || ticket.invoice) && (() => {
              const quoteDoc = typeof ticket.quote === 'object' ? ticket.quote as PayloadDocument : null
              const invoiceDoc = typeof ticket.invoice === 'object' ? ticket.invoice as PayloadDocument : null
              return (
                <div className="mb-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-5 shadow-sm">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Documents</h2>
                  <div className="flex flex-wrap gap-3">
                    {quoteDoc && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_SERVER_URL || ''}/api/documents/file/${quoteDoc.filename}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-300 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:shadow-sm"
                      >
                        <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <div className="text-sm">Devis</div>
                          <div className="text-xs font-normal text-slate-500 dark:text-slate-400">{quoteDoc.title || 'PDF'}</div>
                        </div>
                        <svg className="ml-2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    )}
                    {invoiceDoc && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_SERVER_URL || ''}/api/documents/file/${invoiceDoc.filename}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:shadow-sm"
                      >
                        <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <div className="text-sm">Facture</div>
                          <div className="text-xs font-normal text-slate-500 dark:text-slate-400">{invoiceDoc.title || 'PDF'}</div>
                        </div>
                        {(() => {
                          const ps = ticket.paymentStatus
                          if (ps === 'paid') return <span className="ml-2 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">Payé</span>
                          if (ps === 'partial') return <span className="ml-2 rounded-full bg-orange-100 dark:bg-orange-900/30 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">Partiel</span>
                          return <span className="ml-2 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">Non payé</span>
                        })()}
                        <svg className="ml-1 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Scrollable conversation area */}
        <div className="flex-1 min-h-0 overflow-y-auto mb-0 rounded-t-2xl border border-b-0 border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-800/50 dark:to-slate-800/90 shadow-sm">
          {/* Conversation header */}
          <div className="sticky top-0 z-10 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-5 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Conversation</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">{messages.docs.length} message{messages.docs.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Messages area */}
          <div className="px-4 py-5 sm:px-6 space-y-1">
          {/* Automatic acknowledgement for new tickets */}
          {messages.docs.length <= 1 && ticket.createdAt && (Date.now() - new Date(ticket.createdAt).getTime()) < 3600000 && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 px-4 py-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                  <svg className="h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-green-800 dark:text-green-300">Demande enregistr&eacute;e</span>
                  <span className="text-green-600 dark:text-green-400"> &mdash; R&eacute;ponse sous 2h en moyenne</span>
                </div>
              </div>
            </div>
          )}

          {messages.docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-slate-400">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Aucun message pour le moment</p>
            </div>
          ) : (
            <CollapsibleMessages>
            {messages.docs.map((msg, idx) => {
              const isClient = msg.authorType === 'client' || msg.authorType === 'email'
              const authorName = isClient
                ? msg.authorType === 'email'
                  ? 'Email'
                  : 'Vous'
                : 'Support'

              // Date separator: check if day changed from previous message
              const prevMsg = idx > 0 ? messages.docs[idx - 1] : null
              const showDateSeparator = msg.createdAt && (!prevMsg?.createdAt || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString())

              return (
                <React.Fragment key={msg.id}>
                  {showDateSeparator && (
                    <div className="flex items-center gap-3 py-3 my-1">
                      <div className="flex-1 border-t border-slate-200/60 dark:border-slate-700/60" />
                      <span className="rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 px-3 py-1 text-xs font-medium font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap shadow-sm">{getDateLabel(msg.createdAt!)}</span>
                      <div className="flex-1 border-t border-slate-200/60 dark:border-slate-700/60" />
                    </div>
                  )}

                  <div className={`flex items-end gap-2.5 mb-3 ${isClient ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    {isClient ? (
                      <div className="flex-shrink-0 h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        {clientInitials}
                      </div>
                    ) : (
                      <div className="flex-shrink-0 h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        CW
                      </div>
                    )}

                    {/* Message bubble */}
                    <div className={`group relative max-w-[88%] sm:max-w-[80%] md:max-w-[75%] ${isClient ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`relative rounded-2xl px-4 py-2.5 ${
                          isClient
                            ? 'rounded-br-md bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200'
                            : 'rounded-bl-md bg-blue-600 text-white'
                        }`}
                      >
                        {/* Author + time */}
                        <div className={`mb-1 flex items-center gap-2 ${isClient ? 'justify-end' : ''}`}>
                          <span className={`text-xs font-semibold ${isClient ? 'text-slate-500 dark:text-slate-400' : 'text-blue-100'}`}>
                            {authorName}
                          </span>
                          <span className={`text-xs font-mono ${isClient ? 'text-slate-500 dark:text-slate-400' : 'text-blue-200'}`}>
                            {msg.createdAt ? formatMessageDate(msg.createdAt) : ''}
                            <EditedBadge editedAt={(msg as unknown as { editedAt?: string }).editedAt} />
                          </span>
                        </div>

                        {/* Message content */}
                        {(msg as unknown as { deletedAt?: string }).deletedAt ? (
                          <DeletedMessage />
                        ) : msg.bodyHtml ? (
                          <div
                            className={`text-sm leading-relaxed [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:opacity-80 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:mb-1 last:[&_p]:mb-0 ${
                              isClient
                                ? '[&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline [&_blockquote]:border-slate-300 [&_blockquote]:bg-slate-50 dark:[&_blockquote]:bg-slate-600/30 [&_blockquote]:rounded-r-lg [&_blockquote]:py-1 [&_blockquote]:px-3'
                                : '[&_a]:text-blue-100 [&_a]:underline [&_blockquote]:border-blue-300 [&_blockquote]:rounded-r-lg [&_blockquote]:py-1 [&_blockquote]:px-3'
                            }`}
                            dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap text-sm leading-relaxed" dangerouslySetInnerHTML={{
                            __html: msg.body
                              .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                              .replace(/\[code:(\d+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-semibold">🔗 Voir le code partagé</a>')
                              .replace(/\n/g, '<br/>')
                          }} />
                        )}

                        {/* Attachments */}
                        {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                          <div className="mt-2.5 space-y-2">
                            {/* Inline image previews */}
                            {msg.attachments
                              .filter((att) => {
                                const file = typeof att.file === 'object' ? att.file : null
                                return file?.mimeType?.startsWith('image/')
                              })
                              .map((att, i) => {
                                const file = typeof att.file === 'object' ? att.file : null
                                if (!file) return null
                                const thumbnailUrl = file.sizes?.medium?.url || file.sizes?.small?.url || file.url
                                return (
                                  <a
                                    key={`img-${i}`}
                                    href={file.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block overflow-hidden rounded-xl border border-white/20 transition-opacity hover:opacity-90"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={thumbnailUrl || file.url || ''}
                                      alt={file.alt || file.filename || 'Image jointe'}
                                      className="max-h-72 w-auto object-contain rounded-xl"
                                      loading="lazy"
                                    />
                                  </a>
                                )
                              })}
                            {/* Video previews */}
                            {msg.attachments
                              .filter((att) => {
                                const file = typeof att.file === 'object' ? att.file : null
                                return file?.mimeType?.startsWith('video/')
                              })
                              .map((att, i) => {
                                const file = typeof att.file === 'object' ? att.file : null
                                if (!file) return null
                                return (
                                  <video
                                    key={`vid-${i}`}
                                    src={file.url || ''}
                                    controls
                                    preload="metadata"
                                    className="max-h-52 max-w-sm rounded-xl bg-black"
                                  />
                                )
                              })}
                            {/* Non-media file links */}
                            <div className="flex flex-wrap gap-1.5">
                              {msg.attachments
                                .filter((att) => {
                                  const file = typeof att.file === 'object' ? att.file : null
                                  return file && !file.mimeType?.startsWith('image/') && !file.mimeType?.startsWith('video/')
                                })
                                .map((att, i) => {
                                  const file = typeof att.file === 'object' ? att.file : null
                                  if (!file) return null
                                  return (
                                    <a
                                      key={`file-${i}`}
                                      href={file.url || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                        isClient
                                          ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500'
                                          : 'bg-blue-500/30 text-blue-50 hover:bg-blue-500/50'
                                      }`}
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                      </svg>
                                      {file.filename || 'Fichier'}
                                    </a>
                                  )
                                })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions below bubble */}
                      <div className={`mt-1 flex items-center gap-1.5 ${isClient ? 'justify-end' : 'justify-start'}`}>
                        {/* Edit/delete actions for client messages */}
                        {isClient && msg.authorType === 'client' && !(msg as unknown as { deletedAt?: string }).deletedAt && (
                          <MessageActions
                            messageId={msg.id}
                            body={msg.body}
                            createdAt={msg.createdAt}
                          />
                        )}
                        {/* Read receipt on last client message */}
                        {isClient && idx === messages.docs.length - 1 && (
                          <ReadReceipt
                            lastAdminReadAt={ticket.lastAdminReadAt as string | undefined}
                            messageCreatedAt={msg.createdAt}
                          />
                        )}
                        {/* Solution badge / mark button */}
                        {msg.isSolution && (
                          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-200 dark:border-emerald-800/50">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                              <polyline points="20,6 9,17 4,12" />
                            </svg>
                            Solution
                          </div>
                        )}
                        {!isClient && !msg.isSolution && !isClosed && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MarkSolutionButton messageId={msg.id} isSolution={false} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              )
            })}
            </CollapsibleMessages>
          )}
        </div>

          {/* Typing indicator inside conversation */}
          <div className="px-4 sm:px-6 pb-2">
            <TypingIndicator ticketId={ticket.id} />
          </div>
        </div>

        {/* Sticky reply form or resolved state at bottom */}
        <div className="flex-shrink-0 border-t border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-3">
          {!isClosed ? (
            <TicketReplyForm ticketId={ticket.id} />
          ) : (
            <div className="space-y-4">
              {/* Resolved card */}
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 p-6 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-white">
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                </div>
                <p className="text-base font-bold text-emerald-900 dark:text-emerald-200">Ce ticket est résolu</p>
                <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                  Un souci persiste ?
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <ReopenTicketButton ticketId={ticket.id} />
                  <Link
                    href="/support/tickets/new"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Nouveau ticket
                  </Link>
                </div>
              </div>
              {/* Satisfaction survey */}
              {!hasSurvey && user.collection === 'support-clients' && (
                <SatisfactionForm ticketId={ticket.id} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* XL sidebar */}
      {ticketSidebar}
    </div>
  )
}
