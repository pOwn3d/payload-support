'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
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
}

type Tab = 'all' | 'open' | 'waiting_client' | 'resolved'

const STATUS_DOTS: Record<string, string> = {
  open: '#22c55e',
  waiting_client: '#eab308',
  resolved: '#94a3b8',
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  open: 'inbox.tabs.open',
  waiting_client: 'inbox.tabs.waiting',
  resolved: 'inbox.tabs.resolved',
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  normal: 'transparent',
  low: 'transparent',
}

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  bug: 'ticket.category.bug',
  content: 'ticket.category.content',
  feature: 'ticket.category.feature',
  question: 'ticket.category.question',
  hosting: 'ticket.category.hosting',
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'maintenant'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export const TicketInboxClient: React.FC = () => {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab && ['all', 'open', 'waiting_client', 'resolved'].includes(urlTab)) return urlTab as Tab
    return 'all'
  })
  // Sync tab with URL searchParams on navigation
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab && ['all', 'open', 'waiting_client', 'resolved'].includes(urlTab)) {
      setTab(urlTab as Tab)
    } else if (!urlTab) {
      setTab('all')
    }
  }, [searchParams])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('-updatedAt')
  const [counts, setCounts] = useState({ all: 0, open: 0, waiting: 0, resolved: 0 })
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
    const params = [`limit=30`, `sort=${sort}`, `depth=1`, `select[id]=true`, `select[ticketNumber]=true`, `select[subject]=true`, `select[status]=true`, `select[priority]=true`, `select[category]=true`, `select[client]=true`, `select[updatedAt]=true`, `select[lastClientMessageAt]=true`, `select[lastAdminReadAt]=true`]
    if (tab !== 'all') params.push(`where[status][equals]=${tab}`)
    if (search.trim()) {
      params.push(`where[or][0][subject][contains]=${encodeURIComponent(search)}`)
      params.push(`where[or][1][ticketNumber][contains]=${encodeURIComponent(search)}`)
    }
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
        const [all, openRes, waiting, resolved] = await Promise.all([
          fetch('/api/tickets?limit=0&depth=0', { credentials: 'include' }),
          fetch('/api/tickets?limit=0&depth=0&where[status][equals]=open', { credentials: 'include' }),
          fetch('/api/tickets?limit=0&depth=0&where[status][equals]=waiting_client', { credentials: 'include' }),
          fetch('/api/tickets?limit=0&depth=0&where[status][equals]=resolved', { credentials: 'include' }),
        ])
        const [a, o, w, r] = await Promise.all([all.json(), openRes.json(), waiting.json(), resolved.json()])
        setCounts({ all: a.totalDocs || 0, open: o.totalDocs || 0, waiting: w.totalDocs || 0, resolved: r.totalDocs || 0 })
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

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: 'all', label: t('inbox.tabs.all'), count: counts.all },
    { key: 'open', label: t('inbox.tabs.open'), count: counts.open },
    { key: 'waiting_client', label: t('inbox.tabs.waiting'), count: counts.waiting },
    { key: 'resolved', label: t('inbox.tabs.resolved'), count: counts.resolved },
  ]

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.header}>
        <h1 className={s.title}>{t('inbox.title')}</h1>
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
      <div className={s.tabs}>
        {tabs.map((tk) => (
          <button
            key={tk.key}
            className={`${s.tab} ${tab === tk.key ? s.tabActive : ''}`}
            onClick={() => { setTab(tk.key); setSelectedIdx(-1) }}
          >
            {tk.label}
            <span className={s.tabCount}>({tk.count})</span>
          </button>
        ))}
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

            return (
              <a
                key={tk.id}
                href={`/admin/support/ticket?id=${tk.id}`}
                className={`${s.row} ${idx === selectedIdx ? s.rowSelected : ''}`}
                onClick={(e) => { e.preventDefault(); window.location.href = `/admin/support/ticket?id=${tk.id}` }}
              >
                <input
                  type="checkbox"
                  checked={checkedIds.has(tk.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleCheck(tk.id)}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#2563eb' }}
                />
                <div className={s.statusDot} style={{ backgroundColor: STATUS_DOTS[tk.status] || '#94a3b8' }} />
                <span className={s.statusText}>{t(STATUS_LABEL_KEYS[tk.status] || 'ticket.status.open')}</span>
                <span className={s.ticketNum}>{tk.ticketNumber}</span>
                <span className={s.subject}>{tk.subject}</span>
                <span className={s.client}>{displayClient}</span>
                {tk.category ? <span className={s.categoryChip}>[{t(CATEGORY_LABEL_KEYS[tk.category] || 'ticket.category.bug')}]</span> : <span />}
                <div className={s.priorityBar} style={{ backgroundColor: priorityColor }} />
                <span className={s.timeAgo}>{relativeTime(tk.updatedAt)}</span>
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
