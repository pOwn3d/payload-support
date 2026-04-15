'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import s from '../../styles/EmailTracking.module.scss'

interface EmailLog {
  id: number
  status: 'success' | 'ignored' | 'error'
  action?: string
  senderEmail?: string
  subject?: string
  recipientEmail?: string
  ticketNumber?: string
  errorMessage?: string
  httpStatus?: number
  processingTimeMs?: number
  createdAt: string
}

interface Stats {
  total: number
  success: number
  errors: number
  ignored: number
  successRate: number
  avgProcessingTime: number
}

type StatusTab = 'all' | 'success' | 'error' | 'ignored'
type DateRange = 7 | 30 | 90

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  success: { label: 'Succès', bg: '#dcfce7', color: '#16a34a' },
  error: { label: 'Erreur', bg: '#fef2f2', color: '#dc2626' },
  ignored: { label: 'Ignoré', bg: '#f3f4f6', color: '#6b7280' },
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export const EmailTrackingClient: React.FC = () => {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<StatusTab>('all')
  const [dateRange, setDateRange] = useState<DateRange>(7)
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalDocs, setTotalDocs] = useState(0)
  const LIMIT = 30

  const fetchStats = useCallback(async () => {
    try { const r = await fetch(`/api/support/email-stats?days=${dateRange}`); if (r.ok) setStats(await r.json()) } catch {}
  }, [dateRange])

  const fetchLogs = useCallback(async () => {
    const cutoff = new Date(Date.now() - dateRange * 86400000).toISOString()
    const where = [`where[createdAt][greater_than]=${cutoff}`]
    if (tab !== 'all') where.push(`where[status][equals]=${tab}`)
    if (search.trim()) {
      where.push(`where[or][0][recipientEmail][contains]=${encodeURIComponent(search)}`, `where[or][1][subject][contains]=${encodeURIComponent(search)}`)
    }
    try {
      const r = await fetch(`/api/email-logs?${where.join('&')}&sort=-createdAt&limit=${LIMIT}&page=${page}&depth=0`)
      if (r.ok) { const d = await r.json(); setLogs(d.docs); setHasMore(d.hasNextPage); setTotalDocs(d.totalDocs) }
    } catch {}
    setLoading(false)
  }, [dateRange, tab, search, page])

  useEffect(() => { setLoading(true); setPage(1) }, [dateRange, tab, search])
  useEffect(() => { fetchStats(); fetchLogs() }, [fetchStats, fetchLogs])

  const tabsList: Array<{ key: StatusTab; label: string; count?: number }> = [
    { key: 'all', label: t('emailTracking.tabs.all'), count: stats?.total },
    { key: 'success', label: t('emailTracking.tabs.success'), count: stats?.success },
    { key: 'error', label: t('emailTracking.tabs.errors'), count: stats?.errors },
    { key: 'ignored', label: t('emailTracking.tabs.ignored'), count: stats?.ignored },
  ]

  if (loading && !stats) return <div className={s.loading}>{t('common.loading')}</div>

  return (
    <div className={s.page}>
      <div className={s.header}><h1 className={s.title}>{t('emailTracking.title')}</h1></div>

      {/* Stats */}
      <div className={s.statGrid}>
        <div className={s.statCard}><div className={s.statLabel}>{t('emailTracking.stats.emailsSent')}</div><div className={s.statValue}>{stats?.total ?? '—'}</div></div>
        <div className={s.statCard}><div className={s.statLabel}>{t('emailTracking.stats.successRate')}</div><div className={s.statValue}>{stats ? `${stats.successRate}` : '—'}<span className={s.statUnit}>%</span></div></div>
        <div className={s.statCard}><div className={s.statLabel}>{t('emailTracking.stats.errors')}</div><div className={s.statValue}>{stats?.errors ?? '—'}</div></div>
        <div className={s.statCard}><div className={s.statLabel}>{t('emailTracking.stats.avgTime')}</div><div className={s.statValue}>{stats ? stats.avgProcessingTime : '—'}<span className={s.statUnit}>ms</span></div></div>
      </div>

      {/* Filters */}
      <div className={s.filters}>
        <div className={s.tabs}>
          {tabsList.map((t) => (
            <button key={t.key} className={`${s.tab} ${tab === t.key ? s.tabActive : ''}`} onClick={() => setTab(t.key)}>
              {t.label} {typeof t.count === 'number' && <span style={{ marginLeft: 4, opacity: 0.6 }}>({t.count})</span>}
            </button>
          ))}
        </div>
        <div className={s.dateRangeGroup}>
          {([7, 30, 90] as DateRange[]).map((v) => (
            <button key={v} className={`${s.dateRangeBtn} ${dateRange === v ? s.dateRangeActive : ''}`} onClick={() => setDateRange(v)}>{v}j</button>
          ))}
        </div>
        <input type="text" className={s.searchInput} placeholder={t('emailTracking.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      {logs.length === 0 ? (
        <div className={s.empty}>{t('emailTracking.noLogs')}</div>
      ) : (
        <table className={s.table}>
          <thead>
            <tr><th>{t('emailTracking.tableHeaders.date')}</th><th>{t('emailTracking.tableHeaders.recipient')}</th><th>{t('emailTracking.tableHeaders.subject')}</th><th>{t('emailTracking.tableHeaders.ticket')}</th><th>{t('emailTracking.tableHeaders.status')}</th><th>{t('emailTracking.tableHeaders.action')}</th><th style={{ textAlign: 'right' }}>{t('emailTracking.tableHeaders.time')}</th></tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <React.Fragment key={log.id}>
                <tr onClick={() => log.status === 'error' && log.errorMessage ? setExpandedRow(expandedRow === log.id ? null : log.id) : null} style={{ cursor: log.status === 'error' && log.errorMessage ? 'pointer' : 'default' }}>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.recipientEmail}>{log.recipientEmail || '—'}</td>
                  <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.subject}>{log.subject || '—'}</td>
                  <td>{log.ticketNumber ? <span className={s.ticketLink}>{log.ticketNumber}</span> : '—'}</td>
                  <td><span className={s.statusBadge} style={{ background: STATUS_CFG[log.status]?.bg, color: STATUS_CFG[log.status]?.color }}>{STATUS_CFG[log.status]?.label || log.status}</span></td>
                  <td style={{ fontSize: 12 }}>{log.action || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {log.processingTimeMs != null ? (
                      <span className={`${s.processingTime} ${log.processingTimeMs > 2000 ? s.timeSlow : log.processingTimeMs > 500 ? s.timeMedium : s.timeFast}`}>{log.processingTimeMs}ms</span>
                    ) : '—'}
                    {log.status === 'error' && log.errorMessage && (
                      <button className={s.expandBtn} onClick={(e) => { e.stopPropagation(); setExpandedRow(expandedRow === log.id ? null : log.id) }}>
                        {expandedRow === log.id ? '▴' : '▾'}
                      </button>
                    )}
                  </td>
                </tr>
                {expandedRow === log.id && log.errorMessage && (
                  <tr><td colSpan={7}><div className={s.errorDetail}>Erreur{log.httpStatus ? ` (HTTP ${log.httpStatus})` : ''}: {log.errorMessage}</div></td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {totalDocs > 0 && (
        <div className={s.pagination}>
          <button className={s.pageBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>{t('common.previous')}</button>
          <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)', alignSelf: 'center' }}>{t('common.page')} {page} — {totalDocs} {t('common.results')}</span>
          <button className={s.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>{t('common.next')}</button>
        </div>
      )}
    </div>
  )
}
