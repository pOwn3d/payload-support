import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { dbFind } from '../utils/db'

// Combining diacritics range used to strip accents after NFD normalization.
const DIACRITICS = /[̀-ͯ]/g

/**
 * Recursively extract plain text from a Lexical (Payload richText) JSON tree.
 * Returns a single string with nodes' text content joined by spaces.
 *
 * The shape we expect is roughly:
 *   { root: { children: [ { children: [ { type: 'text', text: '...' } ] } ] } }
 * but we walk anything that has a `children` array or a `text` field so it
 * also tolerates the older Slate format.
 */
function lexicalToPlainText(richText: unknown): string {
  if (!richText) return ''

  const parts: string[] = []

  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return
    if (typeof node.text === 'string') {
      parts.push(node.text)
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) visit(child)
    }
    if (node.root) visit(node.root)
  }

  visit(richText)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Build a short excerpt (~maxChars) cutting on a word boundary.
 */
function buildExcerpt(plain: string, maxChars = 160): string {
  if (!plain) return ''
  if (plain.length <= maxChars) return plain
  const slice = plain.slice(0, maxChars + 1)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > 60 ? slice.slice(0, lastSpace) : slice.slice(0, maxChars)
  return `${cut.trim()}…`
}

/**
 * Tokenize a query into lowercase words ≥ 2 chars (no diacritics).
 */
function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)
}

/**
 * Normalize a string for case/diacritics-insensitive comparison.
 */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(DIACRITICS, '')
}

/**
 * GET /api/support/kb/search?q=<query>&limit=5
 *
 * Public deflection endpoint: returns published KB articles whose `title` or
 * `category` matches the query. No auth required (used on the public portal
 * before/while a client writes a ticket — and also from the chatbot widget).
 *
 * Response shape:
 *   { results: [{ id, title, slug, excerpt, category, score }], total }
 */
export function createKbSearchEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/kb/search',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        const url = new URL(req.url!)
        const q = (url.searchParams.get('q') || '').trim()
        const limitRaw = parseInt(url.searchParams.get('limit') || '5', 10)
        const limit = Math.min(Math.max(Number.isNaN(limitRaw) ? 5 : limitRaw, 1), 10)

        if (!q || q.length < 3) {
          return Response.json({ results: [], total: 0 })
        }

        const tokens = tokenize(q)
        if (tokens.length === 0) {
          return Response.json({ results: [], total: 0 })
        }

        // Build an OR over (title contains token) ∪ (category contains token)
        // for each significant token so multi-word queries still match docs
        // matching any token.
        const orClauses: any[] = []
        for (const t of tokens) {
          orClauses.push({ title: { contains: t } })
          orClauses.push({ category: { contains: t } })
        }
        // Always include the raw query for short single-word matches.
        orClauses.push({ title: { contains: q } })

        const res = await dbFind(payload, slugs.knowledgeBase, {
          where: {
            and: [
              { published: { equals: true } },
              { or: orClauses },
            ],
          } as any,
          // Over-fetch so we can re-rank and trim ourselves.
          limit: Math.max(limit * 3, 10),
          depth: 0,
          overrideAccess: true,
        })

        const results = res.docs
          .map((a: any) => {
            const title: string = a.title || ''
            const category: string = a.category || ''
            const titleN = normalize(title)
            const categoryN = normalize(category)
            let score = 0
            for (const t of tokens) {
              if (titleN.includes(t)) score += 2
              if (categoryN.includes(t)) score += 1
            }
            const plain = lexicalToPlainText(a.body)
            return {
              id: a.id,
              title,
              slug: a.slug,
              category,
              excerpt: buildExcerpt(plain, 160),
              score,
            }
          })
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)

        return Response.json({ results, total: results.length })
      } catch (error) {
        console.error('[kb-search] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
