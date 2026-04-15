'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import styles from '../../styles/CrmView.module.scss'

interface Client {
  id: number
  company: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  notes?: string
  createdAt: string
}

interface ClientDetail {
  client: Client
  tickets: {
    id: number
    ticketNumber: string
    subject: string
    status: string
    priority: string
    createdAt: string
  }[]
  projects: {
    id: number
    name: string
    status: string
  }[]
  stats: {
    totalTickets: number
    openTickets: number
    resolvedTickets: number
    totalTimeMinutes: number
    lastActivity: string | null
  }
}

const statusBadgeClass: Record<string, string> = {
  open: 'badgeAccent',
  waiting_client: 'badgeOrange',
  resolved: 'badgeGreen',
}

const statusLabelKeys: Record<string, string> = {
  open: 'ticket.status.open',
  waiting_client: 'ticket.status.waiting_client',
  resolved: 'ticket.status.resolved',
}

const projectStatusLabelKeys: Record<string, string> = {
  active: 'crm.projectStatus.active',
  paused: 'crm.projectStatus.paused',
  completed: 'crm.projectStatus.completed',
}

const projectStatusBadgeClass: Record<string, string> = {
  active: 'badgeGreen',
  paused: 'badgeOrange',
  completed: 'badgeMuted',
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 30) return `Il y a ${days}j`
  const months = Math.floor(days / 30)
  return `Il y a ${months} mois`
}

function getStatColorClass(key: string, detail: ClientDetail['stats']): string {
  switch (key) {
    case 'total': return styles.statAccent
    case 'open': return detail.openTickets > 0 ? styles.statOrange : styles.statGreen
    case 'resolved': return styles.statGreen
    case 'time': return styles.statAmber
    case 'activity': return styles.statAccent
    default: return styles.statAccent
  }
}

interface ClientSummary {
  summary: string
  recurringTopics: { topic: string; count: number; lastSeen: string }[]
  patterns: string[]
  keyFacts: string[]
  ticketCount: number
  messageCount: number
  averageSatisfaction: number | null
  generatedAt: string
  fromCache?: boolean
}

