'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import { DATE_LOCALE } from '../shared/dateLocale'
import { StatusPill } from '../shared/StatusPill'
import { computeSlaState, formatSlaRemaining } from '../shared/sla'
import s from '../../styles/TicketInbox.module.scss'

interface Ticket {
  id: number
  ticketNumber: string
  subject: string
  status: string
  priority: string
  category?: string
  client?: { id: number; firstName?: string; lastName?: string; company?: string } | number
  updatedAt: string
  createdAt: string
  lastClientMessageAt?: string
  lastAdminReadAt?: string
  // SLA fields (already declared on the Tickets collection)
  slaFirstResponseDue?: string | null
  slaFirstResponseBreached?: boolean | null
  slaResolutionDue?: string | null
  slaResolutionBreached?: boolean | null
  firstResponseAt?: string | null
}

type Tab = 'all' | 'open' | 'waiting_client' | 'resolved' | 'sla_breach'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--theme-error-500)',
  high: 'var(--theme-warning-500)',
  normal: 'var(--theme-info-500, #2a6bd8)',
  low: 'var(--theme-elevation-400)',
}

const STATUS_VARIANT: Record<string, 'open' | 'pending' | 'resolved' | 'closed'> = {
  open: 'open',
  waiting_client: 'pending',
  pending: 'pending',
  resolved: 'resolved',
  closed: 'closed',
}

function relativeTime(dateStr: string, tFn: (k: string) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return tFn('inbox.timeAgo.now')
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  return new Date(dateStr).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })
}

