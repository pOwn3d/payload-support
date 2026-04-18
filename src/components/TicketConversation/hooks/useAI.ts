import { useState, useEffect } from 'react'
import type { Message, ClientInfo } from '../types'
import type { RichTextEditorHandle } from '../context'

export function useAI(
  messages: Message[],
  client: ClientInfo | null,
  ticketSubject: string,
  replyBody: string,
  setReplyBody: (v: string) => void,
  setReplyHtml: (v: string) => void,
  replyEditorRef: React.RefObject<RichTextEditorHandle | null>,
) {
  const [clientSentiment, setClientSentiment] = useState<{ emoji: string; label: string; color: string } | null>(null)
  const [aiReplying, setAiReplying] = useState(false)
  const [aiRewriting, setAiRewriting] = useState(false)
  const [showAiSummary, setShowAiSummary] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiSaved, setAiSaved] = useState(false)

  // Sentiment analysis on last client message
  useEffect(() => {
    if (messages.length === 0) return
    const lastClientMsg = [...messages].reverse().find((m) => m.authorType === 'client' || m.authorType === 'email')
    if (!lastClientMsg) return

    const analyze = async () => {
      try {
        const res = await fetch('/api/support/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'sentiment', text: lastClientMsg.body.slice(0, 500) }),
        })
        if (res.ok) {
          const data = await res.json()
          const raw = (data.sentiment || '').toLowerCase().trim()
          const sentimentMap: Record<string, { emoji: string; label: string; color: string }> = {
            'frustré': { emoji: '\uD83D\uDE24', label: 'Frustré', color: '#dc2626' },
            'frustre': { emoji: '\uD83D\uDE24', label: 'Frustré', color: '#dc2626' },
            'mécontent': { emoji: '\uD83D\uDE20', label: 'Mécontent', color: '#ea580c' },
            'mecontent': { emoji: '\uD83D\uDE20', label: 'Mécontent', color: '#ea580c' },
            'urgent': { emoji: '\uD83D\uDD25', label: 'Urgent', color: '#dc2626' },
            'neutre': { emoji: '\uD83D\uDE10', label: 'Neutre', color: '#6b7280' },
            'satisfait': { emoji: '\uD83D\uDE0A', label: 'Satisfait', color: '#16a34a' },
          }
          const match = Object.keys(sentimentMap).find((k) => raw.includes(k))
          if (match) setClientSentiment(sentimentMap[match])
          else setClientSentiment({ emoji: '\uD83D\uDE10', label: 'Neutre', color: '#6b7280' })
        }
      } catch { /* silent */ }
    }
    analyze()
  }, [messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAiSuggestReply = async () => {
    if (messages.length === 0) return
    setAiReplying(true)
    try {
      const res = await fetch('/api/support/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'suggest_reply',
          messages: messages.slice(-10).map((m) => ({ authorType: m.authorType, body: m.body })),
          clientName: `${client?.firstName || ''} ${client?.lastName || ''}`.trim(),
          clientCompany: client?.company,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const suggestion = data.reply || ''
        if (suggestion) {
          setReplyBody(suggestion)
          setReplyHtml(suggestion.replace(/\n/g, '<br/>'))
          if (replyEditorRef.current?.setContent) {
            replyEditorRef.current.setContent(suggestion.replace(/\n/g, '<br/>'))
          }
        }
      }
    } catch (err) {
      console.error('AI suggest error:', err)
    }
    setAiReplying(false)
  }

  const handleAiRewrite = async (style: string = 'auto') => {
    if (!replyBody.trim()) return
    // Detect selection inside the editor — if present, rewrite only the selected text
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    const selectedText = sel?.toString().trim() || ''
    const hasSelection = selectedText.length > 3
    const textToRewrite = hasSelection ? selectedText : replyBody

    setAiRewriting(true)
    try {
      const res = await fetch('/api/support/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'rewrite', text: textToRewrite, style }),
      })
      if (res.ok) {
        const data = await res.json()
        const rewritten = data.rewritten || ''
        if (rewritten) {
          if (hasSelection && sel && sel.rangeCount > 0) {
            // Replace only the selected text in the contentEditable
            const range = sel.getRangeAt(0)
            range.deleteContents()
            range.insertNode(document.createTextNode(rewritten))
            // Trigger input event so parent state updates via onInput
            const editorEl = replyEditorRef.current as unknown as { focus?: () => void } | null
            editorEl?.focus?.()
            // Sync state from DOM
            const rootEl = (range.commonAncestorContainer as HTMLElement).closest?.('[contenteditable]') as HTMLElement | null
            if (rootEl) {
              const newHtml = rootEl.innerHTML
              const newText = rootEl.innerText?.trim() || ''
              setReplyBody(newText)
              setReplyHtml(newHtml)
            }
          } else {
            setReplyBody(rewritten)
            setReplyHtml(rewritten.replace(/\n/g, '<br/>'))
            if (replyEditorRef.current?.setContent) {
              replyEditorRef.current.setContent(rewritten.replace(/\n/g, '<br/>'))
            }
          }
        }
      }
    } catch (err) {
      console.error('AI rewrite error:', err)
    }
    setAiRewriting(false)
  }

  const handleAiGenerate = async () => {
    if (messages.length === 0) return
    setAiGenerating(true)
    setAiSummary('')
    setAiSaved(false)
    try {
      const res = await fetch('/api/support/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'synthesis',
          messages: messages.map((m) => ({ authorType: m.authorType, body: m.body, createdAt: m.createdAt })),
          ticketSubject,
          clientName: `${client?.firstName || ''} ${client?.lastName || ''}`.trim(),
          clientCompany: client?.company,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiSummary(data.synthesis || 'Aucune réponse générée')
      } else {
        setAiSummary('Erreur lors de la génération de la synthèse.')
      }
    } catch (err) {
      setAiSummary(`Erreur de connexion : ${err instanceof Error ? err.message : 'erreur inconnue'}`)
    } finally {
      setAiGenerating(false)
    }
  }

  const handleAiSave = async (id: string | number | undefined, fetchAll: () => void) => {
    if (!id || !aiSummary) return
    setAiSaving(true)
    try {
      const res = await fetch('/api/ticket-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ticket: id,
          body: `\uD83D\uDCCB **Synthèse IA (${new Date().toLocaleDateString('fr-FR')})**\n\n${aiSummary}`,
          authorType: 'admin',
          isInternal: true,
        }),
      })
      if (res.ok) {
        setAiSaved(true)
        fetchAll()
      }
    } catch { /* ignore */ } finally {
      setAiSaving(false)
    }
  }

  return {
    clientSentiment,
    aiReplying, handleAiSuggestReply,
    aiRewriting, handleAiRewrite,
    showAiSummary, setShowAiSummary,
    aiSummary, aiGenerating, handleAiGenerate,
    aiSaving, aiSaved, handleAiSave,
  }
}
