import { defineConfig, type Options } from 'tsup'
import { rmSync } from 'fs'

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
  // Keep individual modules instead of bundling (required for Next.js RSC
  // to resolve each client boundary individually from node_modules)
  bundle: false,
}

export default defineConfig([
  // Server entry — plugin + collections + types (bundled single file)
  {
    ...sharedConfig,
    entry: { index: 'src/index.ts' },
    bundle: true,
    format: ['esm', 'cjs'],
  },
  // Client barrel — small re-export file
  {
    ...sharedConfig,
    external: clientExternals,
    entry: { client: 'src/client.ts' },
    bundle: true,
    format: ['esm', 'cjs'],
    onSuccess: async () => {
      const { readFileSync, writeFileSync } = await import('fs')
      for (const file of ['dist/client.js', 'dist/client.cjs']) {
        try {
          const content = readFileSync(file, 'utf-8')
          if (!content.startsWith('"use client"')) {
            writeFileSync(file, '"use client";\n' + content)
          }
        } catch { /* ignore if file doesn't exist */ }
      }
      console.log('✓ Prepended "use client" to client barrel')
    },
  },
  // RSC entry — server components (NO 'use client')
  // These wrap DefaultTemplate and render the client components inside.
  // They MUST remain server components so Payload can call them with
  // AdminViewServerProps. bundle:false means imports like `./client` stay
  // as imports in the output.
  // esbuildOptions.outbase forces tsup to use `src/` as the base so that
  // files preserve their `views/NAME/index.js` structure in dist.
  {
    ...sharedConfig,
    external: clientExternals,
    entry: [
      'src/views/TicketInboxView/index.tsx',
      'src/views/TicketDetailView/index.tsx',
      'src/views/SupportDashboardView/index.tsx',
      'src/views/NewTicketView/index.tsx',
      'src/views/TicketingSettingsView/index.tsx',
      'src/views/LogsView/index.tsx',
      'src/views/ChatView/index.tsx',
      'src/views/CrmView/index.tsx',
      'src/views/PendingEmailsView/index.tsx',
      'src/views/EmailTrackingView/index.tsx',
      'src/views/BillingView/index.tsx',
      'src/views/TimeDashboardView/index.tsx',
      'src/views/ImportConversationView/index.tsx',
      // shared server-only utils (no React classes, no hooks)
      'src/views/shared/adminTokens.ts',
      'src/views/shared/config.ts',
    ],
    esbuildOptions(options) {
      options.outbase = 'src'
    },
  },
  // Client entry — individual client components (WITH 'use client')
  // These are the `client.tsx` files for each view + the TicketConversation
  // component tree. Each file is emitted individually thanks to bundle:false.
  // Globs are used to pick up all subfiles of TicketConversation.
  {
    ...sharedConfig,
    external: clientExternals,
    entry: [
      'src/views/**/client.tsx',
      'src/views/**/*.scss',
      'src/views/**/*.css',
      'src/views/shared/ErrorBoundary.tsx',
      'src/views/shared/Skeleton.tsx',
      'src/views/shared/AdminViewHeader.tsx',
      'src/views/shared/index.ts',
      'src/components/TicketConversation/**/*.tsx',
      'src/components/TicketConversation/**/*.ts',
      'src/components/TicketConversation/**/*.json',
      'src/components/TicketConversation/**/*.scss',
      'src/components/TicketConversation/**/*.css',
      'src/styles/**/*.css',
      'src/styles/**/*.scss',
      '!src/components/TicketConversation/**/*.d.ts',
    ],
    loader: {
      '.json': 'copy',
      '.css': 'copy',
      '.scss': 'copy',
    },
    esbuildOptions(options) {
      options.outbase = 'src'
    },
    onSuccess: async () => {
      // Prepend "use client" to individual client files (NOT the RSC ones)
      const { readdirSync, readFileSync, writeFileSync, statSync } = await import('fs')
      const { join } = await import('path')

      function processDir(dir: string, pattern: (file: string) => boolean) {
        try {
          for (const file of readdirSync(dir)) {
            const path = join(dir, file)
            if (statSync(path).isDirectory()) {
              processDir(path, pattern)
              continue
            }
            if (!file.endsWith('.js') && !file.endsWith('.cjs')) continue
            if (!pattern(file)) continue
            const content = readFileSync(path, 'utf-8')
            if (!content.startsWith('"use client"')) {
              writeFileSync(path, '"use client";\n' + content)
            }
          }
        } catch { /* ignore */ }
      }

      // views/*/client.js — client components only
      processDir('dist/views', (f) => f === 'client.js' || f === 'client.cjs')
      // views/shared — client helpers (ErrorBoundary, Skeleton, AdminViewHeader, index barrel)
      processDir('dist/views/shared', (f) => f.endsWith('.js') || f.endsWith('.cjs'))
      // components/TicketConversation/** — all files (TicketConversation and its subcomponents)
      processDir('dist/components', () => true)
      console.log('✓ Prepended "use client" to individual client files')
    },
  },
])
