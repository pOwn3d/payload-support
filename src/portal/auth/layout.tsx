import React from 'react'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { SupportHeader } from './SupportHeader'
import { ChatWidget } from './ChatWidget'
import { ChatbotWidget } from './ChatbotWidget'

export const dynamic = 'force-dynamic'

export type SupportUser = {
  id: number
  email: string
  company: string
  firstName: string
  lastName: string
  collection: 'support-clients'
}

function isSupportUser(user: unknown): user is SupportUser {
  return typeof user === 'object' && user !== null && 'company' in user
}

async function getSupportUser(): Promise<SupportUser | null> {
  try {
    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()

    // Use Payload's auth to verify the JWT from cookies
    const { user } = await payload.auth({ headers })

    if (user && isSupportUser(user)) {
      return user
    }

    return null
  } catch (error) {
    console.error('[support-layout] Failed to get user:', error)
    return null
  }
}

export default async function SupportAuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getSupportUser()

  if (!user) {
    redirect('/support/login')
  }

  return (
    <>
      <SupportHeader user={user} />
      <main className="mx-auto w-full max-w-screen-2xl px-6 py-8 sm:px-10 lg:px-16 dark:text-white">
        {children}
      </main>
      <ChatbotWidget />
      <ChatWidget />
    </>
  )
}
