import { APIError } from 'payload'

/**
 * Resolve the base URL of the OpenAI-compatible gateway used by the `ollama`
 * provider.
 *
 * There is deliberately NO default here. An integrator who selects `ollama` does
 * so precisely to keep ticket content off third-party infrastructure; a silent
 * fallback to any hosted endpoint would ship the whole conversation — subject,
 * message bodies, client name and company — to a server the operator never chose,
 * and would do so invisibly because the AI answer still comes back normally.
 *
 * Fail loudly instead: a missing `OLLAMA_API_URL` is a configuration error.
 */
export function resolveOllamaBaseUrl(): string {
  const baseURL = process.env.OLLAMA_API_URL
  if (!baseURL) {
    throw new APIError("provider 'ollama' requires OLLAMA_API_URL", 500)
  }
  return baseURL
}
