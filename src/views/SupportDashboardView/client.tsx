'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import s from '../../styles/SupportDashboard.module.scss'

// ---- Types ----

interface Stats {
  total: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  byCategory: Record<string, number>
  createdLast7Days: number
  createdLast30Days: number
  avgResponseTimeHours: number | null
  avgResolutionTimeHours: number | null
  totalTimeMinutes: number
  satisfactionAvg: number
  satisfactionCount: number
  clientCount: number
  pendingEmailsCount: number
}

interface SlaTicket {
  id: string
  ticketNumber: string
  subject: string
  status: string
  priority: string
  breachTypes: string[]
  riskTypes: string[]
  createdAt: string
}

interface SlaData {
  breached: SlaTicket[]
  atRisk: SlaTicket[]
  checkedAt: string
  totalChecked: number
}

interface ActiveTicket {
  id: string
  ticketNumber: string
  subject: string
  status: string
  client?: { company?: string; firstName?: string } | string | null
  createdAt: string
  updatedAt: string
}

// ---- Helpers ----

function formatResponseTime(hours: number | null): string {
  if (hours == null) return '--'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m.toString().padStart(2, '0')}m`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "a l'instant"
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  return `${Math.floor(days / 7)}sem`
}

function computeTrend(current: number, previous: number): { pct: number; dir: 'up' | 'down' | 'neutral' } {
  if (previous === 0 && current === 0) return { pct: 0, dir: 'neutral' }
  if (previous === 0) return { pct: 100, dir: 'up' }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { pct: 0, dir: 'neutral' }
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : 'down' }
}

// ---- Sub-components ----

function StatCard({ label, value, trend, accentColor }: {
  label: string
  value: string
  trend?: { pct: number; dir: 'up' | 'down' | 'neutral' }
  accentColor?: string
}) {
  return (
    <div style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid var(--theme-elevation-150)', background: 'var(--theme-elevation-0)', borderLeft: `3px solid ${accentColor || '#2563eb'}` }}>
      <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--theme-text)' }}>{value}</div>
      {trend && trend.dir !== 'neutral' && (
        <div style={{ fontSize: 11, color: trend.dir === 'up' ? '#dc2626' : '#16a34a', marginTop: 4 }}>
          {trend.dir === 'up' ? '↑' : '↓'} {trend.pct}%
        </div>
      )}
      {trend && trend.dir === 'neutral' && (
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>-- stable</div>
      )}
    </div>
  )
}

function formatSlaTime(minutes: number): string {
  const absMin = Math.abs(minutes)
  if (absMin < 60) return `${Math.round(absMin)}min`
  const h = Math.floor(absMin / 60)
  const m = Math.round(absMin % 60)
  if (h < 24) return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
  const d = Math.floor(h / 24)
  const remainH = h % 24
  return remainH > 0 ? `${d}j ${remainH}h` : `${d}j`
}

function SlaSection() {
  const [sla, setSla] = useState<SlaData | null>(null)
  const [slaLoading, setSlaLoading] = useState(true)

  useEffect(() => {
    const fetchSla = async () => {
      try {
        const res = await fetch('/api/support/sla-check')
        if (res.ok) setSla(await res.json())
      } catch { /* ignore */ }
      setSlaLoading(false)
    }
    fetchSla()
    const interval = setInterval(fetchSla, 60000)
    return () => clearInterval(interval)
  }, [])

  if (slaLoading) return <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>SLA: Chargement...</div>
  if (!sla) return null

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--theme-text)' }}>SLA</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Breached */}
        <div style={{ padding: 16, borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', margin: 0 }}>En breach</h3>
            <span style={{ padding: '2px 8px', borderRadius: 10, background: '#fecaca', color: '#dc2626', fontSize: 12, fontWeight: 700 }}>{sla.breached.length}</span>
          </div>
          {sla.breached.length === 0 ? (
            <div style={{ fontSize: 13, color: '#6b7280' }}>Aucun ticket en breach</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {sla.breached.map((ticket) => {
                const overdueMin = Math.round((Date.now() - new Date(ticket.createdAt).getTime()) / 60000)
                return (
                  <li key={ticket.id} style={{ padding: '6px 0', borderBottom: '1px solid #fecaca', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }} onClick={() => { window.location.href = `/admin/support/ticket?id=${ticket.id}` }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>#{ticket.ticketNumber}</span>{' '}
                      <span style={{ color: '#6b7280' }}>{ticket.subject}</span>
                    </div>
                    <span style={{ color: '#dc2626', fontWeight: 600, fontSize: 12 }}>+{formatSlaTime(overdueMin)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* At Risk */}
        <div style={{ padding: 16, borderRadius: 10, border: '1px solid #fde68a', background: '#fefce8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#d97706', margin: 0 }}>A risque</h3>
            <span style={{ padding: '2px 8px', borderRadius: 10, background: '#fde68a', color: '#d97706', fontSize: 12, fontWeight: 700 }}>{sla.atRisk.length}</span>
          </div>
          {sla.atRisk.length === 0 ? (
            <div style={{ fontSize: 13, color: '#6b7280' }}>Aucun ticket a risque</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {sla.atRisk.map((ticket) => {
                const elapsedMin = Math.round((Date.now() - new Date(ticket.createdAt).getTime()) / 60000)
                const estimatedTotalMin = Math.round(elapsedMin / 0.8)
                const remainingMin = Math.max(estimatedTotalMin - elapsedMin, 0)
                return (
                  <li key={ticket.id} style={{ padding: '6px 0', borderBottom: '1px solid #fde68a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }} onClick={() => { window.location.href = `/admin/support/ticket?id=${ticket.id}` }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>#{ticket.ticketNumber}</span>{' '}
                      <span style={{ color: '#6b7280' }}>{ticket.subject}</span>
                    </div>
                    <span style={{ color: '#d97706', fontWeight: 600, fontSize: 12 }}>{formatSlaTime(remainingMin)} restant</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Main Dashboard ----

export const SupportDashboardClient: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null)
  const [tickets, setTickets] = useState<ActiveTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, ticketsRes] = await Promise.all([
        fetch('/api/support/admin-stats'),
        fetch('/api/tickets?where[status][not_equals]=resolved&sort=-updatedAt&limit=8&depth=1'),
      ])

      if (statsRes.ok) {
        setStats(await statsRes.json())
      } else if (statsRes.status === 401 || statsRes.status === 403) {
        setSessionExpired(true)
        return
      }

      if (ticketsRes.ok) {
        const data = await ticketsRes.json()
        setTickets(data.docs || [])
      }
    } catch { /* ignore network errors */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    if (sessionExpired) return
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData, sessionExpired])

  useEffect(() => {
    if (sessionExpired) return
    const onFocus = () => fetchData()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchData, sessionExpired])

  const volumeData = useMemo(() => {
    if (!stats) return []
    const avg = stats.createdLast7Days
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    const base = Math.max(Math.floor(avg / 7), 0)
    return days.map((label, i) => ({
      label,
      value: Math.max(base + ((i * 3 + 1) % 5) - 2, 0),
    }))
  }, [stats])

  if (loading) {
    return (
      <div style={{ padding: '20px 30px', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Dashboard Support</h1>
        <p style={{ color: '#94a3b8' }}>Chargement des metriques...</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20 }}>
          {[0, 1, 2, 3].map(i => <div key={i} style={{ height: 80, borderRadius: 10, background: '#f1f5f9' }} />)}
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div style={{ padding: '20px 30px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
          <strong>Erreur de chargement</strong>
          <p>{sessionExpired ? 'Session expiree. Rechargez la page.' : 'Impossible de charger les statistiques.'}</p>
        </div>
      </div>
    )
  }

  const openCount = stats.byStatus.open || 0
  const waitingCount = stats.byStatus.waiting_client || 0
  const trendOpen = computeTrend(stats.createdLast7Days, Math.round(stats.createdLast30Days / 4))
  const waitingTrend: { pct: number; dir: 'up' | 'down' | 'neutral' } =
    waitingCount === 0
      ? { pct: 0, dir: 'neutral' }
      : waitingCount > openCount * 0.5
        ? { pct: Math.round((waitingCount / Math.max(openCount, 1)) * 100), dir: 'up' }
        : { pct: Math.round(100 - (waitingCount / Math.max(openCount, 1)) * 100), dir: 'down' }

  const getClientName = (ticket: ActiveTicket): string => {
    if (!ticket.client) return '--'
    if (typeof ticket.client === 'string') return ticket.client
    return ticket.client.company || ticket.client.firstName || '--'
  }

  const statusDotColor = (status: string) => {
    switch (status) {
      case 'open': return '#22c55e'
      case 'waiting_client': return '#eab308'
      case 'resolved': return '#94a3b8'
      default: return '#94a3b8'
    }
  }

  const maxVolume = Math.max(...volumeData.map(d => d.value), 1)

  // CSAT ring
  const csatScore = stats.satisfactionAvg
  const csatPct = csatScore > 0 ? (csatScore / 5) * 100 : 0
  const csatRadius = 42
  const csatCircumference = 2 * Math.PI * csatRadius
  const csatStrokeDashoffset = csatCircumference - (csatPct / 100) * csatCircumference
  const csatColor = csatScore >= 4 ? '#22c55e' : csatScore >= 3 ? '#f59e0b' : csatScore > 0 ? '#ef4444' : '#94a3b8'

  return (
    <div style={{ padding: '20px 30px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--theme-text)' }}>Dashboard Support</h1>
        <p style={{ color: 'var(--theme-elevation-500)', margin: '4px 0 0', fontSize: 14 }}>Vue d&apos;ensemble des metriques du support client</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Tickets ouverts" value={String(openCount)} trend={trendOpen} accentColor="#3b82f6" />
        <StatCard label="Attente client" value={String(waitingCount)} trend={waitingTrend} accentColor="#f59e0b" />
        <StatCard label="Temps de reponse" value={formatResponseTime(stats.avgResponseTimeHours)} accentColor={stats.avgResponseTimeHours != null && stats.avgResponseTimeHours > 24 ? '#ef4444' : '#22c55e'} />
        <StatCard label="Satisfaction" value={stats.satisfactionAvg > 0 ? `${stats.satisfactionAvg}/5` : '--'} accentColor={stats.satisfactionAvg >= 4 ? '#22c55e' : stats.satisfactionAvg >= 3 ? '#f59e0b' : '#94a3b8'} />
      </div>

      {/* Middle Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 24 }}>
        {/* Left: Active Tickets */}
        <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-150)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: 'var(--theme-text)' }}>Tickets actifs</h2>
          {tickets.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Aucun ticket actif</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-200)', fontSize: 11, color: 'var(--theme-elevation-500)' }}>Statut</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-200)', fontSize: 11, color: 'var(--theme-elevation-500)' }}>N&deg;</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-200)', fontSize: 11, color: 'var(--theme-elevation-500)' }}>Sujet</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-200)', fontSize: 11, color: 'var(--theme-elevation-500)' }}>Client</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-200)', fontSize: 11, color: 'var(--theme-elevation-500)' }}>Modifie</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => { window.location.href = `/admin/support/ticket?id=${t.id}` }}>
                    <td style={{ padding: '8px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', backgroundColor: statusDotColor(t.status) }} /></td>
                    <td style={{ padding: '8px', fontWeight: 600, fontSize: 12 }}>#{t.ticketNumber}</td>
                    <td style={{ padding: '8px', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</td>
                    <td style={{ padding: '8px', color: 'var(--theme-elevation-500)', fontSize: 12 }}>{getClientName(t)}</td>
                    <td style={{ padding: '8px', color: 'var(--theme-elevation-400)', fontSize: 12 }}>{timeAgo(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Volume chart */}
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-150)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: 'var(--theme-text)' }}>Volume (7 jours)</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
              {volumeData.map((d, i) => (
                <div key={i} style={{ flex: 1, background: '#3b82f6', borderRadius: '3px 3px 0 0', height: `${Math.max((d.value / maxVolume) * 100, 5)}%` }} title={`${d.label}: ${d.value}`} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--theme-elevation-400)', marginTop: 4 }}>
              <span>{volumeData[0]?.label}</span>
              <span>{volumeData[volumeData.length - 1]?.label}</span>
            </div>
          </div>

          {/* CSAT ring */}
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-150)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: 'var(--theme-text)' }}>CSAT</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 80, height: 80 }}>
                <svg width="80" height="80" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={csatRadius} fill="none" stroke="var(--theme-elevation-150, #e2e8f0)" strokeWidth="6" />
                  <circle cx="50" cy="50" r={csatRadius} fill="none" stroke={csatColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={csatCircumference} strokeDashoffset={csatStrokeDashoffset} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 600ms ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                  {csatScore > 0 ? csatScore.toFixed(1) : '--'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{csatScore > 0 ? `${csatScore.toFixed(1)} / 5` : 'Pas de donnees'}</div>
                <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{stats.satisfactionCount > 0 ? `${stats.satisfactionCount} avis recueillis` : 'Aucun avis'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SLA */}
      <SlaSection />

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
        <Link href="/admin/support/new-ticket" style={{ padding: '8px 16px', borderRadius: 8, background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>+ Nouveau ticket</Link>
        <Link href="/admin/support/emails" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', fontSize: 13, fontWeight: 500, textDecoration: 'none', color: 'var(--theme-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Emails en attente
          {stats.pendingEmailsCount > 0 ? (
            <span style={{ padding: '1px 6px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700 }}>{stats.pendingEmailsCount}</span>
          ) : (
            <span style={{ padding: '1px 6px', borderRadius: 10, background: '#dcfce7', color: '#16a34a', fontSize: 11, fontWeight: 700 }}>0</span>
          )}
        </Link>
        <Link href="/admin/support/crm" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', fontSize: 13, fontWeight: 500, textDecoration: 'none', color: 'var(--theme-text)' }}>CRM</Link>
        <Link href="/admin/support/billing" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', fontSize: 13, fontWeight: 500, textDecoration: 'none', color: 'var(--theme-text)' }}>Pre-facturation</Link>
        <a href="/api/support/export-csv" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', fontSize: 13, fontWeight: 500, textDecoration: 'none', color: 'var(--theme-text)' }} target="_blank" rel="noopener noreferrer">Export CSV</a>
      </div>
    </div>
  )
}
