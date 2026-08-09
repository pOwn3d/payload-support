import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DEFAULT_TICKETING_FEATURES,
  FEATURES_ADOPTED_KEY,
  FEATURES_CACHE_KEY,
  fetchFeatures,
  getFeatures,
  hasAdoptedLegacyFeatures,
  markLegacyFeaturesAdopted,
  normalizeFeatures,
  projectAutoClose,
  readFeaturesCache,
  readLegacyFeatures,
  saveFeatures,
  stripProjectedFeatures,
  writeFeaturesCache,
} from '../utils/features'
import {
  mergeSupportSettings,
  invalidateSupportSettingsCache,
  readSupportSettingsState,
  DEFAULT_SETTINGS,
} from '../utils/readSettings'
import type { Payload } from 'payload'

/** Minimal in-memory Storage, with an optional failure mode. */
function createStorage(opts: { throwOnGet?: boolean; throwOnSet?: boolean } = {}) {
  const data = new Map<string, string>()
  return {
    data,
    getItem(key: string) {
      if (opts.throwOnGet) throw new Error('storage disabled')
      return data.has(key) ? data.get(key)! : null
    },
    setItem(key: string, value: string) {
      if (opts.throwOnSet) throw new Error('quota exceeded')
      data.set(key, value)
    },
    removeItem(key: string) { data.delete(key) },
    clear() { data.clear() },
    key(i: number) { return Array.from(data.keys())[i] ?? null },
    get length() { return data.size },
  } as unknown as Storage & { data: Map<string, string> }
}

function installWindow(storage: Storage | null) {
  ;(globalThis as any).window = storage ? { localStorage: storage } : {}
}

function removeWindow() {
  delete (globalThis as any).window
}

describe('normalizeFeatures', () => {
  it('returns the defaults for anything that is not an object', () => {
    for (const input of [null, undefined, 42, 'nope', []]) {
      expect(normalizeFeatures(input)).toEqual(DEFAULT_TICKETING_FEATURES)
    }
  })

  it('keeps known booleans and drops unknown keys', () => {
    const result = normalizeFeatures({ ai: false, chat: false, bogus: true })
    expect(result.ai).toBe(false)
    expect(result.chat).toBe(false)
    expect(result.timeTracking).toBe(true)
    expect(result).not.toHaveProperty('bogus')
  })

  it('ignores wrongly-typed values instead of trusting them', () => {
    const result = normalizeFeatures({ ai: 'yes', merge: 1, autoCloseDays: 'many' })
    expect(result.ai).toBe(DEFAULT_TICKETING_FEATURES.ai)
    expect(result.merge).toBe(DEFAULT_TICKETING_FEATURES.merge)
    expect(result.autoCloseDays).toBe(DEFAULT_TICKETING_FEATURES.autoCloseDays)
  })

  it('accepts a valid autoCloseDays and floors it', () => {
    expect(normalizeFeatures({ autoCloseDays: 14 }).autoCloseDays).toBe(14)
    expect(normalizeFeatures({ autoCloseDays: 3.7 }).autoCloseDays).toBe(3)
    expect(normalizeFeatures({ autoCloseDays: 0 }).autoCloseDays).toBe(7)
    expect(normalizeFeatures({ autoCloseDays: NaN }).autoCloseDays).toBe(7)
  })

  it('does not share state between calls', () => {
    const a = normalizeFeatures({})
    a.ai = false
    expect(normalizeFeatures({}).ai).toBe(true)
  })
})

