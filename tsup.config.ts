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
  // Client barrel
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
  // Views barrel — a single bundled file that re-exports all views via
  // subpath imports. This matches the pattern used by admin-theme's `./rsc`.
  // The server components inside each view import their `./client` siblings
  // which are emitted as separate files in the individual build below.
  {
    ...sharedConfig,
    external: [
      ...clientExternals,
      // Externalize all view individual files so the barrel just re-exports
      // them without bundling
      /^\.\/views\//,
    ],
    entry: { views: 'src/views.ts' },
  },
  // Individual view files — bundle:false preserves the directory structure
  // so that `./client` imports in server index.tsx can resolve to
  // `./client.js` in the output.
  {
    ...sharedConfig,
    dts: false,
    bundle: false,
    external: clientExternals,
    entry: [
      'src/views/**/*.tsx',
      'src/views/**/*.ts',
      'src/views/**/*.scss',
      'src/views/**/*.css',
      '!src/views/**/*.d.ts',
    ],
    loader: {
      '.scss': 'copy',
      '.css': 'copy',
    },
    esbuildOptions(options) {
      options.outbase = 'src'
    },
    onSuccess: async () => {
      const { readdirSync, readFileSync, writeFileSync, statSync } = await import('fs')
      const { join } = await import('path')
      function processDir(dir: string, pattern: (file: string, path: string) => boolean) {
        try {
          for (const file of readdirSync(dir)) {
            const path = join(dir, file)
            if (statSync(path).isDirectory()) {
              processDir(path, pattern)
              continue
            }
            if (!file.endsWith('.js')) continue
            if (!pattern(file, path)) continue
            const content = readFileSync(path, 'utf-8')
            if (!content.startsWith('"use client"')) {
              writeFileSync(path, '"use client";\n' + content)
            }
          }
        } catch { /* ignore */ }
      }
      // Prepend 'use client' to client.js files and shared client components
      processDir('dist/views', (f) => f === 'client.js')
      processDir('dist/views/shared', (f) =>
        f === 'ErrorBoundary.js' || f === 'Skeleton.js' || f === 'AdminViewHeader.js'
      )
      console.log('✓ Prepended "use client" to individual client files')
    },
  },
  // TicketConversation — single bundled client component
  // Output: dist/components/TicketConversation.js
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
