'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

type Toast = { type: 'success' | 'error'; message: string } | null
type ToastPayload = NonNullable<Toast>
type Modal = 'transfer' | 'invite' | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Props {
  ticketId: number | string
}

/**
 * Sidebar actions on the ticket detail page:
 * - Transferer par email     → POST /api/support/tickets/:id/transfer
 * - Inviter un collegue      → POST /api/support/tickets/:id/invite
 *
 * Each action opens a modal (focus trap + ESC to close) with a small form
 * and a toast for feedback.
 */
export function TransferAndInviteActions({ ticketId }: Props) {
  const [modal, setModal] = useState<Modal>(null)
  const [toast, setToast] = useState<Toast>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const closeModal = useCallback(() => setModal(null), [])

  return (
    <>
      <button
        type="button"
        onClick={() => setModal('transfer')}
        className="inline-flex w-full items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        Transf&eacute;rer par email
      </button>
      <button
        type="button"
        onClick={() => setModal('invite')}
        className="inline-flex w-full items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
        Inviter un coll&egrave;gue
      </button>

      {modal === 'transfer' && (
        <TransferModal
          ticketId={ticketId}
          onClose={closeModal}
          onResult={(t) => {
            setToast(t)
            if (t.type === 'success') closeModal()
          }}
        />
      )}
      {modal === 'invite' && (
        <InviteModal
          ticketId={ticketId}
          onClose={closeModal}
          onResult={(t) => {
            setToast(t)
            if (t.type === 'success') closeModal()
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-white text-emerald-800 dark:border-emerald-700/50 dark:bg-slate-800 dark:text-emerald-200'
              : 'border-red-200 bg-white text-red-800 dark:border-red-700/50 dark:bg-slate-800 dark:text-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-emerald-500" aria-hidden>
              <polyline points="20,6 9,17 4,12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-red-500" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
    </>
  )
}

// ─── Modale Transferer ───────────────────────────────────

function TransferModal({
  ticketId,
  onClose,
  onResult,
}: {
  ticketId: number | string
  onClose: () => void
  onResult: (t: ToastPayload) => void
}) {
  const [email, setEmail] = useState('')
  const [includeAttachments, setIncludeAttachments] = useState(true)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = email.trim().toLowerCase()
    if (!cleaned || !EMAIL_RE.test(cleaned)) {
      onResult({ type: 'error', message: 'Email invalide' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/transfer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleaned, includeAttachments, message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onResult({ type: 'error', message: (data && data.error) || 'Echec du transfert' })
      } else {
        onResult({ type: 'success', message: `Transfert envoye a ${cleaned}` })
      }
    } catch (err) {
      console.warn('[TransferModal] Network error:', err)
      onResult({ type: 'error', message: 'Erreur reseau' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Transferer par email" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Destinataire</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="collegue@exemple.com"
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeAttachments}
            onChange={(e) => setIncludeAttachments(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-slate-700 dark:text-slate-300">
            Inclure les pieces jointes (en liens cliquables)
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Message (optionnel)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Un mot pour le destinataire..."
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </label>
        <ModalFooter onClose={onClose} loading={loading} submitLabel="Envoyer" />
      </form>
    </Modal>
  )
}

// ─── Modale Inviter ──────────────────────────────────────

function InviteModal({
  ticketId,
  onClose,
  onResult,
}: {
  ticketId: number | string
  onClose: () => void
  onResult: (t: ToastPayload) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'viewer' | 'collaborator'>('viewer')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = email.trim().toLowerCase()
    if (!cleaned || !EMAIL_RE.test(cleaned)) {
      onResult({ type: 'error', message: 'Email invalide' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleaned, role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onResult({ type: 'error', message: (data && data.error) || "Echec de l'invitation" })
      } else {
        onResult({ type: 'success', message: `Invitation envoyee a ${cleaned}` })
      }
    } catch (err) {
      console.warn('[InviteModal] Network error:', err)
      onResult({ type: 'error', message: 'Erreur reseau' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Inviter un collegue" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Email du collegue</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="collegue@exemple.com"
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'viewer' | 'collaborator')}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="viewer">Lecteur (consultation seule)</option>
            <option value="collaborator">Collaborateur (peut repondre)</option>
          </select>
        </label>
        <ModalFooter onClose={onClose} loading={loading} submitLabel="Inviter" />
      </form>
    </Modal>
  )
}

// ─── Modal shell (focus trap + ESC) ──────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const root = containerRef.current
        if (!root) return
        const focusables = root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    // Prevent background scroll
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      try {
        lastFocusedRef.current?.focus()
      } catch {
        /* noop */
      }
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={containerRef}
        className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({
  onClose,
  loading,
  submitLabel,
}: {
  onClose: () => void
  loading: boolean
  submitLabel: string
}) {
  return (
    <div className="mt-2 flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {loading && (
          <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {submitLabel}
      </button>
    </div>
  )
}
