/* eslint-disable @next/next/no-html-link-for-pages */
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { SkeletonDashboard } from '../shared/Skeleton'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import styles from '../../styles/TimeDashboard.module.scss'

interface TimeEntry {
  id: number
  ticket: number | { id: number; ticketNumber?: string; subject?: string; project?: number | { id: number; name?: string } }
  duration: number
  description: string
  date: string
}

interface GroupedData {
  label: string
  entries: TimeEntry[]
  totalMinutes: number
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
}

function getMonthRange(offset: number): { from: string; to: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] }
}

const MONTHS_FR = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']

export const TimeDashboardClient: React.FC = () => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => getMonthRange(0).from)
  const [to, setTo] = useState(() => getMonthRange(0).to)
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'project'>('day')

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '500',
        depth: '2',
        sort: '-date',
      })
      if (from) params.set('where[date][greater_than_equal]', from)
      if (to) params.set('where[date][less_than_equal]', to)

      const res = await fetch(`/api/time-entries?${params}`)
      if (res.ok) {
        const json = await res.json()
        setEntries(json.docs || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [from, to])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
  const totalEntries = entries.length

  // Group entries
  const grouped: GroupedData[] = React.useMemo(() => {
    const map = new Map<string, TimeEntry[]>()

    for (const entry of entries) {
      let key: string
      if (groupBy === 'day') {
        key = entry.date ? entry.date.split('T')[0] : 'Sans date'
      } else if (groupBy === 'week') {
        const d = new Date(entry.date)
        key = `Semaine ${getWeekNumber(d)} (${MONTHS_FR[d.getMonth()]} ${d.getFullYear()})`
      } else {
        const ticket = typeof entry.ticket === 'object' ? entry.ticket : null
        const project = ticket && typeof ticket.project === 'object' ? ticket.project : null
        key = project?.name || 'Sans projet'
      }

      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(entry)
    }

    return Array.from(map.entries()).map(([label, items]) => ({
      label,
      entries: items,
      totalMinutes: items.reduce((sum, e) => sum + (e.duration || 0), 0),
    }))
  }, [entries, groupBy])

  // Daily chart data (last 30 days)
  const dailyChart = React.useMemo(() => {
    const dayMap = new Map<string, number>()
    for (const entry of entries) {
      const day = entry.date ? entry.date.split('T')[0] : null
      if (day) {
        dayMap.set(day, (dayMap.get(day) || 0) + (entry.duration || 0))
      }
    }
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([day, mins]) => ({ day, minutes: mins }))
  }, [entries])

  const maxDailyMinutes = Math.max(...dailyChart.map((d) => d.minutes), 1)

  const setPeriod = (range: { from: string; to: string }) => {
    setFrom(range.from)
    setTo(range.to)
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{t('timeDashboard.title')}</h1>
          <p className={styles.subtitle}>{t('timeDashboard.subtitle')}</p>
        </div>
        <a href="/admin/collections/time-entries/create" className={styles.newEntryBtn}>
          {t('timeDashboard.newEntry')}
        </a>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.quickPeriod}>
          <button className={styles.btnPrimary} onClick={() => setPeriod(getMonthRange(0))}>{t('timeDashboard.filters.thisMonth')}</button>
          <button className={styles.btnSecondary} onClick={() => setPeriod(getMonthRange(-1))}>{t('timeDashboard.filters.lastMonth')}</button>
          <button className={styles.btnAmber} onClick={() => setPeriod(getMonthRange(-2))}>{t('timeDashboard.filters.twoMonthsAgo')}</button>
        </div>
        <div className={styles.filterRow}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('timeDashboard.filters.from')}</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={styles.input} />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('timeDashboard.filters.to')}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={styles.input} />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('timeDashboard.filters.groupBy')}</label>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'project')} className={styles.select}>
              <option value="day">{t('timeDashboard.filters.day')}</option>
              <option value="week">{t('timeDashboard.filters.week')}</option>
              <option value="project">{t('timeDashboard.filters.project')}</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <SkeletonDashboard />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className={styles.kpis}>
            <div className={styles.kpiCardPrimary}>
              <div className={styles.kpiLabel}>{t('timeDashboard.kpis.totalTime')}</div>
              <div className={styles.kpiPrimary}>{formatDuration(totalMinutes)}</div>
            </div>
            <div className={styles.kpiCardAmber}>
              <div className={styles.kpiLabel}>{t('timeDashboard.kpis.entries')}</div>
              <div className={styles.kpiAmber}>{totalEntries}</div>
            </div>
            <div className={styles.kpiCardOrange}>
              <div className={styles.kpiLabel}>{t('timeDashboard.kpis.dailyAverage')}</div>
              <div className={styles.kpiOrange}>
                {dailyChart.length > 0 ? formatDuration(Math.round(totalMinutes / dailyChart.length)) : '-'}
              </div>
            </div>
          </div>

          {/* Chart */}
          {dailyChart.length > 0 && (
            <div className={styles.chartWrap}>
              <div className={styles.chartHeader}>
                {t('timeDashboard.chart.title')}
              </div>
              <div className={styles.chartBars}>
                {dailyChart.map((d) => (
                  <div
                    key={d.day}
                    className={styles.chartBar}
                    style={{ height: `${Math.max((d.minutes / maxDailyMinutes) * 100, 4)}%` }}
                    title={`${d.day}: ${formatDuration(d.minutes)}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Grouped entries */}
          {grouped.length === 0 ? (
            <div className={styles.empty}>
              {t('timeDashboard.empty')}
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className={styles.groupCard}>
                <div className={styles.groupHeader}>
                  <span className={styles.groupLabel}>{group.label}</span>
                  <span className={styles.groupTotal}>{formatDuration(group.totalMinutes)}</span>
                </div>
                <table className={styles.table}>
                  <tbody>
                    {group.entries.map((entry) => {
                      const ticket = typeof entry.ticket === 'object' ? entry.ticket : null
                      return (
                        <tr key={entry.id} className={styles.entryRow}>
                          <td className={styles.tdTicket}>
                            {ticket ? (
                              <a href={`/admin/collections/tickets/${ticket.id}`} className={styles.ticketLink}>
                                {ticket.ticketNumber || `#${ticket.id}`}
                              </a>
                            ) : '-'}
                          </td>
                          <td className={styles.tdSubject}>
                            {ticket?.subject || ''}
                          </td>
                          <td className={styles.tdDescription}>
                            {entry.description || '-'}
                          </td>
                          <td className={styles.tdDuration}>
                            {formatDuration(entry.duration)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}
