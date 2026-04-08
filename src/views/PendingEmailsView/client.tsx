'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import s from '../../styles/PendingEmails.module.scss'

interface SuggestedTicket { id: number; ticketNumber: string; subject: string; score: number }
interface PendingEmail {
  id: number; senderEmail: string; senderName?: string; subject: string; body: string
  client?: { id: number; firstName?: string; lastName?: string; email?: string; company?: string } | number
  attachments?: Array<{ file: { id: number; filename?: string } | number }>
  status: 'pending' | 'processed' | 'ignored'
  processedAction?: 'ticket_created' | 'message_added' | 'ignored'
  processedTicket?: { id: number; ticketNumber?: string } | number
  suggestedTickets?: SuggestedTicket[]
  createdAt: string
}

type Tab = 'pending' | 'processed' | 'ignored'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "a l'instant"
  if (mins < 60) return `il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

function EmailCard({ email, onProcess, processing, t }: { email: PendingEmail; onProcess: (action: 'create_ticket' | 'add_to_ticket' | 'ignore', ticketId?: number, clientId?: number) => void; processing: boolean; t: (key: string, vars?: Record<string, string | number>) => string }) {
  const [expanded, setExpanded] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkResults, setLinkResults] = useState<Array<{ id: number; ticketNumber: string; subject: string }>>([])
  const isPending = email.status === 'pending'
  const preview = email.body.slice(0, 200) + (email.body.length > 200 ? '...' : '')
  const suggestions = email.suggestedTickets || []

  useEffect(() => {
    if (!linkSearch || linkSearch.length < 2) { setLinkResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tickets?where[or][0][ticketNumber][contains]=${encodeURIComponent(linkSearch)}&where[or][1][subject][contains]=${encodeURIComponent(linkSearch)}&limit=10&sort=-updatedAt&depth=0`)
        if (res.ok) { const data = await res.json(); setLinkResults(data.docs.map((d: Record<string, unknown>) => ({ id: d.id, ticketNumber: d.ticketNumber, subject: d.subject }))) }
      } catch (err) { console.warn('[support] ticket search error:', err) }
    }, 300)
    return () => clearTimeout(timer)
  }, [linkSearch])

  const S: Record<string, React.CSSProperties> = {
    card: { padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-150)', marginBottom: 12, opacity: processing ? 0.5 : 1 },
    senderName: { fontWeight: 600, fontSize: 14 },
    senderEmail: { fontSize: 12, color: 'var(--theme-elevation-500)' },
    subject: { fontWeight: 600, fontSize: 13, marginTop: 4 },
    meta: { fontSize: 12, color: 'var(--theme-elevation-400)', marginTop: 2 },
    body: { fontSize: 13, color: 'var(--theme-text)', padding: '8px 0', whiteSpace: 'pre-wrap' as const, lineHeight: 1.5 },
    actions: { display: 'flex', gap: 8, marginTop: 8 },
    btn: { padding: '6px 14px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)' },
    btnCreate: { background: '#2563eb', color: '#fff', border: 'none' },
    btnIgnore: { color: '#dc2626', borderColor: '#dc2626' },
    overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modal: { background: 'var(--theme-elevation-0)', borderRadius: 12, padding: 24, maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto' as const },
  }

  return (
    <div style={S.card}>
      <div>
        <span style={S.senderName}>{email.senderName || email.senderEmail}</span>
        {email.senderName && <span style={S.senderEmail}> &lt;{email.senderEmail}&gt;</span>}
      </div>
      <div style={S.subject}>{email.subject}</div>
      <div style={S.meta}>{timeAgo(email.createdAt)} {email.attachments?.length ? `-- ${email.attachments.length} PJ` : ''}</div>

      {suggestions.length > 0 && isPending && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {suggestions.map((s) => (
            <span key={s.id} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: s.score >= 0.7 ? '#dcfce7' : '#fef3c7', color: s.score >= 0.7 ? '#166534' : '#92400e' }}>
              Similaire a {s.ticketNumber} ({Math.round(s.score * 100)}%)
            </span>
          ))}
        </div>
      )}

      <div style={S.body}>{expanded ? email.body : preview}</div>
      {email.body.length > 200 && <button onClick={() => setExpanded(!expanded)} style={{ ...S.btn, fontSize: 11, padding: '2px 8px' }}>{expanded ? t('pendingEmails.collapse') : t('pendingEmails.expand')}</button>}

      {isPending && (
        <div style={S.actions}>
          <button onClick={() => {
            const clientId = typeof email.client === 'object' && email.client ? email.client.id : undefined
            onProcess('create_ticket', undefined, clientId)
          }} disabled={processing} style={{ ...S.btn, ...S.btnCreate }}>{t('pendingEmails.actions.createTicket')}</button>
          <button onClick={() => setShowLinkModal(true)} disabled={processing} style={S.btn}>{t('pendingEmails.actions.linkToTicket')}</button>
          <button onClick={() => onProcess('ignore')} disabled={processing} style={{ ...S.btn, ...S.btnIgnore }}>{t('pendingEmails.actions.ignore')}</button>
        </div>
      )}

      {showLinkModal && (
        <div style={S.overlay} onClick={() => setShowLinkModal(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>{t('pendingEmails.linkModal.title')}</h3>
            {suggestions.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--theme-elevation-500)' }}>{t('pendingEmails.linkModal.suggestions')}</div>
                {suggestions.map((s) => (
                  <button key={s.id} onClick={() => { setShowLinkModal(false); onProcess('add_to_ticket', s.id) }} style={{ display: 'block', width: '100%', padding: '8px 12px', border: '1px solid var(--theme-elevation-200)', borderRadius: 6, background: 'var(--theme-elevation-0)', cursor: 'pointer', textAlign: 'left', marginBottom: 4, fontSize: 13 }}>
                    <strong>{s.ticketNumber}</strong> {s.subject} <span style={{ fontSize: 11, color: '#16a34a' }}>{Math.round(s.score * 100)}%</span>
                  </button>
                ))}
              </div>
            )}
            <input type="text" placeholder={t('pendingEmails.linkModal.searchPlaceholder')} value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 13, marginBottom: 8, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' }} />
            {linkResults.map((r) => (
              <button key={r.id} onClick={() => { setShowLinkModal(false); onProcess('add_to_ticket', r.id) }} style={{ display: 'block', width: '100%', padding: '8px 12px', border: '1px solid var(--theme-elevation-200)', borderRadius: 6, background: 'var(--theme-elevation-0)', cursor: 'pointer', textAlign: 'left', marginBottom: 4, fontSize: 13 }}>
                <strong>{r.ticketNumber}</strong> {r.subject}
              </button>
            ))}
          </div>
        </div>
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

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch(`/api/pending-emails?where[status][equals]=${tab}&sort=-createdAt&limit=50&depth=1`)
      if (res.ok) { const data = await res.json(); setEmails(data.docs) }
    } catch { /* ignore */ }
    setLoading(false)
  }, [tab])

  useEffect(() => { setLoading(true); fetchEmails() }, [fetchEmails])
  useEffect(() => { if (tab !== 'pending') return; const iv = setInterval(fetchEmails, 30000); return () => clearInterval(iv) }, [fetchEmails, tab])

  const handleProcess = async (emailId: number, action: 'create_ticket' | 'add_to_ticket' | 'ignore', ticketId?: number, clientId?: number) => {
    setProcessing(emailId)
    try {
      const res = await fetch(`/api/support/pending-emails/${emailId}/process`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ticketId, clientId }) })
      if (res.ok) { setEmails((prev) => prev.filter((e) => e.id !== emailId)) }
      else { const err = await res.json().catch(() => ({ error: 'Unknown error' })); alert(`Erreur : ${err.error || res.statusText}`) }
    } catch { alert('Erreur reseau') }
    setProcessing(null)
  }

  const tabs: { key: Tab; label: string }[] = [{ key: 'pending', label: t('pendingEmails.tabs.pending') }, { key: 'processed', label: t('pendingEmails.tabs.processed') }, { key: 'ignored', label: t('pendingEmails.tabs.ignored') }]

  return (
    <div style={{ padding: '20px 30px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--theme-text)' }}>{t('pendingEmails.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--theme-elevation-500)', margin: '4px 0 0' }}>{t('pendingEmails.subtitle')}</p>
        </div>
        {tab === 'pending' && emails.length > 0 && <span style={{ padding: '4px 10px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700 }}>{t('pendingEmails.pendingCount', { count: String(emails.length) })}</span>}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: tab === tb.key ? 'var(--theme-elevation-100)' : 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === tb.key ? 700 : 500, color: tab === tb.key ? 'var(--theme-text)' : 'var(--theme-elevation-500)' }}>{tb.label}</button>
        ))}
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{t('common.loading')}</div>
        : emails.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{t(`pendingEmails.empty.${tab}`)}</div>
        : emails.map((email) => <EmailCard key={email.id} email={email} onProcess={(action, ticketId, clientId) => handleProcess(email.id, action, ticketId, clientId)} processing={processing === email.id} t={t} />)}
    </div>
  )
}
