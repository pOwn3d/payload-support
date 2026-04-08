import React from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { FAQSearch } from './FAQSearch'

export const revalidate = 300

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  'getting-started': {
    label: 'Premiers pas',
    color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
      </svg>
    ),
  },
  tickets: {
    label: 'Tickets & Support',
    color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M5.25 2A2.25 2.25 0 003 4.25v2.879a2.25 2.25 0 00.659 1.59l7.5 7.502a2.25 2.25 0 003.182 0l2.879-2.879a2.25 2.25 0 000-3.182l-7.5-7.502A2.25 2.25 0 008.129 2H5.25zM6.5 6a.5.5 0 100-1 .5.5 0 000 1z" clipRule="evenodd" />
      </svg>
    ),
  },
  account: {
    label: 'Compte & Profil',
    color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
      </svg>
    ),
  },
  billing: {
    label: 'Facturation',
    color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6zM3 13.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm4.75-.75a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" clipRule="evenodd" />
      </svg>
    ),
  },
  technical: {
    label: 'Technique',
    color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
  general: {
    label: 'General',
    color: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
      </svg>
    ),
  },
}

export default async function FAQPage() {
  const payload = await getPayload({ config: configPromise })

  const articles = await payload.find({
    collection: 'knowledge-base',
    where: { published: { equals: true } },
    sort: 'sortOrder',
    limit: 200,
    depth: 0,
  })

  // Group by category
  const grouped: Record<string, typeof articles.docs> = {}
  for (const article of articles.docs) {
    const cat = (article.category as string) || 'general'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat]!.push(article)
  }

  const totalArticles = articles.docs.length
  const totalCategories = Object.keys(grouped).length

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12">
      {/* Back navigation */}
      <Link
        href="/support/dashboard"
        className="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Retour aux tickets
      </Link>

      {/* Hero header */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-blue-600 dark:text-blue-400">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 01-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 01-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 01-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502.182-.088.351-.199.503-.331.83-.727.83-1.857 0-2.584zM12 18a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Base de connaissances
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-slate-500 dark:text-slate-400">
          Trouvez des reponses a vos questions parmi nos {totalArticles} articles
          {totalCategories > 1 && ` dans ${totalCategories} categories`}.
        </p>
      </div>

      {/* Search */}
      <FAQSearch articles={articles.docs.map((a) => ({
        id: String(a.id),
        title: a.title,
        category: a.category as string,
        slug: a.slug,
      }))} />

      {/* Categories */}
      <div className="space-y-10">
        {Object.entries(grouped).map(([cat, items]) => {
          const config = categoryConfig[cat] || {
            label: cat,
            color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
              </svg>
            ),
          }
          return (
            <section key={cat}>
              {/* Category header */}
              <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${config.color}`}>
                  {config.icon}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{config.label}</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{items.length} article{items.length > 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Articles */}
              <div className="space-y-2">
                {items.map((article) => (
                  <details
                    key={article.id}
                    className="group rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 shadow-sm transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600 open:shadow-md"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-slate-900 dark:text-white list-none [&::-webkit-details-marker]:hidden">
                      <span className="leading-relaxed">{article.title}</span>
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 transition-colors group-open:bg-blue-50 dark:group-open:bg-blue-900/30">
                        <svg
                          className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180 group-open:text-blue-600 dark:group-open:text-blue-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </summary>
                    <div className="border-t border-slate-100 dark:border-slate-700/50 px-5 py-4">
                      <div className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:leading-relaxed prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
                        {article.body && <RichText data={article.body} />}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Empty state */}
      {articles.docs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-16 px-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-slate-400">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-900 dark:text-white">Aucun article pour le moment</p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Les articles FAQ seront bientot disponibles.</p>
        </div>
      )}
    </div>
  )
}
