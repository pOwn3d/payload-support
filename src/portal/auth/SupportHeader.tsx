'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import type { SupportUser } from './layout'

const DARK_MODE_KEY = 'support-dark-mode'
const _NOTIFICATION_KEY = 'support-notifications'

export function SupportHeader({ user }: { user: SupportUser }) {
  const router = useRouter()
  const pathname = usePathname()
  const [darkMode, setDarkMode] = useState(false)
  const [impersonation, setImpersonation] = useState<{ adminEmail: string; clientCompany: string } | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const prevUnreadCountRef = useRef(0)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Fetch unread ticket count
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/tickets?where[status][not_equals]=resolved&limit=100&depth=0', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const docs = data.docs || []
      let count = 0
      for (const t of docs) {
        if (t.updatedAt && (!t.lastClientReadAt || new Date(t.lastClientReadAt) < new Date(t.updatedAt))) {
          count++
        }
      }

      // Show browser notification when unread count increases
      if (count > prevUnreadCountRef.current && prevUnreadCountRef.current >= 0) {
        const diff = count - prevUnreadCountRef.current
        if (diff > 0 && Notification.permission === 'granted' && typeof document !== 'undefined' && document.hidden) {
          const latestTicket = docs
            .filter((t: { updatedAt?: string; lastClientReadAt?: string }) =>
              t.updatedAt && (!t.lastClientReadAt || new Date(t.lastClientReadAt) < new Date(t.updatedAt)),
            )
            .sort((a: { updatedAt: string }, b: { updatedAt: string }) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            )[0]

          if (latestTicket) {
            showNewMessageNotification(
              latestTicket.ticketNumber || `#${latestTicket.id}`,
              latestTicket.subject || 'Nouveau message',
            )
          }
        }
      }

      prevUnreadCountRef.current = count
      setUnreadCount(count)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(DARK_MODE_KEY)
    if (stored === 'true') {
      setDarkMode(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    } else {
      setNotificationPermission('unsupported')
    }

    // Check impersonation cookie
    try {
      const match = document.cookie.split('; ').find((c) => c.startsWith('impersonating='))
      if (match) {
        const value = decodeURIComponent(match.split('=').slice(1).join('='))
        setImpersonation(JSON.parse(value))
      }
    } catch { /* ignore */ }

    // Initial fetch + polling for unread count
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [fetchUnread])

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleDarkMode = useCallback(() => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem(DARK_MODE_KEY, String(next))
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
  }, [darkMode])

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)

    if (permission === 'granted') {
      new Notification('Notifications activees', {
        body: 'Vous recevrez une notification quand le support repond.',
        icon: '/favicon.ico',
      })
    }
  }, [])

  const handleLogout = async () => {
    await fetch('/api/support-clients/logout', {
      method: 'POST',
      credentials: 'include',
    })
    router.push('/support/login')
    router.refresh()
  }

  const navLinks = [
    { href: '/support/dashboard', label: 'Mes tickets', icon: InboxIcon },
    { href: '/support/tickets/new', label: 'Nouveau ticket', icon: PlusIcon },
    { href: '/support/faq', label: 'FAQ', icon: HelpIcon },
  ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {impersonation && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-red-600 px-4 py-2 text-sm font-semibold text-white">
          <span>Mode impersonation — {impersonation.adminEmail} → {impersonation.clientCompany}</span>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/admin/stop-impersonation"
            className="rounded-md bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-red-600"
          >
            Quitter
          </a>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/support/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold text-slate-900 dark:text-white">Support</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => {
                const active = isActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                    {link.href === '/support/dashboard' && unreadCount > 0 && (
                      <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            {notificationPermission !== 'unsupported' && (
              <button
                onClick={requestNotificationPermission}
                className={`relative rounded-lg p-2 transition-colors ${
                  notificationPermission === 'granted'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300'
                }`}
                title={
                  notificationPermission === 'granted'
                    ? 'Notifications activees'
                    : notificationPermission === 'denied'
                      ? 'Notifications bloquees (modifiez dans les parametres du navigateur)'
                      : 'Activer les notifications'
                }
              >
                {notificationPermission === 'granted' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
                    <path d="M12 2C10.343 2 9 3.343 9 5v.26A5.001 5.001 0 0 0 7 10v4l-2 2v1h14v-1l-2-2v-4a5.001 5.001 0 0 0-2-4.74V5c0-1.657-1.343-3-3-3zM10 20a2 2 0 0 0 4 0h-4z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                )}
              </button>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              title={darkMode ? 'Mode clair' : 'Mode sombre'}
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Separator */}
            <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

            {/* User menu dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-bold text-white">
                  {(user.firstName?.[0] || '').toUpperCase()}{(user.lastName?.[0] || '').toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{user.company}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{user.firstName} {user.lastName}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden h-4 w-4 text-slate-400 sm:block">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50">
                  <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{user.company}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                  </div>
                  <div className="py-1.5">
                    <Link
                      href="/support/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-400">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Mon profil
                    </Link>
                    <button
                      onClick={() => { setUserMenuOpen(false); handleLogout() }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Deconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
            >
              {mobileMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 md:hidden">
            <div className="space-y-1">
              {navLinks.map((link) => {
                const active = isActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                    {link.href === '/support/dashboard' && unreadCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </nav>
        )}
      </header>
    </>
  )
}

// Icon components
function InboxIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

// Show a browser notification for a new message
function showNewMessageNotification(ticketNumber: string, preview: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    new Notification(`Nouveau message - ${ticketNumber}`, {
      body: preview.slice(0, 100),
      icon: '/favicon.ico',
      tag: `ticket-${ticketNumber}`,
    })
  } catch {
    // Notification constructor can fail in some contexts
  }
}
