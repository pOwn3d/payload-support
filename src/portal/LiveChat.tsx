'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, Send, X, Minimize2, ArrowLeft } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────

interface ChatMessage {
  id: number | string
  body: string
  senderType: 'client' | 'agent' | 'system'
  createdAt: string
}

interface LiveChatSession {
  clientToken: string
  email: string
  name: string
  sessionId?: string
}

type Screen = 'closed' | 'identify' | 'chat' | 'rating'

// ─── LocalStorage keys ──────────────────────────────────────

const LS_KEY = 'support-livechat'

function loadSession(): LiveChatSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as LiveChatSession

    // Validate token expiry (24h) — extract timestamp from token
    if (session.clientToken) {
      const parts = session.clientToken.split('_')
      if (parts.length === 4) {
        const timestamp = parseInt(parts[2], 10)
        if (!isNaN(timestamp) && Date.now() - timestamp > 24 * 60 * 60 * 1000) {
          localStorage.removeItem(LS_KEY)
          return null
        }
      }
    }

    return session
  } catch {
    return null
  }
}

function saveSession(session: LiveChatSession): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(session))
  } catch {
    // localStorage full or disabled
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    // Ignore
  }
}

// ─── Component ───────────────────────────────────────────────

export function LiveChat() {
  const [screen, setScreen] = useState<Screen>('closed')
  const [session, setSession] = useState<LiveChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [identifyLoading, setIdentifyLoading] = useState(false)
  const [rating, setRating] = useState<number>(0)
  const [ratingHover, setRatingHover] = useState<number>(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitted, setRatingSubmitted] = useState(false)

  // Identify form
  const [formEmail, setFormEmail] = useState('')
  const [formName, setFormName] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastFetchRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load session from localStorage on mount
  useEffect(() => {
    const saved = loadSession()
    if (saved) {
      setSession(saved)
      setFormEmail(saved.email)
      setFormName(saved.name)
    }
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Poll for new messages when chat is open and we have a session
  const pollMessages = useCallback(async (): Promise<boolean> => {
    if (!session?.sessionId || !session?.clientToken) return false

    try {
      const after = lastFetchRef.current || ''
      const params = new URLSearchParams({
        session: session.sessionId,
        clientToken: session.clientToken,
        ...(after ? { after } : {}),
      })
      const res = await fetch(`/api/live-chat/messages?${params}`)
      if (!res.ok) return false

      const data = await res.json()
      if (data.messages?.length > 0) {
        let hadNewMessages = false
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => String(m.id)))
          const newMsgs = data.messages.filter(
            (m: ChatMessage) => !existingIds.has(String(m.id)),
          )
          if (newMsgs.length === 0) return prev

          hadNewMessages = true

          // Count agent messages as unread if chat panel is closed
          if (screen === 'closed') {
            const agentNewMsgs = newMsgs.filter(
              (m: ChatMessage) => m.senderType === 'agent',
            )
            if (agentNewMsgs.length > 0) {
              setUnreadCount((prev) => prev + agentNewMsgs.length)
            }
          }

          return [...prev, ...newMsgs]
        })
        lastFetchRef.current =
          data.messages[data.messages.length - 1].createdAt
        return hadNewMessages
      }
      return false
    } catch {
      // Ignore polling errors silently
      return false
    }
  }, [session?.sessionId, session?.clientToken, screen])

  useEffect(() => {
    // Start adaptive polling if we have a session
    if (session?.sessionId) {
      let currentInterval = 5000
      const MIN_INTERVAL = 5000
      const MAX_INTERVAL = 30000

      const adaptivePoll = async () => {
        const hasNewMessages = await pollMessages()
        if (hasNewMessages) {
          currentInterval = MIN_INTERVAL
        } else {
          currentInterval = Math.min(currentInterval * 1.5, MAX_INTERVAL)
        }
        pollIntervalRef.current = setTimeout(adaptivePoll, currentInterval)
      }

      adaptivePoll()
      return () => {
        if (pollIntervalRef.current) clearTimeout(pollIntervalRef.current)
      }
    }
  }, [session?.sessionId, pollMessages])

  // ─── Handlers ────────────────────────────────────────────

  const handleOpen = () => {
    setUnreadCount(0)
    if (session?.clientToken) {
      setScreen('chat')
      // If we have a session, fetch messages
      if (session.sessionId) {
        lastFetchRef.current = null
        setMessages([])
        pollMessages()
      }
    } else {
      setScreen('identify')
    }
    setError(null)
  }

  const handleClose = () => {
    setScreen('closed')
    setError(null)
  }

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIdentifyLoading(true)

    try {
      const res = await fetch('/api/live-chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail.trim(), name: formName.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur de connexion.')
        setIdentifyLoading(false)
        return
      }

      const newSession: LiveChatSession = {
        clientToken: data.token,
        email: formEmail.trim().toLowerCase(),
        name: formName.trim(),
        sessionId: data.session,
      }

      setSession(newSession)
      saveSession(newSession)
      setScreen('chat')
    } catch {
      setError('Impossible de se connecter. Verifiez votre connexion.')
    } finally {
      setIdentifyLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !session?.clientToken || sending) return

    const messageText = input.trim()
    setInput('')
    setSending(true)
    setError(null)

    // Optimistic update
    const tempId = `temp_${Date.now()}`
    const optimisticMsg: ChatMessage = {
      id: tempId,
      body: messageText,
      senderType: 'client',
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    try {
      const res = await fetch('/api/live-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: session.sessionId || undefined,
          message: messageText,
          clientToken: session.clientToken,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setError(data.error || 'Impossible d\'envoyer le message.')
        setInput(messageText) // Restore input
        setSending(false)
        return
      }

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data.message : m)),
      )
      lastFetchRef.current = data.message.createdAt

      // Save sessionId if this was the first message (fallback session creation)
      if (!session.sessionId && data.session) {
        const updatedSession = { ...session, sessionId: data.session }
        setSession(updatedSession)
        saveSession(updatedSession)
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setError('Erreur reseau. Reessayez.')
      setInput(messageText)
    } finally {
      setSending(false)
    }
  }

  const handleNewConversation = async () => {
    // Start a new session (keep the client identity)
    if (!session?.clientToken) return

    try {
      const res = await fetch('/api/live-chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email, name: session.name }),
      })

      const data = await res.json()

      if (res.ok && data.session) {
        const updatedSession = {
          ...session,
          clientToken: data.token,
          sessionId: data.session,
        }
        setSession(updatedSession)
        saveSession(updatedSession)
        setMessages([])
        lastFetchRef.current = null
      }
    } catch (err) {
      console.warn('[LiveChat] Error starting chat:', err)
    }
  }

  const handleEndChat = () => {
    if (!session?.sessionId) return
    // Show rating screen instead of closing immediately
    setRating(0)
    setRatingHover(0)
    setRatingComment('')
    setRatingSubmitted(false)
    setScreen('rating')
  }

  const handleSubmitRating = async () => {
    if (!session?.sessionId || !session?.clientToken) return

    // Send rating as a system message with structured data
    const ratingText = rating > 0
      ? `Note: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)${ratingComment ? ` — ${ratingComment}` : ''}`
      : ratingComment ? `Commentaire: ${ratingComment}` : null

    try {
      // Close the session
      await fetch('/api/live-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: session.sessionId,
          message: '__close__',
          clientToken: session.clientToken,
        }),
      })

      // Send rating if provided
      if (ratingText) {
        await fetch('/api/live-chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session: session.sessionId,
            message: `__rating__${ratingText}`,
            clientToken: session.clientToken,
          }),
        })
      }
    } catch (err) {
      console.warn('[LiveChat] Error closing chat:', err)
    }

    setRatingSubmitted(true)

    // Clear session but keep identity for next time
    const updatedSession = { ...session, sessionId: undefined }
    setSession(updatedSession)
    saveSession(updatedSession)
    lastFetchRef.current = null

    // After delay, return to closed state
    setTimeout(() => {
      setMessages([])
      setScreen('closed')
    }, 2500)
  }

  const handleSkipRating = async () => {
    // Close without rating
    if (session?.sessionId && session?.clientToken) {
      try {
        await fetch('/api/live-chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session: session.sessionId,
            message: '__close__',
            clientToken: session.clientToken,
          }),
        })
      } catch (err) {
        console.warn('[LiveChat] Error closing session:', err)
      }
    }

    const updatedSession = session ? { ...session, sessionId: undefined } : null
    if (updatedSession) {
      setSession(updatedSession)
      saveSession(updatedSession)
    }
    lastFetchRef.current = null
    setMessages([])
    setScreen('closed')
  }

  const handleLogout = () => {
    clearSession()
    setSession(null)
    setMessages([])
    setFormEmail('')
    setFormName('')
    lastFetchRef.current = null
    setScreen('identify')
  }

  // ─── Render ──────────────────────────────────────────────

  // Floating button
  if (screen === 'closed') {
    return (
      <button
        onClick={handleOpen}
        aria-label="Ouvrir le chat en direct"
        style={{
          position: 'fixed',
          bottom: 134,
          right: 16,
          zIndex: 55,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 16,
          border: '3px solid #000',
          backgroundColor: '#00E5FF',
          color: '#000',
          cursor: 'pointer',
          boxShadow: '4px 4px 0px #000',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translate(2px, 2px)'
          e.currentTarget.style.boxShadow = '2px 2px 0px #000'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translate(0, 0)'
          e.currentTarget.style.boxShadow = '4px 4px 0px #000'
        }}
      >
        <MessageCircle size={24} strokeWidth={2.5} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#FF4444',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 5px',
              border: '2px solid #000',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 55,
        width: 380,
        maxWidth: 'calc(100vw - 32px)',
        height: screen === 'identify' || screen === 'rating' ? 'auto' : 520,
        maxHeight: 'calc(100vh - 32px)',
        borderRadius: 16,
        border: '3px solid #000',
        backgroundColor: '#fff',
        boxShadow: '6px 6px 0px #000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#00E5FF',
          borderBottom: '3px solid #000',
          minHeight: 48,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {screen === 'chat' && session && !session.sessionId && (
            <button
              onClick={() => setScreen('identify')}
              aria-label="Retour"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                color: '#000',
              }}
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
          )}
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              border: '2px solid #000',
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 900, fontSize: 14, color: '#000' }}>
            Chat en direct
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {session?.clientToken && (
            <button
              onClick={handleLogout}
              title="Changer d'identite"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                color: 'rgba(0,0,0,0.5)',
                display: 'flex',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(0,0,0,0.5)'
              }}
            >
              <ArrowLeft size={16} strokeWidth={2} />
            </button>
          )}
          <button
            onClick={handleClose}
            aria-label="Reduire le chat"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              color: 'rgba(0,0,0,0.5)',
              display: 'flex',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#000'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(0,0,0,0.5)'
            }}
          >
            <Minimize2 size={16} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => {
              handleClose()
            }}
            aria-label="Fermer le chat"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              color: 'rgba(0,0,0,0.5)',
              display: 'flex',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#000'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(0,0,0,0.5)'
            }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ── Identify Screen ── */}
      {screen === 'identify' && (
        <div style={{ padding: 24, flex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                border: '3px solid #000',
                backgroundColor: '#FFD600',
                boxShadow: '3px 3px 0px #000',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <MessageCircle size={28} strokeWidth={2} color="#000" />
            </div>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: '#000',
                margin: '0 0 4px',
              }}
            >
              Besoin d&apos;aide ?
            </h3>
            <p
              style={{
                fontSize: 13,
                color: '#666',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Envoyez-nous un message, nous vous repondrons rapidement.
            </p>
          </div>

          <form onSubmit={handleIdentify}>
            <div style={{ marginBottom: 12 }}>
              <label
                htmlFor="livechat-name"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#000',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Votre nom
              </label>
              <input
                id="livechat-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Jean Dupont"
                required
                maxLength={100}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '2px solid #000',
                  fontSize: 14,
                  color: '#000',
                  backgroundColor: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = '2px 2px 0px #00E5FF'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="livechat-email"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#000',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Votre email
              </label>
              <input
                id="livechat-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="jean@exemple.fr"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '2px solid #000',
                  fontSize: 14,
                  color: '#000',
                  backgroundColor: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = '2px 2px 0px #00E5FF'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '2px solid #FF4444',
                  backgroundColor: '#FFF0F0',
                  color: '#CC0000',
                  fontSize: 13,
                  marginBottom: 12,
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={identifyLoading || !formEmail.trim() || !formName.trim()}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '3px solid #000',
                backgroundColor: '#00E5FF',
                color: '#000',
                fontSize: 14,
                fontWeight: 900,
                cursor:
                  identifyLoading || !formEmail.trim() || !formName.trim()
                    ? 'not-allowed'
                    : 'pointer',
                boxShadow: '4px 4px 0px #000',
                transition: 'all 0.15s',
                opacity:
                  identifyLoading || !formEmail.trim() || !formName.trim()
                    ? 0.5
                    : 1,
              }}
              onMouseEnter={(e) => {
                if (!identifyLoading) {
                  e.currentTarget.style.transform = 'translate(2px, 2px)'
                  e.currentTarget.style.boxShadow = '2px 2px 0px #000'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translate(0, 0)'
                e.currentTarget.style.boxShadow = '4px 4px 0px #000'
              }}
            >
              {identifyLoading ? 'Connexion...' : 'Demarrer le chat'}
            </button>
          </form>
        </div>
      )}

      {/* ── Rating Screen ── */}
      {screen === 'rating' && (
        <div style={{ padding: 24, flex: 1 }}>
          {ratingSubmitted ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 0',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  border: '3px solid #000',
                  backgroundColor: '#22c55e',
                  boxShadow: '3px 3px 0px #000',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  color: '#fff',
                  fontSize: 28,
                }}
              >
                ✓
              </div>
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: '#000',
                  margin: '0 0 6px',
                }}
              >
                Merci pour votre avis !
              </p>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                Votre retour nous aide a nous ameliorer.
              </p>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: '#000',
                    margin: '0 0 6px',
                  }}
                >
                  Comment etait cet echange ?
                </p>
                <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                  Notez votre experience (optionnel)
                </p>
              </div>

              {/* Stars */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 20,
                }}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setRatingHover(star)}
                    onMouseLeave={() => setRatingHover(0)}
                    aria-label={`${star} etoile${star > 1 ? 's' : ''}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                      fontSize: 32,
                      lineHeight: 1,
                      color:
                        star <= (ratingHover || rating) ? '#FFD600' : '#E5E5E5',
                      transition: 'color 0.15s, transform 0.15s',
                      transform:
                        star <= ratingHover ? 'scale(1.2)' : 'scale(1)',
                      filter:
                        star <= (ratingHover || rating)
                          ? 'drop-shadow(1px 1px 0px #000)'
                          : 'none',
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>

              {/* Comment */}
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Un commentaire ? (optionnel)"
                maxLength={500}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '2px solid #000',
                  fontSize: 13,
                  color: '#000',
                  backgroundColor: '#fff',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  transition: 'box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = '2px 2px 0px #00E5FF'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginTop: 16,
                }}
              >
                <button
                  type="button"
                  onClick={handleSubmitRating}
                  disabled={rating === 0 && !ratingComment.trim()}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '3px solid #000',
                    backgroundColor:
                      rating === 0 && !ratingComment.trim()
                        ? '#E5E5E5'
                        : '#00E5FF',
                    color: '#000',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor:
                      rating === 0 && !ratingComment.trim()
                        ? 'not-allowed'
                        : 'pointer',
                    boxShadow: '4px 4px 0px #000',
                    transition: 'all 0.15s',
                    opacity:
                      rating === 0 && !ratingComment.trim() ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (rating > 0 || ratingComment.trim()) {
                      e.currentTarget.style.transform = 'translate(2px, 2px)'
                      e.currentTarget.style.boxShadow = '2px 2px 0px #000'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translate(0, 0)'
                    e.currentTarget.style.boxShadow = '4px 4px 0px #000'
                  }}
                >
                  Envoyer mon avis
                </button>
                <button
                  type="button"
                  onClick={handleSkipRating}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#999',
                    textDecoration: 'underline',
                    padding: '6px 0',
                    fontWeight: 600,
                  }}
                >
                  Passer et fermer
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Chat Screen ── */}
      {screen === 'chat' && (
        <>
          {/* Messages area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {messages.length === 0 && !session?.sessionId && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '20px 0',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    border: '2px solid #000',
                    backgroundColor: '#FEFCE8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                    boxShadow: '2px 2px 0px #000',
                  }}
                >
                  <Send size={20} color="#000" />
                </div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#000',
                    margin: '0 0 4px',
                  }}
                >
                  Bonjour {session?.name?.split(' ')[0]} !
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: '#666',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Ecrivez votre message ci-dessous.
                </p>
              </div>
            )}

            {messages.length === 0 && session?.sessionId && (
              <div
                style={{
                  textAlign: 'center',
                  padding: 20,
                  color: '#999',
                  fontSize: 13,
                }}
              >
                Chargement des messages...
              </div>
            )}

            {messages.map((msg) => {
              const isClient = msg.senderType === 'client'
              const isSystem = msg.senderType === 'system'

              // System messages are centered
              if (isSystem) {
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        backgroundColor: '#F5F5F5',
                        border: '1px solid #E5E5E5',
                        color: '#888',
                        fontSize: 12,
                        fontStyle: 'italic',
                        textAlign: 'center',
                        maxWidth: '90%',
                      }}
                    >
                      {msg.body}
                      <div
                        style={{
                          fontSize: 10,
                          color: '#bbb',
                          marginTop: 2,
                        }}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: isClient ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '10px 14px',
                      borderRadius: isClient
                        ? '14px 14px 4px 14px'
                        : '14px 14px 14px 4px',
                      backgroundColor: isClient ? '#00E5FF' : '#F5F5F5',
                      border: `2px solid ${isClient ? '#000' : '#E5E5E5'}`,
                      color: '#000',
                    }}
                  >
                    {!isClient && (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#FF8A00',
                          marginBottom: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        Support
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.body}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: isClient ? 'rgba(0,0,0,0.4)' : '#999',
                        marginTop: 4,
                        textAlign: 'right',
                      }}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Error banner */}
          {error && (
            <div
              style={{
                padding: '8px 16px',
                backgroundColor: '#FFF0F0',
                borderTop: '2px solid #FF4444',
                color: '#CC0000',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#CC0000',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input area */}
          <div
            style={{
              borderTop: '3px solid #000',
              padding: 12,
              backgroundColor: '#fff',
            }}
          >
            <form
              onSubmit={handleSendMessage}
              style={{ display: 'flex', gap: 8 }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Votre message..."
                maxLength={2000}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '2px solid #000',
                  fontSize: 14,
                  color: '#000',
                  backgroundColor: '#fff',
                  outline: 'none',
                  transition: 'box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = '2px 2px 0px #00E5FF'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                }}
                autoFocus
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                aria-label="Envoyer"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  border: '2px solid #000',
                  backgroundColor:
                    !input.trim() || sending ? '#E5E5E5' : '#00E5FF',
                  color: '#000',
                  cursor:
                    !input.trim() || sending ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                  opacity: !input.trim() || sending ? 0.5 : 1,
                }}
              >
                <Send size={18} strokeWidth={2.5} />
              </button>
            </form>

            {/* Session info + actions */}
            {session?.sessionId && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid #E5E5E5',
                }}
              >
                <span style={{ fontSize: 11, color: '#999' }}>
                  {session.email}
                </span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={handleEndChat}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#FF4444',
                      padding: 0,
                    }}
                  >
                    Terminer
                  </button>
                  <button
                    onClick={handleNewConversation}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#00E5FF',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Nouveau sujet
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
