'use client'

import React, { useState, useCallback } from 'react'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import { DATE_LOCALE } from '../shared/dateLocale'
import styles from '../../styles/BillingView.module.scss'

interface BillingEntry {
  duration: number
  description: string
  date: string
}

interface BillingTicket {
  id: number
  ticketNumber: string
  subject: string
  status: string
  entries: BillingEntry[]
  totalMinutes: number
  billedAmount: number | null
  hasNoTimeEntries: boolean
  aiSummary: string | null
  aiSummaryGeneratedAt: string | null
  aiSummaryStatus: string | null
}

interface BillingGroup {
  project: { id: number; name: string } | null
  client: { company: string } | null
  tickets: BillingTicket[]
  totalMinutes: number
  totalBilledAmount: number
}

interface BillingData {
  groups: BillingGroup[]
  grandTotalMinutes: number
  grandTotalBilledAmount: number
  ticketsWithoutTime: number
}

interface ProjectOption {
  id: number
  name: string
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function formatAmount(minutes: number, rate: number): string {
  const hours = minutes / 60
  return (hours * rate).toFixed(2)
}

function getMonthRange(offset: number): { from: string; to: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + offset
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0],
  }
}

function getQuarterRange(offset: number): { from: string; to: string } {
  const now = new Date()
  const currentQuarter = Math.floor(now.getMonth() / 3)
  const quarter = currentQuarter + offset
  const year = now.getFullYear()
  const startMonth = quarter * 3
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, startMonth + 3, 0)
  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0],
  }
}

