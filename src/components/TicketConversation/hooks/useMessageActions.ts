import { useState } from 'react'
import type { Message, ClientInfo } from '../types'

export function useMessageActions(
  id: string | number | undefined,
  client: ClientInfo | null,
  fetchAll: () => void,
) {
  const [togglingAuthor, setTogglingAuthor] = useState<string | number | null>(null)
  const [editingMsg, setEditingMsg] = useState<string | number | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editHtml, setEditHtml] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingMsg, setDeletingMsg] = useState<string | number | null>(null)
  const [resendingMsg, setResendingMsg] = useState<string | number | null>(null)
  const [resendSuccess, setResendSuccess] = useState<string | number | null>(null)

  const handleEditStart = (msg: Message) => {
    setEditingMsg(msg.id)
    setEditBody(msg.body)
    setEditHtml(msg.bodyHtml || msg.body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />'))
  }

  const handleEditSave = async (msgId: string | number) => {
    if (!editBody.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/ticket-messages/${msgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: editBody.trim(), ...(editHtml ? { bodyHtml: editHtml } : {}) }),
      })
      if (res.ok) {
        setEditingMsg(null)
        setEditBody('')
        fetchAll()
      }
    } catch { /* ignore */ } finally {
      setSavingEdit(false)
    }
  }

  const handleEditCancel = () => {
    setEditingMsg(null)
    setEditBody('')
    setEditHtml('')
  }

  const handleDelete = async (msgId: string | number) => {
    if (!window.confirm('Supprimer ce message ?')) return
    setDeletingMsg(msgId)
    try {
      const res = await fetch(`/api/ticket-messages/${msgId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) fetchAll()
    } catch { /* ignore */ } finally {
      setDeletingMsg(null)
    }
  }

  const handleResend = async (msgId: string | number) => {
    setResendingMsg(msgId)
    setResendSuccess(null)
    try {
      const res = await fetch('/api/support/resend-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId: msgId }),
      })
      if (res.ok) {
        setResendSuccess(msgId)
        setTimeout(() => setResendSuccess(null), 3000)
      }
    } catch { /* ignore */ } finally {
      setResendingMsg(null)
    }
  }

  const handleToggleAuthor = async (msgId: string | number, currentType: string) => {
    const newType = currentType === 'admin' ? 'client' : 'admin'
    setTogglingAuthor(msgId)
    try {
      const patchData: Record<string, unknown> = { authorType: newType }
      if (newType === 'client' && client) {
        patchData.authorClient = client.id
      }
      const res = await fetch(`/api/ticket-messages/${msgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patchData),
      })
      if (res.ok) fetchAll()
    } catch { /* ignore */ } finally {
      setTogglingAuthor(null)
    }
  }

  const handleSplitMessage = async (msgId: string | number, ticketSubject: string) => {
    const subject = prompt('Sujet du nouveau ticket :', `Split: ${ticketSubject}`)
    if (!subject) return
    try {
      const res = await fetch('/api/support/split-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId: msgId, subject }),
      })
      if (res.ok) {
        const data = await res.json()
        alert(`Ticket ${data.ticketNumber} créé`)
        fetchAll()
      }
    } catch { /* ignore */ }
  }

  return {
    togglingAuthor,
    editingMsg, editBody, editHtml, setEditHtml, savingEdit,
    handleEditStart, handleEditSave, handleEditCancel,
    deletingMsg, handleDelete,
    resendingMsg, resendSuccess, handleResend,
    handleToggleAuthor,
    handleSplitMessage,
    setEditBody,
  }
}
