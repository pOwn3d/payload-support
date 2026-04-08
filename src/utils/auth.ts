import type { CollectionSlugs } from './slugs'

/**
 * Custom error class for authentication/authorization failures.
 * Carries an HTTP status code for consistent API responses.
 */
export class AuthError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'AuthError'
    this.statusCode = statusCode
  }
}

/**
 * Asserts the request comes from an authenticated admin user.
 * Throws AuthError(401) if unauthenticated, AuthError(403) if not an admin.
 * Uses TypeScript assertion signature so `req.user` is narrowed to non-null after call.
 */
export function requireAdmin(req: { user?: any }, slugs: CollectionSlugs): asserts req is { user: NonNullable<typeof req.user> } {
  if (!req.user) throw new AuthError('Authentication required', 401)
  if (req.user.collection !== slugs.users) throw new AuthError('Admin access required', 403)
}

/**
 * Asserts the request comes from an authenticated support client.
 * Throws AuthError(401) if unauthenticated, AuthError(403) if not a client.
 * Uses TypeScript assertion signature so `req.user` is narrowed to non-null after call.
 */
export function requireClient(req: { user?: any }, slugs: CollectionSlugs): asserts req is { user: NonNullable<typeof req.user> } {
  if (!req.user) throw new AuthError('Authentication required', 401)
  if (req.user.collection !== slugs.supportClients) throw new AuthError('Client access required', 403)
}

/**
 * Handles AuthError in catch blocks, returning appropriate JSON responses.
 * Returns null if the error is not an AuthError (caller should handle it).
 */
export function handleAuthError(error: unknown): Response | null {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.statusCode })
  }
  return null
}
