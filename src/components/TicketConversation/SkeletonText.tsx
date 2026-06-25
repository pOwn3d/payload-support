'use client'

import React from 'react'

// Inline skeleton replacement (no external dependency)
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '14px',
            borderRadius: '4px',
            backgroundColor: '#e2e8f0',
            width: i === lines - 1 ? '60%' : '100%',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  )
}
