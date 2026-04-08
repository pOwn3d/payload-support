'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import s from '../../styles/ChatView.module.scss'

interface ChatSession {
  session: string
  client: { id: number; firstName?: string; lastName?: string; company?: string; email?: string } | number
  lastMessage: string
  lastMessageAt: string
  senderType: string
  status: string
  messageCount: number
  unreadCount: number
}

interface ChatMessage {
  id: string
  senderType: 'client' | 'agent' | 'system'
  message: string
  createdAt: string
  agent?: { firstName?: string; lastName?: string } | null
}

export const ChatViewClient: React.FC = () => {
  const [sessions, setSessions] = useState<{ active: ChatSession[]; closed: ChatSession[] }>({ active: [], closed: [] })
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cannedResponses, setCannedResponses] = useState<{ id: string | number; title: string; body: string }[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastFetchRef = useRef<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const sessionsESRef = useRef<EventSource | null>(null)
  const messagesESRef = useRef<EventSource | null>(null)

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/support/admin-chat')
      if (res.status === 401 || res.status === 403) { setSessionExpired(true); return }
      if (res.ok) {
        const data = await res.json()
        setSessions({ active: data.active || [], closed: data.closed || [] })
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  // SSE for session list with polling fallback
  useEffect(() => {
    if (sessionExpired) return

    // Always fetch once for initial data
    fetchSessions()

    if (typeof EventSource !== 'undefined') {
      const es = new EventSource('/api/support/admin-chat-stream')
      sessionsESRef.current = es

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'sessions' && parsed.data) {
            setSessions({ active: parsed.data.active || [], closed: parsed.data.closed || [] })
            setLoading(false)
          }
        } catch { /* ignore parse errors */ }
      }

      es.onerror = () => {
        // SSE failed, fall back to polling
        es.close()
        sessionsESRef.current = null
        const iv = setInterval(fetchSessions, 5000)
        return () => clearInterval(iv)
      }

      return () => {
        es.close()
        sessionsESRef.current = null
      }
    }

    // Fallback: polling
    const iv = setInterval(fetchSessions, 5000)
    return () => clearInterval(iv)
  }, [fetchSessions, sessionExpired])

  useEffect(() => {
    fetch('/api/canned-responses?sort=sortOrder&limit=50&depth=0', { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.docs) setCannedResponses(data.docs) })
      .catch(() => {})
  }, [])

  // SSE for messages in selected session with polling fallback
  useEffect(() => {
    if (!selectedSession) return

    const fetchMessages = async () => {
      try {
        const after = lastFetchRef.current || ''
        const url = `/api/support/admin-chat?session=${selectedSession}${after ? `&after=${after}` : ''}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (!lastFetchRef.current) {
            setMessages(data.messages || [])
          } else if (data.messages?.length > 0) {
            setMessages((prev) => {
              const ids = new Set(prev.map((m) => m.id))
              const newMsgs = data.messages.filter((m: ChatMessage) => !ids.has(m.id))
              return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev
            })
          }
          if (data.messages?.length > 0) {
            lastFetchRef.current = data.messages[data.messages.length - 1].createdAt
          }
        }
      } catch { /* ignore */ }
    }

    // Always load initial messages via REST
    lastFetchRef.current = null
    fetchMessages()

    // Then try SSE for real-time updates
    if (typeof EventSource !== 'undefined') {
      const es = new EventSource(`/api/support/admin-chat-stream?session=${selectedSession}`)
      messagesESRef.current = es

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'messages' && parsed.data?.length > 0) {
            setMessages((prev) => {
              const ids = new Set(prev.map((m) => m.id))
              const newMsgs = parsed.data.filter((m: ChatMessage) => !ids.has(m.id))
              return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev
            })
          }
        } catch { /* ignore parse errors */ }
      }

      es.onerror = () => {
        // SSE failed, fall back to polling
        es.close()
        messagesESRef.current = null
        const iv = setInterval(fetchMessages, 3000)
        // Store interval for cleanup — use a local ref
        ;(fetchMessages as any)._fallbackIv = iv
      }

      return () => {
        es.close()
        messagesESRef.current = null
        if ((fetchMessages as any)._fallbackIv) clearInterval((fetchMessages as any)._fallbackIv)
      }
    }

    // Fallback: polling
    const iv = setInterval(fetchMessages, 3000)
    return () => clearInterval(iv)
  }, [selectedSession])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !selectedSession || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/support/admin-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', session: selectedSession, message: input.trim() }) })
      if (res.ok) { const data = await res.json(); setMessages((prev) => [...prev, data.message]); lastFetchRef.current = data.message.createdAt; setInput('') }
    } catch { /* ignore */ }
    setSending(false)
  }

  const closeSession = async () => {
    if (!selectedSession) return
    try {
      await fetch('/api/support/admin-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close', session: selectedSession }) })
      setSelectedSession(null)
      fetchSessions()
    } catch { /* ignore */ }
  }

  const getClientName = (client: ChatSession['client']): string => {
    if (typeof client === 'number') return `Client #${client}`
    const parts = [client.firstName, client.lastName].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
    return client.email || `Client #${client.id}`
  }

  const displayedSessions = showClosed ? sessions.closed : sessions.active

  const S: Record<string, React.CSSProperties> = {
    page: { padding: '20px 30px', maxWidth: 1200, margin: '0 auto' },
    container: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, minHeight: 'calc(100vh - 300px)' },
    sidebar: { borderRight: '1px solid var(--theme-elevation-200)' },
    sessionItem: { display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' as const, borderBottom: '1px solid var(--theme-elevation-100)', fontSize: 13 },
    sessionActive: { background: 'var(--theme-elevation-50)' },
    chatPanel: { display: 'flex', flexDirection: 'column' as const },
    messagesArea: { flex: 1, overflowY: 'auto' as const, padding: '12px 0' },
    bubble: { maxWidth: '70%', padding: '8px 12px', borderRadius: 10, marginBottom: 8, fontSize: 14 },
    bubbleAgent: { background: '#dbeafe', color: '#1e3a5f', marginLeft: 'auto' },
    bubbleClient: { background: 'var(--theme-elevation-100)', color: 'var(--theme-text)' },
    bubbleSystem: { margin: '4px auto', padding: '4px 12px', fontSize: 11, color: '#6b7280', textAlign: 'center' as const },
    composer: { borderTop: '1px solid var(--theme-elevation-200)', padding: '8px 0' },
    composerInput: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', fontSize: 13, background: 'var(--theme-elevation-0)', color: 'var(--theme-text)' },
    sendBtn: { padding: '8px 16px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
    tabsRow: { display: 'flex', gap: 4, padding: '8px 14px', borderBottom: '1px solid var(--theme-elevation-200)' },
    tab: { padding: '4px 10px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--theme-elevation-500)' },
    tabActive: { background: 'var(--theme-elevation-100)', fontWeight: 700, color: 'var(--theme-text)' },
  }

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--theme-text)' }}>Chat en direct</h1>
        <p style={{ color: 'var(--theme-elevation-500)', fontSize: 13, margin: '4px 0 0' }}>{sessions.active.length} session{sessions.active.length !== 1 ? 's' : ''} active{sessions.active.length !== 1 ? 's' : ''}</p>
      </div>

      <div style={S.container}>
        <div style={S.sidebar}>
          <div style={S.tabsRow}>
            <button onClick={() => setShowClosed(false)} style={{ ...S.tab, ...(!showClosed ? S.tabActive : {}) }}>Actifs ({sessions.active.length})</button>
            <button onClick={() => setShowClosed(true)} style={{ ...S.tab, ...(showClosed ? S.tabActive : {}) }}>Fermes ({sessions.closed.length})</button>
          </div>
          <div>
            {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>
              : displayedSessions.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Aucune session {showClosed ? 'fermee' : 'active'}</div>
              : displayedSessions.map((s) => (
                <button key={s.session} onClick={() => setSelectedSession(s.session)} style={{ ...S.sessionItem, ...(selectedSession === s.session ? S.sessionActive : {}) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{getClientName(s.client)}</span>
                    {s.unreadCount > 0 && <span style={{ padding: '1px 6px', borderRadius: 10, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700 }}>{s.unreadCount}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.lastMessage}</div>
                  <div style={{ fontSize: 11, color: 'var(--theme-elevation-400)', marginTop: 2 }}>{new Date(s.lastMessageAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} -- {s.messageCount} msg</div>
                </button>
              ))}
          </div>
        </div>

        <div style={S.chatPanel}>
          {!selectedSession ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>Selectionnez une session pour commencer</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--theme-elevation-200)' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--theme-elevation-500)' }}>{selectedSession}</span>
                <button onClick={closeSession} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #dc2626', background: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>Fermer le chat</button>
              </div>
              <div style={S.messagesArea}>
                {messages.map((msg) => (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: msg.senderType === 'agent' ? 'row-reverse' : 'row', padding: '2px 14px' }}>
                    {msg.senderType === 'system' ? (
                      <div style={S.bubbleSystem}>{msg.message}</div>
                    ) : (
                      <div style={{ ...S.bubble, ...(msg.senderType === 'agent' ? S.bubbleAgent : S.bubbleClient) }}>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{msg.senderType === 'agent' ? 'Vous' : 'Client'}</div>
                        <div>{msg.message}</div>
                        <div style={{ fontSize: 10, color: msg.senderType === 'agent' ? '#1e40af' : 'var(--theme-elevation-400)', marginTop: 2 }}>{new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} style={S.composer}>
                {cannedResponses.length > 0 && (
                  <select onChange={(e) => { const cr = cannedResponses.find((c) => String(c.id) === e.target.value); if (cr) setInput(cr.body); e.target.value = '' }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 11, marginBottom: 6, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' }}>
                    <option value="">Reponse rapide...</option>
                    {cannedResponses.map((cr) => <option key={cr.id} value={String(cr.id)}>{cr.title}</option>)}
                  </select>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tapez votre reponse..." maxLength={2000} style={S.composerInput} autoFocus />
                  <button type="submit" disabled={!input.trim() || sending} style={S.sendBtn}>Envoyer</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
