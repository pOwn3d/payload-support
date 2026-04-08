'use client'

import React, { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/support-clients/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (res.ok) {
        setSent(true)
      } else {
        // Payload returns 200 even if email doesn't exist (security)
        setSent(true)
      }
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-black bg-[#FFD600] shadow-[4px_4px_0px_#000]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-black">Mot de passe oublié</h1>
          <p className="mt-2 text-gray-600">Portail client</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border-4 border-black bg-white p-8 shadow-[6px_6px_0px_#000]">
            <div className="mb-4 rounded-xl border-2 border-green-500 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              Si un compte existe avec cette adresse, vous recevrez un email avec un lien de réinitialisation.
            </div>
            <p className="mb-6 text-sm text-gray-500">
              Vérifiez votre boîte de réception et vos spams. Le lien est valable 1 heure.
            </p>
            <Link
              href="/support/login"
              className="block w-full rounded-xl border-3 border-black bg-[#00E5FF] px-6 py-3 text-center text-base font-black text-black shadow-[4px_4px_0px_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000]"
            >
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border-4 border-black bg-white p-8 shadow-[6px_6px_0px_#000]"
          >
            <p className="mb-6 text-sm text-gray-600">
              Entrez votre adresse email. Vous recevrez un lien pour réinitialiser votre mot de passe.
            </p>

            {error && (
              <div className="mb-6 rounded-xl border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="email" className="mb-2 block text-sm font-bold text-black">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.fr"
                className="w-full rounded-xl border-3 border-black px-4 py-3 text-base outline-none transition-shadow focus:shadow-[3px_3px_0px_#00E5FF]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl border-3 border-black bg-[#FFD600] px-6 py-3 text-base font-black text-black shadow-[4px_4px_0px_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000] disabled:opacity-50"
            >
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/support/login" className="font-semibold text-black hover:underline">
            &larr; Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
