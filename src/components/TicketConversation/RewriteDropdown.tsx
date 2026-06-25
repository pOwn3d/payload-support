'use client'

import React, { useState } from 'react'
import { REWRITE_STYLES, s } from './constants'

export const RewriteDropdown: React.FC<{
  disabled: boolean
  loading: boolean
  onSelect: (style: string) => void
}> = ({ disabled, loading, onSelect }) => {
  const [open, setOpen] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        style={{
          ...s.outlineBtn('#0891b2', disabled),
          fontSize: '11px',
          padding: '3px 10px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {loading ? 'Reformulation...' : '✏️ Reformuler'}
        {!loading && <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>}
      </button>
      {open && !disabled && !loading && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 4,
            background: 'var(--theme-elevation-0, #fff)',
            border: '1px solid var(--theme-elevation-200, #e5e7eb)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 100,
            minWidth: 180,
            overflow: 'hidden',
          }}
        >
          {REWRITE_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => { setOpen(false); onSelect(style.id) }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '1px solid var(--theme-elevation-100, #f3f4f6)',
                transition: 'background 120ms',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--theme-elevation-50, #f9fafb)' }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-text, #111)' }}>{style.label}</span>
              <span style={{ fontSize: 10, color: 'var(--theme-elevation-500, #6b7280)' }}>{style.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
