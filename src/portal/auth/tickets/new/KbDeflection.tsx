'use client'

import React, { useEffect, useState } from 'react'

interface KbResult {
  id: number | string
  title: string
  slug: string
  excerpt: string
  category: string
  score: number
}

interface KbDeflectionProps {
  query: string
  /** Max number of suggestions to show (default 3). */
  limit?: number
}

/**
 * Live KB suggestions under the "Subject" field of the new-ticket form.
 *
 * - Debounces the query (400ms) to avoid hitting the endpoint on each keystroke.
 * - Hides itself when the query is too short (< 3 chars) or returns no results.
 * - Renders nothing while loading the first time to avoid flicker.
 *
 * The goal is deflection: let the client find an answer before submitting a
 * ticket. Opens articles in a new tab so the form state is preserved.
 */
export default function KbDeflection({ query, limit = 3 }: KbDeflectionProps) {
  const [results, setResults] = useState<KbResult[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const trimmed = (query || '').trim()
    if (trimmed.length < 3) {
      setResults([])
      return
    }

    const ctrl = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/support/kb/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
          { signal: ctrl.signal, credentials: 'include' },
        )
        if (!res.ok) {
          setResults([])
          return
        }
        const data = (await res.json()) as { results?: KbResult[] }
        setResults(Array.isArray(data.results) ? data.results : [])
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setResults([])
      }
    }, 400)

    return () => {
      ctrl.abort()
      window.clearTimeout(timer)
    }
  }, [query, limit])

  // Reset dismissal whenever the user types a new query.
  useEffect(() => {
    setDismissed(false)
  }, [query])

  if (dismissed) return null
  if (!results || results.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Articles suggérés"
      className="animate-in slide-in-from-top-2 fade-in mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 duration-300 dark:border-blue-900/40 dark:bg-blue-950/30"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          💡 Ces articles peuvent répondre à votre question
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[11px] font-medium text-blue-600/70 hover:text-blue-700 dark:text-blue-300/70 dark:hover:text-blue-200"
        >
          Ignorer
        </button>
      </div>

      <ul className="space-y-2">
        {results.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-blue-100 bg-white p-3 transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-blue-900/50 dark:bg-slate-900/40 dark:hover:border-blue-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {r.title}
                </h4>
                {r.excerpt && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {r.excerpt}
                  </p>
                )}
              </div>
              <a
                href={`/support/kb/${r.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                Lire l&apos;article
              </a>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
        Mon problème n&apos;est pas résolu — continuez à remplir le formulaire pour créer un ticket.
      </p>
    </div>
  )
}
