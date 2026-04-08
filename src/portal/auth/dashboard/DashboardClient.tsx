'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'

interface TicketData {
  id: number | string
  ticketNumber: string | null | undefined
  subject: string
  status: string | null | undefined
  priority: string | null | undefined
  category: string | null | undefined
  projectName: string | null
  updatedAt: string | null | undefined
  createdAt: string | null | undefined
  hasNewMessage: boolean
  messageCount: number
  totalTimeMinutes: number | null | undefined
  lastMessagePreview: string | null | undefined
}

const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
  open: { label: 'Ouvert', dot: 'bg-emerald-500', bg: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-400/20' },
  waiting_client: { label: 'En attente', dot: 'bg-amber-500', bg: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-400/20' },
  resolved: { label: 'Resolu', dot: 'bg-slate-400', bg: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-400/20' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Basse', color: 'text-slate-400 dark:text-slate-500' },
  normal: { label: 'Normale', color: 'text-blue-600 dark:text-blue-400' },
  high: { label: 'Haute', color: 'text-orange-600 dark:text-orange-400' },
  urgent: { label: 'Urgente', color: 'text-red-600 dark:text-red-400' },
}

const categoryLabels: Record<string, string> = {
  bug: 'Bug',
  content: 'Contenu',
  feature: 'Fonctionnalité',
  question: 'Question',
  hosting: 'Hébergement',
}

type Tab = 'active' | 'archived'
type SortBy = 'updatedAt' | 'createdAt' | 'priority'

const PAGE_SIZE = 20

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)

  if (diffMin < 1) return "A l'instant"
  if (diffMin < 60) return `il y a ${diffMin}min`
  if (diffH < 24) return `il y a ${diffH}h`
  if (diffD < 7) return `il y a ${diffD}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function DashboardClient({ tickets }: { tickets: TicketData[] }) {
  const [tab, setTab] = useState<Tab>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('updatedAt')
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Global search across messages
  const [searchMatchedIds, setSearchMatchedIds] = useState<Set<number | string>>(new Set())
  const [messageSearchLoading, setMessageSearchLoading] = useState(false)
  const [messageSearchCount, setMessageSearchCount] = useState(0)

  // Extract unique projects
  const projects = useMemo(() => {
    const names = new Set<string>()
    tickets.forEach((t) => { if (t.projectName) names.add(t.projectName) })
    return Array.from(names).sort()
  }, [tickets])

  // Search in ticket messages when query >= 3 chars
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchMatchedIds(new Set())
      setMessageSearchCount(0)
      return
    }

    setMessageSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/ticket-messages?where[body][like]=${encodeURIComponent(searchQuery)}&limit=50&depth=1`,
          { credentials: 'include' },
        )
        if (res.ok) {
          const data = await res.json()
          const docs = data.docs || []
          const matchedIds = new Set<number | string>(
            docs.map((m: { ticket: { id: number | string } | number | string }) =>
              typeof m.ticket === 'object' ? m.ticket.id : m.ticket,
            ),
          )
          setSearchMatchedIds(matchedIds)
          setMessageSearchCount(matchedIds.size)
        }
      } catch {
        // Silently fail
      } finally {
        setMessageSearchLoading(false)
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      setMessageSearchLoading(false)
    }
  }, [searchQuery])

  // Split tickets by tab
  const archivedStatuses = ['resolved']
  const activeTickets = tickets.filter((t) => !archivedStatuses.includes(t.status || ''))
  const archivedTickets = tickets.filter((t) => archivedStatuses.includes(t.status || ''))

  const baseTickets = tab === 'active' ? activeTickets : archivedTickets

  // Apply search + filters
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return baseTickets.filter((t) => {
      if (query) {
        const matchSubject = t.subject.toLowerCase().includes(query)
        const matchNumber = (t.ticketNumber || '').toLowerCase().includes(query)
        const matchMessages = searchMatchedIds.has(t.id)
        if (!matchSubject && !matchNumber && !matchMessages) return false
      }
      if (filterStatus && t.status !== filterStatus) return false
      if (filterCategory && t.category !== filterCategory) return false
      if (filterProject && t.projectName !== filterProject) return false
      return true
    })
  }, [baseTickets, searchQuery, filterStatus, filterCategory, filterProject, searchMatchedIds])

  // Apply sort
  const sorted = useMemo(() => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
    return [...filtered].sort((a, b) => {
      if (sortBy === 'priority') {
        return (priorityOrder[a.priority || 'normal'] || 2) - (priorityOrder[b.priority || 'normal'] || 2)
      }
      const dateA = new Date(a[sortBy] || 0).getTime()
      const dateB = new Date(b[sortBy] || 0).getTime()
      return dateB - dateA
    })
  }, [filtered, sortBy])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedTickets = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const resetPage = () => setCurrentPage(1)

  // Stats
  const stats = useMemo(() => {
    return {
      total: tickets.length,
      active: activeTickets.length,
      archived: archivedTickets.length,
      newMessages: tickets.filter((t) => t.hasNewMessage).length,
    }
  }, [tickets, activeTickets, archivedTickets])

  const activeFilterCount = [filterStatus, filterCategory, filterProject].filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Mes tickets</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Suivez et gerez vos demandes de support
          </p>
        </div>
        <Link
          href="/support/tickets/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouveau ticket
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-blue-600 dark:text-blue-400">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.active}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Actifs</p>
            </div>
          </div>
        </div>

        {stats.newMessages > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-blue-600 dark:text-blue-400">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.newMessages}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Non lus</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-slate-500 dark:text-slate-400">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-slate-400 dark:text-slate-500">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.archived}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Archives</p>
            </div>
          </div>
        </div>
      </div>

      {/* Response time banner */}
      <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/20">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-blue-600 dark:text-blue-400">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Notre temps de reponse moyen est de <strong>moins de 2h</strong> en jours ouvres.
        </p>
      </div>

      {/* Main content card */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {/* Tabs + Search bar */}
        <div className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between px-4 sm:px-5">
            <div className="flex gap-0">
              <button
                onClick={() => { setTab('active'); setFilterStatus(''); resetPage() }}
                className={`relative cursor-pointer px-4 py-3.5 text-sm font-medium transition-colors ${
                  tab === 'active'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                Actifs
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  tab === 'active'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {activeTickets.length}
                </span>
                {tab === 'active' && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
              <button
                onClick={() => { setTab('archived'); setFilterStatus(''); resetPage() }}
                className={`relative cursor-pointer px-4 py-3.5 text-sm font-medium transition-colors ${
                  tab === 'archived'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                Archives
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  tab === 'archived'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {archivedTickets.length}
                </span>
                {tab === 'archived' && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search + Sort + Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
          <div className="relative flex-1 sm:max-w-xs">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); resetPage() }}
              placeholder="Rechercher..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-600 dark:focus:ring-blue-900/30"
            />
            {messageSearchLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-600 dark:border-t-blue-400" />
              </div>
            )}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="updatedAt">Derniere activite</option>
            <option value="createdAt">Date de creation</option>
            <option value="priority">Priorite</option>
          </select>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Filtres
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Message search indicator */}
        {searchQuery.length >= 3 && !messageSearchLoading && messageSearchCount > 0 && (
          <div className="border-b border-slate-100 px-5 py-2 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {messageSearchCount} ticket{messageSearchCount > 1 ? 's' : ''} trouve{messageSearchCount > 1 ? 's' : ''} via les messages
            </p>
          </div>
        )}

        {/* Collapsible filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/30">
            {tab === 'active' && (
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); resetPage() }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">Tous les statuts</option>
                <option value="open">Ouvert</option>
                <option value="waiting_client">En attente</option>
              </select>
            )}
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); resetPage() }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="">Toutes categories</option>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {projects.length > 0 && (
              <select
                value={filterProject}
                onChange={(e) => { setFilterProject(e.target.value); resetPage() }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">Tous les projets</option>
                {projects.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => { setFilterStatus(''); setFilterCategory(''); setFilterProject(''); resetPage() }}
                className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-700 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-slate-300"
              >
                Effacer
              </button>
            )}
          </div>
        )}

        {/* Results count when searching */}
        {searchQuery && (
          <div className="border-b border-slate-100 px-5 py-2 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sorted.length} resultat{sorted.length !== 1 ? 's' : ''} pour « {searchQuery} »
            </p>
          </div>
        )}

        {/* Ticket list (inbox style) */}
        {paginatedTickets.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              {searchQuery ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-slate-400 dark:text-slate-500">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-slate-400 dark:text-slate-500">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
              )}
            </div>
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
              {searchQuery ? 'Aucun resultat' : tab === 'archived' ? 'Aucun ticket archive' : 'Aucun ticket'}
            </h3>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
              {searchQuery
                ? `Aucun ticket ne correspond a "${searchQuery}"`
                : tab === 'archived'
                  ? 'Vos tickets resolus apparaitront ici'
                  : "Vous n'avez pas encore de demande de support"}
            </p>
            {!searchQuery && tab === 'active' && (
              <Link
                href="/support/tickets/new"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Nouveau ticket
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedTickets.map((ticket) => {
              const status = statusConfig[ticket.status || 'open'] || statusConfig.open
              const priority = priorityConfig[ticket.priority || 'normal']
              const category = ticket.category ? categoryLabels[ticket.category] : null

              return (
                <Link
                  key={ticket.id}
                  href={`/support/tickets/${ticket.id}`}
                  className={`group flex items-start gap-3 px-4 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:items-center sm:gap-4 sm:px-5 ${
                    ticket.hasNewMessage ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
                  }`}
                >
                  {/* Status dot */}
                  <div className="mt-1.5 flex-shrink-0 sm:mt-0">
                    <div className={`h-2.5 w-2.5 rounded-full ${status.dot} ${
                      ticket.hasNewMessage ? 'ring-4 ring-blue-100 dark:ring-blue-900/30' : ''
                    }`} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <span className="font-mono text-xs font-medium text-slate-400 dark:text-slate-500">
                        {ticket.ticketNumber}
                      </span>
                      <h3 className={`truncate text-sm ${
                        ticket.hasNewMessage
                          ? 'font-semibold text-slate-900 dark:text-white'
                          : 'font-medium text-slate-700 dark:text-slate-300'
                      }`}>
                        {ticket.subject}
                      </h3>
                    </div>

                    {/* Preview + meta */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {ticket.lastMessagePreview && (
                        <p className="max-w-md truncate text-xs text-slate-400 dark:text-slate-500">
                          {ticket.lastMessagePreview}
                        </p>
                      )}
                    </div>

                    {/* Tags row (mobile friendly) */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${status.bg}`}>
                        {status.label}
                      </span>
                      {ticket.hasNewMessage && (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-400/20">
                          Nouveau message
                        </span>
                      )}
                      {category && (
                        <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-400/10">
                          {category}
                        </span>
                      )}
                      {ticket.projectName && (
                        <span className="inline-flex items-center rounded-md bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700 ring-1 ring-inset ring-cyan-600/20 dark:bg-cyan-950/40 dark:text-cyan-400 dark:ring-cyan-400/20">
                          {ticket.projectName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side meta */}
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {ticket.updatedAt ? timeAgo(ticket.updatedAt) : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      {ticket.messageCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          {ticket.messageCount}
                        </span>
                      )}
                      {priority && (
                        <span className={`text-xs font-medium ${priority.color}`}>
                          {priority.label}
                        </span>
                      )}
                    </div>
                    {/* Chevron */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Page {safePage} sur {totalPages} ({sorted.length} tickets)
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
                  acc.push(p)
                  return acc
                }, [])
                .map((item, idx) =>
                  item === 'ellipsis' ? (
                    <span key={`e-${idx}`} className="px-1 text-xs text-slate-400">...</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                        safePage === item
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
