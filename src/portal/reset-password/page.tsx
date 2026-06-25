'use client'

import React, { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.')
      return
    }

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/support-clients/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const data = await res.json()
        setError(data.errors?.[0]?.message || 'Le lien est invalide ou a expiré.')
      }
    } catch {
      setError('Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl border-4 border-black bg-white p-8 shadow-[6px_6px_0px_#000]">
          <p className="mb-4 text-lg font-bold text-red-600">Lien invalide</p>
          <p className="mb-6 text-sm text-gray-500">
            Ce lien de réinitialisation est invalide ou a expiré.
          </p>
          <Link
            href="/support/forgot-password"
            className="block w-full rounded-xl border-3 border-black bg-[#FFD600] px-6 py-3 text-center font-black text-black shadow-[4px_4px_0px_#000]"
          >
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-black">Nouveau mot de passe</h1>
        <p className="mt-2 text-gray-600">Choisissez votre nouveau mot de passe</p>
      </div>

      {success ? (
        <div className="rounded-2xl border-4 border-black bg-white p-8 shadow-[6px_6px_0px_#000]">
          <div className="mb-4 rounded-xl border-2 border-green-500 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            Mot de passe modifié avec succès !
          </div>
          <Link
            href="/support/login"
            className="block w-full rounded-xl border-3 border-black bg-[#00E5FF] px-6 py-3 text-center text-base font-black text-black shadow-[4px_4px_0px_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000]"
          >
            Se connecter
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border-4 border-black bg-white p-8 shadow-[6px_6px_0px_#000]"
        >
          {error && (
            <div className="mb-6 rounded-xl border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label htmlFor="password" className="mb-2 block text-sm font-bold text-black">
              Nouveau mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border-3 border-black px-4 py-3 text-base outline-none transition-shadow focus:shadow-[3px_3px_0px_#00E5FF]"
            />
            <p className="mt-1 text-xs text-gray-400">Minimum 8 caractères</p>
          </div>

          <div className="mb-6">
            <label htmlFor="confirm" className="mb-2 block text-sm font-bold text-black">
              Confirmer
            </label>
            <input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border-3 border-black px-4 py-3 text-base outline-none transition-shadow focus:shadow-[3px_3px_0px_#00E5FF]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border-3 border-black bg-[#00E5FF] px-6 py-3 text-base font-black text-black shadow-[4px_4px_0px_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000] disabled:opacity-50"
          >
            {loading ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Suspense fallback={<p className="text-gray-400">Chargement...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
