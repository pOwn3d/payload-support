'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const EDIT_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

export function MessageActions({
  messageId,
  body,
  createdAt,
}: {
  messageId: number
  body: string
  createdAt: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(body)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const elapsed = Date.now() - new Date(createdAt).getTime()
  const canEdit = elapsed < EDIT_WINDOW_MS

  if (!canEdit) return null

  const remainingMin = Math.max(0, Math.ceil((EDIT_WINDOW_MS - elapsed) / 60000))

  const handleSave = async () => {
    if (!editText.trim() || editText === body) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/ticket-messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          body: editText.trim(),
          editedAt: new Date().toISOString(),
        }),
      })
      if (res.ok) {
        setEditing(false)
        router.refresh()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/ticket-messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          body: '[Message supprimé]',
          bodyHtml: '',
          deletedAt: new Date().toISOString(),
        }),
      })
      if (res.ok) {
        setConfirmDelete(false)
        router.refresh()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <button
            onClick={() => { setEditing(false); setEditText(body) }}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Annuler
          </button>
        </div>
      </div>
    )
  }

  if (confirmDelete) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-red-500">Supprimer ce message ?</span>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? '...' : 'Confirmer'}
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Annuler
        </button>
      </div>
    )
  }

  return (
    <div className="mt-1.5 flex items-center gap-3">
      <button
        onClick={() => setEditing(true)}
        className="text-[11px] font-medium text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        Modifier
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        className="text-[11px] font-medium text-slate-400 hover:text-red-500 transition-colors"
      >
        Supprimer
      </button>
      <span className="text-[10px] text-slate-300 dark:text-slate-600">{remainingMin}min restantes</span>
    </div>
  )
}

export function EditedBadge({ editedAt }: { editedAt?: string | null }) {
  if (!editedAt) return null
  return (
    <span className="ml-2 text-[10px] text-slate-400 dark:text-slate-500 italic">
      (modifié)
    </span>
  )
}

export function DeletedMessage() {
  return (
    <div className="italic text-sm text-slate-400 dark:text-slate-500">
      Ce message a été supprimé.
    </div>
  )
}
