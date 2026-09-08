'use client'

import React from 'react'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  viewName?: string
  /**
   * Values that identify the input the subtree renders from (a ticket id, a
   * filter, a page number...). When any of them changes the boundary clears
   * the error on its own, because the new input may well render fine.
   */
  resetKeys?: unknown[]
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  /**
   * Bumped on every reset. It is used as the `key` of the wrapper around the
   * children so that a retry REMOUNTS the subtree. Clearing `hasError` alone
   * keeps the broken component instance and its state, so anything that threw
   * from a bad piece of state throws again on the very next render.
   */
  resetCount: number
}

/**
 * Shallow comparison of two reset-key arrays. A missing array is treated as
 * empty, so a boundary declared without `resetKeys` never auto-resets.
 */
export function haveResetKeysChanged(previous?: unknown[], next?: unknown[]): boolean {
  const a = previous ?? []
  const b = next ?? []

  if (a.length !== b.length) return true
  return a.some((value, index) => !Object.is(value, b[index]))
}

/**
 * Default fallback UI.
 *
 * Exported so it can be rendered (and asserted on) in isolation. It is the
 * only screen a user sees when a view is broken, so it must stay readable in
 * both themes: every colour comes from a Payload theme token, never a hex
 * literal that only works on a light background.
 *
 * The thrown message is deliberately NOT displayed — it can carry a stack
 * fragment, an internal path or a raw API payload. It is logged to the console
 * by `componentDidCatch` instead.
 */
export function AdminErrorFallback({ onRetry }: { onRetry: () => void }): React.ReactElement {
  const { t } = useTranslation()

  return (
    <div
      role="alert"
      style={{
        padding: '40px',
        textAlign: 'center',
        color: 'var(--theme-error-550)',
      }}
    >
      <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>
        {t('errorBoundary.title')}
      </h2>
      <p style={{ marginBottom: '24px', color: 'var(--theme-elevation-650)', fontSize: '14px' }}>
        {t('errorBoundary.description')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          padding: '8px 20px',
          backgroundColor: 'var(--theme-success-550)',
          color: 'var(--theme-elevation-0)',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        {t('errorBoundary.retry')}
      </button>
    </div>
  )
}

export class AdminErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, resetCount: 0 }
  }

  static getDerivedStateFromError(error: Error): Pick<ErrorBoundaryState, 'hasError' | 'error'> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[${this.props.viewName || 'AdminView'}] Error:`, error, errorInfo)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.hasError) return
    if (!haveResetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) return
    this.reset()
  }

  reset = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetCount: prev.resetCount + 1,
    }))
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return <AdminErrorFallback onRetry={this.reset} />
    }

    // The key forces a full remount after a reset instead of resuming the
    // component instance that just threw.
    return <React.Fragment key={this.state.resetCount}>{this.props.children}</React.Fragment>
  }
}
