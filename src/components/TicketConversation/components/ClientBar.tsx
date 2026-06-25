'use client'

import React from 'react'
import type { ClientInfo } from '../types'
import { C, s } from '../constants'

export function ClientBar({ client }: { client: ClientInfo }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px',
      borderRadius: '8px', backgroundColor: 'var(--theme-elevation-100)',
      marginBottom: '16px', flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '16px' }}>&#128100;</span>
      <span style={{ fontWeight: 700, fontSize: '13px', color: C.textPrimary }}>{client.company}</span>
      <span style={{ color: C.textSecondary, fontSize: '13px' }}>
        {client.firstName} {client.lastName}
      </span>
      <span style={{ color: C.textMuted, fontSize: '12px' }}>|</span>
      <a href={`mailto:${client.email}`} style={{ color: '#2563eb', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>{client.email}</a>
      {client.phone && <span style={{ color: C.textSecondary, fontSize: '12px' }}>{client.phone}</span>}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
        <a href={`/admin/collections/support-clients/${client.id}`} style={{ ...s.ghostBtn('#475569'), fontSize: '11px', padding: '4px 10px', textDecoration: 'none' }}>
          Fiche client
        </a>
        <button
          type="button"
          onClick={() => window.open(`/api/admin/impersonate?clientId=${client.id}`, '_blank')}
          style={{ ...s.ghostBtn('#7c3aed'), fontSize: '11px', padding: '4px 10px' }}
          title="Se connecter au portail support en tant que ce client"
        >
          Voir en tant que client
        </button>
      </span>
    </div>
  )
}
