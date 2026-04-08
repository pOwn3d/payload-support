'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ClientOption { id: number; firstName?: string; lastName?: string; company?: string; email?: string }
interface ProjectOption { id: number; name: string }

const CATEGORIES = [
  { value: '', label: '-- Selectionner --' },
  { value: 'bug', label: 'Bug / Dysfonctionnement' },
  { value: 'content', label: 'Modification de contenu' },
  { value: 'feature', label: 'Nouvelle fonctionnalite' },
  { value: 'question', label: 'Question / Aide' },
  { value: 'hosting', label: 'Hebergement / Domaine' },
]

const PRIORITIES = [
  { value: 'low', label: 'Basse' },
  { value: 'normal', label: 'Normale' },
  { value: 'high', label: 'Haute' },
  { value: 'urgent', label: 'Urgente' },
]

export const NewTicketClient: React.FC = () => {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('normal')
  const [clientSearch, setClientSearch] = useState('')
  const [clientId, setClientId] = useState<number | null>(null)
  const [clientResults, setClientResults] = useState<ClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const [projectId, setProjectId] = useState<number | null>(null)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Search clients
  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/support-clients?where[or][0][email][contains]=${encodeURIComponent(clientSearch)}&where[or][1][firstName][contains]=${encodeURIComponent(clientSearch)}&where[or][2][company][contains]=${encodeURIComponent(clientSearch)}&limit=8&depth=0`, { credentials: 'include' })
        if (res.ok) { const d = await res.json(); setClientResults(d.docs || []) }
      } catch (err) { console.warn('[support] client search error:', err) }
    }, 300)
    return () => clearTimeout(timer)
  }, [clientSearch])

  // Fetch projects
  useEffect(() => {
    fetch('/api/projects?where[status][equals]=active&limit=50&depth=0', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setProjects(d.docs || []))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!subject.trim()) { setError('Le sujet est obligatoire'); return }
    if (!clientId) { setError('Selectionnez un client'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: subject.trim(),
          client: clientId,
          category: category || undefined,
          priority,
          project: projectId || undefined,
          source: 'admin',
          status: 'open',
        }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.errors?.[0]?.message || 'Erreur lors de la creation')
        return
      }

      const ticket = await res.json()

      if (description.trim()) {
        await fetch('/api/ticket-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ticket: ticket.doc.id,
            body: description.trim(),
            authorType: 'admin',
            isInternal: false,
          }),
        })
      }

      router.push(`/admin/support/ticket?id=${ticket.doc.id}`)
    } catch {
      setError('Erreur reseau')
    } finally {
      setSubmitting(false)
    }
  }

  const S: Record<string, React.CSSProperties> = {
    page: { padding: '20px 30px', maxWidth: 720, margin: '0 auto' },
    header: { marginBottom: 24 },
    backLink: { fontSize: 13, color: '#2563eb', textDecoration: 'none' },
    title: { fontSize: 24, fontWeight: 700, margin: '8px 0 4px', color: 'var(--theme-text)' },
    subtitle: { fontSize: 14, color: 'var(--theme-elevation-500)' },
    error: { padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 13, marginBottom: 16, border: '1px solid #fecaca' },
    fieldGroup: { marginBottom: 16 },
    label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--theme-text)' },
    required: { color: '#dc2626' },
    input: { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', fontSize: 13, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' },
    select: { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', fontSize: 13, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' },
    textarea: { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', fontSize: 13, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)', minHeight: 120, fontFamily: 'inherit', resize: 'vertical' as const },
    row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 },
    submitBtn: { padding: '10px 20px', borderRadius: 8, background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' },
    searchResults: { position: 'absolute' as const, top: '100%', left: 0, right: 0, background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-200)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto' as const },
    searchItem: { padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--theme-elevation-100)' },
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <Link href="/admin/support/inbox" style={S.backLink}>&larr; Retour a l&apos;inbox</Link>
        <h1 style={S.title}>Nouveau ticket</h1>
        <p style={S.subtitle}>Creer un ticket de support pour un client</p>
      </div>

      {error && <div style={S.error}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Client search */}
        <div style={S.fieldGroup}>
          <label style={S.label}>Client <span style={S.required}>*</span></label>
          {selectedClient ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--theme-elevation-200)', background: 'var(--theme-elevation-50)' }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--theme-text)' }}>
                {selectedClient.firstName} {selectedClient.lastName} -- {selectedClient.company}
              </span>
              <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{selectedClient.email}</span>
              <button type="button" onClick={() => { setSelectedClient(null); setClientId(null); setClientSearch('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-elevation-400)', fontSize: 16 }}>&times;</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                style={S.input}
                placeholder="Rechercher par nom, email, entreprise..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              {clientResults.length > 0 && (
                <div style={S.searchResults}>
                  {clientResults.map((c) => (
                    <div key={c.id} style={S.searchItem} onClick={() => {
                      setSelectedClient(c)
                      setClientId(c.id)
                      setClientSearch('')
                      setClientResults([])
                    }}>
                      <strong>{c.firstName} {c.lastName}</strong> -- {c.company} <span style={{ color: 'var(--theme-elevation-400)', fontSize: 12 }}>{c.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subject */}
        <div style={S.fieldGroup}>
          <label style={S.label}>Sujet <span style={S.required}>*</span></label>
          <input type="text" style={S.input} placeholder="Decrivez brievement le probleme" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        {/* Category + Priority + Project */}
        <div style={S.row3}>
          <div style={S.fieldGroup}>
            <label style={S.label}>Categorie</label>
            <select style={S.select} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>Priorite</label>
            <select style={S.select} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>Projet</label>
            <select style={S.select} value={projectId || ''} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">-- Aucun --</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Description */}
        <div style={S.fieldGroup}>
          <label style={S.label}>Description</label>
          <textarea style={S.textarea} placeholder="Detaillez le probleme ou la demande..." value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <button type="submit" style={S.submitBtn} disabled={submitting}>
          {submitting ? 'Creation...' : 'Creer le ticket'}
        </button>
      </form>
    </div>
  )
}
