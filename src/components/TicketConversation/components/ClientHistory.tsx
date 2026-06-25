'use client'

import React, { useState } from 'react'
import type { ClientInfo } from '../types'
import { statusLabels, projectStatusLabels, C, s } from '../constants'

interface ClientHistoryProps {
  client: ClientInfo
  clientTickets: Array<{ id: number; ticketNumber: string; subject: string; status: string; createdAt: string }>
  clientProjects: Array<{ id: number; name: string; status: string }>
  clientNotes: string
  onNotesChange: (notes: string) => void
  onNotesSave: () => void
  savingNotes: boolean
  notesSaved: boolean
}

export function ClientHistory({
  client: _client, clientTickets, clientProjects, clientNotes, onNotesChange, onNotesSave, savingNotes, notesSaved,
}: ClientHistoryProps) {
  const [showClientHistory, setShowClientHistory] = useState(false)

  return (
    <div style={s.section}>
      <button
        type="button"
        onClick={() => setShowClientHistory(!showClientHistory)}
        style={{
          background: 'none', border: `1px dashed ${C.border}`, borderRadius: '6px',
          padding: '8px 14px', cursor: 'pointer', color: C.textSecondary, fontSize: '13px',
          fontWeight: 600, width: '100%', textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>Historique client ({clientTickets.length} ticket{clientTickets.length !== 1 ? 's' : ''}, {clientProjects.length} projet{clientProjects.length !== 1 ? 's' : ''})</span>
        <span style={{ fontSize: '12px', transition: 'transform 0.2s', display: 'inline-block', transform: showClientHistory ? 'rotate(90deg)' : 'none' }}>&#9654;</span>
      </button>
      {showClientHistory && (
        <div style={{ marginTop: '10px', padding: '14px 18px', borderRadius: '8px', backgroundColor: C.white, border: `1px solid ${C.border}` }}>
          {/* Past tickets */}
          <h5 style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px' }}>Derniers tickets</h5>
          {clientTickets.length === 0 ? (
            <p style={{ fontSize: '12px', color: C.textMuted, fontStyle: 'italic', marginBottom: '14px' }}>Aucun autre ticket</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
              {clientTickets.map((t) => {
                const st = statusLabels[t.status] || statusLabels.open
                return (
                  <a
                    key={t.id}
                    href={`/admin/support/ticket?id=${t.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                      borderRadius: '6px', border: `1px solid ${C.border}`, textDecoration: 'none',
                      fontSize: '12px', color: '#374151', backgroundColor: '#fafafa',
                    }}
                  >
                    <span style={{ fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace", fontWeight: 600, color: C.textMuted, fontSize: '11px', whiteSpace: 'nowrap' }}>{t.ticketNumber}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{t.subject}</span>
                    <span style={s.badge(st.bg, st.color)}>{st.label}</span>
                    <span style={{ fontSize: '10px', color: C.textMuted, whiteSpace: 'nowrap' }}>
                      {new Date(t.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </a>
                )
              })}
            </div>
          )}

          {/* Projects */}
          <h5 style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px' }}>Projets</h5>
          {clientProjects.length === 0 ? (
            <p style={{ fontSize: '12px', color: C.textMuted, fontStyle: 'italic', marginBottom: '14px' }}>Aucun projet</p>
          ) : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {clientProjects.map((p) => {
                const ps = projectStatusLabels[p.status] || projectStatusLabels.active
                return (
                  <a
                    key={p.id}
                    href={`/admin/collections/projects/${p.id}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
                      borderRadius: '6px', border: `1px solid ${C.border}`, textDecoration: 'none',
                      fontSize: '12px', fontWeight: 600, color: '#374151', backgroundColor: '#fafafa',
                    }}
                  >
                    {p.name}
                    <span style={s.badge(ps.bg, ps.color)}>{ps.label}</span>
                  </a>
                )
              })}
            </div>
          )}

          {/* Notes */}
          <h5 style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px' }}>Notes internes</h5>
          <textarea
            value={clientNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            style={{ ...s.input, width: '100%', resize: 'vertical', fontSize: '12px', marginBottom: '8px' }}
            placeholder="Notes sur ce client..."
          />
          <button
            type="button"
            onClick={onNotesSave}
            disabled={savingNotes}
            style={{ ...s.btn(notesSaved ? '#16a34a' : C.blue, savingNotes), fontSize: '11px', padding: '5px 12px' }}
          >
            {notesSaved ? 'Sauvegarde OK' : savingNotes ? 'Sauvegarde...' : 'Sauvegarder les notes'}
          </button>
        </div>
      )}
    </div>
  )
}
