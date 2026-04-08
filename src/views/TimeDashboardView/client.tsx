'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface TimeEntry {
  id: number
  ticket: number | { id: number; ticketNumber?: string; subject?: string; project?: number | { id: number; name?: string } }
  duration: number
  description: string
  date: string
}

interface GroupedData { label: string; entries: TimeEntry[]; totalMinutes: number }

function formatDuration(minutes: number): string { const h = Math.floor(minutes / 60); const m = minutes % 60; if (h === 0) return `${m}min`; if (m === 0) return `${h}h`; return `${h}h${m}m` }
function getWeekNumber(d: Date): number { const oneJan = new Date(d.getFullYear(), 0, 1); return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7) }
function getMonthRange(offset: number): { from: string; to: string } { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() + offset, 1); const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0); return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] } }
const MONTHS_FR = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']

export const TimeDashboardClient: React.FC = () => {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => getMonthRange(0).from)
  const [to, setTo] = useState(() => getMonthRange(0).to)
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'project'>('day')

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500', depth: '2', sort: '-date' })
      if (from) params.set('where[date][greater_than_equal]', from)
      if (to) params.set('where[date][less_than_equal]', to)
      const res = await fetch(`/api/time-entries?${params}`)
      if (res.ok) { const json = await res.json(); setEntries(json.docs || []) }
    } catch { /* silent */ }
    setLoading(false)
  }, [from, to])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0)

  const grouped: GroupedData[] = React.useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const entry of entries) {
      let key: string
      if (groupBy === 'day') { key = entry.date ? entry.date.split('T')[0] : 'Sans date' }
      else if (groupBy === 'week') { const d = new Date(entry.date); key = `Semaine ${getWeekNumber(d)} (${MONTHS_FR[d.getMonth()]} ${d.getFullYear()})` }
      else { const ticket = typeof entry.ticket === 'object' ? entry.ticket : null; const project = ticket && typeof ticket.project === 'object' ? ticket.project : null; key = project?.name || 'Sans projet' }
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(entry)
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, entries: items, totalMinutes: items.reduce((sum, e) => sum + (e.duration || 0), 0) }))
  }, [entries, groupBy])

  const dailyChart = React.useMemo(() => {
    const dayMap = new Map<string, number>()
    for (const entry of entries) { const day = entry.date ? entry.date.split('T')[0] : null; if (day) dayMap.set(day, (dayMap.get(day) || 0) + (entry.duration || 0)) }
    return Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([day, mins]) => ({ day, minutes: mins }))
  }, [entries])

  const maxDailyMinutes = Math.max(...dailyChart.map((d) => d.minutes), 1)
  const setPeriod = (range: { from: string; to: string }) => { setFrom(range.from); setTo(range.to) }

  const S: Record<string, React.CSSProperties> = {
    page: { padding: '20px 30px', maxWidth: 1100, margin: '0 auto' },
    btn: { padding: '6px 12px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, cursor: 'pointer', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)' },
    btnPrimary: { padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer', background: '#2563eb', color: '#fff', fontWeight: 600 },
    kpis: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 },
    kpiCard: { padding: '16px 20px', borderRadius: 10, border: '1px solid var(--theme-elevation-150)' },
    groupCard: { marginBottom: 12, borderRadius: 10, border: '1px solid var(--theme-elevation-150)', overflow: 'hidden' },
    groupHeader: { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--theme-elevation-50)', borderBottom: '1px solid var(--theme-elevation-150)' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
    td: { padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-100)' },
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Tableau de bord du temps</h1>
          <p style={{ fontSize: 13, color: 'var(--theme-elevation-500)', margin: '4px 0 0' }}>Analyse et suivi du temps passe par periode, projet et ticket</p>
        </div>
        <a href="/admin/collections/time-entries/create" style={{ ...S.btnPrimary, textDecoration: 'none', display: 'inline-block' }}>+ Nouvelle entree</a>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button style={S.btnPrimary} onClick={() => setPeriod(getMonthRange(0))}>Ce mois</button>
          <button style={S.btn} onClick={() => setPeriod(getMonthRange(-1))}>Mois precedent</button>
          <button style={S.btn} onClick={() => setPeriod(getMonthRange(-2))}>-2 mois</button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div><label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--theme-elevation-500)' }}>Du</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' }} /></div>
          <div><label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--theme-elevation-500)' }}>Au</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' }} /></div>
          <div><label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--theme-elevation-500)' }}>Grouper par</label><select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'project')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' }}><option value="day">Jour</option><option value="week">Semaine</option><option value="project">Projet</option></select></div>
        </div>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chargement...</div> : (
        <>
          <div style={S.kpis}>
            <div style={S.kpiCard}><div style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>Temps total</div><div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{formatDuration(totalMinutes)}</div></div>
            <div style={S.kpiCard}><div style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>Entrees</div><div style={{ fontSize: 24, fontWeight: 700, color: '#d97706' }}>{entries.length}</div></div>
            <div style={S.kpiCard}><div style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>Moyenne/jour</div><div style={{ fontSize: 24, fontWeight: 700, color: '#ea580c' }}>{dailyChart.length > 0 ? formatDuration(Math.round(totalMinutes / dailyChart.length)) : '-'}</div></div>
          </div>

          {dailyChart.length > 0 && (
            <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-150)', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Temps par jour</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
                {dailyChart.map((d) => <div key={d.day} style={{ flex: 1, background: '#3b82f6', borderRadius: '3px 3px 0 0', height: `${Math.max((d.minutes / maxDailyMinutes) * 100, 4)}%` }} title={`${d.day}: ${formatDuration(d.minutes)}`} />)}
              </div>
            </div>
          )}

          {grouped.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Aucune entree de temps sur cette periode.</div> : grouped.map((group) => (
            <div key={group.label} style={S.groupCard}>
              <div style={S.groupHeader}><span style={{ fontWeight: 700 }}>{group.label}</span><span style={{ fontWeight: 700, color: '#2563eb' }}>{formatDuration(group.totalMinutes)}</span></div>
              <table style={S.table}>
                <tbody>
                  {group.entries.map((entry) => {
                    const ticket = typeof entry.ticket === 'object' ? entry.ticket : null
                    return (
                      <tr key={entry.id}>
                        <td style={S.td}>{ticket ? <a href={`/admin/collections/tickets/${ticket.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>{ticket.ticketNumber || `#${ticket.id}`}</a> : '-'}</td>
                        <td style={S.td}>{ticket?.subject || ''}</td>
                        <td style={{ ...S.td, color: 'var(--theme-elevation-500)' }}>{entry.description || '-'}</td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{formatDuration(entry.duration)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
