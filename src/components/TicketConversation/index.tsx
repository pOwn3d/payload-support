'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import type { Message, TimeEntry, ClientInfo, CannedResponse, ActivityEntry, SatisfactionSurvey } from './types'
import type { RichTextEditorHandle } from './context'
import { C, s } from './constants'
import { getDateLabel, formatMessageDate } from './utils'
import { CodeBlockRenderer, CodeBlockRendererHtml } from './components/CodeBlock'
import { CodeBlockInserter } from './components/CodeBlockInserter'
import { TicketHeader } from './components/TicketHeader'
import { ClientBar } from './components/ClientBar'
import { QuickActions } from './components/QuickActions'
import { AISummaryPanel } from './components/AISummaryPanel'
import { MergePanel, ExtMessagePanel, SnoozePanel } from './components/ActionPanels'
import { ActivityLog } from './components/ActivityLog'
import { ClientHistory } from './components/ClientHistory'
import { TimeTrackingPanel } from './components/TimeTrackingPanel'
import { useTimeTracking } from './hooks/useTimeTracking'
import { useMessageActions } from './hooks/useMessageActions'
import { useTicketActions } from './hooks/useTicketActions'
import { useReply } from './hooks/useReply'
import { useAI } from './hooks/useAI'
import { getFeatures, type TicketingFeatures } from './config'

// Inline skeleton replacement (no external dependency)
function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '14px',
            borderRadius: '4px',
            backgroundColor: '#e2e8f0',
            width: i === lines - 1 ? '60%' : '100%',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  )
}

// Inline layout styles (replacing Layout.module.scss)
const layoutStyles = {
  root: { padding: '12px 0' } as React.CSSProperties,
  twoColumns: {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: '16px',
    alignItems: 'start',
  } as React.CSSProperties,
  mainColumn: { minWidth: 0 } as React.CSSProperties,
  sideColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    position: 'sticky' as const,
    top: '80px',
  } as React.CSSProperties,
}

