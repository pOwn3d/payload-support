'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { RichTextEditor, type RichTextEditorHandle } from '../../components/RichTextEditor/index'
import { hasCodeBlocks, MessageWithCodeBlocks, CodeBlockRendererHtml } from '../../components/TicketConversation/components/CodeBlock'
import { CodeBlockInserter } from '../../components/TicketConversation/components/CodeBlockInserter'
import { getFeatures } from '../shared/config'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import s from '../../styles/TicketDetail.module.scss'

interface Message {
  id: string | number; body: string; bodyHtml?: string; authorType: 'client' | 'admin' | 'email'
  isInternal?: boolean; isSolution?: boolean; createdAt: string; fromChat?: boolean
  attachments?: Array<{ file: { id: number; url?: string; filename?: string; mimeType?: string } | number }>
}
interface ClientInfo { id: number; company: string; firstName: string; lastName: string; email: string; phone?: string }
interface TimeEntry { id: string | number; duration: number; description?: string; date: string }
interface ActivityEntry { id: string | number; action: string; detail?: string; actorType?: string; createdAt: string }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open: { bg: '#dbeafe', color: '#1e40af' },
  waiting_client: { bg: '#fef3c7', color: '#92400e' },
  resolved: { bg: '#dcfce7', color: '#166534' },
}

