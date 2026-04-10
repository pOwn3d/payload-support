import { defineConfig, type Options } from 'tsup'
import { rmSync } from 'fs'
import { sassPlugin } from 'esbuild-sass-plugin'

const serverExternals = [
  'payload',
  'payload/shared',
  '@payloadcms/ui',
  '@payloadcms/translations',
  '@payloadcms/next',
  '@payloadcms/next/templates',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'next',
  'next/navigation',
  'next/link',
  'next/headers',
  '@consilioweb/payload-support',
  '@consilioweb/payload-support/client',
  '@consilioweb/payload-support/views',
  '@consilioweb/payload-support/components/TicketConversation',
  '@anthropic-ai/sdk',
  'openai',
  'lucide-react',
]

const clientExternals = [
  'payload',
  'payload/shared',
  '@payloadcms/ui',
  '@payloadcms/translations',
  '@payloadcms/next',
  '@payloadcms/next/templates',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'next',
  'next/navigation',
  'next/link',
  'lucide-react',
  '@consilioweb/payload-support',
  '@consilioweb/payload-support/client',
]

rmSync('dist', { recursive: true, force: true })

const sharedConfig: Partial<Options> = {
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  external: serverExternals,
  clean: false,
}

export default defineConfig([
  // Server entry — plugin + collections + types
  {
    ...sharedConfig,
    entry: { index: 'src/index.ts' },
  },
  // Client entry — React components barrel
  {
    ...sharedConfig,
    external: clientExternals,
    entry: { client: 'src/client.ts' },
    onSuccess: async () => {
      const { readFileSync, writeFileSync } = await import('fs')
      for (const file of ['dist/client.js', 'dist/client.cjs']) {
        try {
          const content = readFileSync(file, 'utf-8')
          if (!content.startsWith('"use client"')) {
            writeFileSync(file, '"use client";\n' + content)
          }
        } catch { /* ignore */ }
      }
      console.log('✓ Prepended "use client" to client barrel')
    },
  },
  // Views barrel — server components for Payload importMap
  // Bundled as a single file (like admin-theme's ./rsc) so that Next.js
  // can properly detect and follow the client references in each view.
  {
    ...sharedConfig,
    external: clientExternals,
    entry: { views: 'src/views.ts' },
    esbuildPlugins: [sassPlugin({ type: 'local-css' })],
    // NO 'use client' — this is a server barrel that re-exports server
    // components. Each server component internally imports its `./client`
    // sibling which has `'use client'` directive.
  },
  // TicketConversation — single bundled client component
  // Output: dist/components/TicketConversation.js (flat file like admin-theme)
  // ESM only — CJS bundling with 'use client' directive causes tsup to fail
  {
    ...sharedConfig,
    format: ['esm'],
    dts: false,
    external: clientExternals,
    entry: { 'components/TicketConversation': 'src/components/TicketConversation/index.tsx' },
    esbuildPlugins: [sassPlugin({ type: 'local-css' })],
    loader: { '.json': 'copy' },
    onSuccess: async () => {
      const { readFileSync, writeFileSync } = await import('fs')
      for (const file of ['dist/components/TicketConversation.js']) {
        try {
          const content = readFileSync(file, 'utf-8')
          if (!content.startsWith('"use client"')) {
            writeFileSync(file, '"use client";\n' + content)
          }
        } catch { /* ignore */ }
      }
      console.log('✓ Prepended "use client" to TicketConversation bundle')
    },
  },
])