describe('autoClose projection', () => {
  it('mirrors the authoritative autoClose block onto the flags', () => {
    const result = projectAutoClose(normalizeFeatures({ autoClose: true, autoCloseDays: 7 }), {
      enabled: false,
      daysBeforeClose: 30,
    })
    expect(result.autoClose).toBe(false)
    expect(result.autoCloseDays).toBe(30)
  })

  it('leaves the flags untouched when the block is absent or partial', () => {
    const base = normalizeFeatures({ autoClose: false, autoCloseDays: 12 })
    expect(projectAutoClose(base, undefined)).toEqual(base)
    expect(projectAutoClose(base, {}).autoClose).toBe(false)
    expect(projectAutoClose(base, {}).autoCloseDays).toBe(12)
    expect(projectAutoClose(base, { daysBeforeClose: 0 }).autoCloseDays).toBe(12)
  })

  it('never persists the projected flags', () => {
    const stripped = stripProjectedFeatures(DEFAULT_TICKETING_FEATURES) as Record<string, unknown>
    expect(stripped).not.toHaveProperty('autoClose')
    expect(stripped).not.toHaveProperty('autoCloseDays')
    expect(stripped.roundRobin).toBe(false)
    // The input must not be mutated.
    expect(DEFAULT_TICKETING_FEATURES).toHaveProperty('autoCloseDays')
  })
})

describe('localStorage cache', () => {
  let storage: ReturnType<typeof createStorage>

  beforeEach(() => {
    storage = createStorage()
    installWindow(storage)
  })

  afterEach(() => {
    removeWindow()
    vi.unstubAllGlobals()
  })

  it('round-trips a feature set', () => {
    const features = normalizeFeatures({ ai: false })
    writeFeaturesCache(features)
    expect(readFeaturesCache()).toEqual(features)
  })

  it('returns null on an empty or corrupted cache', () => {
    expect(readFeaturesCache()).toBeNull()
    storage.setItem(FEATURES_CACHE_KEY, '{not json')
    expect(readFeaturesCache()).toBeNull()
  })

  it('normalizes what it reads back, so a hand-edited entry cannot leak through', () => {
    storage.setItem(FEATURES_CACHE_KEY, JSON.stringify({ ai: 'yes', rogue: true }))
    const cached = readFeaturesCache()!
    expect(cached.ai).toBe(true)
    expect(cached).not.toHaveProperty('rogue')
  })

  it('falls back to the defaults when there is no window at all (SSR)', () => {
    removeWindow()
    expect(getFeatures()).toEqual(DEFAULT_TICKETING_FEATURES)
    expect(() => writeFeaturesCache(DEFAULT_TICKETING_FEATURES)).not.toThrow()
  })

  it('survives a storage that throws (private mode, quota)', () => {
    installWindow(createStorage({ throwOnGet: true, throwOnSet: true }))
    expect(getFeatures()).toEqual(DEFAULT_TICKETING_FEATURES)
    expect(() => writeFeaturesCache(DEFAULT_TICKETING_FEATURES)).not.toThrow()
  })
})

describe('legacy localStorage migration', () => {
  let storage: ReturnType<typeof createStorage>

  beforeEach(() => {
    storage = createStorage()
    installWindow(storage)
  })

  afterEach(() => {
    removeWindow()
  })

  it('offers the pre-existing flags exactly once', () => {
    storage.setItem(FEATURES_CACHE_KEY, JSON.stringify({ ai: false, chat: false }))
    const legacy = readLegacyFeatures()
    expect(legacy?.ai).toBe(false)
    expect(legacy?.chat).toBe(false)

    markLegacyFeaturesAdopted()
    expect(hasAdoptedLegacyFeatures()).toBe(true)
    expect(readLegacyFeatures()).toBeNull()
  })

  it('offers nothing when the browser never configured anything', () => {
    expect(readLegacyFeatures()).toBeNull()
  })

  it('treats an unusable storage as already migrated', () => {
    installWindow(createStorage({ throwOnGet: true }))
    expect(hasAdoptedLegacyFeatures()).toBe(true)
    expect(readLegacyFeatures()).toBeNull()
  })

  it('records the adoption under its own key, leaving the cache alone', () => {
    storage.setItem(FEATURES_CACHE_KEY, JSON.stringify({ ai: false }))
    markLegacyFeaturesAdopted()
    expect(storage.data.get(FEATURES_ADOPTED_KEY)).toBe('1')
    expect(readFeaturesCache()?.ai).toBe(false)
  })
})

