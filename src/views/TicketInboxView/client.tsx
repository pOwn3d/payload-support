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

  // Auto-refresh 60s
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

  const S: Record<string, React.CSSProperties> = {
    page: { padding: '20px 30px', maxWidth: 1100, margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--theme-text)' },
    headerRight: { display: 'flex', gap: 10, alignItems: 'center' },
    searchWrap: { position: 'relative' as const, display: 'flex', alignItems: 'center' },
    searchInput: { padding: '6px 12px 6px 30px', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', fontSize: 13, background: 'var(--theme-elevation-0)', color: 'var(--theme-text)', width: 200 },
    newTicketBtn: { padding: '7px 14px', borderRadius: 8, background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' as const },
    tabsRow: { display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--theme-elevation-200)', paddingBottom: 8 },
    tab: { padding: '6px 12px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--theme-elevation-500)', fontWeight: 500 },
    tabActive: { background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', fontWeight: 700 },
    sortRow: { display: 'flex', alignItems: 'center', marginBottom: 12 },
    sortSelect: { padding: '4px 10px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, background: 'var(--theme-elevation-0)', color: 'var(--theme-text)', cursor: 'pointer' },
    loading: { padding: 40, textAlign: 'center' as const, color: '#94a3b8' },
    empty: { padding: 60, textAlign: 'center' as const, color: '#94a3b8' },
    list: { display: 'flex', flexDirection: 'column' as const, gap: 1 },
    row: { display: 'grid', gridTemplateColumns: '20px 10px 60px 70px 1fr 140px 80px 4px 50px 10px', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 8, textDecoration: 'none', color: 'var(--theme-text)', fontSize: 13, cursor: 'pointer', transition: 'background 100ms', background: 'var(--theme-elevation-0)' },
    rowHover: { background: 'var(--theme-elevation-50)' },
    statusDot: { width: 8, height: 8, borderRadius: '50%' },
    priorityBar: { width: 4, height: 20, borderRadius: 2 },
    unreadDot: { width: 8, height: 8, borderRadius: '50%', background: '#2563eb' },
    keyboardHints: { display: 'flex', gap: 12, marginTop: 16, fontSize: 11, color: 'var(--theme-elevation-400)' },
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>{t('inbox.title')}</h1>
        <div style={S.headerRight}>
          <div style={S.searchWrap}>
            <input
              type="text"
              style={S.searchInput}
              placeholder={t('inbox.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link href="/admin/support/new-ticket" style={S.newTicketBtn}>{t('inbox.newTicketBtn')}</Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabsRow}>
        {tabs.map((tb) => (
          <button
            key={tb.key}
            style={{ ...S.tab, ...(tab === tb.key ? S.tabActive : {}) }}
            onClick={() => { setTab(tb.key); setSelectedIdx(-1) }}
          >
            {tb.label} <span style={{ opacity: 0.6 }}>({tb.count})</span>
          </button>
        ))}
      </div>

      {/* Sort + Bulk */}
      <div style={S.sortRow}>
        {checkedIds.size > 0 ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text)' }}>{checkedIds.size > 1 ? t('inbox.selectedPlural', { count: String(checkedIds.size) }) : t('inbox.selected', { count: String(checkedIds.size) })}</span>
            <button style={S.sortSelect} onClick={() => handleBulkAction('close')} disabled={bulkProcessing}>{t('inbox.closeAction')}</button>
            <button style={S.sortSelect} onClick={() => handleBulkAction('reopen')} disabled={bulkProcessing}>{t('inbox.reopenAction')}</button>
            <select style={S.sortSelect} value={bulkAction} onChange={(e) => { if (e.target.value) handleBulkAction(e.target.value); setBulkAction('') }}>
              <option value="">{t('inbox.moreActions')}</option>
              <option value="set_priority">{t('inbox.changePriority')}</option>
              <option value="delete">{t('inbox.deleteAction')}</option>
            </select>
            <button style={{ ...S.sortSelect, marginLeft: 'auto' }} onClick={() => setCheckedIds(new Set())}>{t('inbox.deselect')}</button>
          </div>
        ) : (
          <select style={S.sortSelect} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="-updatedAt">{t('inbox.sort.newest')}</option>
            <option value="updatedAt">{t('inbox.sort.oldest')}</option>
            <option value="-createdAt">{t('inbox.sort.created')}</option>
            <option value="priority">{t('inbox.sort.priority')}</option>
          </select>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={S.loading}>{t('common.loading')}</div>
      ) : tickets.length === 0 ? (
        <div style={S.empty}>{t('inbox.empty')}</div>
      ) : (
        <div style={S.list}>
          {tickets.map((tk, idx) => {
            const clientObj = typeof tk.client === 'object' ? tk.client : null
            const clientName = clientObj ? `${clientObj.firstName || ''} ${clientObj.lastName || ''}`.trim() : ''
            const clientCompany = clientObj?.company || ''
            const displayClient = clientName ? `${clientName}${clientCompany ? `, ${clientCompany}` : ''}` : '--'
            const isUnread = tk.lastClientMessageAt && (!tk.lastAdminReadAt || new Date(tk.lastClientMessageAt) > new Date(tk.lastAdminReadAt))
            const priorityColor = PRIORITY_COLORS[tk.priority] || 'transparent'

            return (
              <a
                key={tk.id}
                href={`/admin/support/ticket?id=${tk.id}`}
                style={{ ...S.row, ...(idx === selectedIdx ? { background: 'var(--theme-elevation-100)' } : {}) }}
                onClick={(e) => { e.preventDefault(); window.location.href = `/admin/support/ticket?id=${tk.id}` }}
              >
                <input
                  type="checkbox"
                  checked={checkedIds.has(tk.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleCheck(tk.id)}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#2563eb' }}
                />
                <div style={{ ...S.statusDot, backgroundColor: STATUS_DOTS[tk.status] || '#94a3b8' }} />
                <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>{STATUS_LABEL_KEYS[tk.status] ? t(STATUS_LABEL_KEYS[tk.status]) : tk.status}</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--theme-elevation-400)' }}>{tk.ticketNumber}</span>
                <span style={{ fontWeight: 500 }}>{tk.subject}</span>
                <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayClient}</span>
                {tk.category ? <span style={{ fontSize: 11, color: 'var(--theme-elevation-400)' }}>[{CATEGORY_LABEL_KEYS[tk.category] ? t(CATEGORY_LABEL_KEYS[tk.category]) : tk.category}]</span> : <span />}
                <div style={{ ...S.priorityBar, backgroundColor: priorityColor }} />
                <span style={{ fontSize: 11, color: 'var(--theme-elevation-400)', textAlign: 'right' }}>{relativeTime(tk.updatedAt)}</span>
                {isUnread ? <div style={S.unreadDot} /> : <span />}
              </a>
            )
          })}
        </div>
      )}

      {/* Keyboard hints */}
      <div style={S.keyboardHints}>
        <span><kbd>&#8593;</kbd><kbd>&#8595;</kbd> {t('inbox.keyboardNavigate')}</span>
        <span><kbd>&#8629;</kbd> {t('inbox.keyboardOpen')}</span>
      </div>
    </div>
  )
}
