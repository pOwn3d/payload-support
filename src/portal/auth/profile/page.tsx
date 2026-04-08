'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ProfileData {
  firstName: string
  lastName: string
  company: string
  phone: string
  email: string
  notifyOnReply: boolean
  notifyOnStatusChange: boolean
  twoFactorEnabled: boolean
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Account deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/support-clients/me', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setProfile({
            firstName: data.user?.firstName || '',
            lastName: data.user?.lastName || '',
            company: data.user?.company || '',
            phone: data.user?.phone || '',
            email: data.user?.email || '',
            notifyOnReply: data.user?.notifyOnReply !== false,
            notifyOnStatusChange: data.user?.notifyOnStatusChange !== false,
            twoFactorEnabled: data.user?.twoFactorEnabled === true,
          })
        }
      } catch {
        setError('Impossible de charger le profil.')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      // Get user ID first
      const meRes = await fetch('/api/support-clients/me', { credentials: 'include' })
      const meData = await meRes.json()
      const userId = meData.user?.id

      if (!userId) {
        setError('Session expirée. Veuillez vous reconnecter.')
        return
      }

      const res = await fetch(`/api/support-clients/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          company: profile.company,
          phone: profile.phone,
          notifyOnReply: profile.notifyOnReply,
          notifyOnStatusChange: profile.notifyOnStatusChange,
          twoFactorEnabled: profile.twoFactorEnabled,
        }),
      })

      if (res.ok) {
        setSuccess('Profil mis a jour avec succes.')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.errors?.[0]?.message || 'Erreur lors de la mise a jour.')
      }
    } catch {
      setError('Erreur de connexion.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword.length < 8) {
      setPasswordError('Le mot de passe doit faire au moins 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.')
      return
    }

    setChangingPassword(true)

    try {
      // Verify current password by logging in
      const loginRes = await fetch('/api/support-clients/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: profile?.email, password: currentPassword }),
      })

      if (!loginRes.ok) {
        setPasswordError('Mot de passe actuel incorrect.')
        return
      }

      // Get user ID
      const meRes = await fetch('/api/support-clients/me', { credentials: 'include' })
      const meData = await meRes.json()
      const userId = meData.user?.id

      // Update password
      const res = await fetch(`/api/support-clients/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: newPassword }),
      })

      if (res.ok) {
        setPasswordSuccess('Mot de passe modifie avec succes.')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordError('Erreur lors du changement de mot de passe.')
      }
    } catch {
      setPasswordError('Erreur de connexion.')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
        <p className="mt-4 text-sm font-medium text-slate-400 dark:text-slate-500">Chargement du profil...</p>
      </div>
    )
  }

  if (!profile) return null

  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12">
      {/* Back navigation */}
      <button
        onClick={() => router.push('/support/dashboard')}
        className="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Retour aux tickets
      </button>

      {/* Profile header */}
      <div className="mb-8 flex items-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-xl font-bold text-white shadow-lg shadow-blue-500/20">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Mon profil
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Gerez vos informations personnelles et vos preferences
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Personal info card ── */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 shadow-sm backdrop-blur-sm">
          <div className="border-b border-slate-100 dark:border-slate-700/50 px-6 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-blue-600 dark:text-blue-400">
                  <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Informations personnelles</h2>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="p-6 sm:p-8">
            {/* Alerts */}
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}
            {success && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{success}</p>
              </div>
            )}

            {/* Name row */}
            <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Prenom
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={profile.firstName}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Nom
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={profile.lastName}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>

            {/* Company */}
            <div className="mb-5">
              <label htmlFor="company" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Entreprise
              </label>
              <input
                id="company"
                type="text"
                required
                value={profile.company}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            {/* Phone */}
            <div className="mb-5">
              <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Telephone
              </label>
              <input
                id="phone"
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+33 6 00 00 00 00"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            {/* Email (read-only) */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0 text-slate-400">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-slate-500 dark:text-slate-400">{profile.email}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">L&apos;email ne peut pas etre modifie. Contactez le support si besoin.</p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Enregistrement...
                </>
              ) : (
                'Enregistrer les modifications'
              )}
            </button>
          </form>
        </div>

        {/* ── Security & 2FA card ── */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 shadow-sm backdrop-blur-sm">
          <div className="border-b border-slate-100 dark:border-slate-700/50 px-6 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-600 dark:text-amber-400">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Securite</h2>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {/* 2FA toggle */}
            <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-blue-600 dark:text-blue-400">
                    <path fillRule="evenodd" d="M10 2.5c-1.31 0-2.526.386-3.546 1.051a.75.75 0 01-.908-1.194A8.459 8.459 0 0110 1c1.51 0 2.934.398 4.16 1.094.71.404.607 1.258-.146 1.258-.017 0-.22-.109-.268-.132A6.947 6.947 0 0010 2.5zM5.25 10c0-.98.12-1.933.347-2.845a.75.75 0 10-1.452-.376A10.477 10.477 0 003.75 10c0 .98.12 1.933.347 2.845a.75.75 0 101.452-.376A8.953 8.953 0 015.25 10zm9.5 0c0 .98-.12 1.933-.347 2.845a.75.75 0 101.452.376c.246-.98.395-2 .395-3.221s-.149-2.241-.395-3.221a.75.75 0 10-1.452.376c.227.912.347 1.865.347 2.845zM10 17.5c1.31 0 2.526-.386 3.546-1.051a.75.75 0 01.908 1.194A8.459 8.459 0 0110 19c-1.51 0-2.934-.398-4.16-1.094-.71-.404-.607-1.258.146-1.258.017 0 .22.109.268.132A6.947 6.947 0 0010 17.5zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Verification en deux etapes (2FA)</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Recevoir un code par email a chaque connexion pour plus de securite</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfile({ ...profile, twoFactorEnabled: !profile.twoFactorEnabled })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${
                  profile.twoFactorEnabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'
                }`}
                role="switch"
                aria-checked={profile.twoFactorEnabled}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    profile.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ── Notifications card ── */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 shadow-sm backdrop-blur-sm">
          <div className="border-b border-slate-100 dark:border-slate-700/50 px-6 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-violet-600 dark:text-violet-400">
                  <path fillRule="evenodd" d="M10 2a6 6 0 00-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 00.515 1.076 32.91 32.91 0 003.256.508 3.5 3.5 0 006.972 0 32.903 32.903 0 003.256-.508.75.75 0 00.515-1.076A11.448 11.448 0 0116 8a6 6 0 00-6-6zM8.05 14.943a33.54 33.54 0 003.9 0 2 2 0 01-3.9 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Notifications par email</h2>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {/* Reply notifications */}
            <div className="flex items-center justify-between gap-4 px-6 py-4 sm:px-8">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Reponses du support</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Recevoir un email a chaque reponse sur mes tickets</p>
              </div>
              <button
                type="button"
                onClick={() => setProfile({ ...profile, notifyOnReply: !profile.notifyOnReply })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${
                  profile.notifyOnReply ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'
                }`}
                role="switch"
                aria-checked={profile.notifyOnReply}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  profile.notifyOnReply ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Status change notifications */}
            <div className="flex items-center justify-between gap-4 px-6 py-4 sm:px-8">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Changements de statut</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Recevoir un email quand un ticket est resolu ou ferme</p>
              </div>
              <button
                type="button"
                onClick={() => setProfile({ ...profile, notifyOnStatusChange: !profile.notifyOnStatusChange })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${
                  profile.notifyOnStatusChange ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'
                }`}
                role="switch"
                aria-checked={profile.notifyOnStatusChange}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  profile.notifyOnStatusChange ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          {/* Save button for notifications + 2FA */}
          <div className="border-t border-slate-100 dark:border-slate-700/50 px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement...' : 'Sauvegarder les preferences'}
            </button>
          </div>
        </div>

        {/* ── Password change card ── */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 shadow-sm backdrop-blur-sm">
          <div className="border-b border-slate-100 dark:border-slate-700/50 px-6 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-600 dark:text-slate-400">
                  <path fillRule="evenodd" d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5 1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Changer le mot de passe</h2>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="p-6 sm:p-8">
            {passwordError && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{passwordError}</p>
              </div>
            )}
            {passwordSuccess && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{passwordSuccess}</p>
              </div>
            )}

            <div className="mb-5">
              <label htmlFor="currentPassword" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Mot de passe actuel
              </label>
              <input
                id="currentPassword"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div className="mb-5">
              <label htmlFor="newPassword" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nouveau mot de passe
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/10"
              />
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">Minimum 8 caracteres</p>
            </div>

            <div className="mb-6">
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Confirmer le mot de passe
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 px-6 py-3 text-sm font-semibold text-white dark:text-slate-900 shadow-sm transition-all duration-200 hover:bg-slate-800 dark:hover:bg-white hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changingPassword ? (
                <>
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Modification...
                </>
              ) : (
                'Changer le mot de passe'
              )}
            </button>
          </form>
        </div>

        {/* ── RGPD Data Export card ── */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 shadow-sm backdrop-blur-sm">
          <div className="border-b border-slate-100 dark:border-slate-700/50 px-6 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-600 dark:text-emerald-400">
                  <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Mes données personnelles</h2>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Conformement au RGPD, vous pouvez télécharger l&apos;ensemble de vos données personnelles
              (profil, tickets, messages, enquetes de satisfaction).
            </p>
            <a
              href="/api/support/export-data"
              download
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-all duration-200 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
              Exporter mes données (JSON)
            </a>
          </div>
        </div>

        {/* ── Danger zone — Account Deletion ── */}
        <div className="rounded-2xl border border-red-200 dark:border-red-800/30 bg-white dark:bg-slate-800/50 shadow-sm">
          <div className="border-b border-red-100 dark:border-red-800/20 px-6 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-red-500">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Zone de danger</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Actions irréversibles</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Conformement au RGPD (Article 17 — Droit a l&apos;effacement), vous pouvez demander la suppression
              définitive de votre compte et de toutes vos données. Cette action est irréversible.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800/50 bg-white dark:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
                Supprimer mon compte
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 dark:border-red-800/30 bg-red-50/50 dark:bg-red-900/10 p-5">
                <p className="mb-3 text-sm font-semibold text-red-700 dark:text-red-400">
                  Cette action supprimera definitivement :
                </p>
                <ul className="mb-4 space-y-1.5 text-sm text-red-600 dark:text-red-400">
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 flex-shrink-0 rounded-full bg-red-400" />
                    Votre compte et profil
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 flex-shrink-0 rounded-full bg-red-400" />
                    Tous vos tickets et messages
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 flex-shrink-0 rounded-full bg-red-400" />
                    Vos enquetes de satisfaction
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 flex-shrink-0 rounded-full bg-red-400" />
                    Vos conversations de chat
                  </li>
                </ul>

                {deleteError && (
                  <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-2.5">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">{deleteError}</p>
                  </div>
                )}

                <div className="mb-4">
                  <label htmlFor="deletePassword" className="mb-2 block text-sm font-semibold text-red-700 dark:text-red-400">
                    Confirmez avec votre mot de passe
                  </label>
                  <input
                    id="deletePassword"
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    className="w-full rounded-xl border border-red-200 dark:border-red-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      if (!deletePassword) {
                        setDeleteError('Veuillez entrer votre mot de passe.')
                        return
                      }
                      setDeleting(true)
                      setDeleteError('')
                      try {
                        const res = await fetch('/api/support/delete-account', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ confirmPassword: deletePassword }),
                        })
                        const data = await res.json()
                        if (res.ok && data.deleted) {
                          router.push('/support/login?deleted=true')
                        } else {
                          setDeleteError(data.error || 'Erreur lors de la suppression.')
                        }
                      } catch {
                        setDeleteError('Erreur de connexion.')
                      } finally {
                        setDeleting(false)
                      }
                    }}
                    disabled={deleting || !deletePassword}
                    className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Suppression...' : 'Confirmer la suppression'}
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError('') }}
                    className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
