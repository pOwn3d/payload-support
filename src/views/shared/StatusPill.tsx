'use client'

import React from 'react'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import s from './StatusPill.module.scss'

export type TicketStatusVariant =
  | 'open'
  | 'pending'
  | 'waiting_client'
  | 'resolved'
  | 'closed'
  | 'escalated'
  | 'sla-breach'

export interface StatusPillProps {
  status: TicketStatusVariant | string
  label?: string
  className?: string
}

const VARIANT_CLS: Record<string, string> = {
  open:           s.open,
  pending:        s.pending,
  waiting_client: s.pending,
  resolved:       s.resolved,
  closed:         s.neutral,
  escalated:      s.escalated,
  'sla-breach':   s.breach,
}

const STATUS_I18N_KEY: Record<string, string> = {
  open:           'ticket.status.open',
  pending:        'ticket.status.pending',
  waiting_client: 'ticket.status.waitingClient',
  resolved:       'ticket.status.resolved',
  closed:         'ticket.status.closed',
  escalated:      'ticket.status.escalated',
  'sla-breach':   'ticket.status.slaBreached',
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, label, className }) => {
  const { t } = useTranslation()
  const cls = VARIANT_CLS[status] || VARIANT_CLS.open
  const text = label ?? (STATUS_I18N_KEY[status] ? t(STATUS_I18N_KEY[status]) : status)
  return (
    <span
      className={[s.pill, cls, className].filter(Boolean).join(' ')}
      role="status"
      aria-label={`${t('ticket.status.label')} : ${text}`}
    >
      <span className={s.dot} aria-hidden />
      {text}
    </span>
  )
}
