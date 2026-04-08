'use client'

import React, { useState, useCallback } from 'react'

interface BillingEntry { duration: number; description: string; date: string }
interface BillingTicket { id: number; ticketNumber: string; subject: string; entries: BillingEntry[]; totalMinutes: number; billedAmount: number | null }
interface BillingGroup { project: { id: number; name: string } | null; client: { company: string } | null; tickets: BillingTicket[]; totalMinutes: number; totalBilledAmount: number }
interface BillingData { groups: BillingGroup[]; grandTotalMinutes: number; grandTotalBilledAmount: number }
interface ProjectOption { id: number; name: string }

function formatDuration(minutes: number): string { const h = Math.floor(minutes / 60); const m = minutes % 60; if (h === 0) return `${m}min`; if (m === 0) return `${h}h`; return `${h}h ${m}min` }
function formatAmount(minutes: number, rate: number): string { return ((minutes / 60) * rate).toFixed(2) }
function getMonthRange(offset: number): { from: string; to: string } { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() + offset, 1); const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0); return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] } }
function getQuarterRange(offset: number): { from: string; to: string } { const now = new Date(); const q = Math.floor(now.getMonth() / 3) + offset; const start = new Date(now.getFullYear(), q * 3, 1); const end = new Date(now.getFullYear(), q * 3 + 3, 0); return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] } }

