'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Inbox, Plus, Link2, X, Search, ChevronDown, ChevronUp, Paperclip } from 'lucide-react'
import { SkeletonDashboard } from '../shared/Skeleton'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import styles from '../../styles/PendingEmails.module.scss'

interface SuggestedTicket {
  id: number
  ticketNumber: string
  subject: string
  score: number
}

interface PendingEmail {
  id: number
  senderEmail: string
  senderName?: string
  subject: string
  body: string
  bodyHtml?: string
  client?: { id: number; firstName?: string; lastName?: string; email?: string; company?: string } | number
  attachments?: Array<{ file: { id: number; filename?: string } | number }>
  status: 'pending' | 'processed' | 'ignored'
  processedAction?: 'ticket_created' | 'message_added' | 'ignored'
  processedTicket?: { id: number; ticketNumber?: string } | number
  processedAt?: string
  suggestedTickets?: SuggestedTicket[]
  createdAt: string
}

type Tab = 'pending' | 'processed' | 'ignored'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

function TicketSearchModal({
  suggestions,
  onSelect,
  onClose,
}: {
  suggestions: SuggestedTicket[]
  onSelect: (ticketId: number) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Array<{ id: number; ticketNumber: string; subject: string }>>([])
  const [searching, setSearching] = useState(false)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/tickets?where[or][0][ticketNumber][contains]=${encodeURIComponent(q)}&where[or][1][subject][contains]=${encodeURIComponent(q)}&limit=10&sort=-updatedAt&depth=0`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.docs.map((d: Record<string, unknown>) => ({
          id: d.id,
          ticketNumber: d.ticketNumber,
          subject: d.subject,
        })))
      }
    } catch { /* ignore */ }
    setSearching(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search, doSearch])

  const scoreClass = (score: number) =>
    score >= 0.7 ? styles.scoreHigh : score >= 0.5 ? styles.scoreMedium : styles.scoreLow

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Rattacher a un ticket</h3>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={20} />
          </button>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className={styles.sectionBlock}>
            <div className={styles.sectionLabel}>Suggestions</div>
            {suggestions.map((s) => (
              <button key={s.id} onClick={() => onSelect(s.id)} className={styles.resultRow}>
                <span className={styles.resultTicketNum}>{s.ticketNumber}</span>
                <span className={styles.resultSubject}>{s.subject}</span>
                <span className={`${styles.scoreBadge} ${scoreClass(s.score)}`}>
                  {Math.round(s.score * 100)}%
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Rechercher un ticket (TK-0042, sujet...)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {searching && <div className={styles.searchingHint}>Recherche...</div>}

        {results.map((r) => (
          <button key={r.id} onClick={() => onSelect(r.id)} className={styles.resultRow}>
            <span className={styles.resultTicketNum}>{r.ticketNumber}</span>
            <span className={styles.resultSubject}>{r.subject}</span>
          </button>
        ))}

        {search.length >= 2 && !searching && results.length === 0 && (
          <div className={styles.noResults}>Aucun ticket trouve</div>
        )}
      </div>
    </div>
  )
}

interface ClientOption {
  id: number
  firstName?: string
  lastName?: string
  email?: string
  company?: string
}

function ClientPickerModal({
  defaultEmail,
  detectedClient,
  onSelect,
  onClose,
}: {
  defaultEmail: string
  detectedClient?: ClientOption | null
  onSelect: (clientId: number) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<ClientOption[]>([])
  const [searching, setSearching] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newClient, setNewClient] = useState({ firstName: '', lastName: '', email: defaultEmail, company: '' })
  const [createError, setCreateError] = useState('')

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/support-clients?where[or][0][email][contains]=${encodeURIComponent(q)}&where[or][1][firstName][contains]=${encodeURIComponent(q)}&where[or][2][lastName][contains]=${encodeURIComponent(q)}&where[or][3][company][contains]=${encodeURIComponent(q)}&limit=10&sort=-updatedAt&depth=0`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.docs.map((d: Record<string, unknown>) => ({
          id: d.id, firstName: d.firstName, lastName: d.lastName, email: d.email, company: d.company,
        })))
      }
    } catch { /* ignore */ }
    setSearching(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search, doSearch])

  const handleCreate = async () => {
    setCreateError('')
    if (!newClient.email.trim() || !newClient.firstName.trim() || !newClient.company.trim()) {
      setCreateError('Email, prenom et entreprise sont obligatoires')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/support-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newClient.email.trim(),
          firstName: newClient.firstName.trim(),
          lastName: newClient.lastName.trim() || undefined,
          company: newClient.company.trim(),
          password: crypto.randomUUID(),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        onSelect(data.doc.id)
      } else {
        const err = await res.json().catch(() => ({}))
        setCreateError(err.errors?.[0]?.message || 'Erreur lors de la creation')
      }
    } catch {
      setCreateError('Erreur reseau')
    }
    setCreating(false)
  }

  const clientLabel = (c: ClientOption) => {
    const parts = [c.firstName, c.lastName].filter(Boolean).join(' ')
    return parts ? `${parts}${c.company ? ` — ${c.company}` : ''}` : c.email || ''
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Choisir un client</h3>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={20} />
          </button>
        </div>

        {/* Detected client */}
        {detectedClient && (
          <div className={styles.sectionBlock}>
            <div className={styles.sectionLabel}>Client detecte</div>
            <button onClick={() => onSelect(detectedClient.id)} className={styles.detectedRow}>
              <span className={styles.detectedLabel}>
                <span className={styles.detectedName}>{clientLabel(detectedClient)}</span>
                {detectedClient.email && (
                  <span className={styles.detectedEmail}>{detectedClient.email}</span>
                )}
              </span>
              <span className={styles.useBtn}>Utiliser</span>
            </button>
          </div>
        )}

        {/* Search existing client */}
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Rechercher un client (nom, email, entreprise)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {searching && <div className={styles.searchingHint}>Recherche...</div>}

        {results.map((r) => (
          <button key={r.id} onClick={() => onSelect(r.id)} className={styles.resultRow}>
            <span className={styles.clientResultLabel}>
              <span className={styles.clientResultName}>{clientLabel(r)}</span>
              {r.email && <span className={styles.clientResultEmail}>{r.email}</span>}
            </span>
          </button>
        ))}

        {search.length >= 2 && !searching && results.length === 0 && (
          <div className={styles.noResults}>Aucun client trouve</div>
        )}

        {/* Separator + create toggle */}
        <div className={styles.separator}>
          <button onClick={() => setShowCreate(!showCreate)} className={styles.createToggle}>
            <Plus size={14} />
            {showCreate ? 'Annuler la creation' : 'Creer un nouveau client'}
          </button>
        </div>

        {showCreate && (
          <div className={styles.createForm}>
            {createError && <div className={styles.formError}>{createError}</div>}
            <div className={styles.createFormRow}>
              <input
                type="text"
                placeholder="Prenom *"
                value={newClient.firstName}
                onChange={(e) => setNewClient((p) => ({ ...p, firstName: e.target.value }))}
                className={styles.formInputHalf}
              />
              <input
                type="text"
                placeholder="Nom"
                value={newClient.lastName}
                onChange={(e) => setNewClient((p) => ({ ...p, lastName: e.target.value }))}
                className={styles.formInputHalf}
              />
            </div>
            <input
              type="email"
              placeholder="Email *"
              value={newClient.email}
              onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
              className={styles.formInput}
            />
            <input
              type="text"
              placeholder="Entreprise *"
              value={newClient.company}
              onChange={(e) => setNewClient((p) => ({ ...p, company: e.target.value }))}
              className={styles.formInput}
            />
            <button onClick={handleCreate} disabled={creating} className={styles.submitBtn}>
              {creating ? 'Creation...' : 'Creer et utiliser'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function EmailCard({
  email,
  onProcess,
  processing,
}: {
  email: PendingEmail
  onProcess: (action: 'create_ticket' | 'add_to_ticket' | 'ignore', ticketId?: number, clientId?: number) => void
  processing: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showClientPicker, setShowClientPicker] = useState(false)

  const attachmentCount = email.attachments?.length || 0
  const preview = email.body.slice(0, 200) + (email.body.length > 200 ? '...' : '')
  const suggestions = email.suggestedTickets || []
  const isPending = email.status === 'pending'

  const processedTicketNumber = typeof email.processedTicket === 'object'
    ? email.processedTicket?.ticketNumber
    : null

  const suggestionClass = (score: number) =>
    score >= 0.7 ? styles.suggestionHigh : score >= 0.5 ? styles.suggestionMedium : styles.suggestionLow

  return (
    <div className={`${styles.card} ${processing ? styles.cardProcessing : ''}`}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.cardInfo}>
          <div className={styles.senderRow}>
            <span className={styles.senderName}>
              {email.senderName || email.senderEmail}
            </span>
            {email.senderName && (
              <span className={styles.senderEmail}>&lt;{email.senderEmail}&gt;</span>
            )}
          </div>
          <div className={styles.cardSubject}>{email.subject}</div>
          <div className={styles.cardMeta}>
            <span>{timeAgo(email.createdAt)}</span>
            {attachmentCount > 0 && (
              <span className={styles.attachment}>
                <Paperclip size={12} /> {attachmentCount} PJ
              </span>
            )}
          </div>
        </div>

        {/* Status badge for processed/ignored */}
        {!isPending && (
          <div className={`${styles.statusBadge} ${email.status === 'processed' ? styles.statusProcessed : styles.statusIgnored}`}>
            {email.processedAction === 'ticket_created' && `Ticket cree${processedTicketNumber ? ` (${processedTicketNumber})` : ''}`}
            {email.processedAction === 'message_added' && `Rattache${processedTicketNumber ? ` a ${processedTicketNumber}` : ''}`}
            {email.processedAction === 'ignored' && 'Ignore'}
          </div>
        )}
      </div>

      {/* Suggestions badges */}
      {suggestions.length > 0 && isPending && (
        <div className={styles.suggestions}>
          {suggestions.map((s) => (
            <span key={s.id} className={`${styles.suggestionChip} ${suggestionClass(s.score)}`}>
              Similaire a {s.ticketNumber} ({Math.round(s.score * 100)}%)
            </span>
          ))}
        </div>
      )}

      {/* Body preview / expanded */}
      <div className={styles.bodySection}>
        <div className={`${styles.bodyText} ${expanded ? styles.bodyExpanded : ''}`}>
          {expanded ? email.body : preview}
        </div>
        {email.body.length > 200 && (
          <button onClick={() => setExpanded(!expanded)} className={styles.expandBtn}>
            {expanded ? <><ChevronUp size={14} /> Reduire</> : <><ChevronDown size={14} /> Voir tout</>}
          </button>
        )}
      </div>

      {/* Actions */}
      {isPending && (
        <div className={styles.actions}>
          <button
            onClick={() => setShowClientPicker(true)}
            disabled={processing}
            className={`${styles.actionBtn} ${styles.btnCreate}`}
          >
            <Plus size={14} />
            Creer un ticket
          </button>
          <button
            onClick={() => setShowLinkModal(true)}
            disabled={processing}
            className={`${styles.actionBtn} ${styles.btnLink}`}
          >
            <Link2 size={14} />
            Rattacher a un ticket
          </button>
          <button
            onClick={() => onProcess('ignore')}
            disabled={processing}
            className={`${styles.actionBtn} ${styles.btnIgnore}`}
          >
            <X size={14} />
            Ignorer
          </button>
        </div>
      )}

      {/* Link modal */}
      {showLinkModal && (
        <TicketSearchModal
          suggestions={suggestions}
          onSelect={(ticketId) => {
            setShowLinkModal(false)
            onProcess('add_to_ticket', ticketId)
          }}
          onClose={() => setShowLinkModal(false)}
        />
      )}

      {/* Client picker modal */}
      {showClientPicker && (
        <ClientPickerModal
          defaultEmail={email.senderEmail}
          detectedClient={
            typeof email.client === 'object' && email.client
              ? { id: email.client.id, firstName: email.client.firstName, lastName: email.client.lastName, email: email.client.email, company: email.client.company }
              : null
          }
          onSelect={(clientId) => {
            setShowClientPicker(false)
            onProcess('create_ticket', undefined, clientId)
          }}
          onClose={() => setShowClientPicker(false)}
        />
      )}
    </div>
  )
}

export const PendingEmailsClient: React.FC = () => {
  const { t } = useTranslation()
  const [emails, setEmails] = useState<PendingEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [processing, setProcessing] = useState<number | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch(`/api/pending-emails?where[status][equals]=${tab}&sort=-createdAt&limit=50&depth=1`)
      if (res.ok) {
        const data = await res.json()
        setEmails(data.docs)
      } else if (res.status === 401 || res.status === 403) {
        setSessionExpired(true)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [tab])

  useEffect(() => {
    setLoading(true)
    fetchEmails()
  }, [fetchEmails])

  // Auto-refresh 30s (pending tab only)
  useEffect(() => {
    if (sessionExpired || tab !== 'pending') return
    const interval = setInterval(fetchEmails, 30000)
    return () => clearInterval(interval)
  }, [fetchEmails, sessionExpired, tab])

  // Refresh on focus
  useEffect(() => {
    if (sessionExpired) return
    const onFocus = () => fetchEmails()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchEmails, sessionExpired])

  const handleProcess = async (emailId: number, action: 'create_ticket' | 'add_to_ticket' | 'ignore', ticketId?: number, clientId?: number) => {
    setProcessing(emailId)
    try {
      const res = await fetch(`/api/support/pending-emails/${emailId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ticketId, clientId }),
      })
      if (res.ok) {
        // Remove from list
        setEmails((prev) => prev.filter((e) => e.id !== emailId))
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        alert(`Erreur : ${err.error || res.statusText}`)
      }
    } catch {
      alert('Erreur reseau')
    }
    setProcessing(null)
  }

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <SkeletonDashboard />
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: t('pendingEmails.tabs.pending') },
    { key: 'processed', label: t('pendingEmails.tabs.processed') },
    { key: 'ignored', label: t('pendingEmails.tabs.ignored') },
  ]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <span className={styles.titleIcon}><Inbox size={24} /></span>
            {t('pendingEmails.title')}
          </h1>
          <p className={styles.subtitle}>
            {t('pendingEmails.subtitle')}
          </p>
        </div>
        {tab === 'pending' && emails.length > 0 && (
          <span className={styles.pendingBadge}>
            {t('pendingEmails.pendingCount', { count: String(emails.length) })}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map((tk) => (
          <button
            key={tk.key}
            onClick={() => setTab(tk.key)}
            className={`${styles.tab} ${tab === tk.key ? styles.tabActive : ''}`}
          >
            {tk.label}
          </button>
        ))}
      </div>

      {/* Email list */}
      {emails.length === 0 ? (
        <div className={styles.empty}>
          {tab === 'pending' ? t('pendingEmails.empty.pending') : tab === 'processed' ? t('pendingEmails.empty.processed') : t('pendingEmails.empty.ignored')}
        </div>
      ) : (
        emails.map((email) => (
          <EmailCard
            key={email.id}
            email={email}
            onProcess={(action, ticketId, clientId) => handleProcess(email.id, action, ticketId, clientId)}
            processing={processing === email.id}
          />
        ))
      )}
    </div>
  )
}