describe('fetchFeatures', () => {
  let storage: ReturnType<typeof createStorage>

  beforeEach(() => {
    storage = createStorage()
    installWindow(storage)
  })

  afterEach(() => {
    removeWindow()
    vi.unstubAllGlobals()
  })

  it('reads the server copy and refreshes the cache', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        features: { ai: false, roundRobin: true },
        featuresConfigured: true,
        autoClose: { enabled: false, daysBeforeClose: 21 },
      }),
    })))

    const result = await fetchFeatures()
    expect(result.offline).toBe(false)
    expect(result.configured).toBe(true)
    expect(result.features.ai).toBe(false)
    expect(result.features.roundRobin).toBe(true)
    // Projected from the autoClose block, not from `features`.
    expect(result.features.autoClose).toBe(false)
    expect(result.features.autoCloseDays).toBe(21)
    expect(readFeaturesCache()).toEqual(result.features)
  })

  it('reports an unconfigured server so the caller can migrate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ featuresConfigured: false }),
    })))

    const result = await fetchFeatures()
    expect(result.configured).toBe(false)
    expect(result.offline).toBe(false)
    expect(result.features).toEqual(DEFAULT_TICKETING_FEATURES)
  })

  it('falls back to the cache when the endpoint errors out', async () => {
    writeFeaturesCache(normalizeFeatures({ ai: false, merge: false }))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))

    const result = await fetchFeatures()
    expect(result.offline).toBe(true)
    expect(result.features.ai).toBe(false)
    expect(result.features.merge).toBe(false)
  })

  it('falls back to the defaults when the network is down and nothing is cached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    const result = await fetchFeatures()
    expect(result.offline).toBe(true)
    expect(result.features).toEqual(DEFAULT_TICKETING_FEATURES)
  })

  it('does not overwrite the cache with defaults when the call fails', async () => {
    writeFeaturesCache(normalizeFeatures({ ai: false }))
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    await fetchFeatures()
    expect(readFeaturesCache()?.ai).toBe(false)
  })
})

describe('saveFeatures', () => {
  let storage: ReturnType<typeof createStorage>

  beforeEach(() => {
    storage = createStorage()
    installWindow(storage)
  })

  afterEach(() => {
    removeWindow()
    vi.unstubAllGlobals()
  })

  it('posts the flags and refreshes the cache', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)

    const ok = await saveFeatures(normalizeFeatures({ ai: false }))
    expect(ok).toBe(true)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/support/settings')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    // Only the `features` block is sent: the other settings must not be reset.
    const body = JSON.parse(init.body as string)
    expect(Object.keys(body)).toEqual(['features'])
    expect(body.features.ai).toBe(false)

    expect(readFeaturesCache()?.ai).toBe(false)
  })

  it('reports failure and leaves the cache untouched when the server refuses', async () => {
    writeFeaturesCache(normalizeFeatures({ ai: true }))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })))

    expect(await saveFeatures(normalizeFeatures({ ai: false }))).toBe(false)
    expect(readFeaturesCache()?.ai).toBe(true)
  })

  it('reports failure instead of throwing when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await saveFeatures(DEFAULT_TICKETING_FEATURES)).toBe(false)
  })
})

