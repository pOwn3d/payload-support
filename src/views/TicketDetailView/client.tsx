'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getFeatures } from '../shared/config'

interface Message {
  id: string | number; body: string; bodyHtml?: string; authorType: 'client' | 'admin' | 'email'
  isInternal?: boolean; isSolution?: boolean; createdAt: string; fromChat?: boolean
  attachments?: Array<{ file: { id: number; url?: string; filename?: string; mimeType?: string } | number }>
}
interface ClientInfo { id: number; company: string; firstName: string; lastName: string; email: string; phone?: string }
interface TimeEntry { id: string | number; duration: number; description?: string; date: string }
interface ActivityEntry { id: string | number; action: string; detail?: string; actorType?: string; createdAt: string }

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  open: { label: 'Ouvert', bg: '#dbeafe', color: '#1e40af' },
  waiting_client: { label: 'En attente', bg: '#fef3c7', color: '#92400e' },
  resolved: { label: 'Resolu', bg: '#dcfce7', color: '#166534' },
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

export const TicketDetailClient: React.FC = () => {
  const searchParams = useSearchParams()
  const ticketId = searchParams.get('id')
  const features = getFeatures()
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
  const [isInternal, setIsInternal] = useState(false)
  const [notifyClient, setNotifyClient] = useState(true)
  const [sending, setSending] = useState(false)

  const [showMenu, setShowMenu] = useState(false)
  const [clientTyping, setClientTyping] = useState(false)
  const [aiReplying, setAiReplying] = useState(false)
  const [aiRewriting, setAiRewriting] = useState(false)
  const [sentiment, setSentiment] = useState<{ emoji: string; label: string; color: string } | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
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

  // Undo toast state
  const [undoToast, setUndoToast] = useState<{ msgId: string | number; timer: ReturnType<typeof setTimeout> } | null>(null)

  // Split modal state
  const [splitModal, setSplitModal] = useState<{ messageId: string | number; preview: string } | null>(null)
  const [splitSubject, setSplitSubject] = useState('')

  // File upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [composerDragOver, setComposerDragOver] = useState(false)

  // Tags state
  const [tags, setTags] = useState<string[]>([])
  const [addingTag, setAddingTag] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')

  // ---- DATA FETCHING ----
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
        if (Array.isArray(d.tags)) setTags(d.tags.map((t: { tag?: string } | string) => typeof t === 'object' ? (t.tag || '') : t).filter(Boolean))
      }
      if (ter.ok) { const d = await ter.json(); setTimeEntries(d.docs || []) }
      if (ar.ok) { const d = await ar.json(); setActivityLog(d.docs || []) }
      if (cr.ok) { const d = await cr.json(); setCannedResponses(d.docs || []) }
    } catch { /* silent */ }
    setLoading(false)
  }, [ticketId])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    if (!ticketId || loading) return
    const iv = setInterval(async () => {
      try {
        const [mr, tr] = await Promise.all([
          fetch(`/api/ticket-messages?where[ticket][equals]=${ticketId}&sort=createdAt&limit=200&depth=1`, { credentials: 'include' }),
          fetch(`/api/tickets/${ticketId}?depth=0`, { credentials: 'include' }),
        ])
        if (mr.ok) { const d = await mr.json(); setMessages(d.docs || []) }
        if (tr.ok) { const d = await tr.json(); setTicket((p) => p ? { ...p, ...d } : d) }
      } catch { /* */ }
    }, 10000)
    return () => clearInterval(iv)
  }, [ticketId, loading])
  useEffect(() => {
    if (!ticketId) return
    fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ lastAdminReadAt: new Date().toISOString() }) }).catch(() => {})
  }, [ticketId, messages.length])
  useEffect(() => {
    if (!ticketId) return
    const iv = setInterval(async () => {
      try { const r = await fetch(`/api/support/typing?ticketId=${ticketId}`, { credentials: 'include' }); if (r.ok) { const d = await r.json(); setClientTyping(d.typing) } } catch {}
    }, 2000)
    return () => clearInterval(iv)
  }, [ticketId])
  useEffect(() => {
    if (!features.ai || messages.length === 0) return
    const last = [...messages].reverse().find((m) => m.authorType === 'client' || m.authorType === 'email')
    if (!last) return
    fetch('/api/support/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'sentiment', text: last.body.slice(0, 500) }) })
      .then((r) => r.json()).then((d) => {
        const raw = (d.sentiment || '').toLowerCase()
        const map: Record<string, { emoji: string; label: string; color: string }> = {
          'frustre': { emoji: ':(', label: 'Frustre', color: '#dc2626' },
          'mecontent': { emoji: ':(', label: 'Mecontent', color: '#ea580c' },
          'urgent': { emoji: '!', label: 'Urgent', color: '#dc2626' },
          'neutre': { emoji: '-', label: 'Neutre', color: '#6b7280' },
          'satisfait': { emoji: ':)', label: 'Satisfait', color: '#16a34a' },
        }
        const m = Object.keys(map).find((k) => raw.includes(k))
        setSentiment(m ? map[m] : { emoji: '-', label: 'Neutre', color: '#6b7280' })
      }).catch(() => {})
  }, [messages.length, features.ai]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])
  useEffect(() => {
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

  // Presence
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
      try {
        const r = await fetch(`/api/support/presence?ticketId=${ticketId}`, { credentials: 'include' })
        if (r.ok) { const d = await r.json(); setOtherViewers(d.viewers || []) }
      } catch { /* silent */ }
    }, 5_000)
    return () => clearInterval(poll)
  }, [ticketId])

  // Fetch macros
  useEffect(() => {
    fetch('/api/macros?where[isActive][equals]=true&depth=0&limit=50', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.docs) setMacros(d.docs.map((m: { id: number; name: string }) => ({ id: m.id, name: m.name }))) })
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        const sendBtn = document.querySelector('[data-action="send-reply"]') as HTMLButtonElement | null
        if (sendBtn && !sendBtn.disabled) sendBtn.click()
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setIsInternal((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setShowMenu(false)
        setSplitModal(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // ---- HANDLERS ----
  const handleSend = async () => {
    if (!replyBody.trim() || !ticketId) return
    setSending(true)
    try {
      // Upload pending files first
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
      const finalBody = uploadedLinks.length > 0 ? `${replyBody.trim()}\n\n${uploadedLinks.join('\n')}` : replyBody.trim()

      const res = await fetch('/api/ticket-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ticket: Number(ticketId), body: finalBody, authorType: 'admin', isInternal, skipNotification: isInternal || !notifyClient }) })
      if (res.ok) { setReplyBody(''); setIsInternal(false); setPendingFiles([]); fetchAll() }
    } catch {} finally { setSending(false) }
  }

  const handleStatusChange = async (v: string) => {
    if (!ticketId) return; setStatusUpdating(true)
    try { await fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ status: v }) }); fetchAll() } catch {} finally { setStatusUpdating(false) }
  }

  const handleFieldPatch = async (field: string, value: string) => {
    if (!ticketId) return
    try {
      await fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ [field]: value }) })
      fetchAll()
    } catch { /* silent */ }
  }

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
      if (r.ok) { const d = await r.json(); if (d.reply) { setReplyBody(d.reply) } }
    } catch {} finally { setAiReplying(false) }
  }

  const handleAiRewrite = async () => {
    if (!replyBody.trim()) return; setAiRewriting(true)
    try {
      const r = await fetch('/api/support/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'rewrite', text: replyBody }) })
      if (r.ok) { const d = await r.json(); if (d.rewritten) { setReplyBody(d.rewritten) } }
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

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    setPendingFiles((prev) => [...prev, ...Array.from(files)])
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setComposerDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

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

  // ---- RENDER ----
  if (!ticketId) return <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Selectionnez un ticket depuis la liste</div>
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Chargement...</div>
  if (!ticket) return <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Ticket introuvable</div>

  const st = STATUS[(ticket.status as string) || 'open'] || STATUS.open
  const totalMin = timeEntries.reduce((a, e) => a + (e.duration || 0), 0)
  const initials = client ? `${(client.firstName?.[0] || '').toUpperCase()}${(client.lastName?.[0] || '').toUpperCase()}` : '?'

  const S: Record<string, React.CSSProperties> = {
    page: { padding: '16px 20px', maxWidth: 1200, margin: '0 auto' },
    topBar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '8px 0', borderBottom: '1px solid var(--theme-elevation-200)' },
    backLink: { fontSize: 18, textDecoration: 'none', color: 'var(--theme-elevation-500)', padding: '4px 8px' },
    ticketNumber: { fontWeight: 700, fontSize: 14, color: 'var(--theme-elevation-400)' },
    ticketSubject: { fontWeight: 600, fontSize: 15, color: 'var(--theme-text)', flex: 1 },
    statusChip: { padding: '4px 10px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
    layout: { display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 },
    thread: { display: 'flex', flexDirection: 'column' as const, gap: 12, maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' as const, padding: '8px 0' },
    message: { display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--theme-elevation-150)', position: 'relative' as const },
    avatar: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 },
    messageBody: { fontSize: 14, lineHeight: 1.6, color: 'var(--theme-text)', whiteSpace: 'pre-wrap' as const },
    composer: { marginTop: 12, border: '1px solid var(--theme-elevation-200)', borderRadius: 10, padding: 12 },
    composerInternal: { borderColor: '#fbbf24', background: '#fefce8' },
    textarea: { width: '100%', minHeight: 100, padding: 10, border: 'none', outline: 'none', resize: 'vertical' as const, fontSize: 14, fontFamily: 'inherit', background: 'transparent', color: 'var(--theme-text)' },
    composerFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    sendBtn: { padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
    sidebar: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
    sideSection: { padding: '12px 14px', borderRadius: 10, border: '1px solid var(--theme-elevation-150)', fontSize: 13 },
    sideSectionTitle: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, color: 'var(--theme-elevation-500)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    sideField: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' },
    sideLabel: { fontSize: 12, color: 'var(--theme-elevation-500)' },
    sideSelect: { padding: '2px 6px', borderRadius: 4, border: '1px solid var(--theme-elevation-200)', fontSize: 12, background: 'var(--theme-elevation-0)', color: 'var(--theme-text)' },
    sideValue: { fontSize: 12, fontWeight: 500, color: 'var(--theme-text)' },
    badge: { padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600 },
    tagChip: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: 'var(--theme-elevation-100)', fontSize: 11, fontWeight: 500 },
    tagRemove: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--theme-elevation-400)', padding: 0 },
    tagInput: { padding: '2px 6px', borderRadius: 4, border: '1px solid var(--theme-elevation-200)', fontSize: 11, width: 80 },
    tagAddBtn: { padding: '2px 8px', borderRadius: 4, border: '1px dashed var(--theme-elevation-300)', background: 'none', fontSize: 11, cursor: 'pointer', color: 'var(--theme-elevation-400)' },
    toolbarBtn: { padding: '4px 10px', borderRadius: 4, border: '1px solid var(--theme-elevation-200)', background: 'var(--theme-elevation-0)', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--theme-text)' },
    dateSeparator: { textAlign: 'center' as const, padding: '8px 0', fontSize: 11, color: 'var(--theme-elevation-400)' },
  }

  return (
    <div style={S.page}>
      {/* TOP BAR */}
      <div style={S.topBar}>
        <Link href="/admin/support/inbox" style={S.backLink} aria-label="Retour">&larr;</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={S.ticketNumber}>{ticket.ticketNumber as string}</span>
          <span style={S.ticketSubject}>{ticket.subject as string}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={{ ...S.statusChip, background: st.bg, color: st.color }} value={(ticket.status as string) || 'open'} onChange={(e) => handleStatusChange(e.target.value)} disabled={statusUpdating}>
            <option value="open">Ouvert</option>
            <option value="waiting_client">En attente</option>
            <option value="resolved">Resolu</option>
          </select>
          {sentiment && features.ai && (
            <span style={{ ...S.badge, background: `${sentiment.color}12`, color: sentiment.color }}>
              {sentiment.emoji} {sentiment.label}
            </span>
          )}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--theme-elevation-500)' }}>&middot;&middot;&middot;</button>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-200)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 160 }}>
                <button style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--theme-text)' }} onClick={() => { navigator.clipboard.writeText(window.location.href); setShowMenu(false) }}>Copier le lien</button>
                <Link href={`/admin/collections/tickets/${ticketId}`} style={{ display: 'block', padding: '8px 14px', fontSize: 13, color: 'var(--theme-text)', textDecoration: 'none' }} onClick={() => setShowMenu(false)}>Vue Payload</Link>
                <a href={`/support/tickets/${ticketId}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '8px 14px', fontSize: 13, color: 'var(--theme-text)', textDecoration: 'none' }} onClick={() => setShowMenu(false)}>Vue client</a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRESENCE BANNER */}
      {otherViewers.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', marginBottom: 12, borderRadius: 8, background: '#fef3c7', border: '1px solid #fde68a', fontSize: 13, fontWeight: 500, color: '#92400e' }}>
          {otherViewers.map((v) => v.name).join(', ')} {otherViewers.length === 1 ? 'est aussi en train de voir ce ticket' : 'sont aussi en train de voir ce ticket'}
        </div>
      )}

      {/* LAYOUT */}
      <div style={S.layout}>
        {/* LEFT: Conversation */}
        <div>
          <div style={S.thread}>
            {messages.map((msg, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null
              const showDate = msg.createdAt && (!prev?.createdAt || new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString())
              const isAdmin = msg.authorType === 'admin'
              const isPendingDelete = undoToast?.msgId === msg.id

              return (
                <React.Fragment key={msg.id}>
                  {showDate && <div style={S.dateSeparator}><span>{dateLabel(msg.createdAt)}</span></div>}
                  <div style={{ ...S.message, ...(msg.isInternal ? { borderColor: '#fbbf24', background: '#fefce8' } : {}), ...(isPendingDelete ? { opacity: 0.3, pointerEvents: 'none' as const } : {}) }}>
                    <div style={{ ...S.avatar, backgroundColor: isAdmin ? '#2563eb' : msg.authorType === 'email' ? '#ea580c' : '#7c3aed' }}>
                      {isAdmin ? 'CW' : initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{isAdmin ? 'Support' : msg.authorType === 'email' ? 'Email' : client?.firstName || 'Client'}</span>
                        <span style={{ fontSize: 11, color: 'var(--theme-elevation-400)' }}>{timeAgo(msg.createdAt)}</span>
                        {msg.isInternal && <span style={{ ...S.badge, background: '#fef3c7', color: '#92400e' }}>Interne</span>}
                        {msg.isSolution && <span style={{ ...S.badge, background: '#dcfce7', color: '#166534' }}>Solution</span>}
                      </div>
                      {msg.bodyHtml ? (
                        <div style={S.messageBody} dangerouslySetInnerHTML={{ __html: msg.bodyHtml }} />
                      ) : (
                        <div style={S.messageBody}>{msg.body}</div>
                      )}
                      {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          {msg.attachments.map((att, i) => {
                            const file = typeof att.file === 'object' ? att.file : null
                            if (!file) return null
                            return (file.mimeType || '').startsWith('image/')
                              ? <a key={i} href={file.url || '#'} target="_blank" rel="noopener noreferrer"><img src={file.url || ''} alt="" style={{ maxWidth: 200, maxHeight: 120, borderRadius: 6 }} /></a>
                              : <a key={i} href={file.url || '#'} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#2563eb' }}>PJ {file.filename || 'Fichier'}</a>
                          })}
                        </div>
                      )}
                    </div>
                    {/* Hover actions */}
                    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, opacity: 0.6 }}>
                      <button style={{ ...S.toolbarBtn, color: '#dc2626', fontSize: 11 }} onClick={() => handleDeleteMessage(msg.id)}>Supprimer</button>
                      {features.splitTicket && !msg.isInternal && <button style={{ ...S.toolbarBtn, fontSize: 11 }} onClick={() => { setSplitModal({ messageId: msg.id, preview: msg.body.slice(0, 200) }); setSplitSubject(`Split: ${ticket.subject}`) }}>Extraire</button>}
                      {isAdmin && !msg.isInternal && <button style={{ ...S.toolbarBtn, fontSize: 11 }} onClick={() => fetch('/api/support/resend-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ messageId: msg.id }) })}>Renvoyer</button>}
                    </div>
                  </div>
                </React.Fragment>
              )
            })}
            <div ref={threadEndRef} />
          </div>

          {clientTyping && (
            <div style={{ padding: '8px 14px', fontSize: 13, color: 'var(--theme-elevation-400)' }}>
              {client?.firstName || 'Client'} est en train d&apos;ecrire...
            </div>
          )}

          {/* COMPOSER */}
          <div
            style={{ ...S.composer, ...(isInternal ? S.composerInternal : {}), ...(composerDragOver ? { borderColor: '#2563eb', background: '#eff6ff' } : {}) }}
            onDragOver={(e) => { e.preventDefault(); setComposerDragOver(true) }}
            onDragLeave={() => setComposerDragOver(false)}
            onDrop={handleFileDrop}
          >
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {features.ai && (
                <>
                  <button style={S.toolbarBtn} onClick={handleAiSuggest} disabled={aiReplying || messages.length === 0}>{aiReplying ? '...' : 'IA Suggestion'}</button>
                  <button style={S.toolbarBtn} onClick={handleAiRewrite} disabled={aiRewriting || !replyBody.trim()}>{aiRewriting ? '...' : 'Reformuler'}</button>
                </>
              )}
              <button style={S.toolbarBtn} onClick={() => fileInputRef.current?.click()}>Fichier</button>
              <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => handleFileSelect(e.target.files)} />
              {macros.length > 0 && (
                <select
                  style={{ ...S.sideSelect, marginLeft: 0 }}
                  onChange={(e) => { const id = Number(e.target.value); if (id) handleApplyMacro(id); e.target.value = '' }}
                  disabled={applyingMacro}
                >
                  <option value="">{applyingMacro ? 'Application...' : 'Macros'}</option>
                  {macros.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
              {features.canned && cannedResponses.length > 0 && (
                <select style={S.sideSelect} onChange={(e) => {
                  const cr = cannedResponses.find((c) => String(c.id) === e.target.value)
                  if (cr) { let b = cr.body; if (client) { b = b.replace(/\{\{client\.firstName\}\}/g, client.firstName).replace(/\{\{client\.company\}\}/g, client.company) }; setReplyBody(b) }
                  e.target.value = ''
                }}>
                  <option value="">Reponses types</option>
                  {cannedResponses.map((cr) => <option key={cr.id} value={String(cr.id)}>{cr.title}</option>)}
                </select>
              )}
            </div>
            <textarea
              style={S.textarea}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder={isInternal ? 'Note interne...' : `Repondre a ${client?.firstName || 'client'}...`}
            />
            {pendingFiles.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {pendingFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: 'var(--theme-elevation-100)', fontSize: 11 }}>
                    <span>PJ {f.name}</span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--theme-elevation-400)' }} onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}>&times;</button>
                  </div>
                ))}
              </div>
            )}
            <div style={S.composerFooter}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
                <label><input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} /> Note interne</label>
                <label><input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} disabled={isInternal} /> Notifier</label>
              </div>
              <button style={{ ...S.sendBtn, ...(isInternal ? { background: '#d97706' } : {}) }} onClick={handleSend} disabled={sending || !replyBody.trim()} data-action="send-reply">
                {sending ? 'Envoi...' : isInternal ? 'Ajouter note' : 'Envoyer ->'}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div style={S.sidebar}>
          {client && (
            <div style={S.sideSection}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ ...S.avatar, backgroundColor: '#7c3aed', width: 36, height: 36 }}>{initials}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{client.firstName} {client.lastName}</div>
                  <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{client.company}</div>
                  <a href={`mailto:${client.email}`} style={{ fontSize: 11, color: '#2563eb' }}>{client.email}</a>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Link href={`/admin/collections/support-clients/${client.id}`} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--theme-elevation-200)', fontSize: 11, textDecoration: 'none', color: 'var(--theme-text)' }}>Fiche</Link>
                <button style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--theme-elevation-200)', fontSize: 11, background: 'none', cursor: 'pointer', color: 'var(--theme-text)' }} onClick={() => window.open(`/api/admin/impersonate?clientId=${client.id}`, '_blank')}>Portail</button>
              </div>
            </div>
          )}

          {/* Editable sidebar fields */}
          <div style={S.sideSection}>
            <div style={S.sideSectionTitle}>Details</div>
            <div style={S.sideField}>
              <span style={S.sideLabel}>Priorite</span>
              <select style={S.sideSelect} value={(ticket.priority as string) || 'normal'} onChange={(e) => handleFieldPatch('priority', e.target.value)}>
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div style={S.sideField}>
              <span style={S.sideLabel}>Categorie</span>
              <select style={S.sideSelect} value={(ticket.category as string) || ''} onChange={(e) => handleFieldPatch('category', e.target.value)}>
                <option value="">--</option>
                <option value="bug">Bug</option>
                <option value="content">Contenu</option>
                <option value="feature">Fonctionnalite</option>
                <option value="question">Question</option>
                <option value="hosting">Hebergement</option>
              </select>
            </div>
            <div style={S.sideField}><span style={S.sideLabel}>Source</span><span style={S.sideValue}>{(ticket.source as string) || 'Portail'}</span></div>
            <div style={S.sideField}><span style={S.sideLabel}>Assigne</span><span style={S.sideValue}>{typeof ticket.assignedTo === 'object' && ticket.assignedTo ? (ticket.assignedTo as { firstName?: string }).firstName || 'Admin' : '--'}</span></div>
          </div>

          {/* Tags */}
          <div style={S.sideSection}>
            <div style={S.sideSectionTitle}>Tags</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tags.map((tag) => (
                <span key={tag} style={S.tagChip}>
                  {tag}
                  <button style={S.tagRemove} onClick={() => handleRemoveTag(tag)}>&times;</button>
                </span>
              ))}
              {addingTag ? (
                <input
                  style={S.tagInput}
                  value={newTagValue}
                  onChange={(e) => setNewTagValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') { setAddingTag(false); setNewTagValue('') } }}
                  onBlur={handleAddTag}
                  placeholder="Tag..."
                  autoFocus
                />
              ) : (
                <button style={S.tagAddBtn} onClick={() => setAddingTag(true)}>+ Tag</button>
              )}
            </div>
          </div>

          {features.timeTracking && (
            <div style={S.sideSection}>
              <div style={S.sideSectionTitle}>Temps <span style={{ fontWeight: 700, fontSize: 13, color: '#d97706' }}>{totalMin > 0 ? `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')} total` : '0min'}</span></div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: timerRunning ? '#dc2626' : 'var(--theme-text)' }}>
                  {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
                </span>
                {!timerRunning ? (
                  <button style={{ ...S.toolbarBtn, color: '#dc2626', borderColor: '#dc2626' }} onClick={() => setTimerRunning(true)}>{timerSeconds > 0 ? 'Play' : 'Go'}</button>
                ) : (
                  <button style={S.toolbarBtn} onClick={() => setTimerRunning(false)}>Pause</button>
                )}
                {timerSeconds >= 60 && !timerRunning && (
                  <button style={{ ...S.toolbarBtn, color: '#16a34a', borderColor: '#16a34a' }} onClick={() => { handleTimerSave(); localStorage.removeItem(`timer-sec-${ticketId}`); localStorage.removeItem(`timer-run-${ticketId}`) }}>Save {Math.round(timerSeconds / 60)}m</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                <input type="number" min="1" placeholder="min" style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 12, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' }} id="manual-time-input" />
                <button style={{ ...S.toolbarBtn, fontSize: 11 }} onClick={async () => {
                  const input = document.getElementById('manual-time-input') as HTMLInputElement
                  const mins = Number(input?.value)
                  if (!mins || mins < 1 || !ticketId) return
                  try {
                    await fetch('/api/time-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ticket: Number(ticketId), duration: mins, date: new Date().toISOString(), description: 'Saisie manuelle' }) })
                    if (input) input.value = ''
                    fetchAll()
                  } catch {}
                }}>+ Ajouter</button>
              </div>
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
            <div style={S.sideSection}>
              <div style={S.sideSectionTitle}>
                <button onClick={() => setShowActivity(!showActivity)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, color: 'var(--theme-elevation-500)' }}>
                  Activite {showActivity ? '&#9662;' : '&#9656;'}
                </button>
              </div>
              {showActivity && activityLog.slice(0, 8).map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 4, flexShrink: 0, backgroundColor: a.actorType === 'admin' ? '#2563eb' : a.actorType === 'system' ? '#6b7280' : '#16a34a' }} />
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--theme-text)' }}>{(a.detail || a.action).slice(0, 60)}</div>
                    <div style={{ fontSize: 11, color: 'var(--theme-elevation-400)' }}>{timeAgo(a.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Undo delete toast */}
      {undoToast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: 8, background: '#1e293b', color: '#fff', fontSize: 13, display: 'flex', gap: 12, alignItems: 'center', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} role="alert">
          <span>Message supprime</span>
          <button onClick={handleUndoDelete} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, padding: '4px 10px', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Annuler</button>
        </div>
      )}

      {/* Split ticket modal */}
      {splitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={(e) => { if (e.target === e.currentTarget) { setSplitModal(null); setSplitSubject('') } }}>
          <div style={{ background: 'var(--theme-elevation-0)', borderRadius: 12, padding: 24, maxWidth: 480, width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }} role="dialog">
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Extraire dans un nouveau ticket</h3>
            <div style={{ padding: 10, background: 'var(--theme-elevation-50)', borderRadius: 6, fontSize: 13, color: 'var(--theme-elevation-500)', marginBottom: 12 }}>{splitModal.preview}</div>
            <input
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 13, marginBottom: 12, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' }}
              value={splitSubject}
              onChange={(e) => setSplitSubject(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSplitConfirm() }}
              placeholder="Sujet du nouveau ticket..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--theme-text)' }} onClick={() => { setSplitModal(null); setSplitSubject('') }}>Annuler</button>
              <button style={{ ...S.sendBtn }} onClick={handleSplitConfirm} disabled={!splitSubject.trim()}>Creer le ticket</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
