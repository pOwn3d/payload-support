'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const POLL_INTERVAL = 30_000 // 30 seconds

/**
 * Polls for new messages on the current ticket.
 * Uses Payload REST API to check message count, then triggers a router.refresh()
 * if new messages are detected. Stops polling on session expiry (401/403).
 */
export function TicketPolling({
  ticketId,
  messageCount,
}: {
  ticketId: number | string
  messageCount: number
}) {
  const router = useRouter()
  const lastCount = useRef(messageCount)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    lastCount.current = messageCount
  }, [messageCount])

  useEffect(() => {
    if (sessionExpired) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/ticket-messages?where[ticket][equals]=${ticketId}&limit=0&depth=0`,
          { credentials: 'include' },
        )
        if (res.status === 401 || res.status === 403) {
          setSessionExpired(true)
          return
        }
        if (!res.ok) return

        const data = await res.json()
        if (data.totalDocs > lastCount.current) {
          lastCount.current = data.totalDocs
          router.refresh()
        }
      } catch (err) {
        console.warn('[TicketPolling] Poll failed:', err)
      }
    }, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [ticketId, router, sessionExpired])

  return null
}
