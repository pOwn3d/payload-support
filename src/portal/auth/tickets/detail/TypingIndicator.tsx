'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export function TypingIndicator({ ticketId }: { ticketId: number }) {
  const [typing, setTyping] = useState(false)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/support/typing?ticketId=${ticketId}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setTyping(data.typing)
          setName(data.name)
        }
      } catch { /* silent */ }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [ticketId])

  if (!typing) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400 dark:text-slate-500 animate-pulse">
      <div className="flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{name || 'Support'} est en train d&apos;écrire...</span>
    </div>
  )
}

export function useTypingSignal(ticketId: number) {
  const lastSent = useRef(0)

  const sendTyping = useCallback(() => {
    const now = Date.now()
    // Throttle: send at most every 3s
    if (now - lastSent.current < 3000) return
    lastSent.current = now

    fetch('/api/support/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ticketId }),
    }).catch(() => {})
  }, [ticketId])

  return sendTyping
}
