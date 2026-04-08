'use client'

import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  viewName?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class AdminErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[${this.props.viewName || 'AdminView'}] Error:`, error, errorInfo)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#dc2626',
        }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>
            Une erreur est survenue
          </h2>
          <p style={{ marginBottom: '24px', color: '#6b7280', fontSize: '14px' }}>
            {this.state.error?.message || 'Erreur inattendue'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Reessayer
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