export const BillingClient: React.FC = () => {
  const { t } = useTranslation()
  const [from, setFrom] = useState(() => getMonthRange(0).from)
  const [to, setTo] = useState(() => getMonthRange(0).to)
  const [projectId, setProjectId] = useState('')
  const [rate, setRate] = useState(60)
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectsLoaded, setProjectsLoaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hideEmpty, setHideEmpty] = useState(false)
  const [expandedSummaries, setExpandedSummaries] = useState<Set<number>>(new Set())
  const [regeneratingIds, setRegeneratingIds] = useState<Set<number>>(new Set())
  const [billedTickets, setBilledTickets] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const saved = localStorage.getItem('billing-checked-tickets')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })

  const toggleBilled = useCallback((ticketId: number) => {
    setBilledTickets((prev) => {
      const next = new Set(prev)
      if (next.has(ticketId)) next.delete(ticketId)
      else next.add(ticketId)
      localStorage.setItem('billing-checked-tickets', JSON.stringify([...next]))
      return next
    })
  }, [])

  const toggleSummary = useCallback((ticketId: number) => {
    setExpandedSummaries((prev) => {
      const next = new Set(prev)
      if (next.has(ticketId)) next.delete(ticketId)
      else next.add(ticketId)
      return next
    })
  }, [])

  const visibleGroups = React.useMemo(() => {
    if (!data) return []
    if (!hideEmpty) return data.groups
    return data.groups
      .map((g) => ({ ...g, tickets: g.tickets.filter((t) => !t.hasNoTimeEntries) }))
      .filter((g) => g.tickets.length > 0)
  }, [data, hideEmpty])

  const allTicketIds = visibleGroups.flatMap((g) => g.tickets.map((t) => t.id))
  const allBilled = allTicketIds.length > 0 && allTicketIds.every((id) => billedTickets.has(id))
  const toggleAll = useCallback(() => {
    setBilledTickets((prev) => {
      const ids = visibleGroups.flatMap((g) => g.tickets.map((t) => t.id))
      const next = ids.every((id) => prev.has(id)) ? new Set<number>() : new Set(ids)
      localStorage.setItem('billing-checked-tickets', JSON.stringify([...next]))
      return next
    })
  }, [visibleGroups])

  const loadProjects = useCallback(async () => {
    if (projectsLoaded) return
    try {
      const res = await fetch('/api/projects?limit=100&depth=0&sort=name')
      if (res.ok) {
        const json = await res.json()
        setProjects(json.docs?.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name })) || [])
      }
    } catch { /* ignore */ }
    setProjectsLoaded(true)
  }, [projectsLoaded])

  React.useEffect(() => { loadProjects() }, [loadProjects])

  const fetchBilling = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      if (projectId) params.set('projectId', projectId)
      const res = await fetch(`/api/support/billing?${params}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch (err) {
      console.error('[billing] Fetch error:', err)
    }
    setLoading(false)
  }, [from, to, projectId])

  const setPeriod = (range: { from: string; to: string }) => {
    setFrom(range.from)
    setTo(range.to)
  }

  const requestSynthesis = useCallback(async (ticketId: number, force: boolean) => {
    setRegeneratingIds((prev) => new Set(prev).add(ticketId))
    try {
      const params = new URLSearchParams({ ticketId: String(ticketId) })
      if (force) params.set('force', 'true')
      const res = await fetch(`/api/support/ticket-synthesis?${params}`, { method: 'POST' })
      if (res.ok) {
        const json = await res.json() as { summary: string; generatedAt: string; status: string }
        setData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            groups: prev.groups.map((g) => ({
              ...g,
              tickets: g.tickets.map((t) => t.id === ticketId
                ? { ...t, aiSummary: json.summary, aiSummaryGeneratedAt: json.generatedAt, aiSummaryStatus: 'done' }
                : t,
              ),
            })),
          }
        })
        // Auto-expand once we have a summary
        setExpandedSummaries((prev) => new Set(prev).add(ticketId))
      }
    } catch (err) {
      console.error('[billing] Synthesis error:', err)
    } finally {
      setRegeneratingIds((prev) => {
        const next = new Set(prev)
        next.delete(ticketId)
        return next
      })
    }
  }, [])

  const copyRecap = useCallback(() => {
    if (!data) return
    const lines: string[] = []
    lines.push(t('billing.recap.header', { from, to }))
    lines.push(t('billing.recap.hourlyRate', { rate: String(rate) }))
    lines.push('='.repeat(50))

    for (const group of visibleGroups) {
      lines.push('')
      lines.push(group.project?.name
        ? t('billing.recap.project', { name: group.project.name })
        : t('billing.recap.project', { name: t('billing.recap.noProject') }))
      if (group.client?.company) lines.push(t('billing.recap.client', { company: group.client.company }))
      lines.push('-'.repeat(40))

      for (const ticket of group.tickets) {
        const flag = ticket.hasNoTimeEntries ? t('billing.recap.noTime') : ''
        lines.push(`  ${ticket.ticketNumber} — ${ticket.subject}${flag}`)
        for (const entry of ticket.entries) {
          lines.push(`    ${entry.date} | ${formatDuration(entry.duration)} | ${entry.description || '-'}`)
        }
        if (ticket.entries.length > 0) {
          const ticketAmount = ticket.billedAmount || Number(formatAmount(ticket.totalMinutes, rate))
          lines.push(`    ${t('billing.recap.subtotal')} : ${formatDuration(ticket.totalMinutes)} = ${ticketAmount.toFixed(2)}${t('billing.recap.eur')}${ticket.billedAmount ? t('billing.recap.forfait') : ''}`)
        }
        if (ticket.aiSummary) {
          lines.push(`    ${t('billing.recap.actionDetails')} :`)
          for (const detailLine of ticket.aiSummary.split('\n')) {
            lines.push(`    ${detailLine}`)
          }
        }
      }
      const groupAmount = group.totalBilledAmount > 0
        ? group.totalBilledAmount
        : Number(formatAmount(group.totalMinutes, rate))
      lines.push(`  ${t('billing.recap.projectTotal')} : ${formatDuration(group.totalMinutes)} = ${groupAmount.toFixed(2)}${t('billing.recap.eur')}`)
    }

    lines.push('')
    lines.push('='.repeat(50))
    lines.push(`${t('billing.recap.grandTotal')} : ${formatDuration(data.grandTotalMinutes)} = ${formatAmount(data.grandTotalMinutes, rate)}${t('billing.recap.eur')}`)

    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [data, visibleGroups, from, to, rate, t])

  const copyTicketSummary = useCallback((ticket: BillingTicket) => {
    const lines = [`${ticket.ticketNumber} — ${ticket.subject}`]
    if (ticket.aiSummary) lines.push('', ticket.aiSummary)
    navigator.clipboard.writeText(lines.join('\n'))
  }, [])

  const totalTickets = visibleGroups.reduce((sum, g) => sum + g.tickets.length, 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.title')}</h1>
          <p className={styles.subtitle}>{t('billing.subtitle')}</p>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.quickPeriod}>
          <button className={styles.btnPrimary} onClick={() => setPeriod(getMonthRange(0))}>{t('billing.filters.thisMonth')}</button>
          <button className={styles.btnSecondary} onClick={() => setPeriod(getMonthRange(-1))}>{t('billing.filters.lastMonth')}</button>
          <button className={styles.btnAmber} onClick={() => setPeriod(getQuarterRange(0))}>{t('billing.filters.thisQuarter')}</button>
          <button className={styles.btnMuted} onClick={() => setPeriod(getQuarterRange(-1))}>{t('billing.filters.lastQuarter')}</button>
        </div>

        <div className={styles.filterRow}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('billing.filters.from')}</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={styles.input} />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('billing.filters.to')}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={styles.input} />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('billing.filters.project')}</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={styles.select}>
              <option value="">{t('ticket.allProjects')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('billing.filters.hourlyRate')}</label>
            <div className={styles.rateRow}>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className={styles.rateInput}
                min={0}
              />
              <span className={styles.rateUnit}>{t('billing.filters.rateUnit')}</span>
            </div>
          </div>
          <button className={styles.btnPrimary} onClick={fetchBilling} disabled={loading}>
            {loading ? t('billing.filters.loading') : t('billing.filters.load')}
          </button>
        </div>
      </div>

      {data && (
        <>
          {data.ticketsWithoutTime > 0 && (
            <div className={styles.warningBanner}>
              <span>
                {data.ticketsWithoutTime > 1
                  ? t('billing.warningTicketsPlural', { count: String(data.ticketsWithoutTime) })
                  : t('billing.warningTickets', { count: String(data.ticketsWithoutTime) })}
              </span>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
                <span>{t('billing.hideEmpty')}</span>
              </label>
            </div>
          )}

          {visibleGroups.length === 0 ? (
            <div className={styles.empty}>{t('billing.empty')}</div>
          ) : (
            <>
              {visibleGroups.map((group, gi) => (
                <div key={gi} className={styles.groupCard}>
                  <div className={styles.groupHeader}>
                    <div>
                      <span className={styles.groupName}>{group.project?.name || t('billing.noProject')}</span>
                      {group.client?.company && (
                        <span className={styles.groupClient}>— {group.client.company}</span>
                      )}
                    </div>
                    <div className={styles.groupTotals}>
                      <div className={styles.groupDuration}>{formatDuration(group.totalMinutes)}</div>
                      {group.totalBilledAmount > 0 ? (
                        <>
                          <div className={styles.groupAmountBilled}>{group.totalBilledAmount.toFixed(2)} EUR {t('billing.groupAmountBilled')}</div>
                          <div className={styles.groupAmountStrike}>{formatAmount(group.totalMinutes, rate)} EUR (temps)</div>
                        </>
                      ) : (
                        <div className={styles.groupAmount}>{formatAmount(group.totalMinutes, rate)} EUR</div>
                      )}
                    </div>
                  </div>

                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.thCheckbox}>
                          <input
                            type="checkbox"
                            checked={group.tickets.every((t) => billedTickets.has(t.id))}
                            onChange={() => {
                              const ids = group.tickets.map((t) => t.id)
                              const allChecked = ids.every((id) => billedTickets.has(id))
                              setBilledTickets((prev) => {
                                const next = new Set(prev)
                                ids.forEach((id) => allChecked ? next.delete(id) : next.add(id))
                                localStorage.setItem('billing-checked-tickets', JSON.stringify([...next]))
                                return next
                              })
                            }}
                            className={styles.checkbox}
                            title={t('billing.tableCheckboxTitle')}
                          />
                        </th>
                        <th className={styles.th}>{t('billing.tableHeaders.number')}</th>
                        <th className={styles.thLeft}>{t('billing.tableHeaders.subject')}</th>
                        <th className={styles.th}>{t('billing.tableHeaders.date')}</th>
                        <th className={styles.th}>{t('billing.tableHeaders.duration')}</th>
                        <th className={styles.thLeft}>{t('billing.tableHeaders.description')}</th>
                        <th className={styles.th}>{t('billing.tableHeaders.amount')}</th>
                        <th className={styles.th}>{t('billing.tableHeaders.billed')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.tickets.map((ticket) => {
                        const isBilled = billedTickets.has(ticket.id)
                        const isExpanded = expandedSummaries.has(ticket.id)
                        const isRegenerating = regeneratingIds.has(ticket.id)
                        const rowSpan = Math.max(ticket.entries.length, 1)
                        const renderTicketHeaderCells = () => (
                          <>
                            <td className={styles.td} rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                              <input
                                type="checkbox"
                                checked={isBilled}
                                onChange={() => toggleBilled(ticket.id)}
                                className={styles.checkbox}
                                title={isBilled ? t('billing.markUnbilledTitle') : t('billing.markBilledTitle')}
                              />
                            </td>
                            <td className={`${styles.td} ${styles.bold} ${isBilled ? styles.strikethrough : ''}`} rowSpan={rowSpan}>
                              <a href={`/admin/support/ticket?id=${ticket.id}`} className={styles.ticketLink}>
                                {ticket.ticketNumber}
                              </a>
                              <button
                                className={styles.summaryBtn}
                                onClick={() => toggleSummary(ticket.id)}
                                title={isExpanded ? t('billing.summaryToggleHide') : t('billing.summaryToggleShow')}
                              >
                                {isExpanded ? '▼' : '▶'} IA
                              </button>
                            </td>
                            <td className={`${styles.tdLeft} ${isBilled ? styles.strikethrough : ''}`} rowSpan={rowSpan}>
                              {ticket.subject}
                              {ticket.hasNoTimeEntries && (
                                <span className={styles.noTimeBadge} title={t('billing.noTimeBadgeTitle')}>
                                  {t('billing.noTimeBadge')}
                                </span>
                              )}
                            </td>
                          </>
                        )

                        const rows: React.ReactNode[] = []

                        if (ticket.entries.length === 0) {
                          rows.push(
                            <tr
                              key={`${ticket.id}-empty`}
                              className={`${isBilled ? styles.tableRowBilled : styles.tableRowNoTime}`}
                            >
                              {renderTicketHeaderCells()}
                              <td className={`${styles.td} ${styles.secondary}`} colSpan={5}>
                                <em>{t('billing.noTimeRow')}</em>
                              </td>
                            </tr>,
                          )
                        } else {
                          ticket.entries.forEach((entry, ei) => {
                            rows.push(
                              <tr
                                key={`${ticket.id}-${ei}`}
                                className={`${isBilled ? styles.tableRowBilled : styles.tableRow} ${!isBilled && ei % 2 === 0 ? styles.tableRowEven : ''} ${!isBilled && ei % 2 !== 0 ? styles.tableRowOdd : ''}`}
                              >
                                {ei === 0 ? renderTicketHeaderCells() : null}
                                <td className={styles.td}>{entry.date}</td>
                                <td className={styles.td}>{formatDuration(entry.duration)}</td>
                                <td className={`${styles.tdLeft} ${styles.secondary}`}>
                                  {entry.description || '-'}
                                </td>
                                <td className={`${styles.td} ${styles.bold}`}>
                                  {formatAmount(entry.duration, rate)} EUR
                                </td>
                                {ei === 0 ? (
                                  <td
                                    className={`${styles.td} ${ticket.billedAmount ? styles.billedAmount : styles.secondary}`}
                                    rowSpan={ticket.entries.length}
                                  >
                                    {ticket.billedAmount ? `${ticket.billedAmount.toFixed(2)} EUR` : '-'}
                                  </td>
                                ) : null}
                              </tr>,
                            )
                          })
                        }

                        if (isExpanded) {
                          rows.push(
                            <tr key={`${ticket.id}-summary`} className={styles.summaryRow}>
                              <td colSpan={8} className={styles.summaryCell}>
                                <div className={styles.summaryHeader}>
                                  <strong>{t('billing.summaryTitle')}</strong>
                                  <div className={styles.summaryActions}>
                                    {ticket.aiSummaryGeneratedAt && (
                                      <span className={styles.summaryMeta}>
                                        {t('billing.summaryGeneratedAt', { date: new Date(ticket.aiSummaryGeneratedAt).toLocaleString(DATE_LOCALE) })}
                                      </span>
                                    )}
                                    {ticket.aiSummary && (
                                      <button
                                        className={styles.summaryAction}
                                        onClick={() => copyTicketSummary(ticket)}
                                      >
                                        {t('billing.summaryCopy')}
                                      </button>
                                    )}
                                    <button
                                      className={styles.summaryAction}
                                      onClick={() => requestSynthesis(ticket.id, !!ticket.aiSummary)}
                                      disabled={isRegenerating}
                                    >
                                      {isRegenerating
                                        ? t('billing.summaryGenerating')
                                        : ticket.aiSummary ? t('billing.summaryRegenerate') : t('billing.summaryGenerate')}
                                    </button>
                                  </div>
                                </div>
                                {ticket.aiSummaryStatus === 'pending' && !ticket.aiSummary ? (
                                  <div className={styles.summaryEmpty}>
                                    {t('billing.summaryPending')}
                                  </div>
                                ) : ticket.aiSummary ? (
                                  <pre className={styles.summaryText}>{ticket.aiSummary}</pre>
                                ) : (
                                  <div className={styles.summaryEmpty}>
                                    {t('billing.summaryEmpty')}
                                  </div>
                                )}
                              </td>
                            </tr>,
                          )
                        }

                        return rows
                      })}
                    </tbody>
                  </table>
                </div>
              ))}

              <div className={styles.grandTotal}>
                <div>
                  <div className={styles.totalMeta}>
                    {totalTickets > 1
                      ? t('billing.ticketsDisplayedPlural', { count: String(totalTickets) })
                      : t('billing.ticketsDisplayed', { count: String(totalTickets) })}
                    {billedTickets.size > 0 && (
                      <span className={styles.totalChecked}>
                        {(() => {
                          const checkedCount = allTicketIds.filter((id) => billedTickets.has(id)).length
                          return checkedCount > 1
                            ? `(${t('billing.ticketsCheckedPlural', { count: String(checkedCount) })})`
                            : `(${t('billing.ticketsChecked', { count: String(checkedCount) })})`
                        })()}
                      </span>
                    )}
                  </div>
                  <div className={styles.totalAmount}>
                    {t('billing.totalLabel')} : {formatDuration(data.grandTotalMinutes)} ={' '}
                    {data.grandTotalBilledAmount > 0
                      ? `${data.grandTotalBilledAmount.toFixed(2)} EUR`
                      : `${formatAmount(data.grandTotalMinutes, rate)} EUR`
                    }
                  </div>
                </div>
                <div className={styles.totalActions}>
                  <button className={allBilled ? styles.btnSecondary : styles.btnGreen} onClick={toggleAll}>
                    {allBilled ? t('billing.totals.uncheckAll') : t('billing.totals.checkAll')}
                  </button>
                  <button className={copied ? styles.btnSuccess : styles.btnAmber} onClick={copyRecap}>
                    {copied ? t('billing.totals.copiedRecap') : t('billing.totals.copyRecap')}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
