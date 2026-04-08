'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface EmailLog { id: number; status: 'success' | 'ignored' | 'error'; action?: string; subject?: string; recipientEmail?: string; ticketNumber?: string; errorMessage?: string; httpStatus?: number; processingTimeMs?: number; createdAt: string }
interface Stats { total: number; success: number; errors: number; ignored: number; successRate: number; avgProcessingTime: number }
type StatusTab = 'all' | 'success' | 'error' | 'ignored'
type DateRange = 7 | 30 | 90

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  success: { label: 'Succes', bg: '#dcfce7', color: '#16a34a' },
  error: { label: 'Erreur', bg: '#fef2f2', color: '#dc2626' },
  ignored: { label: 'Ignore', bg: '#f3f4f6', color: '#6b7280' },
}

function fmtDate(d: string): string { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) }

export const EmailTrackingClient: React.FC = () => {
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

  const fetchStats = useCallback(async () => { try { const r = await fetch(`/api/support/email-stats?days=${dateRange}`); if (r.ok) setStats(await r.json()) } catch (err) { console.warn('[support] fetchStats error:', err) } }, [dateRange])
  const fetchLogs = useCallback(async () => {
    const cutoff = new Date(Date.now() - dateRange * 86400000).toISOString()
    const where = [`where[createdAt][greater_than]=${cutoff}`]
    if (tab !== 'all') where.push(`where[status][equals]=${tab}`)
    if (search.trim()) { where.push(`where[or][0][recipientEmail][contains]=${encodeURIComponent(search)}`, `where[or][1][subject][contains]=${encodeURIComponent(search)}`) }
    try { const r = await fetch(`/api/email-logs?${where.join('&')}&sort=-createdAt&limit=30&page=${page}&depth=0`); if (r.ok) { const d = await r.json(); setLogs(d.docs); setHasMore(d.hasNextPage); setTotalDocs(d.totalDocs) } } catch (err) { console.warn('[support] fetchLogs error:', err) }
    setLoading(false)
  }, [dateRange, tab, search, page])

  useEffect(() => { setLoading(true); setPage(1) }, [dateRange, tab, search])
  useEffect(() => { fetchStats(); fetchLogs() }, [fetchStats, fetchLogs])

  const S: Record<string, React.CSSProperties> = {
    page: { padding: '20px 30px', maxWidth: 1100, margin: '0 auto' },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
    statCard: { padding: '12px 16px', borderRadius: 8, border: '1px solid var(--theme-elevation-150)' },
    statLabel: { fontSize: 11, color: 'var(--theme-elevation-500)' },
    statValue: { fontSize: 22, fontWeight: 700, color: 'var(--theme-text)' },
    filters: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const },
    tab: { padding: '4px 10px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--theme-elevation-500)' },
    tabActive: { background: 'var(--theme-elevation-100)', fontWeight: 700, color: 'var(--theme-text)' },
    dateBtn: { padding: '4px 8px', borderRadius: 4, border: '1px solid var(--theme-elevation-200)', fontSize: 11, cursor: 'pointer', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)' },
    dateBtnActive: { background: '#2563eb', color: '#fff', borderColor: '#2563eb' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    th: { textAlign: 'left' as const, padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-200)', fontSize: 11, color: 'var(--theme-elevation-500)' },
    td: { padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-100)' },
    badge: { padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 },
    btn: { padding: '4px 10px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 11, cursor: 'pointer', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)' },
  }

  return (
    <div style={S.page}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: 'var(--theme-text)' }}>Suivi des emails</h1>

      <div style={S.statGrid}>
        <div style={S.statCard}><div style={S.statLabel}>Emails envoyes</div><div style={S.statValue}>{stats?.total ?? '--'}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Taux de succes</div><div style={S.statValue}>{stats ? `${stats.successRate}%` : '--'}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Erreurs</div><div style={S.statValue}>{stats?.errors ?? '--'}</div></div>
        <div style={S.statCard}><div style={S.statLabel}>Temps moyen</div><div style={S.statValue}>{stats ? `${stats.avgProcessingTime}ms` : '--'}</div></div>
      </div>

      <div style={S.filters}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'success', 'error', 'ignored'] as StatusTab[]).map((t) => (
            <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => setTab(t)}>{t === 'all' ? 'Tous' : t === 'success' ? 'Succes' : t === 'error' ? 'Erreurs' : 'Ignores'}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {([7, 30, 90] as DateRange[]).map((v) => (
            <button key={v} style={{ ...S.dateBtn, ...(dateRange === v ? S.dateBtnActive : {}) }} onClick={() => setDateRange(v)}>{v}j</button>
          ))}
        </div>
        <input type="text" placeholder="Email, sujet..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' }} />
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>
        : logs.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Aucun log pour cette periode</div>
        : (
          <table style={S.table}>
            <thead><tr><th style={S.th}>Date</th><th style={S.th}>Destinataire</th><th style={S.th}>Sujet</th><th style={S.th}>Ticket</th><th style={S.th}>Statut</th><th style={S.th}>Action</th><th style={{ ...S.th, textAlign: 'right' }}>Temps</th></tr></thead>
            <tbody>
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr onClick={() => log.status === 'error' && log.errorMessage ? setExpandedRow(expandedRow === log.id ? null : log.id) : null} style={{ cursor: log.status === 'error' ? 'pointer' : 'default' }}>
                    <td style={{ ...S.td, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                    <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.recipientEmail || '--'}</td>
                    <td style={{ ...S.td, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.subject || '--'}</td>
                    <td style={S.td}>{log.ticketNumber || '--'}</td>
                    <td style={S.td}><span style={{ ...S.badge, background: STATUS_CFG[log.status]?.bg, color: STATUS_CFG[log.status]?.color }}>{STATUS_CFG[log.status]?.label || log.status}</span></td>
                    <td style={{ ...S.td, fontSize: 12 }}>{log.action || '--'}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{log.processingTimeMs != null ? <span style={{ fontFamily: 'monospace', fontSize: 12, color: log.processingTimeMs > 2000 ? '#dc2626' : '#16a34a' }}>{log.processingTimeMs}ms</span> : '--'}</td>
                  </tr>
                  {expandedRow === log.id && log.errorMessage && (
                    <tr><td colSpan={7}><div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: 6, fontSize: 12, color: '#dc2626' }}>Erreur{log.httpStatus ? ` (HTTP ${log.httpStatus})` : ''}: {log.errorMessage}</div></td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}

      {totalDocs > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16, alignItems: 'center' }}>
          <button style={S.btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Precedent</button>
          <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>Page {page} -- {totalDocs} resultats</span>
          <button style={S.btn} onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>Suivant</button>
        </div>
      )}
    </div>
  )
}
