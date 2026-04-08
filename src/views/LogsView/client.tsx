'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import s from '../../styles/Logs.module.scss'

type LogType = 'email' | 'auth'

interface LogEntry {
  id: number
  status?: string
  action?: string
  senderEmail?: string
  subject?: string
  recipientEmail?: string
  errorMessage?: string
  httpStatus?: number
  processingTimeMs?: number
  email?: string
  success?: boolean
  ip?: string
  userAgent?: string
  createdAt: string
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export const LogsClient: React.FC = () => {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const [logType, setLogType] = useState<LogType>(() => {
    const t = searchParams.get('type')
    return t === 'auth' ? 'auth' : 'email'
  })
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalDocs, setTotalDocs] = useState(0)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)

  const collection = logType === 'email' ? 'email-logs' : 'auth-logs'

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/${collection}?sort=-createdAt&limit=30&page=${page}&depth=0`, { credentials: 'include' })
      if (res.ok) {
        const d = await res.json()
        setLogs(d.docs || [])
        setHasMore(d.hasNextPage)
        setTotalDocs(d.totalDocs)
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [collection, page])

  useEffect(() => { setLoading(true); setPage(1) }, [logType])
  useEffect(() => { fetchLogs() }, [fetchLogs])

  const handlePurge = async (days: number) => {
    const label = days === 0 ? 'TOUS les logs' : `les logs de plus de ${days} jours`
    if (!window.confirm(`Supprimer ${label} (${collection}) ? Cette action est irreversible.`)) return
    try {
      const res = await fetch(`/api/support/purge-logs?collection=${collection}&days=${days}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) { const d = await res.json(); setPurgeResult(`${d.purged} log(s) supprime(s)`); setTimeout(() => setPurgeResult(null), 5000); fetchLogs() }
    } catch { /* silent */ }
  }

  const S: Record<string, React.CSSProperties> = {
    page: { padding: '20px 30px', maxWidth: 1100, margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--theme-text)' },
    tabsRow: { display: 'flex', gap: 4, marginBottom: 12 },
    tab: { padding: '6px 12px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--theme-elevation-500)', fontWeight: 500 },
    tabActive: { background: 'var(--theme-elevation-100)', color: 'var(--theme-text)', fontWeight: 700 },
    purgeBtn: { padding: '4px 10px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 11, background: 'var(--theme-elevation-0)', cursor: 'pointer', color: 'var(--theme-text)' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    th: { textAlign: 'left' as const, padding: '8px', borderBottom: '1px solid var(--theme-elevation-200)', fontSize: 11, color: 'var(--theme-elevation-500)' },
    td: { padding: '8px', borderBottom: '1px solid var(--theme-elevation-100)' },
    badge: { padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 },
    mono: { fontFamily: 'monospace', fontSize: 12 },
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>{logType === 'email' ? t('logs.title') : t('logs.titleAuth')}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.purgeBtn} onClick={() => handlePurge(7)}>{t('logs.purge7')}</button>
          <button style={S.purgeBtn} onClick={() => handlePurge(30)}>{t('logs.purge30')}</button>
          <button style={{ ...S.purgeBtn, color: '#dc2626', borderColor: '#dc2626' }} onClick={() => handlePurge(0)}>{t('logs.purgeAll')}</button>
        </div>
      </div>

      <div style={S.tabsRow}>
        <button style={{ ...S.tab, ...(logType === 'email' ? S.tabActive : {}) }} onClick={() => setLogType('email')}>{t('logs.tabs.email')} ({logType === 'email' ? totalDocs : '...'})</button>
        <button style={{ ...S.tab, ...(logType === 'auth' ? S.tabActive : {}) }} onClick={() => setLogType('auth')}>{t('logs.tabs.auth')} ({logType === 'auth' ? totalDocs : '...'})</button>
      </div>

      {purgeResult && <div style={{ padding: '8px 14px', borderRadius: 6, background: '#dcfce7', color: '#166534', fontSize: 13, marginBottom: 12 }}>{purgeResult}</div>}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{t('common.loading')}</div>
      ) : logs.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{t('logs.noLogs')}</div>
      ) : logType === 'email' ? (
        <table style={S.table}>
          <thead><tr><th style={S.th}>{t('logs.tableHeaders.date')}</th><th style={S.th}>{t('logs.tableHeaders.status')}</th><th style={S.th}>{t('logs.tableHeaders.recipient')}</th><th style={S.th}>{t('logs.tableHeaders.subject')}</th><th style={S.th}>{t('logs.tableHeaders.action')}</th><th style={{ ...S.th, textAlign: 'right' }}>{t('logs.tableHeaders.time')}</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ ...S.td, ...S.mono }}>{fmtDate(log.createdAt)}</td>
                <td style={S.td}><span style={{ ...S.badge, background: log.status === 'success' ? '#dcfce7' : log.status === 'error' ? '#fef2f2' : '#f3f4f6', color: log.status === 'success' ? '#16a34a' : log.status === 'error' ? '#dc2626' : '#6b7280' }}>{log.status === 'success' ? t('logs.statusSuccess') : log.status === 'error' ? t('logs.statusError') : t('logs.statusIgnored')}</span></td>
                <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.recipientEmail}>{log.recipientEmail || '--'}</td>
                <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.subject}>{log.subject || '--'}</td>
                <td style={{ ...S.td, fontSize: 12, color: 'var(--theme-elevation-500)' }}>{log.action || '--'}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>{log.processingTimeMs != null ? <span style={{ ...S.mono, color: log.processingTimeMs > 2000 ? '#dc2626' : '#16a34a' }}>{log.processingTimeMs}ms</span> : '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table style={S.table}>
          <thead><tr><th style={S.th}>{t('logs.tableHeaders.date')}</th><th style={S.th}>{t('logs.tableHeaders.status')}</th><th style={S.th}>{t('logs.tableHeaders.email')}</th><th style={S.th}>{t('logs.tableHeaders.ip')}</th><th style={S.th}>{t('logs.tableHeaders.userAgent')}</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ ...S.td, ...S.mono }}>{fmtDate(log.createdAt)}</td>
                <td style={S.td}><span style={{ ...S.badge, background: log.success ? '#dcfce7' : '#fef2f2', color: log.success ? '#16a34a' : '#dc2626' }}>{log.success ? t('logs.statusSuccess') : t('logs.statusFailed')}</span></td>
                <td style={{ ...S.td, ...S.mono }}>{log.email || '--'}</td>
                <td style={{ ...S.td, ...S.mono }}>{log.ip || '--'}</td>
                <td style={{ ...S.td, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.userAgent || '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalDocs > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16, alignItems: 'center' }}>
          <button style={S.purgeBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>{t('common.previous')}</button>
          <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{t('common.page')} {page} -- {totalDocs} {t('common.results')}</span>
          <button style={S.purgeBtn} onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>{t('common.next')}</button>
        </div>
      )}
    </div>
  )
}