describe('mergeSupportSettings', () => {
  it('fills in the defaults when nothing is stored', () => {
    const merged = mergeSupportSettings(null)
    expect(merged.features).toEqual(DEFAULT_TICKETING_FEATURES)
    expect(merged.email).toEqual(DEFAULT_SETTINGS.email)
  })

  it('merges a features-only body onto the current settings, keeping the rest', () => {
    const current = mergeSupportSettings({
      email: { fromAddress: 'a@b.c', fromName: 'Support', replyToAddress: 'r@b.c' },
      sla: { firstResponseMinutes: 30, resolutionMinutes: 90, businessHoursOnly: false, escalationEmail: 'e@b.c' },
    })

    const merged = mergeSupportSettings({ features: { ...current.features, ai: false } as never }, current)

    expect(merged.features.ai).toBe(false)
    expect(merged.email.fromAddress).toBe('a@b.c')
    expect(merged.sla.firstResponseMinutes).toBe(30)
  })

  it('recomputes the projected flags from the autoClose block, not from the body', () => {
    const merged = mergeSupportSettings({
      autoClose: { enabled: false, daysBeforeClose: 30, reminderDaysBefore: 2 },
      features: { ...DEFAULT_TICKETING_FEATURES, autoClose: true, autoCloseDays: 3 } as never,
    })
    expect(merged.features.autoClose).toBe(false)
    expect(merged.features.autoCloseDays).toBe(30)
  })

  it('keeps flags absent from the body at their current value', () => {
    const current = mergeSupportSettings({ features: { ...DEFAULT_TICKETING_FEATURES, chat: false } as never })
    const merged = mergeSupportSettings({ features: { ai: false } as never }, current)
    expect(merged.features.ai).toBe(false)
    expect(merged.features.chat).toBe(false)
  })
})

describe('readSupportSettingsState', () => {
  /** Fake Payload exposing only the `payload-preferences` rows a test needs. */
  function payloadWith(rows: Record<string, unknown>): Payload {
    return {
      find: vi.fn(async ({ where }: any) => {
        const key = where?.key?.equals as string
        return key in rows ? { docs: [{ value: rows[key] }] } : { docs: [] }
      }),
    } as unknown as Payload
  }

  beforeEach(() => {
    invalidateSupportSettingsCache()
  })

  afterEach(() => {
    invalidateSupportSettingsCache()
  })

  it('returns the defaults, unconfigured, when nothing is stored', async () => {
    const state = await readSupportSettingsState(payloadWith({}))
    expect(state.featuresConfigured).toBe(false)
    expect(state.settings.features).toEqual(DEFAULT_TICKETING_FEATURES)
  })

  it('marks the flags configured once a features block exists', async () => {
    const state = await readSupportSettingsState(
      payloadWith({ 'support-settings': { features: { ai: false } } }),
    )
    expect(state.featuresConfigured).toBe(true)
    expect(state.settings.features.ai).toBe(false)
  })

  it('honours the legacy round-robin row until the first save', async () => {
    const state = await readSupportSettingsState(
      payloadWith({
        'support-settings': { email: { fromName: 'Support' } },
        'support-round-robin': { enabled: true },
      }),
    )
    expect(state.featuresConfigured).toBe(false)
    expect(state.settings.features.roundRobin).toBe(true)
  })

  it('ignores the legacy round-robin row once features are stored', async () => {
    const state = await readSupportSettingsState(
      payloadWith({
        'support-settings': { features: { roundRobin: false } },
        'support-round-robin': { enabled: true },
      }),
    )
    expect(state.settings.features.roundRobin).toBe(false)
  })

  it('falls back to the defaults when the database read throws', async () => {
    const broken = {
      find: vi.fn(async () => { throw new Error('db down') }),
    } as unknown as Payload
    const state = await readSupportSettingsState(broken)
    expect(state.settings.features).toEqual(DEFAULT_TICKETING_FEATURES)
    expect(state.featuresConfigured).toBe(false)
  })

  it('serves the cache until it is invalidated', async () => {
    const payload = payloadWith({ 'support-settings': { features: { ai: false } } })
    await readSupportSettingsState(payload)
    await readSupportSettingsState(payload)
    expect((payload.find as any).mock.calls.length).toBe(1)

    invalidateSupportSettingsCache()
    await readSupportSettingsState(payload)
    expect((payload.find as any).mock.calls.length).toBe(2)
  })
})
