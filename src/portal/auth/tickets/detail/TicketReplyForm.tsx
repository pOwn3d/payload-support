'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
// RichTextEditor must be provided by the host application
// import { RichTextEditor } from '@/components/RichTextEditor'
import { useTypingSignal } from './TypingIndicator'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_FILE_SIZE_LABEL = '5 Mo'

export function TicketReplyForm({ ticketId }: { ticketId: number | string }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendTyping = useTypingSignal(Number(ticketId))
  const [body, setBody] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [editorKey, setEditorKey] = useState(0)
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const handleEditorFileUpload = useCallback(async (file: File): Promise<string | null> => {
    if (file.size > 5 * 1024 * 1024) return null
    const formData = new FormData()
    formData.append('file', file)
    formData.append('_payload', JSON.stringify({ alt: file.name }))
    try {
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: formData })
      if (res.ok) {
        const data = await res.json()
        return data.doc?.url || null
      }
    } catch { /* ignore */ }
    return null
  }, [])

  const addFiles = useCallback((newFiles: File[]) => {
    const tooLarge = newFiles.filter((f) => f.size > MAX_FILE_SIZE)
    if (tooLarge.length > 0) {
      setError(`Fichier(s) trop volumineux (max ${MAX_FILE_SIZE_LABEL}) : ${tooLarge.map((f) => f.name).join(', ')}`)
    }
    setFiles((prev) => [...prev, ...newFiles.filter((f) => f.size <= MAX_FILE_SIZE)])
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }, [addFiles])

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!body.trim() && !bodyHtml) {
      setError('Le message ne peut pas être vide.')
      return
    }

    setLoading(true)

    try {
      // Upload files first if any
      const uploadedMediaIds: number[] = []
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('_payload', JSON.stringify({ alt: file.name }))

        const uploadRes = await fetch('/api/media', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          if (uploadData.doc?.id) {
            uploadedMediaIds.push(uploadData.doc.id)
          }
        }
      }

      // Create message with attachments via Payload REST API
      const finalBody = body.trim() || (bodyHtml ? '[Contenu enrichi]' : '')
      const messageData: Record<string, unknown> = {
        ticket: ticketId,
        body: finalBody,
        ...(bodyHtml ? { bodyHtml } : {}),
        authorType: 'client',
      }

      if (uploadedMediaIds.length > 0) {
        messageData.attachments = uploadedMediaIds.map((id) => ({ file: id }))
      }

      const res = await fetch('/api/ticket-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(messageData),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.errors?.[0]?.message || 'Erreur lors de l\'envoi.')
        return
      }

      setBody('')
      setBodyHtml('')
      setEditorKey((k) => k + 1)
      setFiles([])
      router.refresh()
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-xl transition-all ${
        isDragging
          ? 'bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-400/20'
          : ''
      }`}
    >
      <div>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {isDragging && (
          <div className="mb-4 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 p-8">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              D&eacute;posez vos fichiers ici
            </div>
          </div>
        )}

        {/* Message textarea */}
        <div className="mb-4">
          <textarea
            key={editorKey}
            value={body}
            onChange={(e) => { setBody(e.target.value); setBodyHtml(''); sendTyping() }}
            placeholder="Écrivez votre message..."
            rows={5}
            className="w-full resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm leading-relaxed text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          />
        </div>

        {/* File attachments zone */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.csv"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Joindre (max {MAX_FILE_SIZE_LABEL})
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={loading || (!body.trim() && !bodyHtml)}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Envoi...
              </>
            ) : (
              <>
                Envoyer
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Attached files list */}
        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((file, index) => {
              const isImage = file.type.startsWith('image/')
              return (
                <div
                  key={index}
                  className="group flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-sm transition-colors hover:border-slate-300 dark:hover:border-slate-600"
                >
                  {isImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-7 w-7 rounded object-cover"
                    />
                  )}
                  {!isImage && (
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  )}
                  <span className="max-w-[120px] truncate text-xs font-medium text-slate-700 dark:text-slate-300">{file.name}</span>
                  <span className="text-xs font-mono text-slate-500">
                    {file.size < 1024 * 1024
                      ? `${(file.size / 1024).toFixed(0)}KB`
                      : `${(file.size / (1024 * 1024)).toFixed(1)}MB`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="ml-0.5 rounded-full p-0.5 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </form>
  )
}
