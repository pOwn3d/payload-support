'use client'

import React from 'react'
import { C, s } from '../constants'

interface QuickActionsProps {
  statusTransitions: Array<{ status: string; label: string; color: string }>
  statusUpdating: boolean
  onStatusChange: (status: string) => void
  snoozeUntil: string | null
  snoozeSaving: boolean
  onCancelSnooze: () => void
  // Panel toggles
  showMerge: boolean
  showExtMsg: boolean
  showSnooze: boolean
  onToggleMerge: () => void
  onToggleExtMsg: () => void
  onToggleSnooze: () => void
  onNextTicket: () => void
  // Next ticket banner
  showNextTicket: boolean
  nextTicketId: number | null
  nextTicketInfo: string
  onCloseNextTicket: () => void
}

export function QuickActions({
  statusTransitions, statusUpdating, onStatusChange,
  snoozeUntil, snoozeSaving, onCancelSnooze,
  showMerge: _showMerge, showExtMsg: _showExtMsg, showSnooze: _showSnooze,
  onToggleMerge, onToggleExtMsg, onToggleSnooze, onNextTicket,
  showNextTicket, nextTicketId, nextTicketInfo, onCloseNextTicket,
}: QuickActionsProps) {
  return (
    <>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
        {statusTransitions.map((a) => (
          <button
            key={a.status}
            onClick={() => onStatusChange(a.status)}
            disabled={statusUpdating}
            style={s.outlineBtn(a.color, statusUpdating)}
          >
            {a.label}
          </button>
        ))}
        {snoozeUntil && new Date(snoozeUntil) > new Date() && (
          <button onClick={onCancelSnooze} disabled={snoozeSaving} style={{ ...s.ghostBtn('#7c3aed', snoozeSaving), fontSize: '12px', padding: '5px 10px' }}>
            Annuler snooze
          </button>
        )}
        <span style={{ borderLeft: `1px solid ${C.border}`, height: '20px', margin: '0 4px' }} />
        <button onClick={onToggleMerge} style={s.ghostBtn('#be185d')}>Fusionner</button>
        <button onClick={onToggleExtMsg} style={s.ghostBtn('#4f46e5')}>+ Message reçu</button>
        <button onClick={onToggleSnooze} style={s.ghostBtn('#7c3aed')}>Snooze</button>
        <button onClick={onNextTicket} style={s.ghostBtn('#16a34a')}>Ticket suivant</button>
      </div>

      {showNextTicket && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: `1px solid ${C.border}`, marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {nextTicketId ? (
            <>
              <span style={{ fontSize: '13px', color: '#166534', fontWeight: 600 }}>
                Ticket suivant : <strong>{nextTicketInfo}</strong>
              </span>
              <button
                onClick={() => { window.location.href = `/admin/support/ticket?id=${nextTicketId}` }}
                style={{ ...s.btn(C.statusResolved), color: C.white, fontSize: '12px', padding: '5px 14px' }}
              >
                Ouvrir
              </button>
            </>
          ) : (
            <span style={{ fontSize: '13px', color: '#166534', fontWeight: 700 }}>{nextTicketInfo}</span>
          )}
          <button onClick={onCloseNextTicket} style={{ border: 'none', background: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '16px', fontWeight: 700, marginLeft: '8px' }}>&times;</button>
        </div>
      )}
    </>
  )
}
