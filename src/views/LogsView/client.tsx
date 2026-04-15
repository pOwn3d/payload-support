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
  // Auth log fields
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
    const label = days === 0 ? t('logs.purgeAllLabel') : t('logs.purgeDaysLabel', { days: String(days) })
    if (!window.confirm(t('logs.purgeConfirm', { label, collection }))) return

    try {
      const res = await fetch(`/api/support/purge-logs?collection=${collection}&days=${days}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        const d = await res.json()
        setPurgeResult(t('logs.purgeResult', { count: String(d.purged) }))
        setTimeout(() => setPurgeResult(null), 5000)
        fetchLogs()
      }
    } catch { /* silent */ }
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>{logType === 'email' ? t('logs.title') : t('logs.titleAuth')}</h1>
        <div className={s.headerActions}>
          <button className={s.purgeBtn} onClick={() => handlePurge(7)}>{t('logs.purge7')}</button>
          <button className={s.purgeBtn} onClick={() => handlePurge(30)}>{t('logs.purge30')}</button>
          <button className={s.purgeBtn} onClick={() => handlePurge(90)}>Purger +90j</button>
          <button className={`${s.purgeBtn} ${s.purgeBtnDanger}`} onClick={() => handlePurge(0)}>{t('logs.purgeAll')}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className={s.tabs}>
        <button className={`${s.tab} ${logType === 'email' ? s.tabActive : ''}`} onClick={() => setLogType('email')}>
          {t('logs.tabs.email')} ({logType === 'email' ? totalDocs : '...'})
        </button>
        <button className={`${s.tab} ${logType === 'auth' ? s.tabActive : ''}`} onClick={() => setLogType('auth')}>
          {t('logs.tabs.auth')} ({logType === 'auth' ? totalDocs : '...'})
        </button>
      </div>

      {purgeResult && <div className={s.purgeResult}>{purgeResult}</div>}

      {loading ? (
        <div className={s.loading}>{t('common.loading')}</div>
      ) : logs.length === 0 ? (
        <div className={s.empty}>{t('logs.noLogs')}</div>
      ) : logType === 'email' ? (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('logs.tableHeaders.date')}</th>
              <th>{t('logs.tableHeaders.status')}</th>
              <th>{t('logs.tableHeaders.recipient')}</th>
              <th>{t('logs.tableHeaders.subject')}</th>
              <th>{t('logs.tableHeaders.action')}</th>
              <th style={{ textAlign: 'right' }}>{t('logs.tableHeaders.time')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className={s.mono}>{fmtDate(log.createdAt)}</td>
                <td>
                  <span className={s.badge} style={{
                    background: log.status === 'success' ? '#dcfce7' : log.status === 'error' ? '#fef2f2' : '#f3f4f6',
                    color: log.status === 'success' ? '#16a34a' : log.status === 'error' ? '#dc2626' : '#6b7280',
                  }}>
                    {log.status === 'success' ? t('logs.statusSuccess') : log.status === 'error' ? t('logs.statusError') : t('logs.statusIgnored')}
                  </span>
                </td>
                <td className={s.truncate} title={log.recipientEmail}>{log.recipientEmail || '—'}</td>
                <td className={s.truncate} title={log.subject}>{log.subject || '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{log.action || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  {log.processingTimeMs != null ? (
                    <span className={s.mono} style={{ color: log.processingTimeMs > 2000 ? '#dc2626' : log.processingTimeMs > 500 ? '#d97706' : '#16a34a' }}>
                      {log.processingTimeMs}ms
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('logs.tableHeaders.date')}</th>
              <th>{t('logs.tableHeaders.status')}</th>
              <th>{t('logs.tableHeaders.email')}</th>
              <th>{t('logs.tableHeaders.ip')}</th>
              <th>{t('logs.tableHeaders.userAgent')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className={s.mono}>{fmtDate(log.createdAt)}</td>
                <td>
                  <span className={s.badge} style={{
                    background: log.success ? '#dcfce7' : '#fef2f2',
                    color: log.success ? '#16a34a' : '#dc2626',
                  }}>
                    {log.success ? t('logs.statusSuccess') : t('logs.statusFailed')}
                  </span>
                </td>
                <td className={s.mono}>{log.email || '—'}</td>
                <td className={s.mono}>{log.ip || '—'}</td>
                <td className={s.truncate} style={{ fontSize: 11 }}>{log.userAgent || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalDocs > 0 && (
        <div className={s.pagination}>
          <button className={s.pageBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>{t('common.previous')}</button>
          <span className={s.pageInfo}>{t('common.page')} {page} — {totalDocs} {t('common.results')}</span>
          <button className={s.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>{t('common.next')}</button>
        </div>
      )}
    </div>
  )
}