export const CrmClient: React.FC = () => {
  const { t } = useTranslation()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  // Merge clients
  const [showMerge, setShowMerge] = useState(false)
  const [mergeSearch, setMergeSearch] = useState('')
  const [mergeResults, setMergeResults] = useState<Client[]>([])
  const [merging, setMerging] = useState(false)
  // Client Intelligence
  const [intelligence, setIntelligence] = useState<ClientSummary | null>(null)
  const [intelLoading, setIntelLoading] = useState(false)
  const [intelRefreshing, setIntelRefreshing] = useState(false)
  const [mergeSuccess, setMergeSuccess] = useState('')

  const fetchClients = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100', sort: 'company', depth: '0' })
      if (search) params.set('where[company][like]', search)
      const res = await fetch(`/api/support-clients?${params}`)
      if (res.ok) {
        const json = await res.json()
        setClients(json.docs || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [search])

  useEffect(() => {
    const timeout = setTimeout(fetchClients, 300)
    return () => clearTimeout(timeout)
  }, [fetchClients])

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

      // Get time entries for this client's tickets
      const ticketIds = tickets.map((t: { id: number }) => t.id)
      let totalTimeMinutes = 0
      if (timeRes.ok) {
        const timeData = await timeRes.json()
        totalTimeMinutes = timeData.docs
          .filter((e: { ticket: number }) => ticketIds.includes(e.ticket))
          .reduce((sum: number, e: { duration: number }) => sum + (e.duration || 0), 0)
      }

      const openTickets = tickets.filter((t: { status: string }) =>
        ['open', 'waiting_client'].includes(t.status),
      ).length
      const resolvedTickets = tickets.filter((t: { status: string }) =>
        t.status === 'resolved',
      ).length

      const lastActivity = tickets.length > 0 ? tickets[0].createdAt : null

      setDetail({
        client,
        tickets,
        projects,
        stats: {
          totalTickets: tickets.length,
          openTickets,
          resolvedTickets,
          totalTimeMinutes,
          lastActivity,
        },
      })
    } catch {
      setDetail(null)
    }
    setDetailLoading(false)
  }, [])

  const fetchIntelligence = useCallback(async (clientId: number, force = false) => {
    if (force) setIntelRefreshing(true); else setIntelLoading(true)
    try {
      const method = force ? 'POST' : 'GET'
      const url = force ? '/api/support/client-intelligence' : `/api/support/client-intelligence?clientId=${clientId}`
      const opts: RequestInit = { method, credentials: 'include', headers: { 'Content-Type': 'application/json' } }
      if (force) opts.body = JSON.stringify({ clientId })
      const res = await fetch(url, opts)
      if (res.ok) setIntelligence(await res.json())
    } catch { /* silent */ }
    setIntelLoading(false); setIntelRefreshing(false)
  }, [])

  const selectClient = (id: number) => {
    setSelectedId(id)
    fetchDetail(id)
    fetchIntelligence(id)
    setIntelligence(null)
    setShowMerge(false)
    setMergeSuccess('')
  }

  // Merge: search for target client
  useEffect(() => {
    if (!mergeSearch || mergeSearch.length < 2) { setMergeResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/support-clients?where[or][0][company][like]=${encodeURIComponent(mergeSearch)}&where[or][1][email][like]=${encodeURIComponent(mergeSearch)}&where[or][2][firstName][like]=${encodeURIComponent(mergeSearch)}&limit=10&depth=0`)
        if (res.ok) {
          const json = await res.json()
          setMergeResults((json.docs || []).filter((c: Client) => c.id !== selectedId))
        }
      } catch { /* silent */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [mergeSearch, selectedId])

  const handleMerge = async (targetId: number) => {
    if (!selectedId || !detail) return
    const targetClient = mergeResults.find((c) => c.id === targetId) || clients.find((c) => c.id === targetId)
    if (!confirm(`Fusionner "${detail.client.company} (${detail.client.email})" dans "${targetClient?.company || targetId}" ?\n\nTous les tickets, messages et projets seront transférés.\nLe client "${detail.client.company}" sera supprimé.\n\nCette action est irréversible.`)) return

    setMerging(true)
    try {
      const res = await fetch('/api/support/merge-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: selectedId, targetId }),
      })
      if (res.ok) {
        const data = await res.json()
        setMergeSuccess(data.message)
        setShowMerge(false)
        setSelectedId(targetId)
        fetchDetail(targetId)
        fetchClients()
      } else {
        const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        alert(`Erreur : ${err.error}`)
      }
    } catch {
      alert('Erreur réseau')
    }
    setMerging(false)
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('crm.title')}</h1>
          <div className={styles.subtitle}>
            {t('crm.subtitle')}
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Left: Client list */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarSearch}>
            <input
              type="text"
              placeholder={t('crm.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <div className={styles.clientList}>
            {loading ? (
              <div className={styles.emptyState}>
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
              </div>
            ) : clients.length === 0 ? (
              <div className={styles.emptyState}>
                {t('crm.noClientFound')}
              </div>
            ) : (
              clients.map((c) => (
                <div
                  key={c.id}
                  onClick={() => selectClient(c.id)}
                  className={`${styles.clientItem} ${selectedId === c.id ? styles.clientItemActive : ''}`}
                >
                  <div className={styles.clientCompany}>{c.company}</div>
                  <div className={styles.clientName}>
                    {c.firstName} {c.lastName}
                  </div>
                  <div className={styles.clientEmail}>{c.email}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Client detail */}
        <div>
          {!selectedId ? (
            <div className={styles.placeholder}>
              {t('crm.selectClient')}
            </div>
          ) : detailLoading ? (
            <div className={styles.loadingCard}>
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
            </div>
          ) : detail ? (
            <div className={styles.detailStack}>
              {/* Client info header */}
              <div className={styles.clientHeader}>
                <div>
                  <h2 className={styles.clientHeaderName}>
                    {detail.client.company}
                  </h2>
                  <div className={styles.clientHeaderContact}>
                    {detail.client.firstName} {detail.client.lastName}
                  </div>
                  <div className={styles.clientContactRow}>
                    <span>{detail.client.email}</span>
                    {detail.client.phone && <span>{detail.client.phone}</span>}
                  </div>
                  {detail.client.notes && (
                    <div className={styles.clientNotes}>
                      {detail.client.notes}
                    </div>
                  )}
                </div>
                <div className={styles.headerActions}>
                  <a
                    href={`/admin/collections/support-clients/${detail.client.id}`}
                    className={styles.btnPrimary}
                  >
                    {t('crm.editButton')}
                  </a>
                  <button
                    onClick={() => { setShowMerge(!showMerge); setMergeSearch(''); setMergeResults([]) }}
                    className={styles.btnWarning}
                  >
                    {t('crm.mergeButton')}
                  </button>
                </div>
              </div>

              {/* Merge success */}
              {mergeSuccess && (
                <div className={styles.successBanner}>
                  {mergeSuccess}
                </div>
              )}

              {/* Merge panel */}
              {showMerge && (
                <div className={styles.mergePanel}>
                  <h4 className={styles.mergePanelTitle}>
                    {t('crm.mergeTitle')}
                  </h4>
                  <p className={styles.mergePanelDesc}>
                    Tous les tickets, messages, projets et enquetes de <strong>{detail.client.company}</strong> seront transferes vers le client cible. Le client actuel sera supprime.
                  </p>
                  <input
                    type="text"
                    value={mergeSearch}
                    onChange={(e) => setMergeSearch(e.target.value)}
                    placeholder={t('crm.mergeSearchPlaceholder')}
                    className={styles.mergeInput}
                  />
                  {mergeResults.length > 0 && (
                    <div className={styles.mergeResultList}>
                      {mergeResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleMerge(c.id)}
                          disabled={merging}
                          className={styles.mergeResultItem}
                        >
                          <div>
                            <strong>{c.company}</strong>
                            <span className={styles.mergeResultName}>{c.firstName} {c.lastName}</span>
                          </div>
                          <span className={styles.mergeResultEmail}>{c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {mergeSearch.length >= 2 && mergeResults.length === 0 && (
                    <p className={styles.mergeEmpty}>{t('crm.mergeNoClient')}</p>
                  )}
                </div>
              )}

              {/* Stats row */}
              <div className={styles.statsGrid}>
                {[
                  { key: 'total', label: t('crm.stats.totalTickets'), value: String(detail.stats.totalTickets) },
                  { key: 'open', label: t('crm.stats.openTickets'), value: String(detail.stats.openTickets) },
                  { key: 'resolved', label: t('crm.stats.resolvedTickets'), value: String(detail.stats.resolvedTickets) },
                  { key: 'time', label: t('crm.stats.timeSpent'), value: formatDuration(detail.stats.totalTimeMinutes) },
                  { key: 'activity', label: t('crm.stats.lastActivity'), value: detail.stats.lastActivity ? timeAgo(detail.stats.lastActivity) : '-' },
                ].map((stat) => (
                  <div key={stat.key} className={styles.statCard}>
                    <div className={styles.statLabel}>{stat.label}</div>
                    <div className={`${styles.statValue} ${getStatColorClass(stat.key, detail.stats)}`}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Projects */}
              {detail.projects.length > 0 && (
                <div className={styles.sectionCard}>
                  <h3 className={styles.sectionTitle}>
                    {t('crm.sections.projects')} ({detail.projects.length})
                  </h3>
                  <div className={styles.projectList}>
                    {detail.projects.map((p) => (
                      <a
                        key={p.id}
                        href={`/admin/collections/projects/${p.id}`}
                        className={styles.projectChip}
                      >
                        {p.name}
                        <span className={`${styles.badge} ${styles[projectStatusBadgeClass[p.status] || 'badgeAccent']}`}>
                          {t(projectStatusLabelKeys[p.status] || 'crm.projectStatus.active')}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Client Intelligence */}
              <div className={styles.sectionCard} style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.03) 0%, rgba(139,92,246,0.03) 100%)' }}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>🧠</span> Résumé IA
                  </h3>
                  <button
                    onClick={() => selectedId && fetchIntelligence(selectedId, true)}
                    disabled={intelRefreshing}
                    className={styles.viewAllLink}
                    style={{ cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}
                  >
                    {intelRefreshing ? '⏳ Génération...' : '🔄 Actualiser'}
                  </button>
                </div>
                {intelLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Chargement du résumé...</div>
                ) : intelligence ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{intelligence.summary}</p>
                    {intelligence.recurringTopics?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>Sujets récurrents</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {intelligence.recurringTopics.map((tp, i) => (
                            <span key={i} style={{ padding: '3px 10px', borderRadius: 12, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontSize: 11, fontWeight: 600 }}>{tp.topic} ({tp.count}x)</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {intelligence.patterns?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>Patterns</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.8 }}>
                          {intelligence.patterns.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {intelligence.keyFacts?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>Faits clés</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {intelligence.keyFacts.map((f, i) => (
                            <span key={i} style={{ padding: '3px 10px', borderRadius: 12, background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontSize: 11, fontWeight: 600 }}>{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#9ca3af', display: 'flex', gap: 12 }}>
                      <span>{intelligence.ticketCount} tickets</span>
                      <span>{intelligence.messageCount} messages</span>
                      {intelligence.averageSatisfaction && <span>Satisfaction: {intelligence.averageSatisfaction}/5</span>}
                      {intelligence.fromCache && <span>• Cache</span>}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    Cliquez sur &laquo; Actualiser &raquo; pour générer le résumé IA.
                  </div>
                )}
              </div>

              {/* Tickets */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>
                    {t('crm.sections.tickets')} ({detail.tickets.length})
                  </h3>
                  <a
                    href={`/admin/collections/tickets?where[client][equals]=${detail.client.id}`}
                    className={styles.sectionLink}
                  >
                    {t('crm.sections.viewAll')} &rarr;
                  </a>
                </div>
                {detail.tickets.length === 0 ? (
                  <div className={styles.ticketEmpty}>
                    {t('crm.noTickets')}
                  </div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{t('crm.tableHeaders.number')}</th>
                        <th>{t('crm.tableHeaders.subject')}</th>
                        <th>{t('crm.tableHeaders.status')}</th>
                        <th>{t('crm.tableHeaders.date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.tickets.map((tk) => (
                        <tr key={tk.id}>
                          <td>
                            <a href={`/admin/collections/tickets/${tk.id}`} className={styles.ticketLink}>
                              {tk.ticketNumber}
                            </a>
                          </td>
                          <td className={styles.ticketSubject}>{tk.subject}</td>
                          <td className={styles.ticketStatusCell}>
                            <span className={`${styles.badge} ${styles[statusBadgeClass[tk.status] || 'badgeAccent']}`}>
                              {t(statusLabelKeys[tk.status] || 'ticket.status.open')}
                            </span>
                          </td>
                          <td className={styles.ticketDate}>
                            {timeAgo(tk.createdAt)}
                          </td>
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
