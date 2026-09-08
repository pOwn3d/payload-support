import React from 'react'
import { describe, expect, it, vi } from 'vitest'

// Rendered without a DOM: the fallback is invoked as a plain function and its
// element tree is inspected. `t` is stubbed so the assertions can prove that
// the strings go through the translation layer instead of being hardcoded.
vi.mock('../components/TicketConversation/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => `T:${key}`,
    locale: 'fr',
    setLocale: () => {},
  }),
}))

import {
  AdminErrorBoundary,
  AdminErrorFallback,
  haveResetKeysChanged,
} from '../views/shared/ErrorBoundary'

type BoundaryProps = React.ComponentProps<typeof AdminErrorBoundary>
type Boundary = InstanceType<typeof AdminErrorBoundary>

interface Walked {
  types: unknown[]
  props: Record<string, unknown>[]
  text: string[]
}

function walk(node: React.ReactNode, acc: Walked = { types: [], props: [], text: [] }): Walked {
  if (node == null || typeof node === 'boolean') return acc
  if (typeof node === 'string' || typeof node === 'number') {
    acc.text.push(String(node))
    return acc
  }
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, acc))
    return acc
  }
  if (React.isValidElement(node)) {
    acc.types.push(node.type)
    const props = node.props as Record<string, unknown>
    acc.props.push(props)
    walk(props.children as React.ReactNode, acc)
  }
  return acc
}

function styleValues(tree: Walked): string[] {
  return tree.props.flatMap((props) => {
    const style = props.style as Record<string, unknown> | undefined
    return style ? Object.values(style).map(String) : []
  })
}

/**
 * Drives the boundary without a renderer: `setState` is replaced by a direct
 * merge so the lifecycle methods can be called by hand.
 */
function mountBoundary(props: BoundaryProps): Boundary {
  const instance = new AdminErrorBoundary(props)

  instance.setState = ((updater: unknown) => {
    const next = typeof updater === 'function'
      ? (updater as (s: typeof instance.state) => Partial<typeof instance.state>)(instance.state)
      : (updater as Partial<typeof instance.state>)
    instance.state = { ...instance.state, ...next }
  }) as typeof instance.setState

  return instance
}

function throwInto(instance: Boundary, error: Error): void {
  instance.state = {
    ...instance.state,
    ...AdminErrorBoundary.getDerivedStateFromError(error),
  }
}

describe('haveResetKeysChanged', () => {
  it('reports no change when both sides are absent', () => {
    expect(haveResetKeysChanged(undefined, undefined)).toBe(false)
  })

  it('reports no change for identical keys', () => {
    expect(haveResetKeysChanged(['a', 1], ['a', 1])).toBe(false)
  })

  it('reports a change when a key differs', () => {
    expect(haveResetKeysChanged(['a', 1], ['a', 2])).toBe(true)
  })

  it('reports a change when the arity differs', () => {
    expect(haveResetKeysChanged(['a'], ['a', 'b'])).toBe(true)
  })

  it('treats NaN as unchanged (Object.is semantics, not ===)', () => {
    expect(haveResetKeysChanged([NaN], [NaN])).toBe(false)
  })
})

