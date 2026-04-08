import { useState, useCallback, useEffect } from 'react'
import frTranslations from '../locales/fr.json'
import enTranslations from '../locales/en.json'

type Locale = 'fr' | 'en'

const LOCALE_STORAGE_KEY = 'support_locale'
const DEFAULT_LOCALE: Locale = 'fr'

const translations: Record<Locale, Record<string, unknown>> = {
  fr: frTranslations,
  en: enTranslations,
}

/**
 * Resolve a dot-notation key from a nested object.
 * e.g. getNestedValue(obj, 'ticket.status.open') => 'Ouvert'
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return path // fallback to key if path doesn't resolve
    }
    current = (current as Record<string, unknown>)[key]
  }

  if (typeof current === 'string') {
    return current
  }

  return path // fallback to key
}

/**
 * Interpolate variables in a translation string.
 * Supports {{variable}} syntax.
 * e.g. interpolate('Hello {{name}}', { name: 'World' }) => 'Hello World'
 */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
    return String(vars[key] ?? `{{${key}}}`)
  })
}

/**
 * Hook providing i18n translation capabilities for the support module.
 *
 * Usage:
 * ```tsx
 * const { t, locale, setLocale } = useTranslation()
 *
 * // Simple key
 * t('common.save') // => 'Sauvegarder' (fr) or 'Save' (en)
 *
 * // With interpolation
 * t('inbox.selected', { count: '3' }) // => '3 sélectionné(s)'
 *
 * // Switch locale
 * setLocale('en')
 * ```
 */
export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return DEFAULT_LOCALE
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
      if (stored === 'fr' || stored === 'en') return stored
    } catch {
      // localStorage not available
    }
    return DEFAULT_LOCALE
  })

  // Fetch locale from user prefs API on mount
  useEffect(() => {
    fetch('/api/support/user-prefs', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.locale && (data.locale === 'fr' || data.locale === 'en')) {
          setLocaleState(data.locale)
        }
      })
      .catch(() => {})
  }, [])

  // Sync locale to localStorage as fallback
  useEffect(() => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      // localStorage not available
    }
  }, [locale])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict = translations[locale] || translations[DEFAULT_LOCALE]
      const value = getNestedValue(dict, key)
      return interpolate(value, vars)
    },
    [locale],
  )

  return { t, locale, setLocale }
}

export type { Locale }
export { DEFAULT_LOCALE, LOCALE_STORAGE_KEY }
