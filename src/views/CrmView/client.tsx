'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import s from '../../styles/CrmView.module.scss'

interface Client { id: number; company: string; firstName: string; lastName: string; email: string; phone?: string; notes?: string; createdAt: string }
interface ClientDetail {
  client: Client
  tickets: { id: number; ticketNumber: string; subject: string; status: string; priority: string; createdAt: string }[]
  projects: { id: number; name: string; status: string }[]
  stats: { totalTickets: number; openTickets: number; resolvedTickets: number; totalTimeMinutes: number; lastActivity: string | null }
}

const statusLabelKeys: Record<string, string> = { open: 'ticket.status.open', waiting_client: 'ticket.status.waiting_client', resolved: 'ticket.status.resolved' }
const statusColors: Record<string, string> = { open: '#3b82f6', waiting_client: '#f59e0b', resolved: '#22c55e' }

function formatDuration(minutes: number): string { const h = Math.floor(minutes / 60); const m = minutes % 60; if (h === 0) return `${m}min`; if (m === 0) return `${h}h`; return `${h}h${m}m` }
function timeAgo(dateStr: string): string { const diff = Date.now() - new Date(dateStr).getTime(); const days = Math.floor(diff / 86400000); if (days === 0) return "Aujourd'hui"; if (days === 1) return 'Hier'; if (days < 30) return `Il y a ${days}j`; return `Il y a ${Math.floor(days / 30)} mois` }