function timeAgo(d: string): string {
  const date = new Date(d), now = new Date()
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (date.toDateString() === y.toDateString()) return `Hier, ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function dateLabel(d: string): string {
  const date = new Date(d), now = new Date()
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui"
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (date.toDateString() === y.toDateString()) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

// ── Rewrite style dropdown ──────────────────────────────────────────────
const REWRITE_STYLES = [
  { id: 'auto', label: '✏️ Auto', desc: 'Garde le ton actuel' },
  { id: 'tutoyer', label: '👋 Tutoyer', desc: 'Passe en tu' },
  { id: 'vouvoyer', label: '🎩 Vouvoyer', desc: 'Passe en vous' },
  { id: 'formel', label: '💼 Formel', desc: 'Ton professionnel' },
  { id: 'amical', label: '😊 Amical', desc: 'Ton chaleureux' },
  { id: 'court', label: '⚡ Court', desc: 'Version concise' },
]

const RewriteDropdown: React.FC<{
  disabled: boolean
  loading: boolean
  onSelect: (style: string) => void
  toolbarBtnClass?: string
}> = ({ disabled, loading, onSelect, toolbarBtnClass }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={toolbarBtnClass}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', width: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        {loading ? '...' : '✏️ Reformuler'}
        {!loading && <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>}
      </button>
      {open && !disabled && !loading && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 180, overflow: 'hidden',
        }}>
          {REWRITE_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => { setOpen(false); onSelect(style.id) }}
              style={{
                display: 'flex', flexDirection: 'column', width: '100%', padding: '8px 12px',
                border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
                borderBottom: '1px solid #f3f4f6',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f9fafb' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontSize: 12, fontWeight: 600 }}>{style.label}</span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{style.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const TicketDetailClient: React.FC = () => {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const ticketId = searchParams.get('id')
  const features = getFeatures()
  const editorRef = useRef<RichTextEditorHandle>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [ticket, setTicket] = useState<Record<string, unknown> | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [cannedResponses, setCannedResponses] = useState<Array<{ id: string | number; title: string; body: string }>>([])
  const [loading, setLoading] = useState(true)

  const [replyBody, setReplyBody] = useState('')
  const [replyHtml, setReplyHtml] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [notifyClient, setNotifyClient] = useState(true)
  const [sendAsClient, setSendAsClient] = useState(false)
  // Inline message edit
  const [editingMsgId, setEditingMsgId] = useState<string | number | null>(null)
  const [editingBody, setEditingBody] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const [showMenu, setShowMenu] = useState(false)
const [clientTyping, setClientTyping] = useState(false)
  const [aiReplying, setAiReplying] = useState(false)
  const [aiRewriting, setAiRewriting] = useState(false)
  const [sentiment, setSentiment] = useState<{ emoji: string; label: string; color: string } | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  // Client Intelligence
  const [clientSummary, setClientSummary] = useState<{ summary: string; recurringTopics?: { topic: string; count: number }[]; keyFacts?: string[] } | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [timerRunning, setTimerRunning] = useState(() => {
    if (typeof window === 'undefined' || !ticketId) return false
    return localStorage.getItem(`timer-run-${ticketId}`) === '1'
  })
  const [timerSeconds, setTimerSeconds] = useState(() => {
    if (typeof window === 'undefined' || !ticketId) return 0
    const s = Number(localStorage.getItem(`timer-sec-${ticketId}`) || 0)
    const t = Number(localStorage.getItem(`timer-ts-${ticketId}`) || 0)
    const running = localStorage.getItem(`timer-run-${ticketId}`) === '1'
    return running && t ? s + Math.floor((Date.now() - t) / 1000) : s
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Presence / collision detection
  const [otherViewers, setOtherViewers] = useState<Array<{ name: string; email: string }>>([])

  // Macros
  const [macros, setMacros] = useState<Array<{ id: number; name: string }>>([])
  const [applyingMacro, setApplyingMacro] = useState(false)

  // #2 — Undo toast state
  const [undoToast, setUndoToast] = useState<{ msgId: string | number; timer: ReturnType<typeof setTimeout> } | null>(null)

  // #2 — Split modal state
  const [splitModal, setSplitModal] = useState<{ messageId: string | number; preview: string } | null>(null)
  const [splitSubject, setSplitSubject] = useState('')

  // #5 — File upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [composerDragOver, setComposerDragOver] = useState(false)

  // #6 — Tags state
  const [tags, setTags] = useState<string[]>([])
  const [addingTag, setAddingTag] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')

  // ─── DATA FETCHING ───
  const fetchAll = useCallback(async () => {
    if (!ticketId) return
    try {
      const [mr, tr, ter, ar, cr] = await Promise.all([
        fetch(`/api/ticket-messages?where[ticket][equals]=${ticketId}&sort=createdAt&limit=200&depth=1`, { credentials: 'include' }),
        fetch(`/api/tickets/${ticketId}?depth=1`, { credentials: 'include' }),
        fetch(`/api/time-entries?where[ticket][equals]=${ticketId}&sort=-date&limit=50&depth=0`, { credentials: 'include' }),
        fetch(`/api/ticket-activity-log?where[ticket][equals]=${ticketId}&sort=-createdAt&limit=30&depth=0`, { credentials: 'include' }),
        fetch('/api/canned-responses?sort=sortOrder&limit=50&depth=0', { credentials: 'include' }),
      ])
      if (mr.ok) { const d = await mr.json(); setMessages(d.docs || []) }
      if (tr.ok) {
        const d = await tr.json()
        setTicket(d)
        if (d.client && typeof d.client === 'object') setClient(d.client)
        // #6 — Sync tags
        if (Array.isArray(d.tags)) setTags(d.tags.map((t: { tag?: string } | string) => typeof t === 'object' ? (t.tag || '') : t).filter(Boolean))
      }
      if (ter.ok) { const d = await ter.json(); setTimeEntries(d.docs || []) }
      if (ar.ok) { const d = await ar.json(); setActivityLog(d.docs || []) }
      if (cr.ok) { const d = await cr.json(); setCannedResponses(d.docs || []) }
    } catch { /* silent */ }
    setLoading(false)
  }, [ticketId])

  // Circuit breaker: stop polling after consecutive failures
  const failCountRef = useRef({ messages: 0, typing: 0, presence: 0 })
  const MAX_FAILS = 3

  useEffect(() => { fetchAll() }, [fetchAll])
  // Fetch client summary when ticket loads
  useEffect(() => {
    if (!ticket) return
    const clientId = typeof ticket.client === 'object' ? (ticket.client as any)?.id : ticket.client
    if (!clientId) return
    setSummaryLoading(true)
    fetch(`/api/support/client-intelligence?clientId=${clientId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setClientSummary(d) })
      .catch(() => {})
      .finally(() => setSummaryLoading(false))
  }, [ticket?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // Poll 10s
    if (!ticketId || loading) return
    const iv = setInterval(async () => {
      if (failCountRef.current.messages >= MAX_FAILS) return
      try {
        const [mr, tr] = await Promise.all([
          fetch(`/api/ticket-messages?where[ticket][equals]=${ticketId}&sort=createdAt&limit=200&depth=1`, { credentials: 'include' }),
          fetch(`/api/tickets/${ticketId}?depth=0`, { credentials: 'include' }),
        ])
        if (mr.ok && tr.ok) {
          failCountRef.current.messages = 0
          const d = await mr.json(); setMessages(d.docs || [])
          const td = await tr.json(); setTicket((p) => p ? { ...p, ...td } : td)
        } else { failCountRef.current.messages++ }
      } catch { failCountRef.current.messages++ }
    }, 10000)
    return () => clearInterval(iv)
  }, [ticketId, loading])
  useEffect(() => { // Mark read
    if (!ticketId) return
    fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ lastAdminReadAt: new Date().toISOString() }) }).catch(() => {})
  }, [ticketId, messages.length])
  useEffect(() => { // Typing
    if (!ticketId) return
    const iv = setInterval(async () => {
      if (failCountRef.current.typing >= MAX_FAILS) return
      try {
        const r = await fetch(`/api/support/typing?ticketId=${ticketId}`, { credentials: 'include' })
        if (r.ok) { failCountRef.current.typing = 0; const d = await r.json(); setClientTyping(d.typing) }
        else { failCountRef.current.typing++ }
      } catch { failCountRef.current.typing++ }
    }, 3000)
    return () => clearInterval(iv)
  }, [ticketId])
  useEffect(() => { // Sentiment
    if (!features.ai || messages.length === 0) return
    // Use last 3 client messages for better context (not just the last one)
    const clientMsgs = messages.filter((m) => m.authorType === 'client' || m.authorType === 'email').slice(-3)
    if (clientMsgs.length === 0) return
    const contextText = clientMsgs.map((m) => m.body).join('\n---\n').slice(0, 1000)
    fetch('/api/support/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'sentiment', text: contextText }) })
      .then((r) => r.json()).then((d) => {
        const raw = (d.sentiment || '').toLowerCase().replace(/[^a-zéèêàùûîôëüöç]/g, '')
        const map: Record<string, { emoji: string; label: string; color: string }> = {
          'frustré': { emoji: '😤', label: 'Frustré', color: '#dc2626' }, 'frustre': { emoji: '😤', label: 'Frustré', color: '#dc2626' },
          'mécontent': { emoji: '😠', label: 'Mécontent', color: '#ea580c' }, 'mecontent': { emoji: '😠', label: 'Mécontent', color: '#ea580c' },
          'urgent': { emoji: '🔥', label: 'Urgent', color: '#dc2626' }, 'neutre': { emoji: '😐', label: 'Neutre', color: '#6b7280' }, 'satisfait': { emoji: '😊', label: 'Satisfait', color: '#16a34a' },
        }
        const m = Object.keys(map).find((k) => raw.includes(k))
        setSentiment(m ? map[m] : { emoji: '😐', label: 'Neutre', color: '#6b7280' })
      }).catch(() => {})
  }, [messages.length, features.ai]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])
  useEffect(() => { // Timer with localStorage persistence
    if (timerRunning) {
      localStorage.setItem(`timer-run-${ticketId}`, '1')
      localStorage.setItem(`timer-ts-${ticketId}`, String(Date.now()))
      localStorage.setItem(`timer-sec-${ticketId}`, String(timerSeconds))
      timerRef.current = setInterval(() => {
        setTimerSeconds((p) => {
          const next = p + 1
          localStorage.setItem(`timer-sec-${ticketId}`, String(next))
          localStorage.setItem(`timer-ts-${ticketId}`, String(Date.now()))
          return next
        })
      }, 1000)
    } else {
      localStorage.setItem(`timer-run-${ticketId}`, '0')
      localStorage.setItem(`timer-sec-${ticketId}`, String(timerSeconds))
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning, ticketId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── PRESENCE / COLLISION DETECTION ───
  useEffect(() => {
    if (!ticketId) return
    const join = () => fetch('/api/support/presence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ ticketId: Number(ticketId), action: 'join' }),
    }).catch(() => {})
    join()
    const heartbeat = setInterval(join, 20_000)
    return () => {
      clearInterval(heartbeat)
      fetch('/api/support/presence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ticketId: Number(ticketId), action: 'leave' }),
      }).catch(() => {})
    }
  }, [ticketId])

  useEffect(() => {
    if (!ticketId) return
    const poll = setInterval(async () => {
      if (failCountRef.current.presence >= MAX_FAILS) return
      try {
        const r = await fetch(`/api/support/presence?ticketId=${ticketId}`, { credentials: 'include' })
        if (r.ok) { failCountRef.current.presence = 0; const d = await r.json(); setOtherViewers(d.viewers || []) }
        else { failCountRef.current.presence++ }
      } catch { failCountRef.current.presence++ }
    }, 5_000)
    return () => clearInterval(poll)
  }, [ticketId])

  // ─── FETCH MACROS ───
  useEffect(() => {
    fetch('/api/macros?where[isActive][equals]=true&depth=0&limit=50', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.docs) setMacros(d.docs.map((m: { id: number; name: string }) => ({ id: m.id, name: m.name }))) })
      .catch(() => {})
  }, [])

  // #12 — Close dropdown on outside click
  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  // #3 — Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      // Cmd/Ctrl+Enter -> send
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        const sendBtn = document.querySelector('[data-action="send-reply"]') as HTMLButtonElement | null
        if (sendBtn && !sendBtn.disabled) sendBtn.click()
      }
      // Cmd/Ctrl+Shift+N -> toggle internal
      if (mod && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setIsInternal((prev) => !prev)
      }
      // Escape -> close dropdown / split modal
      if (e.key === 'Escape') {
        setShowMenu(false)
        setSplitModal(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // ─── HANDLERS ───
  const handleSend = async () => {
    if ((!replyBody.trim() && !replyHtml.trim()) || !ticketId) return
    setSending(true)
    try {
      // #5 — Upload pending files first
      const uploadedLinks: string[] = []
      for (const file of pendingFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('_payload', JSON.stringify({ alt: file.name }))
        try {
          const ur = await fetch('/api/media', { method: 'POST', credentials: 'include', body: formData })
          if (ur.ok) {
            const ud = await ur.json()
            if (ud.doc?.url) uploadedLinks.push(`[${ud.doc.filename || file.name}](${ud.doc.url})`)
          }
        } catch { /* silent */ }
      }
      const finalBody = uploadedLinks.length > 0 ? `${replyBody.trim()}\n\n${uploadedLinks.join('\n')}` : (replyBody.trim() || '[Contenu enrichi]')
      const finalHtml = uploadedLinks.length > 0 ? `${replyHtml || replyBody.trim()}<br/><br/>${uploadedLinks.map((l) => l.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')).join('<br/>')}` : (replyHtml || undefined)

      const res = await fetch('/api/ticket-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          ticket: Number(ticketId),
          body: finalBody,
          ...(finalHtml ? { bodyHtml: finalHtml } : {}),
          authorType: sendAsClient ? 'client' : 'admin',
          ...(sendAsClient && client ? { authorClient: client.id } : {}),
          isInternal: sendAsClient ? false : isInternal,
          skipNotification: sendAsClient || isInternal || !notifyClient,
        }) })
      if (res.ok) { setReplyBody(''); setReplyHtml(''); setIsInternal(false); setSendAsClient(false); setPendingFiles([]); editorRef.current?.clear(); fetchAll() }
    } catch {} finally { setSending(false) }
  }

  const handleStatusChange = async (v: string) => {
    if (!ticketId) return; setStatusUpdating(true)
    try { await fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ status: v }) }); fetchAll() } catch {} finally { setStatusUpdating(false) }
  }

  // #1 — Inline field patch
  const handleFieldPatch = async (field: string, value: string) => {
    if (!ticketId) return
    try {
      await fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ [field]: value }) })
      fetchAll()
    } catch { /* silent */ }
  }

  // #2 — Delete with undo toast
  const handleDeleteMessage = (msgId: string | number) => {
    if (undoToast) clearTimeout(undoToast.timer)
    const timer = setTimeout(() => {
      fetch(`/api/ticket-messages/${msgId}`, { method: 'DELETE', credentials: 'include' }).then(() => fetchAll())
      setUndoToast(null)
    }, 5000)
    setUndoToast({ msgId, timer })
  }

  const handleUndoDelete = () => {
    if (undoToast) {
      clearTimeout(undoToast.timer)
      setUndoToast(null)
    }
  }

  // Inline edit message (body only, clears bodyHtml so the edit shows as plain text)
  const startEditMessage = (msg: Message) => {
    setEditingMsgId(msg.id)
    setEditingBody(msg.body || '')
  }

  const cancelEditMessage = () => {
    setEditingMsgId(null)
    setEditingBody('')
  }

  const saveEditMessage = async () => {
    if (editingMsgId === null) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/ticket-messages/${editingMsgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: editingBody, bodyHtml: null, skipNotification: true }),
      })
      if (res.ok) {
        setEditingMsgId(null)
        setEditingBody('')
        fetchAll()
      }
    } catch { /* silent */ } finally {
      setEditSaving(false)
    }
  }

  // #2 — Split ticket with modal
  const handleSplitConfirm = async () => {
    if (!splitModal || !splitSubject.trim()) return
    try {
      const r = await fetch('/api/support/split-ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ messageId: splitModal.messageId, subject: splitSubject }) })
      const d = await r.json()
      if (d.ticketNumber) { fetchAll() }
    } catch { /* silent */ }
    setSplitModal(null)
    setSplitSubject('')
  }

  const handleAiSuggest = async () => {
    if (messages.length === 0) return; setAiReplying(true)
    try {
      const r = await fetch('/api/support/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'suggest_reply', messages: messages.slice(-10).map((m) => ({ authorType: m.authorType, body: m.body })), clientName: `${client?.firstName || ''} ${client?.lastName || ''}`.trim(), clientCompany: client?.company }) })
      if (r.ok) { const d = await r.json(); if (d.reply) { setReplyBody(d.reply); setReplyHtml(d.reply.replace(/\n/g, '<br/>')); editorRef.current?.setContent(d.reply.replace(/\n/g, '<br/>')) } }
    } catch {} finally { setAiReplying(false) }
  }

  const handleAiRewrite = async (style: string = 'auto') => {
    if (!replyBody.trim()) return; setAiRewriting(true)
    try {
      const r = await fetch('/api/support/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'rewrite', text: replyBody, style }) })
      if (r.ok) { const d = await r.json(); if (d.rewritten) { setReplyBody(d.rewritten); setReplyHtml(d.rewritten.replace(/\n/g, '<br/>')); editorRef.current?.setContent(d.rewritten.replace(/\n/g, '<br/>')) } }
    } catch {} finally { setAiRewriting(false) }
  }

  const handleTimerSave = async () => {
    if (!ticketId || timerSeconds < 60) return
    try { await fetch('/api/time-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ticket: Number(ticketId), duration: Math.round(timerSeconds / 60), date: new Date().toISOString(), description: 'Timer' }) }); setTimerSeconds(0); setTimerRunning(false); fetchAll() } catch {}
  }

  const handleApplyMacro = async (macroId: number) => {
    if (!ticketId || applyingMacro) return
    setApplyingMacro(true)
    try {
      const r = await fetch('/api/support/apply-macro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ macroId, ticketId: Number(ticketId) }),
      })
      if (r.ok) { fetchAll() }
    } catch { /* silent */ } finally { setApplyingMacro(false) }
  }

// #5 — File handling
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    setPendingFiles((prev) => [...prev, ...Array.from(files)])
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setComposerDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  // #6 — Tags
  const handleRemoveTag = async (tag: string) => {
    const newTags = tags.filter((t) => t !== tag)
    setTags(newTags)
    if (ticketId) {
      await fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ tags: newTags.map((t) => ({ tag: t })) }) }).catch(() => {})
    }
  }

  const handleAddTag = async () => {
    if (!newTagValue.trim()) { setAddingTag(false); return }
    const tag = newTagValue.trim()
    if (tags.includes(tag)) { setAddingTag(false); setNewTagValue(''); return }
    const newTags = [...tags, tag]
    setTags(newTags)
    setAddingTag(false)
    setNewTagValue('')
    if (ticketId) {
      await fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ tags: newTags.map((t) => ({ tag: t })) }) }).catch(() => {})
    }
  }

  // ─── RENDER ───
  if (!ticketId) return <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>{t('detail.selectTicket')}</div>
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>{t('common.loading')}</div>
  if (!ticket) return <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>{t('detail.notFound')}</div>

  const st = STATUS_STYLE[(ticket.status as string) || 'open'] || STATUS_STYLE.open
  const totalMin = timeEntries.reduce((a, e) => a + (e.duration || 0), 0)
  const initials = client ? `${(client.firstName?.[0] || '').toUpperCase()}${(client.lastName?.[0] || '').toUpperCase()}` : '?'

  return (
    <div className={s.page}>
      {/* TOP BAR */}
      <div className={s.topBar}>
        <Link href="/admin/support/inbox" className={s.backLink} aria-label="Retour à la boîte de réception">&larr;</Link>
        <div className={s.ticketMeta}>
          <span className={s.ticketNumber}>{ticket.ticketNumber as string}</span>
          <span className={s.ticketSubject}>{ticket.subject as string}</span>
        </div>
        <div className={s.topBarRight}>
          <select className={s.statusChip} style={{ background: st.bg, color: st.color }} value={(ticket.status as string) || 'open'} onChange={(e) => handleStatusChange(e.target.value)} disabled={statusUpdating} aria-label={t('ticket.status.label')}>
            <option value="open">{t('detail.statusOpen')}</option>
            <option value="waiting_client">{t('detail.statusWaiting')}</option>
            <option value="resolved">{t('detail.statusResolved')}</option>
          </select>
          {sentiment && features.ai && (
            <span className={s.sentimentBadge} style={{ background: `${sentiment.color}12`, color: sentiment.color }}>
              {sentiment.emoji} {sentiment.label}
            </span>
          )}
          <div className={s.dropdown} ref={dropdownRef}>
            <button className={s.moreBtn} onClick={() => setShowMenu(!showMenu)} aria-label="Plus d&apos;options">&middot;&middot;&middot;</button>
            {showMenu && (
              <div className={s.dropdownMenu}>
                <button className={s.dropdownItem} onClick={() => { navigator.clipboard.writeText(window.location.href); setShowMenu(false) }}>{t('detail.copyLink')}</button>
                <Link href={`/admin/collections/tickets/${ticketId}`} className={s.dropdownItem} onClick={() => setShowMenu(false)}>{t('detail.payloadView')}</Link>
                <a href={`/support/tickets/${ticketId}`} target="_blank" rel="noopener noreferrer" className={s.dropdownItem} onClick={() => setShowMenu(false)}>{t('detail.clientView')}</a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRESENCE BANNER */}
      {otherViewers.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', marginBottom: 12, borderRadius: 8,
          background: '#fef3c7', border: '1px solid #fde68a',
          fontSize: 13, fontWeight: 500, color: '#92400e',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" fill="#92400e"/></svg>
          {otherViewers.length === 1 ? t('detail.viewingAlso', { names: otherViewers.map((v) => v.name).join(', ') }) : t('detail.viewingAlsoPlural', { names: otherViewers.map((v) => v.name).join(', ') })}
        </div>
      )}

      {/* LAYOUT */}
      <div className={s.layout}>
        {/* LEFT: Conversation */}
        <div className={s.conversationCol}>
          <div className={s.thread}>
            {messages.map((msg, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null
              const showDate = msg.createdAt && (!prev?.createdAt || new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString())
              const isAdmin = msg.authorType === 'admin'
              // #2 — Hide message visually if pending delete
              const isPendingDelete = undoToast?.msgId === msg.id

              return (
                <React.Fragment key={msg.id}>
                  {showDate && <div className={s.dateSeparator}><span className={s.dateSeparatorText}>{dateLabel(msg.createdAt)}</span></div>}
                  <div className={`${s.message} ${msg.isInternal ? s.messageInternal : ''}`} style={isPendingDelete ? { opacity: 0.3, pointerEvents: 'none' } : undefined}>
                    {/* #10 — Client avatar purple */}
                    <div className={s.avatar} style={{ backgroundColor: isAdmin ? '#2563eb' : msg.authorType === 'email' ? '#ea580c' : '#7c3aed' }}>
                      {isAdmin ? 'CW' : initials}
                    </div>
                    <div className={s.messageContent}>
                      <div className={s.messageHeader}>
                        <span className={s.messageAuthor}>{isAdmin ? 'Support' : msg.authorType === 'email' ? 'Email' : client?.firstName || 'Client'}</span>
                        <span className={s.messageTime}>{timeAgo(msg.createdAt)}</span>
                        {msg.isInternal && <span className={s.badge} style={{ background: '#fef3c7', color: '#92400e' }}>Interne</span>}
                        {msg.isSolution && <span className={s.badge} style={{ background: '#dcfce7', color: '#166534' }}>Solution</span>}
                        <span className={s.messageMeta}>
                          {isAdmin && !msg.isInternal && (() => {
                            const ext = msg as unknown as { emailOpenedAt?: string; emailSentAt?: string }
                            if (ext.emailOpenedAt) {
                              const d = new Date(ext.emailOpenedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                              return <span style={{ color: '#16a34a', cursor: 'help' }} title={`Ouvert le ${d}`}>✓✓ Lu {d}</span>
                            }
                            if (ext.emailSentAt) {
                              const d = new Date(ext.emailSentAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                              return <span style={{ color: '#2563eb', cursor: 'help' }} title={`Envoyé le ${d}`}>✓ Envoyé {d}</span>
                            }
                            return <span style={{ color: '#94a3b8' }}>✓</span>
                          })()}
                        </span>
                      </div>
                      {editingMsgId === msg.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <textarea
                            value={editingBody}
                            onChange={(e) => setEditingBody(e.target.value)}
                            style={{ width: '100%', minHeight: 120, padding: 10, fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', border: '1px solid var(--theme-elevation-200)', borderRadius: 6, background: 'var(--theme-elevation-0)', color: 'var(--theme-text)' }}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={cancelEditMessage} disabled={editSaving} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 5, border: '1px solid var(--theme-elevation-200)', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)', cursor: 'pointer' }}>Annuler</button>
                            <button onClick={saveEditMessage} disabled={editSaving || !editingBody.trim()} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 5, border: 'none', background: '#2563eb', color: '#fff', cursor: editSaving ? 'wait' : 'pointer', opacity: editSaving ? 0.6 : 1 }}>{editSaving ? 'Sauvegarde…' : 'Enregistrer'}</button>
                          </div>
                        </div>
                      ) : (msg as unknown as { deletedAt?: string }).deletedAt ? (
                        <div className={s.messageBody} style={{ color: '#94a3b8', fontStyle: 'italic' }}>{t('detail.messageDeleted')}</div>
                      ) : msg.bodyHtml && hasCodeBlocks(msg.bodyHtml.replace(/<[^>]+>/g, '')) ? (
                        <CodeBlockRendererHtml html={msg.bodyHtml} />
                      ) : msg.bodyHtml ? (
                        <div className={`${s.messageBody} ${s.rteDisplay}`} dangerouslySetInnerHTML={{ __html: msg.bodyHtml }} />
                      ) : hasCodeBlocks(msg.body) ? (
                        <MessageWithCodeBlocks text={msg.body} style={{ fontSize: '13px', lineHeight: 1.5 }} />
                      ) : (
                        <div className={s.messageBody}>{msg.body}</div>
                      )}
                      {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                        <div className={s.attachments}>
                          {msg.attachments.map((att, i) => {
                            const file = typeof att.file === 'object' ? att.file : null
                            if (!file) return null
                            return (file.mimeType || '').startsWith('image/')
                              ? <a key={i} href={file.url || '#'} target="_blank" rel="noopener noreferrer"><img src={file.url || ''} alt="" className={s.attachmentImg} /></a>
                              : <a key={i} href={file.url || '#'} target="_blank" rel="noopener noreferrer" className={s.attachmentFile}>PJ {file.filename || 'Fichier'}</a>
                          })}
                        </div>
                      )}
                    </div>
                    {/* Hover actions — icon buttons with aria-labels (#7) */}
                    {editingMsgId !== msg.id && !(msg as unknown as { deletedAt?: string }).deletedAt && (
                      <div className={s.messageActions}>
                        <button className={s.actionIcon} title="Éditer" aria-label="Éditer le message" onClick={() => startEditMessage(msg)} style={{ fontSize: 11, width: 'auto', padding: '4px 8px' }}>Éditer</button>
                        {/* #2 — Undo toast instead of confirm() */}
                        <button className={`${s.actionIcon} ${s.danger}`} title={t('actions.deleteMessage')} aria-label={t('actions.deleteMessage')} onClick={() => handleDeleteMessage(msg.id)} style={{ fontSize: 11, width: 'auto', padding: '4px 8px' }}>{t('actions.deleteMessage')}</button>
                        {/* #2 — Split modal instead of prompt() */}
                        {features.splitTicket && !msg.isInternal && <button className={s.actionIcon} title={t('actions.extractMessage')} aria-label={t('actions.extractToNewTicket')} onClick={() => { setSplitModal({ messageId: msg.id, preview: msg.body.slice(0, 200) }); setSplitSubject(`Split: ${ticket.subject}`) }} style={{ fontSize: 11, width: 'auto', padding: '4px 8px' }}>{t('actions.extractMessage')}</button>}
                        {isAdmin && !msg.isInternal && <button className={s.actionIcon} title={t('actions.resendEmail')} aria-label={t('actions.resendEmail')} onClick={() => fetch('/api/support/resend-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ messageId: msg.id }) })} style={{ fontSize: 11, width: 'auto', padding: '4px 8px' }}>{t('actions.resendEmail')}</button>}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              )
            })}
            <div ref={threadEndRef} />
          </div>

          {clientTyping && (
            <div className={s.typing}>
              <span className={s.typingDots}><span /><span /><span /></span>
              {t('detail.typing', { name: client?.firstName || 'Client' })}
            </div>
          )}

          {/* COMPOSER */}
          <div
            className={`${s.composer} ${isInternal ? s.composerInternal : ''} ${composerDragOver ? s.composerDragOver : ''}`}
            onDragOver={(e) => { e.preventDefault(); setComposerDragOver(true) }}
            onDragLeave={() => setComposerDragOver(false)}
            onDrop={handleFileDrop}
          >
            <div className={s.composerToolbar}>
              {features.ai && (
                <>
                  <button className={s.toolbarBtn} data-tooltip={t('detail.iaSuggestion')} aria-label={t('detail.iaSuggestion')} onClick={handleAiSuggest} disabled={aiReplying || messages.length === 0} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', width: 'auto' }}>{aiReplying ? '...' : `✨ ${t('detail.iaSuggestion')}`}</button>
                  <RewriteDropdown disabled={aiRewriting || !replyBody.trim()} loading={aiRewriting} onSelect={(style) => handleAiRewrite(style)} toolbarBtnClass={s.toolbarBtn} />
                </>
              )}
              <CodeBlockInserter
                className={s.toolbarBtn}
                onInsert={(block) => {
                  const nb = replyBody ? replyBody + block : block
                  setReplyBody(nb)
                  setReplyHtml(nb.replace(/\n/g, '<br/>'))
                  editorRef.current?.setContent(nb.replace(/\n/g, '<br/>'))
                }}
              />
              {/* #5 — File upload button */}
              <button className={s.toolbarBtn} data-tooltip={t('detail.file')} aria-label={t('detail.file')} onClick={() => fileInputRef.current?.click()} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', width: 'auto' }}>📎 {t('detail.file')}</button>
              <input ref={fileInputRef} type="file" multiple className={s.hiddenFileInput} onChange={(e) => handleFileSelect(e.target.files)} />
              {macros.length > 0 && (
                <select
                  className={s.cannedSelect}
                  onChange={(e) => { const id = Number(e.target.value); if (id) handleApplyMacro(id); e.target.value = '' }}
                  disabled={applyingMacro}
                  style={{ marginLeft: 0 }}
                  aria-label="Appliquer une macro"
                >
                  <option value="">{applyingMacro ? t('detail.applyingMacro') : t('detail.macros')}</option>
                  {macros.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
              <span className={s.toolbarDivider} />
              {/* #9 — "Canned" -> "Réponses types" */}
              {features.canned && cannedResponses.length > 0 && (
                <select className={s.cannedSelect} aria-label="Réponses types" onChange={(e) => {
                  const cr = cannedResponses.find((c) => String(c.id) === e.target.value)
                  if (cr) { let b = cr.body; if (client) { b = b.replace(/\{\{client\.firstName\}\}/g, client.firstName).replace(/\{\{client\.company\}\}/g, client.company) }; setReplyBody(b); setReplyHtml(b.replace(/\n/g, '<br/>')); editorRef.current?.setContent(b.replace(/\n/g, '<br/>')) }
                  e.target.value = ''
                }}>
                  <option value="">{t('detail.cannedResponses')}</option>
                  {cannedResponses.map((cr) => <option key={cr.id} value={String(cr.id)}>{cr.title}</option>)}
                </select>
              )}
            </div>
            <RichTextEditor
              ref={editorRef}
              onChange={(html, text) => { setReplyHtml(html); setReplyBody(text) }}
              placeholder={isInternal ? t('composer.placeholderInternal') : t('composer.placeholderReplyTo', { name: client?.firstName || 'client' })}
              minHeight={100}
              borderColor="transparent"
              onFileUpload={async (file) => {
                try {
                  const formData = new FormData()
                  formData.append('file', file)
                  formData.append('_payload', JSON.stringify({ alt: file.name }))
                  const ur = await fetch('/api/media', { method: 'POST', credentials: 'include', body: formData })
                  if (!ur.ok) return null
                  const ud = await ur.json()
                  return ud.doc?.url || null
                } catch { return null }
              }}
            />
            {/* #5 — File upload preview */}
            {pendingFiles.length > 0 && (
              <div className={s.uploadPreview}>
                {pendingFiles.map((f, i) => (
                  <div key={i} className={s.uploadPreviewItem}>
                    <span>PJ {f.name}</span>
                    <button className={s.uploadRemoveBtn} aria-label={`Retirer ${f.name}`} onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}>&times;</button>
                  </div>
                ))}
              </div>
            )}
            <div className={s.composerFooter}>
              <div className={s.composerOptions}>
                <select
                  value={sendAsClient ? 'client' : 'admin'}
                  onChange={(e) => {
                    const asClient = e.target.value === 'client'
                    setSendAsClient(asClient)
                    if (asClient) { setIsInternal(false); setNotifyClient(false) }
                  }}
                  style={{ fontSize: '12px', padding: '4px 8px', fontWeight: 600, borderRadius: 6, border: '1px solid var(--theme-elevation-200)', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)' }}
                >
                  <option value="admin">En tant que : Support</option>
                  <option value="client">En tant que : Client</option>
                </select>
                {!sendAsClient && (
                  <>
                    <label><input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} /> {t('detail.internalNote')}</label>
                    <label><input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} disabled={isInternal} /> {t('detail.notify')}</label>
                  </>
                )}
              </div>
              <button className={`${s.sendBtn} ${isInternal ? s.sendBtnInternal : ''}`} onClick={handleSend} disabled={sending || !replyBody.trim()} data-action="send-reply">
                {sending ? t('detail.sending') : sendAsClient ? 'Ajouter message client' : isInternal ? t('detail.sendNote') : t('detail.sendReply')}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div className={s.sidebar}>
          {client && (
            <div className={s.sideSection}>
              <div className={s.clientCard}>
                <div className={s.clientAvatar}>{initials}</div>
                <div className={s.clientInfo}>
                  <div className={s.clientName}>{client.firstName} {client.lastName}</div>
                  <div className={s.clientCompany}>{client.company}</div>
                  <a href={`mailto:${client.email}`} className={s.clientEmail}>{client.email}</a>
                </div>
              </div>
              <div className={s.clientActions}>
                <Link href={`/admin/collections/support-clients/${client.id}`} className={s.smallBtn}>{t('client.clientSheet')}</Link>
                <button className={s.smallBtn} onClick={() => window.open(`/api/admin/impersonate?clientId=${client.id}`, '_blank')}>{t('client.clientPortal')}</button>
              </div>
            </div>
          )}

          {/* #1 — Editable sidebar fields */}
          <div className={s.sideSection}>
            <div className={s.sideSectionTitle}>{t('detail.details')}</div>
            <div className={s.sideField}>
              <span className={s.sideLabel}>{t('detail.priority')}</span>
              <select className={s.sideSelect} value={(ticket.priority as string) || 'normal'} onChange={(e) => handleFieldPatch('priority', e.target.value)} aria-label={t('detail.priority')}>
                <option value="low">{t('ticket.priority.low')}</option>
                <option value="normal">{t('ticket.priority.normal')}</option>
                <option value="high">{t('ticket.priority.high')}</option>
                <option value="urgent">{t('ticket.priority.urgent')}</option>
              </select>
            </div>
            <div className={s.sideField}>
              <span className={s.sideLabel}>{t('detail.category')}</span>
              <select className={s.sideSelect} value={(ticket.category as string) || ''} onChange={(e) => handleFieldPatch('category', e.target.value)} aria-label={t('detail.category')}>
                <option value="">—</option>
                <option value="bug">{t('ticket.category.bug')}</option>
                <option value="content">{t('ticket.category.content')}</option>
                <option value="feature">{t('ticket.category.feature')}</option>
                <option value="question">{t('ticket.category.question')}</option>
                <option value="hosting">{t('ticket.category.hosting')}</option>
              </select>
            </div>
            <div className={s.sideField}><span className={s.sideLabel}>{t('detail.source')}</span><span className={s.sideValue}>{(ticket.source as string) || t('ticket.source.portal')}</span></div>
            <div className={s.sideField}><span className={s.sideLabel}>{t('detail.assigned')}</span><span className={s.sideValue}>{typeof ticket.assignedTo === 'object' && ticket.assignedTo ? (ticket.assignedTo as { firstName?: string }).firstName || 'Admin' : '—'}</span></div>
          </div>

          {/* #6 — Tags section */}
          <div className={s.sideSection}>
            <div className={s.sideSectionTitle}>{t('detail.tags')}</div>
            <div className={s.tagsWrap}>
              {tags.map((tag) => (
                <span key={tag} className={s.tagChip}>
                  {tag}
                  <button className={s.tagRemove} aria-label={`Retirer le tag ${tag}`} onClick={() => handleRemoveTag(tag)}>&times;</button>
                </span>
              ))}
              {addingTag ? (
                <input
                  className={s.tagInput}
                  value={newTagValue}
                  onChange={(e) => setNewTagValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') { setAddingTag(false); setNewTagValue('') } }}
                  onBlur={handleAddTag}
                  placeholder="Tag..."
                  autoFocus
                />
              ) : (
                <button className={s.tagAddBtn} onClick={() => setAddingTag(true)} aria-label="Ajouter un tag">+ Tag</button>
              )}
            </div>
          </div>

          {/* ===== BILLING ===== */}
          <div className={s.sideSection}>
            <div className={s.sideSectionTitle}>Facturation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12 }}>Type</span>
                <select
                  value={(ticket as any)?.billingType || 'hourly'}
                  onChange={async (e) => {
                    try {
                      await fetch(`/api/tickets/${ticketId}`, {
                        method: 'PATCH', credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ billingType: e.target.value }),
                      })
                      fetchAll()
                    } catch {}
                  }}
                  style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff' }}
                >
                  <option value="hourly">Au temps</option>
                  <option value="flat">Forfait</option>
                </select>
              </div>
              {(ticket as any)?.billingType === 'flat' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12 }}>Montant forfait</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      defaultValue={(ticket as any)?.flatRateAmount ?? ''}
                      placeholder="0"
                      onBlur={async (e) => {
                        const val = e.target.value ? Number(e.target.value) : null
                        try {
                          await fetch(`/api/tickets/${ticketId}`, {
                            method: 'PATCH', credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ flatRateAmount: val }),
                          })
                          fetchAll()
                        } catch {}
                      }}
                      style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', width: 80, textAlign: 'right' }}
                    />
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>€</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12 }}>Montant facturé</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    defaultValue={(ticket as any)?.billedAmount ?? ''}
                    placeholder="0"
                    onBlur={async (e) => {
                      const val = e.target.value ? Number(e.target.value) : null
                      try {
                        await fetch(`/api/tickets/${ticketId}`, {
                          method: 'PATCH', credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ billedAmount: val }),
                        })
                        fetchAll()
                      } catch {}
                    }}
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', width: 80, textAlign: 'right' }}
                  />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>€</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12 }}>Paiement</span>
                <select
                  value={(ticket as any)?.paymentStatus || 'unpaid'}
                  onChange={async (e) => {
                    try {
                      await fetch(`/api/tickets/${ticketId}`, {
                        method: 'PATCH', credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paymentStatus: e.target.value }),
                      })
                      fetchAll()
                    } catch {}
                  }}
                  style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff' }}
                >
                  <option value="unpaid">Non payé</option>
                  <option value="partial">Partiel</option>
                  <option value="paid">Payé</option>
                </select>
              </div>
            </div>
          </div>

          {features.timeTracking && (
            <div className={s.sideSection}>
              <div className={s.sideSectionTitle}>{t('detail.time')} <span style={{ fontWeight: 700, fontSize: 13, color: '#d97706' }}>{totalMin > 0 ? `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')} ${t('detail.total')}` : '0min'}</span></div>
              {/* Timer */}
              <div className={s.timer}>
                <span className={`${s.timerDisplay} ${timerRunning ? s.timerActive : ''}`}>
                  {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
                </span>
                {!timerRunning ? (
                  <button className={s.timerBtn} onClick={() => setTimerRunning(true)} style={{ color: '#dc2626', borderColor: '#dc2626' }} aria-label="Démarrer le timer">{timerSeconds > 0 ? '▶' : '▶ Go'}</button>
                ) : (
                  <button className={s.timerBtn} onClick={() => setTimerRunning(false)} aria-label="Mettre en pause le timer">⏸</button>
                )}
                {timerSeconds >= 60 && !timerRunning && (
                  <button className={s.timerBtn} onClick={() => { handleTimerSave(); localStorage.removeItem(`timer-sec-${ticketId}`); localStorage.removeItem(`timer-run-${ticketId}`) }} style={{ color: '#16a34a', borderColor: '#16a34a' }} aria-label="Sauvegarder le temps">💾 {Math.round(timerSeconds / 60)}m</button>
                )}
              </div>
              {/* Manual time entry */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                <input type="number" min="1" placeholder="min" style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' }} id="manual-time-input" />
                <button className={s.timerBtn} onClick={async () => {
                  const input = document.getElementById('manual-time-input') as HTMLInputElement
                  const mins = Number(input?.value)
                  if (!mins || mins < 1 || !ticketId) return
                  try {
                    await fetch('/api/time-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ticket: Number(ticketId), duration: mins, date: new Date().toISOString(), description: 'Saisie manuelle' }) })
                    if (input) input.value = ''
                    fetchAll()
                  } catch {}
                }} style={{ fontSize: 11 }}>+ Ajouter</button>
              </div>
              {/* Billing info */}
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--theme-elevation-500)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', alignItems: 'center' }}>
                  <span>Facturable</span>
                  <button
                    onClick={async () => {
                      const newVal = ticket.billable === false ? true : false
                      try { await fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ billable: newVal }) }); fetchAll() } catch {}
                    }}
                    style={{ fontWeight: 600, color: (ticket.billable !== false) ? '#16a34a' : '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}
                  >
                    {(ticket.billable !== false) ? 'Oui' : 'Non'}
                  </button>
                </div>
                {totalMin > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span>Montant estimé</span>
                    <span style={{ fontWeight: 700, color: 'var(--theme-text)' }}>{((totalMin / 60) * 60).toFixed(0)}€</span>
                  </div>
                )}
              </div>
              {/* Time entries */}
              {timeEntries.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11 }}>
                  {timeEntries.slice(0, 6).map((e) => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--theme-elevation-500)' }}>
                      <span>{new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                      <span title={e.description} style={{ fontWeight: 600, cursor: e.description ? 'help' : 'default' }}>{e.duration}min</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {features.activityLog && (
            <div className={s.sideSection}>
              <div className={s.sideSectionTitle}>
                <button className={s.collapseBtn} onClick={() => setShowActivity(!showActivity)} aria-label={showActivity ? 'Masquer le journal' : 'Afficher le journal'}>
                  Activité {showActivity ? '▾' : '▸'}
                </button>
              </div>
              {showActivity && activityLog.slice(0, 8).map((a) => (
                <div key={a.id} className={s.activityItem}>
                  <div className={s.activityDot} style={{ backgroundColor: a.actorType === 'admin' ? '#2563eb' : a.actorType === 'system' ? '#6b7280' : '#16a34a' }} />
                  <div className={s.activityContent}>
                    <div className={s.activityText}>{(a.detail || a.action).slice(0, 60)}</div>
                    <div className={s.activityTime}>{timeAgo(a.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Client Intelligence (compact) */}
          {clientSummary && clientSummary.summary && (
            <div className={s.sideSection} style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.03) 0%, rgba(139,92,246,0.03) 100%)' }}>
              <div className={s.sideSectionTitle} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 13 }}>🧠</span> Résumé client
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 11, lineHeight: 1.6, color: '#374151' }}>{clientSummary.summary}</p>
              {clientSummary.recurringTopics && clientSummary.recurringTopics.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {clientSummary.recurringTopics.slice(0, 3).map((tp, i) => (
                    <span key={i} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontSize: 10, fontWeight: 600 }}>{tp.topic}</span>
                  ))}
                </div>
              )}
              {clientSummary.keyFacts && clientSummary.keyFacts.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {clientSummary.keyFacts.slice(0, 3).map((f, i) => (
                    <span key={i} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontSize: 10, fontWeight: 600 }}>{f}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          {summaryLoading && (
            <div className={s.sideSection}>
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 8 }}>🧠 Chargement résumé...</div>
            </div>
          )}
        </div>
      </div>

{/* #2 — Undo delete toast */}
      {undoToast && (
        <div className={s.undoToast} role="alert">
          <span>Message supprimé</span>
          <button className={s.undoBtn} onClick={handleUndoDelete}>Annuler</button>
        </div>
      )}

      {/* #2 — Split ticket modal */}
      {splitModal && (
        <div className={s.splitOverlay} onClick={(e) => { if (e.target === e.currentTarget) { setSplitModal(null); setSplitSubject('') } }}>
          <div className={s.splitModal} role="dialog" aria-label="Extraire dans un nouveau ticket">
            <h3 className={s.splitTitle}>Extraire dans un nouveau ticket</h3>
            <div className={s.splitPreview}>{splitModal.preview}</div>
            <input
              className={s.splitInput}
              value={splitSubject}
              onChange={(e) => setSplitSubject(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSplitConfirm() }}
              placeholder="Sujet du nouveau ticket..."
              autoFocus
            />
            <div className={s.splitActions}>
              <button className={s.splitCancelBtn} onClick={() => { setSplitModal(null); setSplitSubject('') }}>Annuler</button>
              <button className={s.splitConfirmBtn} onClick={handleSplitConfirm} disabled={!splitSubject.trim()}>Créer le ticket</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
