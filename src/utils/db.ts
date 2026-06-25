import type { Payload } from 'payload'

/**
 * Thin typed wrappers around Payload data operations.
 *
 * Collection slugs are user-overridable config (`string`), not Payload's literal
 * `CollectionSlug` union — so every call site otherwise needs `collection: X as any`.
 * These helpers isolate that single unavoidable cast in ONE place, removing the
 * ~200 scattered `as any` while staying an EXACT behavioral pass-through of options.
 *
 * Returns default to `any` (callers consume docs loosely, as before). Pass a type
 * argument to opt into stronger typing: `dbFind<TicketData>(payload, slug, { ... })`.
 */

interface PaginatedResult<T> {
  docs: T[]
  totalDocs: number
  totalPages: number
  page?: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
  nextPage?: number | null
  prevPage?: number | null
}

export function dbFind<T = any>(
  payload: Payload,
  slug: string,
  options: Record<string, unknown> = {},
): Promise<PaginatedResult<T>> {
  return payload.find({ collection: slug as any, ...options }) as any
}

export function dbFindByID<T = any>(
  payload: Payload,
  slug: string,
  options: { id: number | string } & Record<string, unknown>,
): Promise<T> {
  return payload.findByID({ collection: slug as any, ...options }) as any
}

export function dbCreate<T = any>(
  payload: Payload,
  slug: string,
  options: Record<string, unknown>,
): Promise<T> {
  return (payload.create as any)({ collection: slug, ...options })
}

export function dbUpdate<T = any>(
  payload: Payload,
  slug: string,
  options: Record<string, unknown>,
): Promise<T> {
  return (payload.update as any)({ collection: slug, ...options })
}

export function dbCount(
  payload: Payload,
  slug: string,
  options: Record<string, unknown> = {},
): Promise<{ totalDocs: number }> {
  return payload.count({ collection: slug as any, ...options }) as any
}

export function dbDelete<T = any>(
  payload: Payload,
  slug: string,
  options: Record<string, unknown>,
): Promise<T> {
  return (payload.delete as any)({ collection: slug, ...options })
}
