import React from 'react'
import Link from 'next/link'

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
const supportEmail = process.env.SUPPORT_EMAIL || 'support@example.com'

export default function SupportPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-slate-900 dark:text-white">Support</span>
          </Link>
          <Link
            href="/support/login"
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98]"
          >
            Se connecter
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-950 dark:to-blue-950/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.15),transparent)]" />

          <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-28 lg:py-32 text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              Assistance disponible
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
              Espace Support Client
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl dark:text-slate-400">
              Suivez vos projets, signalez un problème ou posez une question.
              Notre équipe vous repond sous 24h.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/support/login"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 active:scale-[0.98] dark:shadow-blue-600/20"
              >
                Accéder à mon espace
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link
                href="/support/register"
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-base font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Créer un compte
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
            <div className="mb-4 text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Simple et efficace</p>
            </div>
            <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Comment ça fonctionne ?
            </h2>
            <p className="mx-auto mb-14 max-w-xl text-center text-slate-500 dark:text-slate-400">
              Trois étapes pour obtenir de l&apos;aide rapidement.
            </p>
            <div className="grid gap-8 sm:grid-cols-3">
              {/* Card 1 */}
              <div className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950 dark:text-blue-400 dark:group-hover:bg-blue-600 dark:group-hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Créez un ticket</h3>
                <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Décrivez votre besoin ou problème. Ajoutez une catégorie et une priorité pour un traitement rapide.
                </p>
              </div>

              {/* Card 2 */}
              <div className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950 dark:text-blue-400 dark:group-hover:bg-blue-600 dark:group-hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Échangez avec nous</h3>
                <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Discutez directement avec notre équipe. Chaque message est suivi et archive dans votre espace.
                </p>
              </div>

              {/* Card 3 */}
              <div className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950 dark:text-blue-400 dark:group-hover:bg-blue-600 dark:group-hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Suivez l&apos;avancement</h3>
                <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Consultez le statut de vos tickets, le temps passé et l&apos;historique complet de vos projets.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Email alternative */}
        <section className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-5xl px-6 py-20 text-center">
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Pas encore de compte ?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-base text-slate-500 dark:text-slate-400">
              Créez votre compte en quelques secondes pour acceder à votre espace support, ou envoyez un email a{' '}
              <strong className="font-medium text-slate-700 dark:text-slate-300">{supportEmail}</strong>{' '}
              pour une creation automatique.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/support/register"
                className="inline-flex items-center rounded-xl bg-blue-600 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl active:scale-[0.98]"
              >
                Créer un compte
              </Link>
              <a
                href={`mailto:${supportEmail}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-base font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-slate-400">
                  <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                  <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                </svg>
                {supportEmail}
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