const TicketConversation: React.FC = () => {
  const { id } = useDocumentInfo()
  const [features] = useState<TicketingFeatures>(() => getFeatures())
  const [messages, setMessages] = useState<Message[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([])
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [satisfaction, setSatisfaction] = useState<SatisfactionSurvey | null>(null)
  const [loading, setLoading] = useState(true)
  const [messagesCollapsed, setMessagesCollapsed] = useState(true)
  // Search
  const [searchQuery, setSearchQuery] = useState('')
  // Copy link feedback
  const [copiedLink, setCopiedLink] = useState<'admin' | 'client' | null>(null)
  // Notification sound: track previous message count
  const prevMessageCountRef = useRef<number>(0)
  // Typing indicator
  const [clientTyping, setClientTyping] = useState(false)
  const [clientTypingName, setClientTypingName] = useState('')
  const typingLastSent = useRef(0)
  // Current ticket status + number + source
  const [currentStatus, setCurrentStatus] = useState<string>('')
  const [ticketNumber, setTicketNumber] = useState<string>('')
  const [ticketSubject, setTicketSubject] = useState<string>('')
  const [ticketSource, setTicketSource] = useState<string>('')
  const [chatSession, setChatSession] = useState<string>('')
  // Client history
  const [clientTickets, setClientTickets] = useState<Array<{ id: number; ticketNumber: string; subject: string; status: string; createdAt: string }>>([])
  const [clientProjects, setClientProjects] = useState<Array<{ id: number; name: string; status: string }>>([])
  const [clientNotes, setClientNotes] = useState<string>('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [lastClientReadAt, setLastClientReadAt] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!id) return
    try {
      const [msgRes, timeRes, ticketRes, cannedRes, activityRes, csatRes] = await Promise.all([
        fetch(`/api/ticket-messages?where[ticket][equals]=${id}&sort=createdAt&limit=200&depth=1`, { credentials: 'include' }),
        fetch(`/api/time-entries?where[ticket][equals]=${id}&sort=-date&limit=50&depth=0`, { credentials: 'include' }),
        fetch(`/api/tickets/${id}?depth=1`, { credentials: 'include' }),
        fetch(`/api/canned-responses?sort=sortOrder&limit=50&depth=0`, { credentials: 'include' }),
        fetch(`/api/ticket-activity-log?where[ticket][equals]=${id}&sort=-createdAt&limit=50&depth=0`, { credentials: 'include' }),
        fetch(`/api/satisfaction-surveys?where[ticket][equals]=${id}&limit=1&depth=0`, { credentials: 'include' }),
      ])

      if (msgRes.ok) {
        const d = await msgRes.json()
        setMessages(d.docs || [])
      }
      if (timeRes.ok) {
        const d = await timeRes.json()
        setTimeEntries(d.docs || [])
      }
      let resolvedChatSession = ''
      if (ticketRes.ok) {
        const d = await ticketRes.json()
        if (d.client && typeof d.client === 'object') {
          setClient(d.client)
        }
        setSnoozeUntil(d.snoozeUntil || null)
        setLastClientReadAt(d.lastClientReadAt || null)
        setCurrentStatus(d.status || '')
        setTicketNumber(d.ticketNumber || '')
        setTicketSubject(d.subject || '')
        setTicketSource(d.source || '')
        setChatSession(d.chatSession || '')
        resolvedChatSession = d.chatSession || ''

        // Fetch client history (tickets + projects + notes)
        const clientId = typeof d.client === 'object' ? d.client?.id : d.client
        if (clientId) {
          const [clientTicketsRes, projectsRes, clientDetailRes] = await Promise.all([
            fetch(`/api/tickets?where[client][equals]=${clientId}&where[id][not_equals]=${id}&sort=-createdAt&limit=5&depth=0`, { credentials: 'include' }),
            fetch(`/api/projects?where[client][contains]=${clientId}&depth=0`, { credentials: 'include' }),
            fetch(`/api/support-clients/${clientId}?depth=0`, { credentials: 'include' }),
          ])
          if (clientTicketsRes.ok) {
            const ctData = await clientTicketsRes.json()
            setClientTickets((ctData.docs || []).map((t: { id: number; ticketNumber: string; subject: string; status: string; createdAt: string }) => ({
              id: t.id, ticketNumber: t.ticketNumber, subject: t.subject, status: t.status, createdAt: t.createdAt,
            })))
          }
          if (projectsRes.ok) {
            const pData = await projectsRes.json()
            setClientProjects((pData.docs || []).map((p: { id: number; name: string; status: string }) => ({
              id: p.id, name: p.name, status: p.status,
            })))
          }
          if (clientDetailRes.ok) {
            const cdData = await clientDetailRes.json()
            setClientNotes(cdData.notes || '')
          }
        }
      }
      if (cannedRes.ok) {
        const d = await cannedRes.json()
        setCannedResponses(d.docs || [])
      }
      if (activityRes.ok) {
        const d = await activityRes.json()
        setActivityLog(d.docs || [])
      }
      if (csatRes.ok) {
        const d = await csatRes.json()
        setSatisfaction(d.docs?.[0] || null)
      }

      // Fetch chat messages if this ticket is linked to a chat session
      if (resolvedChatSession) {
        try {
          const chatRes = await fetch(`/api/support/admin-chat?session=${encodeURIComponent(resolvedChatSession)}`, { credentials: 'include' })
          if (chatRes.ok) {
            const chatData = await chatRes.json()
            const chatMsgs: Message[] = (chatData.messages || [])
              .filter((cm: { senderType: string }) => cm.senderType !== 'system')
              .map((cm: { id: string | number; message: string; senderType: string; createdAt: string }) => ({
                id: `chat-${cm.id}`,
                body: cm.message,
                authorType: cm.senderType === 'agent' ? 'admin' as const : 'client' as const,
                isInternal: false,
                createdAt: cm.createdAt,
                fromChat: true,
              }))

            // Merge with ticket messages, deduplicate by matching body+time
            setMessages((prev) => {
              const ticketMsgs = prev
              const merged = [...ticketMsgs]

              for (const chatMsg of chatMsgs) {
                // Skip if a ticket-message with same body exists within 5 seconds
                const isDuplicate = ticketMsgs.some((tm) => {
                  if (tm.body !== chatMsg.body) return false
                  const timeDiff = Math.abs(new Date(tm.createdAt).getTime() - new Date(chatMsg.createdAt).getTime())
                  return timeDiff < 5000
                })
                if (!isDuplicate) {
                  merged.push(chatMsg)
                }
              }

              return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            })
          }
        } catch (err) {
          console.warn('[TicketConversation] Chat fetch error:', err)
        }
      }
    } catch (err) { console.warn('[TicketConversation] Fetch error:', err) } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Mark ticket as read by admin
  useEffect(() => {
    if (!id) return
    fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ lastAdminReadAt: new Date().toISOString() }),
    }).catch(() => {})
  }, [id, messages.length]) // re-mark on new messages

  // Typing indicator: poll for client typing (circuit breaker after 3 fails)
  const typingFailCount = useRef(0)
  useEffect(() => {
    if (!id) return
    typingFailCount.current = 0
    const poll = async () => {
      if (typingFailCount.current >= 3) return
      try {
        const res = await fetch(`/api/support/typing?ticketId=${id}`, { credentials: 'include' })
        if (res.ok) { typingFailCount.current = 0; const data = await res.json(); setClientTyping(data.typing); setClientTypingName(data.name || '') }
        else { typingFailCount.current++ }
      } catch { typingFailCount.current++ }
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [id])

  // Send admin typing signal (called from reply editor onChange)
  const sendAdminTyping = useCallback(() => {
    if (!id) return
    const now = Date.now()
    if (now - typingLastSent.current < 3000) return
    typingLastSent.current = now
    fetch('/api/support/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ticketId: id }),
    }).catch(() => {})
  }, [id])

  // Time tracking
  const tt = useTimeTracking(id, fetchAll)
  const { duration, setDuration, timeDescription, setTimeDescription, addingTime, timeSuccess, timerRunning, timerSeconds, setTimerSeconds, timerDescription, setTimerDescription, handleAddTime, handleTimerStart, handleTimerStop, handleTimerSave, handleTimerDiscard } = tt

  // Message actions (edit, delete, resend, toggle author, split)
  const ma = useMessageActions(id, client, fetchAll)
  const { togglingAuthor, editingMsg, editBody, editHtml, setEditHtml, savingEdit, handleEditStart, handleEditSave, handleEditCancel, deletingMsg, handleDelete, resendingMsg, resendSuccess, handleResend, handleToggleAuthor, handleSplitMessage, setEditBody } = ma

  // Ticket actions (status, merge, snooze, ext msg, next ticket)
  const ta = useTicketActions(id, fetchAll)
  const { statusUpdating, handleStatusChange, showMerge, setShowMerge, mergeTarget, setMergeTarget, mergeTargetInfo, setMergeTargetInfo, mergeError, setMergeError, merging, handleMergeLookup, handleMerge, showExtMsg, setShowExtMsg, extMsgBody, setExtMsgBody, extMsgAuthor, setExtMsgAuthor, extMsgDate, setExtMsgDate, extMsgFiles, setExtMsgFiles, sendingExtMsg, handleExtFileChange, handleSendExtMsg, showSnooze, setShowSnooze, snoozeUntil, setSnoozeUntil, snoozeSaving, handleSnooze, showNextTicket, setShowNextTicket, nextTicketId, nextTicketInfo, handleNextTicket } = ta

  // Reply composer
  const replyEditorRef = useRef<RichTextEditorHandle>(null)
  const rp = useReply(id, client, cannedResponses, ticketNumber, ticketSubject, fetchAll, handleNextTicket, replyEditorRef)
  const { fileInputRef, replyBody, setReplyBody, replyHtml, setReplyHtml, replyFiles, setReplyFiles, isInternal, setIsInternal, notifyClient, setNotifyClient, sendAsClient, setSendAsClient, sending, showSchedule, setShowSchedule, scheduleDate, setScheduleDate, handleEditorFileUpload, handleCannedSelect, handleReplyFileChange, handleSendReply, handleScheduleReply } = rp

  // AI features (needs replyBody/setReplyBody from useReply)
  const ai = useAI(messages, client, ticketSubject, replyBody, setReplyBody, setReplyHtml, replyEditorRef)
  const { clientSentiment, aiReplying, handleAiSuggestReply, aiRewriting, handleAiRewrite, showAiSummary, setShowAiSummary, aiSummary, aiGenerating, handleAiGenerate, aiSaving, aiSaved, handleAiSave: aiSaveRaw } = ai
  const handleAiSave = () => aiSaveRaw(id, fetchAll)

  // Auto-refresh: poll for new messages, status changes and activity every 15s
  const [pollExpired, setPollExpired] = useState(false)
  useEffect(() => {
    if (!id || loading || pollExpired) return

    const poll = async () => {
      try {
        const [msgRes, ticketRes, activityRes] = await Promise.all([
          fetch(`/api/ticket-messages?where[ticket][equals]=${id}&sort=createdAt&limit=200&depth=1`, { credentials: 'include' }),
          fetch(`/api/tickets/${id}?depth=0`, { credentials: 'include' }),
          fetch(`/api/ticket-activity-log?where[ticket][equals]=${id}&sort=-createdAt&limit=50&depth=0`, { credentials: 'include' }),
        ])

        if (msgRes.status === 401 || msgRes.status === 403) { setPollExpired(true); return }

        if (msgRes.ok) {
          const d = await msgRes.json()
          setMessages(d.docs || [])
        }
        if (ticketRes.ok) {
          const d = await ticketRes.json()
          setCurrentStatus(d.status || '')
          setSnoozeUntil(d.snoozeUntil || null)
          setLastClientReadAt(d.lastClientReadAt || null)
        }
        if (activityRes.ok) {
          const d = await activityRes.json()
          setActivityLog(d.docs || [])
        }
      } catch { /* silent fail for poll */ }
    }

    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [id, loading, pollExpired])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter -> send reply
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const sendBtn = document.querySelector('[data-action="send-reply"]') as HTMLButtonElement
        if (sendBtn && !sendBtn.disabled) sendBtn.click()
      }
      // Ctrl/Cmd + Shift + N -> toggle internal note
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        e.preventDefault()
        setIsInternal(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])




  // Notification sound for new client messages
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 800
      osc.type = 'sine'
      gain.gain.value = 0.1
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.stop(ctx.currentTime + 0.3)
    } catch { /* silent */ }
  }, [])

  // Detect new client messages and play sound
  useEffect(() => {
    const currentCount = messages.length
    if (prevMessageCountRef.current > 0 && currentCount > prevMessageCountRef.current) {
      // Check if the newest message is from a client
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.authorType !== 'admin') {
        playNotificationSound()
      }
    }
    prevMessageCountRef.current = currentCount
  }, [messages, playNotificationSound])

  // AI Suggest/Rewrite handlers moved to useAI hook

  // Copy link handler
  const handleCopyLink = (type: 'admin' | 'client') => {
    const url = type === 'admin'
      ? `${window.location.origin}/admin/collections/tickets/${id}`
      : `${window.location.origin}/support/tickets/${id}`
    navigator.clipboard.writeText(url)
    setCopiedLink(type)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  if (!id) {
    return (
      <div style={{ padding: '16px', color: '#666', fontStyle: 'italic' }}>
        Enregistrez le ticket pour voir le tableau de bord.
      </div>
    )
  }

  const totalMinutes = timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0)

  // Contextual status transitions
  const statusTransitions: Array<{ status: string; label: string; color: string }> = (() => {
    switch (currentStatus) {
      case 'open':
        return [
          { status: 'waiting_client', label: 'Attente client', color: C.statusWaiting },
          { status: 'resolved', label: 'Résolu', color: C.statusResolved },
        ]
      case 'waiting_client':
        return [
          { status: 'open', label: 'Ouvrir', color: C.statusOpen },
          { status: 'resolved', label: 'Résolu', color: C.statusResolved },
        ]
      case 'resolved':
        return [
          { status: 'open', label: 'Rouvrir', color: C.statusOpen },
        ]
      default:
        return [
          { status: 'open', label: 'Ouvrir', color: C.statusOpen },
          { status: 'waiting_client', label: 'Attente client', color: C.statusWaiting },
          { status: 'resolved', label: 'Résolu', color: C.statusResolved },
        ]
    }
  })()

  return (
    <div style={layoutStyles.root}>
      {/* ===== 1. COMPACT HEADER ===== */}
      <TicketHeader
        ticketNumber={ticketNumber}
        currentStatus={currentStatus}
        clientSentiment={clientSentiment}
        ticketSource={ticketSource}
        chatSession={chatSession}
        snoozeUntil={snoozeUntil}
        satisfaction={satisfaction}
        copiedLink={copiedLink}
        onCopyLink={handleCopyLink}
      />

      {/* ===== 2. CLIENT COMPACT ===== */}
      {client && <ClientBar client={client} />}


      <div style={layoutStyles.twoColumns}>
        <div style={layoutStyles.mainColumn}>
{/* ===== 3. CONVERSATION THREAD ===== */}
      <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          Conversation <span style={s.badge('#f1f5f9', '#475569')}>{messages.length}</span>
        </h3>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            style={{ ...s.input, width: '100%', fontSize: '12px', padding: '6px 10px' }}
          />
        </div>
      </div>

      {loading ? (
        <SkeletonText lines={4} />
      ) : messages.length === 0 ? (
        <p style={{ color: '#999', fontStyle: 'italic', padding: '12px 0' }}>Aucun message.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', paddingRight: '4px' }}>
          {(() => {
            const filtered = messages.filter((msg) => !searchQuery.trim() || msg.body.toLowerCase().includes(searchQuery.toLowerCase()))
            const isSearching = searchQuery.trim().length > 0
            const VISIBLE_COUNT = 3
            const showCollapse = !isSearching && messagesCollapsed && filtered.length > VISIBLE_COUNT
            const visibleMessages = showCollapse ? filtered.slice(-VISIBLE_COUNT) : filtered
            const hiddenCount = filtered.length - VISIBLE_COUNT

            return (
              <>
                {showCollapse && hiddenCount > 0 && (
                  <button
                    onClick={() => setMessagesCollapsed(false)}
                    style={{
                      background: 'none', border: `1px dashed ${C.border}`, borderRadius: '6px',
                      padding: '8px', cursor: 'pointer', color: C.textMuted, fontSize: '12px',
                      fontWeight: 600, textAlign: 'center',
                    }}
                  >
                    Voir les {hiddenCount} message{hiddenCount > 1 ? 's' : ''} précédent{hiddenCount > 1 ? 's' : ''}
                  </button>
                )}
                {!messagesCollapsed && filtered.length > 1 && !isSearching && (
                  <button
                    onClick={() => setMessagesCollapsed(true)}
                    style={{
                      background: 'none', border: `1px dashed ${C.border}`, borderRadius: '6px',
                      padding: '8px', cursor: 'pointer', color: C.textMuted, fontSize: '12px',
                      fontWeight: 600, textAlign: 'center',
                    }}
                  >
                    Masquer les anciens messages
                  </button>
                )}
                {visibleMessages.map((msg, msgIdx) => {
                  const borderColor = msg.isInternal ? C.internalBorder : msg.fromChat ? '#bae6fd' : msg.authorType === 'admin' ? '#bfdbfe' : msg.authorType === 'email' ? '#fed7aa' : C.clientBorder
                  const bgColor = msg.isInternal ? C.internalBg : msg.fromChat ? '#f0f9ff' : msg.authorType === 'admin' ? C.adminBg : msg.authorType === 'email' ? C.emailBg : C.clientBg
                  const prevVisMsg = msgIdx > 0 ? visibleMessages[msgIdx - 1] : null
                  const showDateSep = msg.createdAt && (!prevVisMsg?.createdAt || new Date(msg.createdAt).toDateString() !== new Date(prevVisMsg.createdAt).toDateString())
                  return (
                    <React.Fragment key={msg.id}>
                      {showDateSep && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                          <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
                          <span style={{ fontSize: '11px', fontWeight: 600, color: C.textMuted, whiteSpace: 'nowrap' }}>{getDateLabel(msg.createdAt)}</span>
                          <div style={{ flex: 1, borderTop: `1px solid ${C.border}` }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        {/* Avatar */}
                        <div style={{
                          flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 700, color: '#fff', marginTop: '2px',
                          backgroundColor: msg.authorType === 'admin' ? C.blue : msg.authorType === 'email' ? C.orange : '#94a3b8',
                        }}>
                          {msg.authorType === 'admin' ? 'CW' : client ? `${(client.firstName?.[0] || '').toUpperCase()}${(client.lastName?.[0] || '').toUpperCase()}` || '?' : '?'}
                        </div>
                        <div
                          style={{
                            flex: 1, padding: '10px 14px', borderRadius: '8px',
                            border: msg.isInternal ? `1px dashed ${C.internalBorder}` : `1px solid ${borderColor}`,
                            backgroundColor: bgColor,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {msg.authorType === 'email' ? (
                                <span style={s.badge(C.emailBg, C.orange)}>Email</span>
                              ) : (
                                <select
                                  value={msg.authorType}
                                  onChange={(e) => handleToggleAuthor(msg.id, e.target.value === 'admin' ? 'client' : 'admin')}
                                  disabled={togglingAuthor === msg.id}
                                  style={{
                                    fontSize: '12px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                                    border: `1px solid ${C.border}`, cursor: 'pointer',
                                    backgroundColor: msg.authorType === 'admin' ? '#eff6ff' : '#f9fafb',
                                    color: '#374151',
                                    opacity: togglingAuthor === msg.id ? 0.5 : 1,
                                  }}
                                >
                                  <option value="admin">Support</option>
                                  <option value="client">Client</option>
                                </select>
                              )}
                              {msg.fromChat && <span style={s.badge('#e0f2fe', '#0284c7')}>Chat</span>}
                              {msg.isInternal && <span style={s.badge('#fef3c7', '#92400e')}>Interne</span>}
                              {(msg as unknown as { scheduledAt?: string; scheduledSent?: boolean }).scheduledAt && (() => {
                                const sched = msg as unknown as { scheduledAt: string; scheduledSent?: boolean }
                                const scheduledDate = new Date(sched.scheduledAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                const createdDate = new Date(msg.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                return sched.scheduledSent ? (
                                  <span style={s.badge('#f0fdf4', '#16a34a')}>{'\u2713'} Programmé le {createdDate} — rédigé le {scheduledDate !== createdDate ? scheduledDate : createdDate}</span>
                                ) : (
                                  <span style={s.badge('#f3e8ff', '#7c3aed')}>{'\u23F0'} Rédigé le {createdDate} — envoi programmé le {scheduledDate}</span>
                                )
                              })()}
                            </span>
                            <span style={{ color: C.textMuted, fontWeight: 500, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {formatMessageDate(msg.createdAt)}
                              {(msg as unknown as { editedAt?: string }).editedAt && (
                                <span style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>(modifié)</span>
                              )}
                              {/* Split button */}
                              {!msg.isInternal && !(msg as unknown as { deletedAt?: string }).deletedAt && (
                                <button
                                  onClick={() => handleSplitMessage(msg.id, ticketSubject)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: '#6b7280', padding: 0 }}
                                  title="Extraire en nouveau ticket"
                                >
                                  {'\u2197'} Extraire
                                </button>
                              )}
                              {msg.authorType === 'admin' && !msg.isInternal && (() => {
                                const msgExt = msg as unknown as { emailSentAt?: string; emailSentTo?: string; emailOpenedAt?: string }
                                const isRead = lastClientReadAt && msg.createdAt && new Date(msg.createdAt) < new Date(lastClientReadAt)
                                const sentAt = msgExt.emailSentAt
                                const openedAt = msgExt.emailOpenedAt
                                const sentTo = msgExt.emailSentTo

                                if (openedAt) {
                                  const openDate = new Date(openedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
                                  return (
                                    <span title={`Envoyé à ${sentTo || '?'} — Ouvert le ${openDate}`} style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600, cursor: 'help' }}>
                                      &#9993; Ouvert {openDate}
                                    </span>
                                  )
                                }
                                if (sentAt) {
                                  const sentDate = new Date(sentAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
                                  return (
                                    <span title={`Envoyé à ${sentTo || '?'} le ${sentDate}`} style={{ fontSize: '10px', color: '#2563eb', fontWeight: 600, cursor: 'help' }}>
                                      &#9993; Envoyé à {sentTo} — {sentDate}
                                    </span>
                                  )
                                }
                                return (
                                  <span style={{ fontSize: '10px', color: isRead ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                                    {isRead ? '\u2713\u2713 Lu' : '\u2713 Envoy\u00e9'}
                                  </span>
                                )
                              })()}
                            </span>
                          </div>
                          {/* Body or edit mode */}
                          {editingMsg === msg.id ? (
                            <div style={{ marginTop: '6px' }}>
                              <textarea
                                value={editBody}
                                onChange={(e) => { setEditBody(e.target.value); setEditHtml(e.target.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />')) }}
                                rows={4}
                                style={{ ...s.input, width: '100%', resize: 'vertical', fontSize: '13px' }}
                              />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button onClick={() => handleEditSave(msg.id)} disabled={savingEdit || (!editBody.trim() && !editHtml)} style={{ ...s.btn(C.blue, savingEdit), fontSize: '11px', padding: '5px 12px' }}>
                                  {savingEdit ? '...' : 'Enregistrer'}
                                </button>
                                <button onClick={handleEditCancel} style={{ ...s.ghostBtn('#6b7280'), fontSize: '11px', padding: '5px 12px' }}>
                                  Annuler
                                </button>
                              </div>
                            </div>
                          ) : (msg as unknown as { deletedAt?: string }).deletedAt ? (
                            <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Ce message a été supprimé.</div>
                          ) : msg.bodyHtml ? (
                            <>
                              <div
                                className="rte-display"
                                style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}
                                dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                              />
                              <CodeBlockRendererHtml html={msg.bodyHtml} />
                            </>
                          ) : (
                            <>
                              <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
                                {searchQuery.trim() ? (
                                  msg.body.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) =>
                                    part.toLowerCase() === searchQuery.toLowerCase()
                                      ? <mark key={i} style={{ backgroundColor: '#fde68a', borderRadius: '2px', padding: '0 2px', fontWeight: 600 }}>{part}</mark>
                                      : part
                                  )
                                ) : msg.body}
                              </div>
                              <CodeBlockRenderer text={msg.body} />
                            </>
                          )}
                          {/* Attachments */}
                          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {msg.attachments.map((att, i) => {
                                const file = typeof att.file === 'object' ? att.file : null
                                if (!file) return null
                                const mime = (file.mimeType || file.filename || '').toLowerCase()
                                const isImage = mime.includes('image/') || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(file.filename || '')
                                const isGif = mime.includes('image/gif') || /\.gif$/i.test(file.filename || '')
                                const isVideo = mime.includes('video/') || /\.(mp4|webm|mov|avi)$/i.test(file.filename || '')

                                if (isImage) {
                                  return (
                                    <a key={i} href={file.url || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                                      <img
                                        src={file.url || ''}
                                        alt={file.filename || 'Image'}
                                        style={{
                                          maxWidth: isGif ? 300 : 240, maxHeight: 200, borderRadius: '6px',
                                          border: `1px solid ${C.border}`, objectFit: 'cover', cursor: 'pointer',
                                        }}
                                      />
                                    </a>
                                  )
                                }

                                if (isVideo) {
                                  return (
                                    <video
                                      key={i}
                                      src={file.url || ''}
                                      controls
                                      preload="metadata"
                                      style={{
                                        maxWidth: 360, maxHeight: 240, borderRadius: '6px',
                                        border: `1px solid ${C.border}`, backgroundColor: '#000',
                                      }}
                                    />
                                  )
                                }

                                return (
                                  <a
                                    key={i}
                                    href={file.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                                      padding: '4px 10px', borderRadius: '4px', border: `1px solid ${C.border}`,
                                      fontSize: '11px', fontWeight: 600, color: '#374151', textDecoration: 'none',
                                      backgroundColor: C.white,
                                    }}
                                  >
                                    {'\uD83D\uDCCE'} {file.filename || 'Fichier'}
                                  </a>
                                )
                              })}
                            </div>
                          )}
                          {/* Message actions (disabled for chat-only messages) */}
                          {editingMsg !== msg.id && !msg.fromChat && (
                            <div style={{ marginTop: '6px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleEditStart(msg)}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: C.textSecondary, padding: 0, fontWeight: 600, textDecoration: 'underline' }}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(msg.id)}
                                disabled={deletingMsg === msg.id}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: '#ef4444', padding: 0, fontWeight: 600, textDecoration: 'underline', opacity: deletingMsg === msg.id ? 0.3 : 1 }}
                              >
                                Supprimer
                              </button>
                              {msg.authorType === 'admin' && !msg.isInternal && (
                                <button
                                  type="button"
                                  onClick={() => handleResend(msg.id)}
                                  disabled={resendingMsg === msg.id}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: '#2563eb', padding: 0, fontWeight: 600, textDecoration: 'underline', opacity: resendingMsg === msg.id ? 0.3 : 1 }}
                                >
                                  {resendingMsg === msg.id ? 'Envoi...' : resendSuccess === msg.id ? 'Envoyé !' : 'Renvoyer email'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  )
                })}
              </>
            )
          })()}
        </div>
      )}

      {/* Typing indicator */}
      {clientTyping && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          fontSize: 12, color: '#7c3aed', fontWeight: 500,
        }}>
          <span style={{ display: 'flex', gap: 2 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#7c3aed', animation: 'bounce 1s infinite', animationDelay: '0ms' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#7c3aed', animation: 'bounce 1s infinite', animationDelay: '150ms' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#7c3aed', animation: 'bounce 1s infinite', animationDelay: '300ms' }} />
          </span>
          {clientTypingName || 'Client'} est en train d&apos;écrire...
        </div>
      )}

      {/* ===== 4. REPLY EDITOR ===== */}
      <div style={{ marginBottom: '16px' }}>
        {/* Quick reply pills + canned responses + AI suggest */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', overflowX: 'auto', paddingBottom: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
          {[
            'Bien reçu, je regarde ça !',
            'C\'est corrigé !',
            'Pouvez-vous préciser ?',
            'Je reviens vers vous rapidement',
            'Pouvez-vous m\'envoyer une capture d\'écran ?',
          ].map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => {
                setReplyBody(text)
                const html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                setReplyHtml(html)
                if (replyEditorRef.current?.setContent) {
                  replyEditorRef.current.setContent(html)
                }
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f1f5f9' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'white' }}
              style={{
                padding: '3px 10px',
                borderRadius: '14px',
                border: `1px solid ${C.border}`,
                backgroundColor: 'white',
                fontSize: '11px',
                fontWeight: 500,
                color: '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {text}
            </button>
          ))}
          {features.ai && (
            <button
              onClick={handleAiSuggestReply}
              disabled={aiReplying || messages.length === 0}
              style={{ ...s.outlineBtn('#7c3aed', aiReplying || messages.length === 0), fontSize: '11px', padding: '3px 10px', borderRadius: '14px' }}
            >
              {aiReplying ? 'Génération...' : 'Suggestion IA'}
            </button>
          )}
          {features.ai && (
            <button
              onClick={handleAiRewrite}
              disabled={aiRewriting || !replyBody.trim()}
              style={{ ...s.outlineBtn('#0891b2', aiRewriting || !replyBody.trim()), fontSize: '11px', padding: '3px 10px', borderRadius: '14px' }}
            >
              {aiRewriting ? 'Reformulation...' : 'Reformuler'}
            </button>
          )}
          <CodeBlockInserter
            style={{ ...s.outlineBtn('#059669', false), fontSize: '11px', padding: '3px 10px', borderRadius: '14px' }}
            onInsert={(block) => {
              const nb = replyBody ? replyBody + block : block
              setReplyBody(nb)
              setReplyHtml(nb.replace(/\n/g, '<br/>'))
              replyEditorRef.current?.setContent(nb.replace(/\n/g, '<br/>'))
            }}
          />
{features.canned && cannedResponses.length > 0 && (
            <>
              <select onChange={handleCannedSelect} style={{ ...s.input, fontSize: '11px', padding: '3px 8px', fontWeight: 600 }}>
                <option value="">Réponse rapide...</option>
                {cannedResponses.map((cr) => (
                  <option key={cr.id} value={String(cr.id)}>{cr.title}</option>
                ))}
              </select>
              <span
                title="Variables disponibles : {{client.firstName}}, {{client.lastName}}, {{client.company}}, {{client.email}}, {{ticket.number}}, {{ticket.subject}}, {{agent.name}}"
                style={{ cursor: 'help', fontSize: '13px', color: C.textMuted }}
              >
                &#9432;
              </span>
            </>
          )}
        </div>
        {/* Reply textarea (replacing RichTextEditor) */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
          <textarea
            value={replyBody}
            onChange={(e) => {
              const text = e.target.value
              setReplyBody(text)
              setReplyHtml(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />'))
              sendAdminTyping()
            }}
            placeholder="Écrire une réponse au client..."
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              lineHeight: 1.5,
              resize: 'vertical',
              fontFamily: 'inherit',
              color: '#374151',
              backgroundColor: 'transparent',
              boxSizing: 'border-box',
            }}
          />
        </div>
        {/* Attachments */}
        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleReplyFileChange}
            style={{ display: 'none' }}
            accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ ...s.ghostBtn('#6b7280'), fontSize: '12px', padding: '5px 10px' }}
          >
            + Pièce jointe
          </button>
          {replyFiles.length > 0 && (
            <>
              {replyFiles.map((file, i) => (
                <span key={i} style={{ ...s.badge('#f1f5f9', '#374151'), display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {'\uD83D\uDCCE'} {file.name}
                  <button
                    type="button"
                    onClick={() => setReplyFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}
                  >
                    {'\u00D7'}
                  </button>
                </span>
              ))}
            </>
          )}
        </div>
        {/* Send row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
          <select
            value={sendAsClient ? 'client' : 'admin'}
            onChange={(e) => setSendAsClient(e.target.value === 'client')}
            style={{ ...s.input, fontSize: '12px', padding: '6px 8px', fontWeight: 600 }}
          >
            <option value="admin">En tant que : Support</option>
            <option value="client">En tant que : Client</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={isInternal} onChange={(e) => { setIsInternal(e.target.checked); if (e.target.checked) setNotifyClient(false) }} style={{ width: '14px', height: '14px', accentColor: C.amber }} />
            Note interne
          </label>
          {!isInternal && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} style={{ width: '14px', height: '14px', accentColor: '#16a34a' }} />
              Envoyer au client
            </label>
          )}
          <button data-action="send-reply" onClick={handleSendReply} disabled={sending || (!replyBody.trim() && !replyHtml)} style={{ ...s.btn(isInternal ? C.amber : notifyClient ? '#16a34a' : C.blue, sending || (!replyBody.trim() && !replyHtml)), fontSize: '13px', padding: '8px 20px', marginLeft: 'auto' }}>
            {sending ? 'Envoi...' : isInternal ? 'Ajouter note' : notifyClient ? 'Envoyer + Notifier' : 'Sauvegarder'}
          </button>
          {!isInternal && (
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              disabled={!replyBody.trim() && !replyHtml}
              style={{ ...s.outlineBtn('#7c3aed', !replyBody.trim() && !replyHtml), fontSize: '12px', padding: '8px 12px' }}
              title="Programmer l'envoi à une date/heure précise"
            >
              {'\u23F0'}
            </button>
          )}
        </div>
        {showSchedule && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed' }}>Programmer pour :</span>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              style={{ ...s.input, fontSize: '12px', width: 'auto' }}
            />
            <button
              onClick={handleScheduleReply}
              disabled={sending || !scheduleDate || (!replyBody.trim() && !replyHtml)}
              style={{ ...s.btn('#7c3aed', sending || !scheduleDate || (!replyBody.trim() && !replyHtml)), fontSize: '12px', padding: '6px 14px' }}
            >
              {sending ? '...' : '\u23F0 Programmer'}
            </button>
            <button onClick={() => setShowSchedule(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }}>{'\u2715'}</button>
          </div>
        )}
        <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px', textAlign: 'right' }}>
          {'\u2318'}Enter pour envoyer &middot; {'\u2318'}{'\u21E7'}N note interne
        </div>
      </div>

      {/* ===== SEPARATOR ===== */}
      <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: '16px' }} />

            {/* ===== 5. QUICK ACTIONS ===== */}
      <QuickActions
        statusTransitions={statusTransitions}
        statusUpdating={statusUpdating}
        onStatusChange={handleStatusChange}
        snoozeUntil={snoozeUntil}
        snoozeSaving={snoozeSaving}
        onCancelSnooze={() => handleSnooze(null)}
        showMerge={showMerge}
        showExtMsg={showExtMsg}
        showSnooze={showSnooze}
        onToggleMerge={() => { setShowMerge(!showMerge); setShowExtMsg(false); setShowSnooze(false) }}
        onToggleExtMsg={() => { setShowExtMsg(!showExtMsg); setShowMerge(false); setShowSnooze(false) }}
        onToggleSnooze={() => { setShowSnooze(!showSnooze); setShowMerge(false); setShowExtMsg(false) }}
        onNextTicket={handleNextTicket}
        showNextTicket={showNextTicket}
        nextTicketId={nextTicketId}
        nextTicketInfo={nextTicketInfo}
        onCloseNextTicket={() => setShowNextTicket(false)}
      />

      {/* ===== 6. AI SUMMARY ===== */}
      {features.ai && <AISummaryPanel
        showAiSummary={showAiSummary}
        setShowAiSummary={setShowAiSummary}
        aiSummary={aiSummary}
        aiGenerating={aiGenerating}
        aiSaving={aiSaving}
        aiSaved={aiSaved}
        handleAiGenerate={handleAiGenerate}
        handleAiSave={handleAiSave}
      />}

      {/* ===== 7. CONDITIONAL PANELS ===== */}
      {features.merge && showMerge && (
        <MergePanel
          mergeTarget={mergeTarget} setMergeTarget={setMergeTarget}
          mergeTargetInfo={mergeTargetInfo} setMergeTargetInfo={setMergeTargetInfo}
          mergeError={mergeError} setMergeError={setMergeError}
          merging={merging}
          handleMergeLookup={handleMergeLookup} handleMerge={handleMerge}
        />
      )}
      {features.externalMessages && showExtMsg && (
        <ExtMessagePanel
          extMsgBody={extMsgBody} setExtMsgBody={setExtMsgBody}
          extMsgAuthor={extMsgAuthor} setExtMsgAuthor={setExtMsgAuthor}
          extMsgDate={extMsgDate} setExtMsgDate={setExtMsgDate}
          extMsgFiles={extMsgFiles} setExtMsgFiles={setExtMsgFiles}
          sendingExtMsg={sendingExtMsg}
          handleSendExtMsg={handleSendExtMsg} handleExtFileChange={handleExtFileChange}
        />
      )}
      {features.snooze && showSnooze && (
        <SnoozePanel snoozeSaving={snoozeSaving} handleSnooze={handleSnooze} />
      )}


        </div>
        <div style={layoutStyles.sideColumn}>
{/* ===== 8. TIME TRACKING ===== */}
      <TimeTrackingPanel
        timeEntries={timeEntries}
        totalMinutes={totalMinutes}
        timerRunning={timerRunning}
        timerSeconds={timerSeconds}
        setTimerSeconds={setTimerSeconds}
        timerDescription={timerDescription}
        setTimerDescription={setTimerDescription}
        handleTimerStart={handleTimerStart}
        handleTimerStop={handleTimerStop}
        handleTimerSave={handleTimerSave}
        handleTimerDiscard={handleTimerDiscard}
        duration={duration}
        setDuration={setDuration}
        timeDescription={timeDescription}
        setTimeDescription={setTimeDescription}
        handleAddTime={handleAddTime}
        addingTime={addingTime}
        timeSuccess={timeSuccess}
      />

{/* ===== 9. CLIENT HISTORY ===== */}
      {features.clientHistory && client && (
        <ClientHistory
          client={client}
          clientTickets={clientTickets}
          clientProjects={clientProjects}
          clientNotes={clientNotes}
          onNotesChange={(v) => { setClientNotes(v); setNotesSaved(false) }}
          onNotesSave={async () => {
            if (!client) return
            setSavingNotes(true)
            try {
              const res = await fetch(`/api/support-clients/${client.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ notes: clientNotes }),
              })
              if (res.ok) { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 3000) }
            } catch { /* ignore */ } finally { setSavingNotes(false) }
          }}
          savingNotes={savingNotes}
          notesSaved={notesSaved}
        />
      )}

{/* ===== 10. ACTIVITY LOG (collapsible) ===== */}
      {features.activityLog && <ActivityLog activityLog={activityLog} />}

{/* ===== 11. EXPORT CSV ===== */}
      <div style={s.section}>
        <a
          href="/api/support/export-csv"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...s.ghostBtn('#6b7280'), fontSize: '12px', textDecoration: 'none', display: 'inline-block' }}
        >
          Exporter tous les tickets (CSV)
        </a>
      </div>


        </div>
      </div>

    </div>
  )
}



export default TicketConversation
