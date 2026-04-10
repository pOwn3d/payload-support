import { defineConfig, type Options } from 'tsup'
import { writeFileSync, readFileSync, rmSync } from 'fs'
import { sassPlugin } from 'esbuild-sass-plugin'

const CLIENT_BANNER = '"use client";\n'

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
}

export default defineConfig([
  // Server entry — plugin + collections + types
  {
    ...sharedConfig,
    entry: { index: 'src/index.ts' },
  },
  // Client entry — React components
  {
    ...sharedConfig,
    external: clientExternals,
    entry: { client: 'src/client.ts' },
    esbuildPlugins: [sassPlugin({ type: 'local-css' })],
    onSuccess: async () => {
      for (const file of ['dist/client.js', 'dist/client.cjs']) {
        try {
          const content = readFileSync(file, 'utf-8')
          writeFileSync(file, CLIENT_BANNER + content)
        } catch { /* ignore if file doesn't exist */ }
      }
      console.log('✓ Prepended "use client" to client bundles')
    },
  },
  // Views entry — admin views (marked as client since they use hooks)
  {
    ...sharedConfig,
    external: clientExternals,
    entry: { views: 'src/views.ts' },
    esbuildPlugins: [sassPlugin({ type: 'local-css' })],
    onSuccess: async () => {
      for (const file of ['dist/views.js', 'dist/views.cjs']) {
        try {
          const content = readFileSync(file, 'utf-8')
          writeFileSync(file, CLIENT_BANNER + content)
        } catch { /* ignore */ }
      }
      console.log('✓ Prepended "use client" to views bundles')
    },
  },
])
