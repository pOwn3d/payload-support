'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const categories = [
  { label: 'Bug / Dysfonctionnement', value: 'bug', icon: '🐛' },
  { label: 'Modification de contenu', value: 'content', icon: '📝' },
  { label: 'Nouvelle fonctionnalité', value: 'feature', icon: '✨' },
  { label: 'Question / Aide', value: 'question', icon: '💬' },
  { label: 'Hébergement / Domaine', value: 'hosting', icon: '🌐' },
]

const templates: Record<string, { subject: string; message: string }> = {
  bug: {
    subject: '',
    message: `**Description du bug :**\n\n**Étapes pour reproduire :**\n1. \n2. \n3. \n\n**Résultat attendu :**\n\n**Résultat actuel :**\n\n**Navigateur / Appareil :**\n`,
  },
  feature: {
    subject: '',
    message: `**Fonctionnalité souhaitée :**\n\n**Contexte / besoin :**\n\n**Comportement attendu :**\n\n**Priorité souhaitée :**\n`,
  },
  content: {
    subject: '',
    message: `**Page concernée :**\n\n**Modification demandée :**\n\n**Nouveau contenu :**\n`,
  },
  hosting: {
    subject: '',
    message: `**Nom de domaine :**\n\n**Description du problème :**\n\n**Message d'erreur (si applicable) :**\n`,
  },
}

const priorities = [
  { label: 'Basse', value: 'low', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  { label: 'Normale', value: 'normal', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  { label: 'Haute', value: 'high', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  { label: 'Urgente', value: 'urgent', color: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
]

interface Project {
  id: number | string
  name: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_FILE_SIZE_LABEL = '5 Mo'

export default function NewTicketPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('normal')
  const [project, setProject] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects?where[status][equals]=active&limit=50', {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          setProjects(data.docs || [])
        }
      } catch { /* ignore */ }
    }
    fetchProjects()
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

    if (!subject.trim() || !message.trim()) {
      setError('Le sujet et le message sont obligatoires.')
      return
    }

    setLoading(true)

    try {
      // Step 1: Upload files if any
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

      // Step 2: Create the ticket via Payload REST API
      const ticketRes = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: subject.trim(),
          category: category || undefined,
          priority,
          project: project || undefined,
          status: 'open',
        }),
      })

      const ticketData = await ticketRes.json()

      if (!ticketRes.ok || ticketData.errors) {
        setError(ticketData.errors?.[0]?.message || 'Erreur lors de la création du ticket.')
        return
      }

      // Step 3: Create the first message with attachments
      const messagePayload: Record<string, unknown> = {
        ticket: ticketData.doc.id,
        body: message.trim(),
        authorType: 'client',
      }

      if (uploadedMediaIds.length > 0) {
        messagePayload.attachments = uploadedMediaIds.map((id) => ({ file: id }))
      }

      const messageRes = await fetch('/api/ticket-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(messagePayload),
      })

      if (!messageRes.ok) {
        setError('Le ticket a été créé mais le message n\'a pas pu être envoyé.')
        return
      }

      router.push(`/support/tickets/${ticketData.doc.id}`)
      router.refresh()
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} o`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} Ko`
    return `${(size / (1024 * 1024)).toFixed(1)} Mo`
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12">
      {/* Back navigation */}
      <button
        onClick={() => router.back()}
        className="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Retour aux tickets
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-900/20 px-3 py-1">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Nouveau ticket</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Comment pouvons-nous vous aider ?
        </h1>
        <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
          Decrivez votre besoin en detail et nous vous repondrons dans les plus brefs delais.
        </p>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="space-y-6"
      >
        {/* Error alert */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Main card */}
        <div className={`rounded-2xl border bg-white dark:bg-slate-800/50 shadow-sm backdrop-blur-sm transition-all duration-200 ${
          isDragging
            ? 'border-blue-400 dark:border-blue-500 ring-4 ring-blue-100 dark:ring-blue-900/30 shadow-blue-100/50'
            : 'border-slate-200 dark:border-slate-700/50'
        }`}>
          <div className="p-6 sm:p-8">
            {/* Subject */}
            <div className="mb-6">
              <label htmlFor="subject" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Sujet <span className="text-red-400">*</span>
              </label>
              <input
                id="subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Erreur 404 sur la page contact"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            {/* Description */}
            <div className="mb-6">
              <label htmlFor="message" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                id="message"
                required
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Decrivez votre probleme en detail. Plus vous donnez d'informations, plus nous pourrons vous aider rapidement."
                className="w-full resize-y rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm leading-relaxed text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            {/* File attachments */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Pieces jointes
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.csv"
              />

              {/* Drop zone overlay */}
              {isDragging && (
                <div className="mb-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/80 dark:bg-blue-900/20 p-10">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 h-8 w-8 text-blue-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Deposez vos fichiers ici</p>
                </div>
              )}

              {/* Upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/30 px-6 py-4 transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 transition-colors group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Cliquez ou glissez-deposez vos fichiers
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Images, PDF, documents — max {MAX_FILE_SIZE_LABEL} par fichier
                  </p>
                </div>
              </button>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((file, index) => {
                    const isImage = file.type.startsWith('image/')
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 transition-colors hover:border-slate-200 dark:hover:border-slate-600"
                      >
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400">
                              <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{file.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{formatFileSize(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Advanced options toggle */}
            <div className="border-t border-slate-100 dark:border-slate-700/50 pt-5">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="group flex w-full items-center justify-between rounded-lg px-1 py-1 text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M17 2.75a.75.75 0 00-1.5 0v5.5a.75.75 0 001.5 0v-5.5zM17 15.75a.75.75 0 00-1.5 0v1.5a.75.75 0 001.5 0v-1.5zM3.75 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM4.5 2.75a.75.75 0 00-1.5 0v5.5a.75.75 0 001.5 0v-5.5zM10 11a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0v-5.5A.75.75 0 0110 11zM10.75 2.75a.75.75 0 00-1.5 0v1.5a.75.75 0 001.5 0v-1.5zM10 6a2 2 0 100 4 2 2 0 000-4zM3.75 10a2 2 0 100 4 2 2 0 000-4zM16.25 10a2 2 0 100 4 2 2 0 000-4z" />
                  </svg>
                  Options avancees
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-4 w-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
                >
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>

              {showAdvanced && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-xl border border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 p-5">
                  {/* Category */}
                  <div>
                    <label htmlFor="category" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Categorie
                    </label>
                    <select
                      id="category"
                      value={category}
                      onChange={(e) => {
                        const val = e.target.value
                        setCategory(val)
                        const tmpl = templates[val]
                        if (tmpl) {
                          if (!message.trim()) setMessage(tmpl.message)
                          if (!subject.trim() && tmpl.subject) setSubject(tmpl.subject)
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    >
                      <option value="">Selectionner</option>
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label htmlFor="priority" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Priorite
                    </label>
                    <select
                      id="priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    >
                      {priorities.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Project */}
                  {projects.length > 0 && (
                    <div>
                      <label htmlFor="project" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Projet
                      </label>
                      <select
                        id="project"
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      >
                        <option value="">Selectionner</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Submit footer */}
          <div className="border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 px-6 py-4 sm:px-8 rounded-b-2xl">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Les champs marques d&apos;un <span className="text-red-400">*</span> sont obligatoires
              </p>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    Creer le ticket
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
