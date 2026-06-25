'use client'

import React from 'react'
import { V } from './adminTokens'

interface AdminViewHeaderProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  breadcrumb?: { label: string; href: string }
  actions?: React.ReactNode
}

export const AdminViewHeader: React.FC<AdminViewHeaderProps> = ({
  icon,
  title,
  subtitle,
  breadcrumb,
  actions,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
      }}
    >
      <div>
        {breadcrumb && (
          <div style={{ marginBottom: 6 }}>
            <a
              href={breadcrumb.href}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: V.cyan,
                textDecoration: 'none',
                textTransform: 'uppercase',
              }}
            >
              &larr; {breadcrumb.label}
            </a>
          </div>
        )}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: 0,
            margin: 0,
            color: V.text,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ color: V.cyan, display: 'flex', alignItems: 'center' }}>{icon}</span>
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: V.textSecondary, margin: '4px 0 0', fontSize: 14 }}>{subtitle}</p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  )
}
