'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import styles from '../../styles/ChatView.module.scss'

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
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<{ active: ChatSession[]; closed: ChatSession[] }>({ active: [], closed: [] })
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cannedResponses, setCannedResponses] = useState<{ id: string | number; title: string; body: string; category?: string }[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastFetchRef = useRef<string | null>(null)
  const sessionsPollInterval = useRef(5000)
  const sessionsPollTimeout = useRef<NodeJS.Timeout>(undefined)
  const messagesPollInterval = useRef(3000)
  const messagesPollTimeout = useRef<NodeJS.Timeout>(undefined)

  // Fetch sessions list
  const [sessionExpired, setSessionExpired] = useState(false)
  const fetchSessions = useCallback(async () => {
    let hadChanges = false
    try {
      const res = await fetch('/api/support/admin-chat')
      if (res.status === 401 || res.status === 403) { setSessionExpired(true); return }
      if (res.ok) {
        const data = await res.json()
        setSessions((prev) => {
          const newActive = data.active || []
          const newClosed = data.closed || []
          if (JSON.stringify(prev.active) !== JSON.stringify(newActive) || JSON.stringify(prev.closed) !== JSON.stringify(newClosed)) {
            hadChanges = true
            return { active: newActive, closed: newClosed }
          }
          return prev
        })
      }
    } catch { /* ignore */ }
    setLoading(false)
    if (hadChanges) {
      sessionsPollInterval.current = 5000
    } else {
      sessionsPollInterval.current = Math.min(sessionsPollInterval.current + 2000, 15000)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
    if (sessionExpired) return

    const schedulePoll = () => {
      sessionsPollTimeout.current = setTimeout(async () => {
        await fetchSessions()
        schedulePoll()
      }, sessionsPollInterval.current)
    }
    schedulePoll()

    return () => clearTimeout(sessionsPollTimeout.current)
  }, [fetchSessions, sessionExpired])

  // Fetch canned responses
  useEffect(() => {
    fetch('/api/canned-responses?sort=sortOrder&limit=50&depth=0', { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.docs) setCannedResponses(data.docs) })
      .catch(() => {})
  }, [])

  // Fetch messages for selected session (polling)
  useEffect(() => {
    if (!selectedSession) return

    const fetchMessages = async () => {
      let hadNewMessages = false
      try {
        const after = lastFetchRef.current || ''
        const url = `/api/support/admin-chat?session=${selectedSession}${after ? `&after=${after}` : ''}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (!lastFetchRef.current) {
            // Initial load
            setMessages(data.messages || [])
            hadNewMessages = (data.messages?.length || 0) > 0
          } else if (data.messages?.length > 0) {
            setMessages((prev) => {
              const ids = new Set(prev.map((m) => m.id))
              const newMsgs = data.messages.filter((m: ChatMessage) => !ids.has(m.id))
              return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev
            })
            hadNewMessages = true
          }
          if (data.messages?.length > 0) {
            lastFetchRef.current = data.messages[data.messages.length - 1].createdAt
          }
        }
      } catch { /* ignore */ }
      if (hadNewMessages) {
        messagesPollInterval.current = 3000
      } else {
        messagesPollInterval.current = Math.min(messagesPollInterval.current + 1000, 10000)
      }
    }

    lastFetchRef.current = null
    messagesPollInterval.current = 3000
    fetchMessages()

    const schedulePoll = () => {
      messagesPollTimeout.current = setTimeout(async () => {
        await fetchMessages()
        schedulePoll()
      }, messagesPollInterval.current)
    }
    schedulePoll()

    return () => clearTimeout(messagesPollTimeout.current)
  }, [selectedSession])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !selectedSession || sending) return

    setSending(true)
    try {
      const res = await fetch('/api/support/admin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', session: selectedSession, message: input.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
        lastFetchRef.current = data.message.createdAt
        setInput('')
      }
    } catch { /* ignore */ }
    setSending(false)
  }

  const closeSession = async () => {
    if (!selectedSession) return
    try {
      await fetch('/api/support/admin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', session: selectedSession }),
      })
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

  const getClientCompany = (client: ChatSession['client']): string => {
    if (typeof client === 'number') return ''
    return client.company || ''
  }

  const displayedSessions = showClosed ? sessions.closed : sessions.active

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('chat.title')}</h1>
          <p className={styles.subtitle}>
            {sessions.active.length !== 1 ? t('chat.sessionCountPlural', { count: String(sessions.active.length) }) : t('chat.sessionCount', { count: String(sessions.active.length) })}
          </p>
        </div>
      </div>

      <div className={styles.container}>
        {/* Sessions sidebar */}
        <div className={styles.sidebar}>
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              onClick={() => setShowClosed(false)}
              className={`${styles.tab} ${!showClosed ? styles.tabActive : ''}`}
            >
              {t('chat.tabs.active')} ({sessions.active.length})
            </button>
            <button
              onClick={() => setShowClosed(true)}
              className={`${styles.tab} ${showClosed ? styles.tabActive : ''}`}
            >
              {t('chat.tabs.closed')} ({sessions.closed.length})
            </button>
          </div>

          {/* Session list */}
          <div className={styles.sessionList}>
            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.emptyState}>{t('common.loading')}</div>
              </div>
            ) : displayedSessions.length === 0 ? (
              <div className={styles.emptyState}>
                {showClosed ? t('chat.noSessionClosed') : t('chat.noSessionActive')}
              </div>
            ) : displayedSessions.map((s) => (
              <button
                key={s.session}
                onClick={() => setSelectedSession(s.session)}
                className={`${styles.sessionItem} ${selectedSession === s.session ? styles.sessionItemActive : ''}`}
              >
                <div className={styles.sessionHeader}>
                  <span className={styles.sessionName}>{getClientName(s.client)}</span>
                  {s.unreadCount > 0 && (
                    <span className={styles.unreadBadge}>{s.unreadCount}</span>
                  )}
                </div>
                {getClientCompany(s.client) && (
                  <div className={styles.sessionCompany}>{getClientCompany(s.client)}</div>
                )}
                <div className={styles.sessionPreview}>
                  {s.lastMessage.startsWith('Note:') ? (
                    <span className={styles.sessionRating}>{s.lastMessage.match(/[★☆]+/)?.[0] || '⭐'}</span>
                  ) : s.lastMessage}
                </div>
                <div className={styles.sessionMeta}>
                  {new Date(s.lastMessageAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {' · '}{s.messageCount} {t('chat.msg')}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className={styles.chatPanel}>
          {!selectedSession ? (
            <div className={styles.chatEmpty}>
              {t('chat.selectSession')}
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className={styles.chatHeader}>
                <span className={styles.chatSessionId}>{selectedSession}</span>
                <button onClick={closeSession} className={styles.closeBtn}>
                  {t('chat.closeChat')}
                </button>
              </div>

              {/* Messages */}
              <div className={styles.messagesArea}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.messageRow} ${
                      msg.senderType === 'agent'
                        ? styles.messageRowAgent
                        : msg.senderType === 'system'
                          ? styles.messageRowSystem
                          : styles.messageRowClient
                    }`}
                  >
                    {msg.senderType === 'system' ? (
                      msg.message.startsWith('Note:') || msg.message.startsWith('Commentaire:') ? (
                        <div className={styles.bubbleRating}>
                          {msg.message.includes('★') && (
                            <div className={styles.ratingStars}>
                              {msg.message.match(/[★☆]+/)?.[0] || ''}
                            </div>
                          )}
                          <div className={styles.ratingComment}>
                            {msg.message.includes('—')
                              ? msg.message.split('—').slice(1).join('—').trim()
                              : msg.message.replace(/Note:\s*[★☆]+\s*\(\d\/5\)\s*/, '').replace('Commentaire: ', '')}
                          </div>
                          <div className={styles.ratingMeta}>
                            {t('chat.clientReview')} · {new Date(msg.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ) : (
                        <div className={styles.bubbleSystem}>
                          {msg.message}
                        </div>
                      )
                    ) : (
                      <div className={`${styles.bubble} ${msg.senderType === 'agent' ? styles.bubbleAgent : styles.bubbleClient}`}>
                        <div className={styles.bubbleSender}>
                          {msg.senderType === 'agent'
                            ? (msg.agent ? `${(msg.agent as { firstName?: string }).firstName || t('chat.agent')}` : t('chat.you'))
                            : t('chat.clientLabel')}
                        </div>
                        <div className={styles.bubbleBody}>
                          {msg.message}
                        </div>
                        <div className={styles.bubbleTime}>
                          {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <form onSubmit={sendMessage} className={styles.composer}>
                {cannedResponses.length > 0 && (
                  <select
                    onChange={(e) => {
                      const cr = cannedResponses.find((c) => String(c.id) === e.target.value)
                      if (cr) setInput(cr.body)
                      e.target.value = ''
                    }}
                    className={styles.cannedSelect}
                  >
                    <option value="">{t('chat.quickReply')}</option>
                    {cannedResponses.map((cr) => (
                      <option key={cr.id} value={String(cr.id)}>{cr.title}</option>
                    ))}
                  </select>
                )}
                <div className={styles.composerRow}>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t('chat.inputPlaceholder')}
                    maxLength={2000}
                    className={styles.composerInput}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className={styles.sendBtn}
                  >
                    {t('chat.sendButton')}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
