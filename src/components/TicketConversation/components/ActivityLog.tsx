'use client'

import React, { useState } from 'react'
import type { ActivityEntry } from '../types'
import { C, s } from '../constants'

export function ActivityLog({ activityLog }: { activityLog: ActivityEntry[] }) {
  const [showActivity, setShowActivity] = useState(false)

  return (
    <div style={s.section}>
      <h4 style={{ ...s.sectionTitle, cursor: 'pointer' }} onClick={() => setShowActivity(!showActivity)}>
        Historique <span style={s.badge('#f1f5f9', '#475569')}>{activityLog.length}</span>
        <span style={{ fontSize: '12px', color: C.textMuted, transition: 'transform 0.2s', display: 'inline-block', transform: showActivity ? 'rotate(90deg)' : 'none' }}>&#9654;</span>
      </h4>

      {showActivity && (
        activityLog.length === 0 ? (
          <p style={{ fontSize: '12px', color: C.textMuted, fontStyle: 'italic' }}>Aucune activité enregistrée.</p>
        ) : (
          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '2px solid #bfdbfe', paddingLeft: '14px', marginLeft: '4px' }}>
            {activityLog.map((entry) => (
              <div key={entry.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ color: C.textMuted, fontSize: '11px', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {new Date(entry.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={s.badge(entry.actorType === 'admin' ? '#eff6ff' : '#dcfce7', entry.actorType === 'admin' ? '#1e40af' : '#166534')}>
                  {entry.actorType || 'system'}
                </span>
                <span style={{ color: '#374151', fontWeight: 500 }}>{(entry.detail || entry.action).replace(/\[object Object\]/g, '(utilisateur)')}</span>
                <span style={{ color: C.textMuted, fontSize: '11px' }}>{entry.actorEmail}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