export const TicketInboxClient: React.FC = () => {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab && ['all', 'open', 'waiting_client', 'resolved', 'sla_breach'].includes(urlTab)) return urlTab as Tab
    return 'all'
  })
  // Sync tab with URL searchParams on navigation
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab && ['all', 'open', 'waiting_client', 'resolved', 'sla_breach'].includes(urlTab)) {
      setTab(urlTab as Tab)
    } else if (!urlTab) {
      setTab('all')
    }
  }, [searchParams])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('-updatedAt')
  const [counts, setCounts] = useState({ all: 0, open: 0, waiting: 0, resolved: 0, breach: 0 })
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())
  const [bulkAction, setBulkAction] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const toggleCheck = (id: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const _toggleAll = () => {
    if (checkedIds.size === tickets.length) setCheckedIds(new Set())
    else setCheckedIds(new Set(tickets.map((tk) => tk.id)))
  }

  const handleBulkAction = async (action: string) => {
    if (checkedIds.size === 0) return
    setBulkProcessing(true)
    try {
      const res = await fetch('/api/support/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticketIds: Array.from(checkedIds), action }),
      })
      if (res.ok) {
        setCheckedIds(new Set())
        setBulkAction('')
        fetchTickets()
      }
    } catch { /* silent */ }
    setBulkProcessing(false)
  }

  const fetchTickets = useCallback(async () => {
    const params = [
      `limit=30`, `sort=${sort}`, `depth=1`,
      `select[id]=true`, `select[ticketNumber]=true`, `select[subject]=true`,
      `select[status]=true`, `select[priority]=true`, `select[category]=true`,
      `select[client]=true`, `select[updatedAt]=true`,
      `select[lastClientMessageAt]=true`, `select[lastAdminReadAt]=true`,
      `select[slaFirstResponseDue]=true`, `select[slaFirstResponseBreached]=true`,
      `select[slaResolutionDue]=true`, `select[slaResolutionBreached]=true`,
      `select[firstResponseAt]=true`,
    ]
    if (tab === 'sla_breach') {
      // Either first-response breached or resolution breached
      params.push(`where[or][0][slaFirstResponseBreached][equals]=true`)
      params.push(`where[or][1][slaResolutionBreached][equals]=true`)
    } else if (tab !== 'all') {
      params.push(`where[status][equals]=${tab}`)
    }
    if (search.trim()) {
      params.push(`where[or][0][subject][contains]=${encodeURIComponent(search)}`)
      params.push(`where[or][1][ticketNumber][contains]=${encodeURIComponent(search)}`)
    }
    // Hide snoozed tickets (snoozeUntil in the future); they resurface automatically once due.
    params.push(`where[and][0][or][0][snoozeUntil][exists]=false`)
    params.push(`where[and][0][or][1][snoozeUntil][less_than_equal]=${encodeURIComponent(new Date().toISOString())}`)
    try {
      const url = `/api/tickets?${params.join('&')}`
      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) {
        const d = await res.json()
        setTickets(d.docs || [])
      } else {
        console.error('[inbox] Fetch failed:', res.status, await res.text().catch(() => ''))
      }
    } catch (err) {
      console.error('[inbox] Fetch error:', err)
    }
    setLoading(false)
  }, [tab, sort, search])

  useEffect(() => { setLoading(true); fetchTickets() }, [fetchTickets])

  // Fetch counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Exclude snoozed tickets from the counts too (mirrors the list query).
        const sn = `where[and][0][or][0][snoozeUntil][exists]=false&where[and][0][or][1][snoozeUntil][less_than_equal]=${encodeURIComponent(new Date().toISOString())}`
        const [all, openRes, waiting, resolved, breach] = await Promise.all([
          fetch(`/api/tickets?limit=0&depth=0&${sn}`, { credentials: 'include' }),
          fetch(`/api/tickets?limit=0&depth=0&where[status][equals]=open&${sn}`, { credentials: 'include' }),
          fetch(`/api/tickets?limit=0&depth=0&where[status][equals]=waiting_client&${sn}`, { credentials: 'include' }),
          fetch(`/api/tickets?limit=0&depth=0&where[status][equals]=resolved&${sn}`, { credentials: 'include' }),
          fetch(`/api/tickets?limit=0&depth=0&where[or][0][slaFirstResponseBreached][equals]=true&where[or][1][slaResolutionBreached][equals]=true&${sn}`, { credentials: 'include' }),
        ])
        const [a, o, w, r, b] = await Promise.all([all.json(), openRes.json(), waiting.json(), resolved.json(), breach.json()])
        setCounts({
          all: a.totalDocs || 0,
          open: o.totalDocs || 0,
          waiting: w.totalDocs || 0,
          resolved: r.totalDocs || 0,
          breach: b.totalDocs || 0,
        })
      } catch { /* silent */ }
    }
    fetchCounts()
  }, [])

  // Auto-refresh 30s
  useEffect(() => {
    const iv = setInterval(fetchTickets, 60000)
    return () => clearInterval(iv)
  }, [fetchTickets])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((p) => Math.min(p + 1, tickets.length - 1)) }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((p) => Math.max(p - 1, 0)) }
      if (e.key === 'Enter' && selectedIdx >= 0 && tickets[selectedIdx]) {
        window.location.href = `/admin/support/ticket?id=${tickets[selectedIdx].id}`
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [tickets, selectedIdx])

  const tabs: Array<{ key: Tab; label: string; count: number; alert?: boolean }> = [
    { key: 'all', label: t('inbox.tabs.all'), count: counts.all },
    { key: 'open', label: t('inbox.tabs.open'), count: counts.open },
    { key: 'waiting_client', label: t('inbox.tabs.waiting'), count: counts.waiting },
    { key: 'sla_breach', label: t('inbox.tabs.slaBreach'), count: counts.breach, alert: true },
    { key: 'resolved', label: t('inbox.tabs.resolved'), count: counts.resolved },
  ]

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.header}>
        <div>
          <h1 className={s.title}>{t('inbox.title')}</h1>
          <p className={s.subtitle}>
            {tickets.length > 0 && `${tickets.length} sur ${counts.all} · `}
            {counts.breach > 0 ? (
              <span className={s.subtitleBreach}>{counts.breach} SLA dépassé{counts.breach > 1 ? 's' : ''}</span>
            ) : (
              <span>Aucun SLA en alerte</span>
            )}
          </p>
        </div>
        <div className={s.headerRight}>
          <div className={s.searchWrap}>
            <svg className={s.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input
              type="text"
              className={s.searchInput}
              placeholder={t('inbox.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className={s.searchHint}>&#8984;K</span>
          </div>
          <Link href="/admin/support/new-ticket" className={s.newTicketBtn}>{t('inbox.newTicketBtn')}</Link>
        </div>
      </div>

      {/* Tabs */}
      <div className={s.tabs} role="tablist">
        {tabs.map((tk) => {
          const isAlert = tk.alert && tk.count > 0
          return (
            <button
              key={tk.key}
              role="tab"
              aria-selected={tab === tk.key}
              className={`${s.tab} ${tab === tk.key ? s.tabActive : ''} ${isAlert ? s.tabAlert : ''}`}
              onClick={() => { setTab(tk.key); setSelectedIdx(-1) }}
            >
              {tk.label}
              <span className={`${s.tabCount} ${isAlert ? s.tabCountAlert : ''}`}>{tk.count}</span>
            </button>
          )
        })}
      </div>

      {/* Sort + Bulk */}
      <div className={s.sortRow}>
        {checkedIds.size > 0 ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text)' }}>{checkedIds.size > 1 ? t('inbox.selectedPlural', { count: String(checkedIds.size) }) : t('inbox.selected', { count: String(checkedIds.size) })}</span>
            <button className={s.sortSelect} onClick={() => handleBulkAction('close')} disabled={bulkProcessing}>{t('inbox.closeAction')}</button>
            <button className={s.sortSelect} onClick={() => handleBulkAction('reopen')} disabled={bulkProcessing}>{t('inbox.reopenAction')}</button>
            <select className={s.sortSelect} value={bulkAction} onChange={(e) => { if (e.target.value) handleBulkAction(e.target.value); setBulkAction('') }}>
              <option value="">{t('inbox.moreActions')}</option>
              <option value="set_priority">{t('inbox.changePriority')}</option>
              <option value="delete">{t('inbox.deleteAction')}</option>
            </select>
            <button className={s.sortSelect} onClick={() => setCheckedIds(new Set())} style={{ marginLeft: 'auto' }}>{t('inbox.deselect')}</button>
          </div>
        ) : (
          <select className={s.sortSelect} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="-updatedAt">{t('inbox.sort.newest')}</option>
            <option value="updatedAt">{t('inbox.sort.oldest')}</option>
            <option value="-createdAt">{t('inbox.sort.created')}</option>
            <option value="priority">{t('inbox.sort.priority')}</option>
          </select>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className={s.loading}>{t('common.loading')}</div>
      ) : tickets.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>--</div>
          <div className={s.emptyText}>{t('inbox.empty')}</div>
        </div>
      ) : (
        <div className={s.list}>
          {tickets.map((tk, idx) => {
            const clientObj = typeof tk.client === 'object' ? tk.client : null
            const clientName = clientObj ? `${clientObj.firstName || ''} ${clientObj.lastName || ''}`.trim() : ''
            const clientCompany = clientObj?.company || ''
            const displayClient = clientName ? `${clientName}${clientCompany ? `, ${clientCompany}` : ''}` : '—'
            const isUnread = tk.lastClientMessageAt && (!tk.lastAdminReadAt || new Date(tk.lastClientMessageAt) > new Date(tk.lastAdminReadAt))
            const priorityColor = PRIORITY_COLORS[tk.priority] || 'transparent'
            const sla = computeSlaState(tk)
            const isBreach = sla.state === 'breach'
            const statusVariant: 'open' | 'pending' | 'resolved' | 'closed' = STATUS_VARIANT[tk.status] || 'open'

            return (
              <a
                key={tk.id}
                href={`/admin/support/ticket?id=${tk.id}`}
                className={[
                  s.row,
                  idx === selectedIdx ? s.rowSelected : '',
                  isUnread ? s.rowUnread : '',
                  isBreach ? s.rowBreach : '',
                ].filter(Boolean).join(' ')}
                onClick={(e) => { e.preventDefault(); window.location.href = `/admin/support/ticket?id=${tk.id}` }}
              >
                <input
                  type="checkbox"
                  checked={checkedIds.has(tk.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleCheck(tk.id)}
                  className={s.rowCheck}
                  aria-label={`Sélectionner ${tk.ticketNumber}`}
                />
                <span
                  className={s.priorityDot}
                  style={{ background: priorityColor }}
                  aria-label={`Priorité ${tk.priority}`}
                  title={`Priorité ${tk.priority}`}
                />
                <StatusPill status={isBreach ? 'sla-breach' : statusVariant} />
                <span className={s.ticketNum}>{tk.ticketNumber}</span>
                <span className={s.subject}>{tk.subject}</span>
                <span className={s.client}>{displayClient}</span>
                <span
                  className={[
                    s.slaCell,
                    sla.state === 'breach' ? s.slaBreach : '',
                    sla.state === 'warn' ? s.slaWarn : '',
                    sla.state === 'ok' ? s.slaOk : '',
                  ].filter(Boolean).join(' ')}
                  title={sla.due ? new Date(sla.due).toLocaleString(DATE_LOCALE) : ''}
                >
                  {formatSlaRemaining(sla.remainingMs)}
                </span>
                <span className={s.timeAgo}>{relativeTime(tk.updatedAt, t)}</span>
                {isUnread ? <div className={s.unreadDot} /> : <span />}
              </a>
            )
          })}
        </div>
      )}

      {/* Keyboard hints */}
      <div className={s.keyboardHints}>
        <span><kbd>↑</kbd><kbd>↓</kbd> {t('inbox.keyboardNavigate')}</span>
        <span><kbd>↵</kbd> {t('inbox.keyboardOpen')}</span>
      </div>
    </div>
  )
}
