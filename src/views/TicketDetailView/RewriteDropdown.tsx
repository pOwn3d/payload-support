'use client'

import React, { useState, useEffect, useRef } from 'react'
import { REWRITE_STYLES } from './constants'

export const RewriteDropdown: React.FC<{
  disabled: boolean
  loading: boolean
  onSelect: (style: string) => void
  toolbarBtnClass?: string
}> = ({ disabled, loading, onSelect, toolbarBtnClass }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
        className={toolbarBtnClass}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', width: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        {loading ? '...' : '✏️ Reformuler'}
        {!loading && <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>}
      </button>
      {open && !disabled && !loading && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 180, overflow: 'hidden',
        }}>
          {REWRITE_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => { setOpen(false); onSelect(style.id) }}
              style={{
                display: 'flex', flexDirection: 'column', width: '100%', padding: '8px 12px',
                border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
                borderBottom: '1px solid #f3f4f6',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f9fafb' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontSize: 12, fontWeight: 600 }}>{style.label}</span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{style.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
