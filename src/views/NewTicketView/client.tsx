'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import s from '../../styles/NewTicket.module.scss'

interface ClientOption { id: number; firstName?: string; lastName?: string; company?: string; email?: string }
interface ProjectOption { id: number; name: string }

const CATEGORY_KEYS = [
  { value: '', key: 'ticket.category.select' },
  { value: 'bug', key: 'ticket.category.bugFull' },
  { value: 'content', key: 'ticket.category.contentFull' },
  { value: 'feature', key: 'ticket.category.featureFull' },
  { value: 'question', key: 'ticket.category.questionFull' },
  { value: 'hosting', key: 'ticket.category.hostingFull' },
]

const PRIORITY_KEYS = [
  { value: 'low', key: 'ticket.priority.low' },
  { value: 'normal', key: 'ticket.priority.normal' },
  { value: 'high', key: 'ticket.priority.high' },
  { value: 'urgent', key: 'ticket.priority.urgent' },
]

export const NewTicketClient: React.FC = () => {
  const { t } = useTranslation()
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
      } catch {}
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

    if (!subject.trim()) { setError(t('newTicket.errors.subjectRequired')); return }
    if (!clientId) { setError(t('newTicket.errors.clientRequired')); return }

    setSubmitting(true)
    try {
      // Create ticket
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
        setError(d.errors?.[0]?.message || t('newTicket.errors.creationError'))
        return
      }

      const ticket = await res.json()

      // Create first message if description provided
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
      setError(t('newTicket.errors.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <Link href="/admin/support/inbox" className={s.backLink}>&larr; {t('newTicket.backToInbox')}</Link>
        <h1 className={s.title}>{t('newTicket.title')}</h1>
        <p className={s.subtitle}>{t('newTicket.subtitle')}</p>
      </div>

      {error && <div className={s.error}>{error}</div>}

      <form className={s.form} onSubmit={handleSubmit}>
        {/* Client search */}
        <div className={s.fieldGroup}>
          <label className={s.label}>{t('newTicket.clientLabel')} <span className={s.required}>*</span></label>
          {selectedClient ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--theme-elevation-200)', background: 'var(--theme-elevation-50)' }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--theme-text)' }}>
                {selectedClient.firstName} {selectedClient.lastName} — {selectedClient.company}
              </span>
              <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{selectedClient.email}</span>
              <button type="button" onClick={() => { setSelectedClient(null); setClientId(null); setClientSearch('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-elevation-400)', fontSize: 16 }}>&times;</button>
            </div>
          ) : (
            <div className={s.searchWrap}>
              <input
                type="text"
                className={s.input}
                placeholder={t('newTicket.clientSearchPlaceholder')}
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                style={{ width: '100%' }}
              />
              {clientResults.length > 0 && (
                <div className={s.searchResults}>
                  {clientResults.map((c) => (
                    <div key={c.id} className={s.searchItem} onClick={() => {
                      setSelectedClient(c)
                      setClientId(c.id)
                      setClientSearch('')
                      setClientResults([])
                    }}>
                      <strong>{c.firstName} {c.lastName}</strong> — {c.company} <span style={{ color: 'var(--theme-elevation-400)', fontSize: 12 }}>{c.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subject */}
        <div className={s.fieldGroup}>
          <label className={s.label}>{t('newTicket.subjectLabel')} <span className={s.required}>*</span></label>
          <input type="text" className={s.input} placeholder={t('newTicket.subjectPlaceholder')} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        {/* Category + Priority + Project */}
        <div className={s.row3}>
          <div className={s.fieldGroup}>
            <label className={s.label}>{t('newTicket.categoryLabel')}</label>
            <select className={s.select} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_KEYS.map((c) => <option key={c.value} value={c.value}>{t(c.key)}</option>)}
            </select>
          </div>
          <div className={s.fieldGroup}>
            <label className={s.label}>{t('newTicket.priorityLabel')}</label>
            <select className={s.select} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITY_KEYS.map((p) => <option key={p.value} value={p.value}>{t(p.key)}</option>)}
            </select>
          </div>
          <div className={s.fieldGroup}>
            <label className={s.label}>{t('newTicket.projectLabel')}</label>
            <select className={s.select} value={projectId || ''} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Aucun —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Description */}
        <div className={s.fieldGroup}>
          <label className={s.label}>{t('newTicket.descriptionLabel')}</label>
          <textarea className={s.textarea} placeholder={t('newTicket.descriptionPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <button type="submit" className={s.submitBtn} disabled={submitting}>
          {submitting ? t('newTicket.submitting') : t('newTicket.submitButton')}
        </button>
      </form>
    </div>
  )
}
