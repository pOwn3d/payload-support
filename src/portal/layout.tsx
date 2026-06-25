import React from 'react'

export const metadata = {
  title: 'Support Client',
  description: 'Portail de support client',
  robots: { index: false, follow: false },
}

export default function SupportRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <meta name="theme-color" content="#2563eb" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('support-dark-mode')==='true'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){console.error('[support-layout] Failed to get user:',e)}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