export const BillingClient: React.FC = () => {
  const [from, setFrom] = useState(() => getMonthRange(0).from)
  const [to, setTo] = useState(() => getMonthRange(0).to)
  const [projectId, setProjectId] = useState('')
  const [rate, setRate] = useState(60)
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectsLoaded, setProjectsLoaded] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadProjects = useCallback(async () => {
    if (projectsLoaded) return
    try { const res = await fetch('/api/projects?limit=100&depth=0&sort=name'); if (res.ok) { const json = await res.json(); setProjects(json.docs?.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name })) || []) } } catch {}
    setProjectsLoaded(true)
  }, [projectsLoaded])

  React.useEffect(() => { loadProjects() }, [loadProjects])

  const fetchBilling = useCallback(async () => {
    setLoading(true)
    try { const params = new URLSearchParams({ from, to }); if (projectId) params.set('projectId', projectId); const res = await fetch(`/api/support/billing?${params}`); if (res.ok) setData(await res.json()) } catch {}
    setLoading(false)
  }, [from, to, projectId])

  const setPeriod = (range: { from: string; to: string }) => { setFrom(range.from); setTo(range.to) }

  const copyRecap = useCallback(() => {
    if (!data) return
    const lines: string[] = [`PRE-FACTURATION -- Du ${from} au ${to}`, `Taux horaire : ${rate} EUR/h`, '='.repeat(50)]
    for (const group of data.groups) {
      lines.push('', `PROJET : ${group.project?.name || 'Sans projet'}`)
      if (group.client?.company) lines.push(`Client : ${group.client.company}`)
      for (const ticket of group.tickets) {
        lines.push(`  ${ticket.ticketNumber} -- ${ticket.subject}`)
        for (const entry of ticket.entries) lines.push(`    ${entry.date} | ${formatDuration(entry.duration)} | ${entry.description || '-'}`)
        lines.push(`    Sous-total : ${formatDuration(ticket.totalMinutes)} = ${formatAmount(ticket.totalMinutes, rate)} EUR`)
      }
    }
    lines.push('', '='.repeat(50), `TOTAL : ${formatDuration(data.grandTotalMinutes)} = ${formatAmount(data.grandTotalMinutes, rate)} EUR`)
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }, [data, from, to, rate])

  const S: Record<string, React.CSSProperties> = {
    page: { padding: '20px 30px', maxWidth: 1100, margin: '0 auto' },
    filters: { marginBottom: 20 },
    quickPeriod: { display: 'flex', gap: 6, marginBottom: 8 },
    btn: { padding: '6px 12px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, cursor: 'pointer', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)' },
    btnPrimary: { padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer', background: '#2563eb', color: '#fff', fontWeight: 600 },
    filterRow: { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' as const },
    fieldGroup: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
    label: { fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-500)' },
    input: { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' },
    select: { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' },
    groupCard: { marginBottom: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-150)', overflow: 'hidden' },
    groupHeader: { display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--theme-elevation-50)', borderBottom: '1px solid var(--theme-elevation-150)' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
    th: { textAlign: 'left' as const, padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-200)', fontSize: 11, color: 'var(--theme-elevation-500)' },
    td: { padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-100)' },
    grandTotal: { padding: 16, borderRadius: 10, border: '2px solid #2563eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  }

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Pre-facturation</h1>
        <p style={{ fontSize: 13, color: 'var(--theme-elevation-500)', margin: '4px 0 0' }}>Agregation du temps par projet pour preparer la facturation</p>
      </div>

      <div style={S.filters}>
        <div style={S.quickPeriod}>
          <button style={S.btnPrimary} onClick={() => setPeriod(getMonthRange(0))}>Ce mois</button>
          <button style={S.btn} onClick={() => setPeriod(getMonthRange(-1))}>Mois precedent</button>
          <button style={S.btn} onClick={() => setPeriod(getQuarterRange(0))}>Ce trimestre</button>
        </div>
        <div style={S.filterRow}>
          <div style={S.fieldGroup}><label style={S.label}>Du</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={S.input} /></div>
          <div style={S.fieldGroup}><label style={S.label}>Au</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={S.input} /></div>
          <div style={S.fieldGroup}><label style={S.label}>Projet</label><select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={S.select}><option value="">Tous</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div style={S.fieldGroup}><label style={S.label}>Taux</label><div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} style={{ ...S.input, width: 70 }} min={0} /><span style={{ fontSize: 11 }}>EUR/h</span></div></div>
          <button style={S.btnPrimary} onClick={fetchBilling} disabled={loading}>{loading ? 'Chargement...' : 'Charger'}</button>
        </div>
      </div>

      {data && (
        <>
          {data.groups.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Aucun ticket facturable sur cette periode.</div> : (
            <>
              {data.groups.map((group, gi) => (
                <div key={gi} style={S.groupCard}>
                  <div style={S.groupHeader}>
                    <div><span style={{ fontWeight: 700 }}>{group.project?.name || 'Sans projet'}</span>{group.client?.company && <span style={{ color: 'var(--theme-elevation-500)' }}> -- {group.client.company}</span>}</div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700 }}>{formatDuration(group.totalMinutes)}</div><div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>{formatAmount(group.totalMinutes, rate)} EUR</div></div>
                  </div>
                  <table style={S.table}>
                    <thead><tr><th style={S.th}>Ticket</th><th style={S.th}>Sujet</th><th style={S.th}>Date</th><th style={S.th}>Duree</th><th style={S.th}>Description</th><th style={{ ...S.th, textAlign: 'right' }}>Montant</th></tr></thead>
                    <tbody>
                      {group.tickets.map((ticket) => ticket.entries.map((entry, ei) => (
                        <tr key={`${ticket.id}-${ei}`}>
                          {ei === 0 && <><td style={{ ...S.td, fontWeight: 600 }} rowSpan={ticket.entries.length}><a href={`/admin/support/ticket?id=${ticket.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{ticket.ticketNumber}</a></td><td style={S.td} rowSpan={ticket.entries.length}>{ticket.subject}</td></>}
                          <td style={S.td}>{entry.date}</td><td style={S.td}>{formatDuration(entry.duration)}</td><td style={S.td}>{entry.description || '-'}</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{formatAmount(entry.duration, rate)} EUR</td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              ))}
              <div style={S.grandTotal}>
                <div><div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{data.groups.reduce((s, g) => s + g.tickets.length, 0)} tickets facturables</div><div style={{ fontSize: 18, fontWeight: 700 }}>Total : {formatDuration(data.grandTotalMinutes)} = {formatAmount(data.grandTotalMinutes, rate)} EUR</div></div>
                <button style={S.btnPrimary} onClick={copyRecap}>{copied ? 'Copie !' : 'Copier le recapitulatif'}</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