export const CrmClient: React.FC = () => {
  const { t } = useTranslation()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showMerge, setShowMerge] = useState(false)
  const [mergeSearch, setMergeSearch] = useState('')
  const [mergeResults, setMergeResults] = useState<Client[]>([])
  const [merging, setMerging] = useState(false)
  const [mergeSuccess, setMergeSuccess] = useState('')

  const fetchClients = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100', sort: 'company', depth: '0' })
      if (search) params.set('where[company][like]', search)
      const res = await fetch(`/api/support-clients?${params}`)
      if (res.ok) { const json = await res.json(); setClients(json.docs || []) }
    } catch { /* silent */ }
    setLoading(false)
  }, [search])

  useEffect(() => { const timeout = setTimeout(fetchClients, 300); return () => clearTimeout(timeout) }, [fetchClients])

  const fetchDetail = useCallback(async (clientId: number) => {
    setDetailLoading(true)
    try {
      const [clientRes, ticketsRes, projectsRes, timeRes] = await Promise.all([
        fetch(`/api/support-clients/${clientId}?depth=0`),
        fetch(`/api/tickets?where[client][equals]=${clientId}&sort=-createdAt&limit=20&depth=0`),
        fetch(`/api/projects?where[client][equals]=${clientId}&depth=0`),
        fetch(`/api/time-entries?limit=0&depth=0`),
      ])
      const client = clientRes.ok ? await clientRes.json() : null
      const tickets = ticketsRes.ok ? (await ticketsRes.json()).docs || [] : []
      const projects = projectsRes.ok ? (await projectsRes.json()).docs || [] : []
      const ticketIds = tickets.map((t: { id: number }) => t.id)
      let totalTimeMinutes = 0
      if (timeRes.ok) { const timeData = await timeRes.json(); totalTimeMinutes = timeData.docs.filter((e: { ticket: number }) => ticketIds.includes(e.ticket)).reduce((sum: number, e: { duration: number }) => sum + (e.duration || 0), 0) }
      const openTickets = tickets.filter((t: { status: string }) => ['open', 'waiting_client'].includes(t.status)).length
      const resolvedTickets = tickets.filter((t: { status: string }) => t.status === 'resolved').length
      setDetail({ client, tickets, projects, stats: { totalTickets: tickets.length, openTickets, resolvedTickets, totalTimeMinutes, lastActivity: tickets.length > 0 ? tickets[0].createdAt : null } })
    } catch { setDetail(null) }
    setDetailLoading(false)
  }, [])

  const selectClient = (id: number) => { setSelectedId(id); fetchDetail(id); setShowMerge(false); setMergeSuccess('') }

  useEffect(() => {
    if (!mergeSearch || mergeSearch.length < 2) { setMergeResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/support-clients?where[or][0][company][like]=${encodeURIComponent(mergeSearch)}&where[or][1][email][like]=${encodeURIComponent(mergeSearch)}&limit=10&depth=0`)
        if (res.ok) { const json = await res.json(); setMergeResults((json.docs || []).filter((c: Client) => c.id !== selectedId)) }
      } catch { /* silent */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [mergeSearch, selectedId])

  const handleMerge = async (targetId: number) => {
    if (!selectedId || !detail) return
    if (!confirm(`Fusionner ce client dans un autre ? Cette action est irreversible.`)) return
    setMerging(true)
    try {
      const res = await fetch('/api/support/merge-clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId: selectedId, targetId }) })
      if (res.ok) { const data = await res.json(); setMergeSuccess(data.message); setShowMerge(false); setSelectedId(targetId); fetchDetail(targetId); fetchClients() }
      else { const err = await res.json().catch(() => ({ error: 'Erreur inconnue' })); alert(`Erreur : ${err.error}`) }
    } catch { alert('Erreur reseau') }
    setMerging(false)
  }

  const S: Record<string, React.CSSProperties> = {
    page: { padding: '20px 30px', maxWidth: 1200, margin: '0 auto' },
    grid: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 },
    sidebar: { borderRight: '1px solid var(--theme-elevation-200)', paddingRight: 16 },
    searchInput: { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', fontSize: 13, marginBottom: 12, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' },
    clientItem: { padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, border: '1px solid transparent' },
    clientItemActive: { background: 'var(--theme-elevation-50)', borderColor: 'var(--theme-elevation-200)' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 },
    statCard: { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--theme-elevation-150)', textAlign: 'center' as const },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    th: { textAlign: 'left' as const, padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-200)', fontSize: 11, color: 'var(--theme-elevation-500)' },
    td: { padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-100)' },
    badge: { padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600 },
  }

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--theme-text)' }}>{t('crm.title')}</h1>
        <div style={{ fontSize: 13, color: 'var(--theme-elevation-500)', marginTop: 4 }}>{t('crm.subtitle')}</div>
      </div>

      <div style={S.grid}>
        <div style={S.sidebar}>
          <input type="text" placeholder={t('crm.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} style={S.searchInput} />
          <div>
            {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>{t('common.loading')}</div>
              : clients.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>{t('crm.noClientFound')}</div>
              : clients.map((c) => (
                <div key={c.id} onClick={() => selectClient(c.id)} style={{ ...S.clientItem, ...(selectedId === c.id ? S.clientItemActive : {}) }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.company}</div>
                  <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{c.firstName} {c.lastName}</div>
                  <div style={{ fontSize: 11, color: 'var(--theme-elevation-400)' }}>{c.email}</div>
                </div>
              ))}
          </div>
        </div>

        <div>
          {!selectedId ? <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>{t('crm.selectClient')}</div>
            : detailLoading ? <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>{t('common.loading')}</div>
            : detail ? (
              <div>
                {/* Client header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{detail.client.company}</h2>
                    <div style={{ fontSize: 13, color: 'var(--theme-elevation-500)' }}>{detail.client.firstName} {detail.client.lastName}</div>
                    <div style={{ fontSize: 12, color: 'var(--theme-elevation-400)' }}>{detail.client.email} {detail.client.phone && `-- ${detail.client.phone}`}</div>
                    {detail.client.notes && <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginTop: 4, fontStyle: 'italic' }}>{detail.client.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`/admin/collections/support-clients/${detail.client.id}`} style={{ padding: '6px 14px', borderRadius: 6, background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>{t('crm.editButton')}</a>
                    <button onClick={() => { setShowMerge(!showMerge); setMergeSearch(''); setMergeResults([]) }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d97706', background: 'none', color: '#d97706', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('crm.mergeButton')}</button>
                  </div>
                </div>

                {mergeSuccess && <div style={{ padding: '8px 14px', borderRadius: 6, background: '#dcfce7', color: '#166534', fontSize: 13, marginBottom: 12 }}>{mergeSuccess}</div>}

                {showMerge && (
                  <div style={{ padding: 16, borderRadius: 8, border: '1px solid #fde68a', background: '#fefce8', marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>{t('crm.mergeTitle')}</h4>
                    <input type="text" value={mergeSearch} onChange={(e) => setMergeSearch(e.target.value)} placeholder={t('crm.mergeSearchPlaceholder')} style={S.searchInput} />
                    {mergeResults.map((c) => (
                      <button key={c.id} onClick={() => handleMerge(c.id)} disabled={merging} style={{ display: 'block', width: '100%', padding: '8px 12px', border: '1px solid var(--theme-elevation-200)', borderRadius: 6, background: 'var(--theme-elevation-0)', cursor: 'pointer', textAlign: 'left', marginBottom: 4, fontSize: 13 }}>
                        <strong>{c.company}</strong> -- {c.firstName} {c.lastName} <span style={{ color: 'var(--theme-elevation-400)', fontSize: 11 }}>{c.email}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div style={S.statsGrid}>
                  {[
                    { label: t('crm.stats.totalTickets'), value: String(detail.stats.totalTickets) },
                    { label: t('crm.stats.openTickets'), value: String(detail.stats.openTickets) },
                    { label: t('crm.stats.resolvedTickets'), value: String(detail.stats.resolvedTickets) },
                    { label: t('crm.stats.timeSpent'), value: formatDuration(detail.stats.totalTimeMinutes) },
                    { label: t('crm.stats.lastActivity'), value: detail.stats.lastActivity ? timeAgo(detail.stats.lastActivity) : '-' },
                  ].map((stat) => (
                    <div key={stat.label} style={S.statCard}>
                      <div style={{ fontSize: 11, color: 'var(--theme-elevation-500)', marginBottom: 2 }}>{stat.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-text)' }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Tickets table */}
                <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-150)', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>{t('crm.sections.tickets')} ({detail.tickets.length})</h3>
                  {detail.tickets.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 13 }}>{t('crm.noTickets')}</div> : (
                    <table style={S.table}>
                      <thead><tr><th style={S.th}>{t('crm.tableHeaders.number')}</th><th style={S.th}>{t('crm.tableHeaders.subject')}</th><th style={S.th}>{t('crm.tableHeaders.status')}</th><th style={S.th}>{t('crm.tableHeaders.date')}</th></tr></thead>
                      <tbody>
                        {detail.tickets.map((tk) => (
                          <tr key={tk.id}>
                            <td style={S.td}><a href={`/admin/support/ticket?id=${tk.id}`} style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>{tk.ticketNumber}</a></td>
                            <td style={S.td}>{tk.subject}</td>
                            <td style={S.td}><span style={{ ...S.badge, background: `${statusColors[tk.status] || '#94a3b8'}20`, color: statusColors[tk.status] || '#94a3b8' }}>{statusLabelKeys[tk.status] ? t(statusLabelKeys[tk.status]) : tk.status}</span></td>
                            <td style={{ ...S.td, fontSize: 12, color: 'var(--theme-elevation-400)' }}>{timeAgo(tk.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}
        </div>
      </div>
    </div>
  )
}
