import { describe, it, expect, afterEach } from 'vitest'
import { resolveOllamaBaseUrl } from '../utils/aiProvider'

const ORIGINAL = process.env.OLLAMA_API_URL

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.OLLAMA_API_URL
  else process.env.OLLAMA_API_URL = ORIGINAL
})

/**
 * Non-regression: the `ollama` provider used to silently fall back to a hosted
 * third-party gateway when OLLAMA_API_URL was unset, exfiltrating whole ticket
 * conversations to a host the operator never configured. It must now fail.
 */
describe('resolveOllamaBaseUrl', () => {
  it('throws when OLLAMA_API_URL is not set — no implicit third-party host', () => {
    delete process.env.OLLAMA_API_URL
    expect(() => resolveOllamaBaseUrl()).toThrowError(/OLLAMA_API_URL/)
  })

  it('throws on an empty value rather than defaulting', () => {
    process.env.OLLAMA_API_URL = ''
    expect(() => resolveOllamaBaseUrl()).toThrowError(/OLLAMA_API_URL/)
  })

  it('returns the configured URL verbatim', () => {
    process.env.OLLAMA_API_URL = 'http://127.0.0.1:11434/v1'
    expect(resolveOllamaBaseUrl()).toBe('http://127.0.0.1:11434/v1')
  })
})
