'use client'

import React, { useState } from 'react'
import s from '../../styles/TicketDetail.module.scss'

const labelMap: Record<string, string> = { now: 'Maintenant', today: "Aujourd'hui", 'this-week': 'Cette semaine' }

export function NextActionItem({ action, index, onToggle }: { action: any; index: number; onToggle: (done: boolean) => Promise<void> }) {
  const [pending, setPending] = useState(false)
  const done = !!action.done
  return (
    <li className={s.aiCardNextAction}>
      <button
        type="button"
        className={`${s.aiCardNextCheck} ${done ? s.aiCardNextCheckDone : ''}`}
        onClick={async () => {
          setPending(true)
          try { await onToggle(!done) } finally { setPending(false) }
        }}
        aria-pressed={done}
        aria-label={done ? 'Marquer non fait' : 'Marquer fait'}
        disabled={pending}
      >
        {done && <span aria-hidden>✓</span>}
      </button>
      <span className={`${s.aiCardNextLabel} ${done ? s.aiCardNextLabelDone : ''}`}>{action.label}</span>
      <span className={s.aiCardNextWhen}>{labelMap[action.priority] || action.priority}</span>
    </li>
  )
}
