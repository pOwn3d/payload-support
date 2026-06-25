'use client'

import React from 'react'
import type { SatisfactionSurvey } from '../types'
import { statusLabels, C, s } from '../constants'

const sourceLabels: Record<string, string> = {
  email: 'Email',
  'live-chat': 'Live Chat',
  portal: 'Portail',
  admin: 'Admin',
}

interface TicketHeaderProps {
  ticketNumber: string
  currentStatus: string
  clientSentiment: { emoji: string; label: string; color: string } | null
  ticketSource: string
  chatSession: string
  snoozeUntil: string | null
  satisfaction: SatisfactionSurvey | null
  copiedLink: 'admin' | 'client' | null
  onCopyLink: (type: 'admin' | 'client') => void
}

export function TicketHeader({
  ticketNumber, currentStatus, clientSentiment, ticketSource, chatSession,
  snoozeUntil, satisfaction, copiedLink, onCopyLink,
}: TicketHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
      borderRadius: '8px', backgroundColor: 'var(--theme-elevation-100)',
      marginBottom: '12px', flexWrap: 'wrap',
    }}>
      {ticketNumber && (
        <span style={{ fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace", fontWeight: 700, fontSize: '14px', color: C.textPrimary }}>{ticketNumber}</span>
      )}
      {currentStatus && (() => {
        const st = statusLabels[currentStatus] || statusLabels.open
        return <span style={s.badge(st.bg, st.color)}>{st.label}</span>
      })()}
      {clientSentiment && (
        <span
          style={{ ...s.badge(`${clientSentiment.color}15`, clientSentiment.color), fontSize: '11px' }}
          title={`Sentiment : ${clientSentiment.label}`}
        >
          {clientSentiment.emoji} {clientSentiment.label}
        </span>
      )}
      {ticketSource && ticketSource !== 'portal' && (
        <span style={s.badge('#f1f5f9', '#475569')}>{sourceLabels[ticketSource] || ticketSource}</span>
      )}
      {chatSession && ticketSource === 'live-chat' && (
        <span style={{ fontSize: '11px', color: C.textMuted }}>
          Session : {chatSession.slice(0, 16)}...
        </span>
      )}
      {snoozeUntil && new Date(snoozeUntil) > new Date() && (
        <span style={s.badge('#f5f3ff', '#7c3aed')}>
          Snoozé {new Date(snoozeUntil).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {satisfaction && (
        <span style={s.badge(
          satisfaction.rating >= 4 ? '#dcfce7' : satisfaction.rating >= 3 ? '#fef9c3' : '#fee2e2',
          satisfaction.rating >= 4 ? '#166534' : satisfaction.rating >= 3 ? '#854d0e' : '#991b1b',
        )}>
          {Array.from({ length: 5 }, (_, i) => i < satisfaction.rating ? '\u2605' : '\u2606').join('')} {satisfaction.rating}/5
        </span>
      )}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={() => onCopyLink('admin')}
          title="Copier le lien admin"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', opacity: copiedLink === 'admin' ? 1 : 0.5, padding: '2px 4px' }}
        >
          {copiedLink === 'admin' ? '\u2705' : '\uD83D\uDCCB'}
        </button>
        <button
          onClick={() => onCopyLink('client')}
          title="Copier le lien client"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', opacity: copiedLink === 'client' ? 1 : 0.5, padding: '2px 4px' }}
        >
          {copiedLink === 'client' ? '\u2705' : '\uD83D\uDD17'}
        </button>
        {copiedLink && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Copié</span>}
      </span>
    </div>
  )
}
