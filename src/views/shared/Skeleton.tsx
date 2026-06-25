'use client'

import React, { useEffect } from 'react'

// ---- Style injection ----

const styleId = 'skeleton-shimmer-style'

function injectSkeletonStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(styleId)) return
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    @keyframes skeleton-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `
  document.head.appendChild(style)
}

// ---- Base Skeleton ----

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = '4px', style }: SkeletonProps) {
  useEffect(() => {
    injectSkeletonStyles()
  }, [])

  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s infinite',
        ...style,
      }}
    />
  )
}

// ---- Skeleton Text ----

export function SkeletonText({ lines = 3, width = '100%' }: { lines?: number; width?: string | number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="16px" width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  )
}

// ---- Skeleton Card ----

export function SkeletonCard({ height = '200px' }: { height?: string }) {
  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      minHeight: height,
    }}>
      <Skeleton height="24px" width="40%" />
      <SkeletonText lines={3} />
      <Skeleton height="32px" width="120px" borderRadius="6px" />
    </div>
  )
}

// ---- Skeleton Table ----

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '2px solid #e5e7eb' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height="16px" width={`${100 / columns}%`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={colIdx} height="14px" width={`${100 / columns}%`} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ---- Skeleton Dashboard ----

export function SkeletonDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px 0' }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ padding: '20px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <Skeleton height="14px" width="60%" style={{ marginBottom: '8px' }} />
            <Skeleton height="32px" width="40%" />
          </div>
        ))}
      </div>
      {/* Table */}
      <SkeletonTable rows={5} columns={4} />
    </div>
  )
}
