'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

interface ChatMessage {
  id: string
  senderType: 'client' | 'agent' | 'system'
  message: string
  createdAt: string
  agent?: { firstName?: string; lastName?: string } | null
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [session, setSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [closed, setClosed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastFetchRef = useRef<string | null>(null)
  const pollInterval = useRef(3000)
  const pollTimeout = useRef<NodeJS.Timeout>(undefined)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Receive messages via SSE (with polling fallback)
  const [pollExpired, setPollExpired] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const usingSSE = useRef(false)

  useEffect(() => {
    if (!session || closed || pollExpired) return

    // Helper to merge new messages into state
    const mergeMessages = (newMsgs: ChatMessage[]) => {
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        const filtered = newMsgs.filter((m) => !existingIds.has(m.id))
        if (filtered.length === 0) return prev
        return [...prev, ...filtered]
      })
      if (newMsgs.length > 0) {
        lastFetchRef.current = newMsgs[newMsgs.length - 1].createdAt
        // Check if session was closed by agent
        const lastMsg = newMsgs[newMsgs.length - 1]
        if (lastMsg.senderType === 'system' && lastMsg.message.includes('terminé')) {
          setClosed(true)
        }
      }
    }

    // Try SSE first
    if (typeof EventSource !== 'undefined') {
      const es = new EventSource(`/api/support/chat-stream?session=${session}`)
      eventSourceRef.current = es
      usingSSE.current = true

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'messages' && parsed.data?.length > 0) {
            mergeMessages(parsed.data)
          } else if (parsed.type === 'closed') {
            setClosed(true)
          }
        } catch {
          // Ignore parse errors
        }
      }

      es.onerror = () => {
        // SSE connection lost — close and fall back to polling
        es.close()
        eventSourceRef.current = null
        usingSSE.current = false
      }

      return () => {
        es.close()
        eventSourceRef.current = null
        usingSSE.current = false
      }
    }

    // Fallback: adaptive polling (same as before)
    usingSSE.current = false

    const poll = async () => {
      let hadNewMessages = false
      try {
        const after = lastFetchRef.current || ''
        const url = `/api/support/chat?session=${session}${after ? `&after=${after}` : ''}`
        const res = await fetch(url, { credentials: 'include' })
        if (res.status === 401 || res.status === 403) { setPollExpired(true); return }
        if (res.ok) {
          const data = await res.json()
          if (data.messages?.length > 0) {
            mergeMessages(data.messages)
            hadNewMessages = true
          }
        }
      } catch (err) {
        console.warn('[ChatWidget] Polling error:', err)
      }
      if (hadNewMessages) {
        pollInterval.current = 3000
      } else {
        pollInterval.current = Math.min(pollInterval.current + 2000, 15000)
      }
    }

    pollInterval.current = 3000
    poll()

    const schedulePoll = () => {
      pollTimeout.current = setTimeout(async () => {
        if (usingSSE.current) return // SSE reconnected, stop polling
        await poll()
        schedulePoll()
      }, pollInterval.current)
    }
    schedulePoll()

    return () => clearTimeout(pollTimeout.current)
  }, [session, closed, pollExpired])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const startChat = async () => {
    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'start' }),
      })
      if (res.ok) {
        const data = await res.json()
        setSession(data.session)
        setMessages(data.messages || [])
        lastFetchRef.current = data.messages?.[data.messages.length - 1]?.createdAt || null
        setClosed(false)
      }
    } catch (err) {
      console.warn('[ChatWidget] Error starting chat:', err)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !session || sending) return

    setSending(true)
    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'send', session, message: input.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
        lastFetchRef.current = data.message.createdAt
        setInput('')
      }
    } catch (err) {
      console.warn('[ChatWidget] Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  const closeChat = async () => {
    if (!session) return
    try {
      await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'close', session }),
      })
    } catch (err) {
      console.warn('[ChatWidget] Error closing chat:', err)
    }
    setClosed(true)
  }

  const resetChat = () => {
    setSession(null)
    setMessages([])
    setClosed(false)
    lastFetchRef.current = null
  }

  return (
    <>
      {/* Chat toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border-3 border-black bg-[#00E5FF] shadow-[4px_4px_0px_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000] dark:border-gray-600 dark:shadow-[4px_4px_0px_#333]"
          title="Chat en direct"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border-4 border-black bg-white shadow-[6px_6px_0px_#000] dark:border-gray-600 dark:bg-gray-900 dark:shadow-[6px_6px_0px_#333]">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-xl border-b-3 border-black bg-[#00E5FF] px-4 py-3 dark:border-gray-600">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border-2 border-black bg-green-400" />
              <span className="text-sm font-black text-black">Chat en direct</span>
            </div>
            <div className="flex items-center gap-1">
              {session && !closed && (
                <button
                  onClick={closeChat}
                  className="rounded-lg p-1 text-black/60 transition-colors hover:bg-black/10 hover:text-black"
                  title="Terminer le chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-black/60 transition-colors hover:bg-black/10 hover:text-black"
                title="Réduire"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4">
            {!session ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-3 border-black bg-[#FFD600] shadow-[3px_3px_0px_#000] dark:border-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-black text-black dark:text-white">Besoin d&apos;aide ?</h3>
                <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                  Démarrez une conversation avec notre équipe support.
                </p>
                <button
                  onClick={startChat}
                  className="rounded-xl border-3 border-black bg-[#00E5FF] px-6 py-3 text-sm font-black text-black shadow-[4px_4px_0px_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000]"
                >
                  Démarrer le chat
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === 'client' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.senderType === 'system' ? (
                      <div className="w-full rounded-lg bg-gray-100 px-3 py-2 text-center text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        {msg.message}
                      </div>
                    ) : (
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          msg.senderType === 'client'
                            ? 'border-2 border-black bg-[#00E5FF] text-black'
                            : 'border-2 border-gray-200 bg-gray-100 text-black dark:border-gray-700 dark:bg-gray-800 dark:text-white'
                        }`}
                      >
                        {msg.senderType === 'agent' && msg.agent && (
                          <p className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                            {(msg.agent as { firstName?: string })?.firstName || 'Agent'}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <p className={`mt-1 text-xs ${msg.senderType === 'client' ? 'text-black/50' : 'text-gray-400'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {closed && (
              <div className="mt-4 text-center">
                <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Le chat est terminé.</p>
                <button
                  onClick={resetChat}
                  className="rounded-xl border-2 border-black bg-[#FFD600] px-4 py-2 text-xs font-bold text-black shadow-[2px_2px_0px_#000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000]"
                >
                  Nouveau chat
                </button>
              </div>
            )}
          </div>

          {/* Input area */}
          {session && !closed && (
            <form onSubmit={sendMessage} className="border-t-3 border-black p-3 dark:border-gray-600">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Tapez votre message..."
                  maxLength={2000}
                  className="flex-1 rounded-xl border-2 border-black px-3 py-2 text-sm outline-none transition-shadow focus:shadow-[2px_2px_0px_#00E5FF] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="rounded-xl border-2 border-black bg-[#00E5FF] px-3 py-2 font-bold text-black transition-all hover:shadow-[2px_2px_0px_#000] disabled:opacity-50 dark:border-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  )
}
