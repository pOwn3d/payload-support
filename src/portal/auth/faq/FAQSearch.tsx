'use client'

import React, { useState, useMemo } from 'react'

interface Article {
  id: string
  title: string
  category: string
  slug: string
}

export function FAQSearch({ articles }: { articles: Article[] }) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return articles.filter((a) => a.title.toLowerCase().includes(q))
  }, [query, articles])

  const showResults = query.trim().length > 0

  return (
    <div className="relative mb-10">
      {/* Search input */}
      <div className={`relative rounded-2xl border bg-white dark:bg-slate-800/50 shadow-sm backdrop-blur-sm transition-all duration-200 ${
        isFocused
          ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-md'
          : 'border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
      }`}>
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 transition-colors duration-200 ${isFocused ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`}>
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Rechercher un article..."
          className="w-full bg-transparent py-4 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>

      {/* Search results dropdown */}
      {showResults && (
        <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-lg">
          {results.length === 0 ? (
            <div className="flex flex-col items-center py-8 px-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Aucun resultat pour &laquo;&nbsp;{query}&nbsp;&raquo;
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Essayez avec d&apos;autres mots-cles</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              <div className="px-4 py-2.5">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  {results.length} resultat{results.length > 1 ? 's' : ''}
                </p>
              </div>
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    // Find and open the details element
                    const details = document.querySelectorAll('details')
                    details.forEach((d) => {
                      const summary = d.querySelector('summary span')
                      if (summary?.textContent === r.title) {
                        d.open = true
                        d.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                    })
                    setQuery('')
                  }}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors">
                      <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v11.5A2.25 2.25 0 004.25 18h11.5A2.25 2.25 0 0018 15.75V4.25A2.25 2.25 0 0015.75 2H4.25zm4.03 6.28a.75.75 0 00-1.06-1.06L4.97 9.47a.75.75 0 000 1.06l2.25 2.25a.75.75 0 001.06-1.06L6.56 10l1.72-1.72zm2.44-1.06a.75.75 0 011.06 0l2.25 2.25a.75.75 0 010 1.06l-2.25 2.25a.75.75 0 11-1.06-1.06L12.44 10l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {r.title}
                    </p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0 text-slate-300 dark:text-slate-600 transition-colors group-hover:text-blue-400">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
