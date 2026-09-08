#!/usr/bin/env node

/**
 * `support-uninstall` — removes this plugin from a host application.
 *
 * Contract, deliberately identical to the other ConsilioWEB plugins:
 *   - DRY RUN by default. Nothing is written without `--confirm`.
 *   - a detection gate: the destructive step refuses to run unless this project
 *     really uses the plugin (a source file references it, or it is a declared
 *     dependency). `--force-db` overrides it.
 *   - `--keep-data` cleans the code and the preferences but keeps every row.
 *
 * Usage:
 *   npx support-uninstall                       list what would be removed
 *   npx support-uninstall --confirm             do it
 *   npx support-uninstall --confirm --keep-data code only, rows kept
 *   npx support-uninstall --confirm --force-db  delete rows even if undetected
 *   npx support-uninstall --extra-slugs=a,b     add renamed collections
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

function readOwnPackageName() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'package.json'), 'utf-8'))
    if (typeof pkg.name === 'string' && pkg.name) return pkg.name
  } catch {
    // fall through
  }
  return '@consilioweb/payload-support'
}

const PACKAGE_NAME = readOwnPackageName()

function detectPackageManager(dir) {
  if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(dir, 'bun.lockb')) || fs.existsSync(path.join(dir, 'bun.lock'))) return 'bun'
  return 'npm'
}

function findSourceFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) continue
      findSourceFiles(full, acc)
    } else if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}

function isDeclaredDependency(projectDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'))
    return Boolean(
      pkg.dependencies?.[PACKAGE_NAME]
      || pkg.devDependencies?.[PACKAGE_NAME]
      || pkg.peerDependencies?.[PACKAGE_NAME]
      || pkg.optionalDependencies?.[PACKAGE_NAME],
    )
  } catch {
    return false
  }
}

function run(cmd, cwd) {
  console.log(`  $ ${cmd}`)
  try {
    execSync(cmd, { cwd, stdio: 'inherit' })
    return true
  } catch {
    return false
  }
}

function main() {
  const projectDir = process.env.INIT_CWD || process.cwd()
  const argv = process.argv.slice(2)
  const confirm = argv.includes('--confirm')
  const keepData = argv.includes('--keep-data')
  const forceDb = argv.includes('--force-db')
  const extraSlugs = argv.find((a) => a.startsWith('--extra-slugs='))
  const pm = detectPackageManager(projectDir)

  console.log('')
  console.log(`  ${PACKAGE_NAME} — uninstall`)
  console.log('  ─────────────────────────────────────────────')
  console.log(`  Project:         ${projectDir}`)
  console.log(`  Package manager: ${pm}`)
  console.log(`  Mode:            ${confirm ? 'APPLY' : 'DRY RUN — nothing will be written'}`)
  if (keepData) console.log('  --keep-data:     rows will be kept')
  console.log('')

  // ── 1. Where is the plugin referenced? ───────────────────
  const sourceFiles = findSourceFiles(path.join(projectDir, 'src'))
  const referencing = sourceFiles.filter((file) => {
    try {
      return fs.readFileSync(file, 'utf-8').includes(PACKAGE_NAME)
    } catch {
      return false
    }
  })

  console.log('  [1/3] Source references')
  if (referencing.length === 0) {
    console.log('    none found under src/')
  } else {
    for (const file of referencing) console.log(`    ${path.relative(projectDir, file)}`)
    console.log('')
    console.log('    Remove the `supportPlugin(...)` call and its import yourself.')
    console.log('    This script never rewrites your source: the plugin call carries')
    console.log('    your configuration, and a regex that guesses where it ends is how')
    console.log('    a config file gets silently corrupted.')
  }
  console.log('')

  const declared = isDeclaredDependency(projectDir)
  const detected = referencing.length > 0 || declared || forceDb

  // ── 2. Data ──────────────────────────────────────────────
  console.log('  [2/3] Data')
  if (!detected) {
    console.log(`    ${PACKAGE_NAME} was not found in this project`)
    console.log('    (no source reference, not in package.json dependencies).')
    console.log('    Skipping the data step. Force it with --force-db.')
    console.log('')
  } else {
    // The Payload local API needs the host's TypeScript config loaded, which is
    // exactly what `payload run` sets up. Spawning it beats reimplementing a
    // TypeScript loader here.
    const dataScript = path.join(HERE, 'uninstall-data.mjs')
    const args = ['payload', 'run', dataScript]
    if (confirm) args.push('--confirm')
    if (keepData) args.push('--keep-data')
    if (extraSlugs) args.push(extraSlugs)

    const result = spawnSync('npx', args, { cwd: projectDir, stdio: 'inherit' })
    if (result.status !== 0) {
      console.log('')
      console.log('    Could not run the data step through `npx payload run`.')
      console.log('    Run it by hand from your project root:')
      console.log(`      npx payload run ${dataScript} ${confirm ? '--confirm' : ''}`)
      console.log('')
    }
  }

  // ── 3. The package ───────────────────────────────────────
  console.log('  [3/3] Package')
  if (!confirm) {
    const removeCmd = pm === 'npm' ? 'npm uninstall' : `${pm} remove`
    console.log(`    would run: ${removeCmd} ${PACKAGE_NAME}`)
    console.log(`    would run: ${pm === 'npm' ? 'npx' : pm} payload generate:importmap`)
    console.log('')
    console.log('  Dry run finished. Nothing was changed. Re-run with --confirm.')
    console.log('')
    return
  }

  if (referencing.length > 0) {
    console.log('    Skipped: the plugin is still imported by the files listed above.')
    console.log('    Remove those references first, then re-run.')
    console.log('')
    return
  }

  const removeCmd = pm === 'npm' ? 'npm uninstall' : `${pm} remove`
  run(`${removeCmd} ${PACKAGE_NAME}`, projectDir)
  run(`${pm === 'npm' ? 'npx' : pm} payload generate:importmap`, projectDir)

  console.log('')
  console.log('  Done.')
  console.log('')
}

main()