describe('AdminErrorFallback', () => {
  const tree = walk(AdminErrorFallback({ onRetry: () => {} }))

  it('announces itself to assistive technology', () => {
    expect(tree.props[0].role).toBe('alert')
  })

  it('uses theme tokens so it stays readable in dark mode', () => {
    const values = styleValues(tree)
    expect(values).toContain('var(--theme-error-550)')
    expect(values).toContain('var(--theme-elevation-650)')
    expect(values).toContain('var(--theme-success-550)')
    expect(values).toContain('var(--theme-elevation-0)')
  })

  it('carries no hardcoded hex colour', () => {
    for (const value of styleValues(tree)) {
      expect(value).not.toMatch(/^#[0-9a-fA-F]{3,8}$/)
    }
  })

  it('gives the retry control an explicit type so it never submits a host form', () => {
    const button = tree.props.find((_, index) => tree.types[index] === 'button')
    expect(button?.type).toBe('button')
  })

  it('routes every visible string through the translation layer', () => {
    expect(tree.text).toEqual([
      'T:errorBoundary.title',
      'T:errorBoundary.description',
      'T:errorBoundary.retry',
    ])
  })
})

describe('AdminErrorBoundary', () => {
  it('renders children untouched while healthy', () => {
    const child = <p>alive</p>
    const instance = mountBoundary({ children: child })

    expect(walk(instance.render()).text).toEqual(['alive'])
  })

  it('never prints the thrown message on screen', () => {
    const instance = mountBoundary({ children: <p>alive</p>, viewName: 'X' })
    throwInto(instance, new Error('token=s3cr3t at /srv/app/src/secret.ts:42'))

    const element = instance.render() as React.ReactElement

    // The fallback is handed nothing but a retry callback, so there is no path
    // by which the thrown message could reach the screen.
    expect(element.type).toBe(AdminErrorFallback)
    expect(Object.keys(element.props as object)).toEqual(['onRetry'])
    expect(walk(element).text.join(' ')).not.toContain('s3cr3t')
  })

  it('keeps the thrown message reachable in the console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const instance = mountBoundary({ children: <p>alive</p>, viewName: 'TicketConversation' })
    const error = new Error('boom')

    instance.componentDidCatch(error, { componentStack: '' } as React.ErrorInfo)

    expect(spy).toHaveBeenCalledWith('[TicketConversation] Error:', error, { componentStack: '' })
    spy.mockRestore()
  })

  it('remounts the subtree on retry instead of resuming the instance that threw', () => {
    const instance = mountBoundary({ children: <p>alive</p> })
    const before = instance.render() as React.ReactElement

    throwInto(instance, new Error('boom'))
    instance.reset()

    const after = instance.render() as React.ReactElement

    expect(instance.state.hasError).toBe(false)
    // A different key is what forces React to discard the broken instance.
    expect(after.key).not.toBe(before.key)
  })

  it('clears the error by itself when a reset key changes', () => {
    const props: BoundaryProps = { children: <p>alive</p>, resetKeys: ['ticket-1'] }
    const instance = mountBoundary(props)
    throwInto(instance, new Error('boom'))

    ;(instance as { props: BoundaryProps }).props = { ...props, resetKeys: ['ticket-2'] }
    instance.componentDidUpdate(props)

    expect(instance.state.hasError).toBe(false)
    expect(instance.state.resetCount).toBe(1)
  })

  it('stays in the error state when the reset keys are unchanged', () => {
    const props: BoundaryProps = { children: <p>alive</p>, resetKeys: ['ticket-1'] }
    const instance = mountBoundary(props)
    throwInto(instance, new Error('boom'))

    instance.componentDidUpdate(props)

    expect(instance.state.hasError).toBe(true)
    expect(instance.state.resetCount).toBe(0)
  })

  it('honours a custom fallback', () => {
    const instance = mountBoundary({ children: <p>alive</p>, fallback: <span>custom</span> })
    throwInto(instance, new Error('boom'))

    expect(walk(instance.render()).text).toEqual(['custom'])
  })
})

describe('error boundary translation keys', () => {
  it('exist in both catalogs', async () => {
    vi.doUnmock('../components/TicketConversation/hooks/useTranslation')
    const { translations, getNestedValue } = await vi.importActual<
      typeof import('../components/TicketConversation/hooks/useTranslation')
    >('../components/TicketConversation/hooks/useTranslation')

    for (const locale of ['fr', 'en'] as const) {
      for (const key of ['errorBoundary.title', 'errorBoundary.description', 'errorBoundary.retry']) {
        expect(getNestedValue(translations[locale], key)).not.toBe(key)
      }
    }
  })
})
