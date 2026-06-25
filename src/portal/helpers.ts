import type { LiveChatSession } from './types'

// ─── LocalStorage keys ──────────────────────────────────────

export const LS_KEY = 'support-livechat'

export function loadSession(): LiveChatSession | null {
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

export function saveSession(session: LiveChatSession): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(session))
  } catch {
    // localStorage full or disabled
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    // Ignore
  }
}
