import type React from 'react'
import { describe, expect, it, vi } from 'vitest'

// The only hook the exported wrapper calls. Stubbing it lets the wrapper be
// invoked as a plain function, outside any renderer.
vi.mock('../components/TicketConversation/hooks/useDocumentIdFromUrl', () => ({
  useDocumentIdFromUrl: () => ({ id: 42 }),
}))

const { AdminErrorBoundary } = await import('../views/shared/ErrorBoundary')
const TicketConversation = (await import('../components/TicketConversation')).default

describe('TicketConversation export', () => {
  /**
   * Payload mounts this component from the import map as the Tickets `ui`
   * field, so no ancestor of the plugin's own can wrap it: the boundary has to
   * be part of the exported module or there is none at all.
   */
  const element = (TicketConversation as unknown as (p: object) => React.ReactElement)({})

  it('is wrapped in the admin error boundary', () => {
    expect(element.type).toBe(AdminErrorBoundary)
  })

  it('names itself so the console tells you which view broke', () => {
    expect((element.props as { viewName?: string }).viewName).toBe('TicketConversation')
  })

  it('resets when the ticket being viewed changes', () => {
    expect((element.props as { resetKeys?: unknown[] }).resetKeys).toEqual([42])
  })

  it('still renders the conversation itself as its child', () => {
    const child = (element.props as { children: React.ReactElement }).children
    expect(typeof child.type).toBe('function')
    expect(child.type).not.toBe(AdminErrorBoundary)
  })
})
