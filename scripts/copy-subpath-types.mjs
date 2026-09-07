/**
 * Copies the declarations emitted by `tsc -p tsconfig.types.json` into dist/,
 * then rewrites their relative import specifiers so they carry an explicit
 * `.js` extension.
 *
 * Why a separate pass: the `bundle: false` tsup entry that emits dist/views/**
 * and dist/components/** cannot generate declarations — turning `dts: true` on
 * for ~100 entries makes rollup-plugin-dts run for well over ten minutes without
 * finishing. Without them, `dist/views.d.ts` re-exports 13 views from paths that
 * carry no declaration (TS7016 under noImplicitAny) and the publicly documented
 * `./components/TicketConversation` subpath has no types at all.
 *
 * Why the extension rewrite: the sources are compiled with
 * `moduleResolution: bundler`, so both tsc and tsup emit extensionless relative
 * specifiers (`from './client'`, `from '../../utils/features'`). A consumer on
 * `moduleResolution: node16 | nodenext` — the recommended setting for an ESM
 * package — then gets `TS2835: Relative import paths need explicit file
 * extensions`, and with the default `skipLibCheck: true` that error is swallowed
 * and every export silently degrades to `any`. tsup's `onSuccess` already does
 * this for the emitted `.js`; this does the same for the `.d.ts` (the copied ones
 * *and* the `dist/views.d.ts` barrel produced by tsup's dts pass).
 *
 * `utils` is copied too: the emitted view declarations reference
 * `../../utils/features`, whose JS is already emitted by the same tsup pass.
 */
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const OUT = '.types-out'
const SUBPATHS = ['views', 'components', 'utils']

if (!existsSync(OUT)) {
  console.error(`[build] "${OUT}" is missing — run \`tsc -p tsconfig.types.json\` before this script.`)
  process.exit(1)
}

for (const dir of SUBPATHS) {
  const from = `${OUT}/${dir}`
  if (existsSync(from)) cpSync(from, `dist/${dir}`, { recursive: true })
}

rmSync(OUT, { recursive: true, force: true })
console.log('✓ Copied subpath declarations into dist/')

// ─── Explicit .js extensions on relative specifiers ──────────────────────────

const HAS_EXTENSION = /\.(js|jsx|mjs|cjs|css|scss|json)$/
const RELATIVE_SPECIFIER = /((?:from|import)\s*['"])(\.\.?\/[^'"]+?)(['"])/g

const errors = []

/** Resolve an extensionless specifier against the emitted declarations. */
function withExtension(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier)
  if (existsSync(`${base}.d.ts`)) return `${specifier}.js`
  if (existsSync(join(base, 'index.d.ts'))) return `${specifier}/index.js`
  return null
}

function rewrite(file) {
  const content = readFileSync(file, 'utf-8')
  const fixed = content.replace(RELATIVE_SPECIFIER, (match, prefix, specifier, suffix) => {
    if (HAS_EXTENSION.test(specifier)) return match
    const resolved = withExtension(file, specifier)
    if (!resolved) {
      errors.push(`${file}: cannot resolve "${specifier}" to an emitted declaration`)
      return match
    }
    return `${prefix}${resolved}${suffix}`
  })
  if (fixed !== content) writeFileSync(file, fixed)
}

function walkDts(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      walkDts(path)
      continue
    }
    if (path.endsWith('.d.ts')) rewrite(path)
  }
}

// The `./views` barrel is emitted by tsup's dts pass, not by the tsc pass above,
// but it has the exact same extensionless specifiers — and it is the entry point
// consumers actually import, so it matters most.
const VIEWS_BARREL = 'dist/views.d.ts'
if (!existsSync(VIEWS_BARREL)) {
  console.error(`[build] "${VIEWS_BARREL}" is missing — did the tsup views barrel entry run?`)
  process.exit(1)
}
rewrite(VIEWS_BARREL)
for (const dir of SUBPATHS) walkDts(`dist/${dir}`)

if (errors.length > 0) {
  console.error('[build] unresolved relative specifiers in emitted declarations:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log('✓ Added explicit .js extensions to relative specifiers in dist/**/*.d.ts')
