'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export function MarkSolutionButton({
  messageId,
  isSolution,
}: {
  messageId: number | string
  isSolution: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleToggle = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/ticket-messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isSolution: !isSolution }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        setError('Échec. Veuillez réessayer.')
      }
    } catch (err) {
      console.warn('[MarkSolutionButton] Failed to toggle solution:', err)
      setError('Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`mt-2 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-[color,background-color,border-color,box-shadow,transform] motion-reduce:transition-none ${
        isSolution
          ? 'border-2 border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'border-2 border-gray-200 text-gray-400 hover:border-green-500 hover:text-green-600 dark:border-gray-600 dark:hover:border-green-500'
      } disabled:opacity-50`}
      title={isSolution ? 'Retirer le marquage solution' : 'Marquer comme solution'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <polyline points="20,6 9,17 4,12" />
      </svg>
      {isSolution ? 'Solution' : 'Marquer comme solution'}
    </button>
    {error && (
      <p className="text-[10px] font-medium text-red-500 dark:text-red-400">{error}</p>
    )}
    </div>
  )
}
