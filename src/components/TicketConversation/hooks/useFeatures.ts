'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchFeatures,
  getFeatures,
  hasAdoptedLegacyFeatures,
  markLegacyFeaturesAdopted,
  readLegacyFeatures,
  saveFeatures as persistFeatures,
  writeFeaturesCache,
  type TicketingFeatures,
} from '../../../utils/features'

export interface UseFeaturesResult {
  /** Current flags — cached values on first paint, server values once loaded. */
  features: TicketingFeatures
  /** True until the first server round-trip settles. */
  loading: boolean
  /** True when the server could not be reached and cached/default values are shown. */
  offline: boolean
  /** Replace the flags locally without persisting (for a settings form). */
  setFeatures: (features: TicketingFeatures) => void
  /** Persist the flags server-side. Resolves to false when the write failed. */
  save: (features: TicketingFeatures) => Promise<boolean>
}

/**
 * Read the ticketing feature flags from the server, with the local cache as a
 * fallback so a screen never blocks on the settings call.
 *
 * Also performs the one-shot migration of pre-2.1 installs: when this browser
 * still holds flags in `localStorage` and the server has never had any saved,
 * the local values are pushed up once and become the shared truth. Afterwards
 * the server always wins and `localStorage` is only a cache.
 */
export function useFeatures(): UseFeaturesResult {
  const [features, setFeatures] = useState<TicketingFeatures>(() => getFeatures())
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  // Migration must run once per mount at most, even under StrictMode double-effects.
  const migrationAttempted = useRef(false)
  // Set as soon as the caller edits the flags, so a slow first load cannot
  // overwrite a toggle the admin just made in the settings form.
  const dirty = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    void (async () => {
      const result = await fetchFeatures(controller.signal)
      if (cancelled) return

      // Fresh server + legacy browser values => adopt them instead of silently
      // resetting the admin's configuration to the defaults.
      if (!result.offline && !result.configured && !migrationAttempted.current && !dirty.current) {
        migrationAttempted.current = true
        const legacy = readLegacyFeatures()
        if (legacy) {
          const ok = await persistFeatures(legacy)
          if (cancelled) return
          if (ok) {
            markLegacyFeaturesAdopted()
            setFeatures(legacy)
            setLoading(false)
            return
          }
        }
      }

      if (!result.offline && !hasAdoptedLegacyFeatures()) {
        // Server already configured (by this admin elsewhere, or another admin):
        // the server wins, and there is nothing left to migrate here.
        markLegacyFeaturesAdopted()
      }

      if (!dirty.current) setFeatures(result.features)
      setOffline(result.offline)
      setLoading(false)
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const setLocalFeatures = useCallback((next: TicketingFeatures) => {
    dirty.current = true
    setFeatures(next)
    // Keep the cache aligned with what is on screen, so a reload before saving
    // does not flash the previous values.
    writeFeaturesCache(next)
  }, [])

  const save = useCallback(async (next: TicketingFeatures) => {
    const ok = await persistFeatures(next)
    if (ok) {
      markLegacyFeaturesAdopted()
      dirty.current = false
      setFeatures(next)
      setOffline(false)
    }
    return ok
  }, [])

  return { features, loading, offline, setFeatures: setLocalFeatures, save }
}
