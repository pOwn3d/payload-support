import React from 'react'
import { headers } from 'next/headers'

export const metadata = {
  title: 'Support Client',
  description: 'Portail de support client',
  robots: { index: false, follow: false },
}

export default async function SupportRootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') || undefined
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <meta name="theme-color" content="#2563eb" />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('support-dark-mode')==='true'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){console.error('[support-layout] Failed to get user:',e)}})()`,
          }}
        />
      </head>
      <body className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
