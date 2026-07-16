import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getNestedValue, translations } from '../components/TicketConversation/hooks/useTranslation'

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) return collectSourceFiles(path)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

function collectTranslationKeys(): string[] {
  const keys = new Set<string>()
  const sourceDirectories = [join(process.cwd(), 'src/components'), join(process.cwd(), 'src/views')]
  const translationCall = /\b(?:t|tFn)\(\s*(['"`])([^'"`]+)\1/g

  for (const file of sourceDirectories.flatMap(collectSourceFiles)) {
    const source = readFileSync(file, 'utf8')

    for (const match of source.matchAll(translationCall)) {
      keys.add(match[2])
    }
  }

  return [...keys].sort()
}

function flattenCatalog(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key

    if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
      return flattenCatalog(entry as Record<string, unknown>, path)
    }

    return [path]
  })
}

describe('support translations', () => {
  const usedKeys = collectTranslationKeys()

  it.each(['fr', 'en'] as const)('defines every literal key used by support views in %s', (locale) => {
    const catalogKeys = new Set(flattenCatalog(translations[locale]))
    const missingKeys = usedKeys.filter((key) => !catalogKeys.has(key))

    expect(missingKeys).toEqual([])
  })

  it('keeps the French and English catalogs aligned', () => {
    expect(flattenCatalog(translations.fr).sort()).toEqual(flattenCatalog(translations.en).sort())
  })

  it.each([
    'ticket.status.pending',
    'inbox.timeAgo.now',
    'detail.addTime',
    'detail.addTagBtn',
    'detail.billing.title',
  ])('resolves the regression key %s', (key) => {
    expect(getNestedValue(translations.fr, key)).not.toBe(key)
    expect(getNestedValue(translations.en, key)).not.toBe(key)
  })
})
