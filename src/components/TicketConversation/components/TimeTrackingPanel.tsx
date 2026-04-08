'use client'

import React from 'react'
import type { TimeEntry } from '../types'
import { C, s } from '../constants'

interface TimeTrackingPanelProps {
  timeEntries: TimeEntry[]
  totalMinutes: number
  // Timer
  timerRunning: boolean
  timerSeconds: number
  setTimerSeconds: React.Dispatch<React.SetStateAction<number>>
  timerDescription: string
  setTimerDescription: (v: string) => void
  handleTimerStart: (reset?: boolean) => void
  handleTimerStop: () => void
  handleTimerSave: () => void
  handleTimerDiscard: () => void
  // Manual entry
  duration: string
  setDuration: (v: string) => void
  timeDescription: string
  setTimeDescription: (v: string) => void
  handleAddTime: () => void
  addingTime: boolean
  timeSuccess: string
}

export function TimeTrackingPanel({
  timeEntries, totalMinutes,
  timerRunning, timerSeconds, setTimerSeconds, timerDescription, setTimerDescription,
  handleTimerStart, handleTimerStop, handleTimerSave, handleTimerDiscard,
  duration, setDuration, timeDescription, setTimeDescription,
  handleAddTime, addingTime, timeSuccess,
}: TimeTrackingPanelProps) {
  const totalH = Math.floor(totalMinutes / 60)
  const totalM = totalMinutes % 60

  return (
    <div style={s.section}>
      <h4 style={s.sectionTitle}>
        Temps
        {totalMinutes > 0 && <span style={s.badge('#fef3c7', '#92400e')}>{totalH}h{String(totalM).padStart(2, '0')} total</span>}
      </h4>

      {/* Timer */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        padding: '12px 16px', borderRadius: '10px', marginBottom: '14px',
        backgroundColor: timerRunning ? '#fef2f2' : 'var(--theme-elevation-100)',
        border: timerRunning ? '1px solid #fca5a5' : '1px solid var(--theme-elevation-300)',
      }}>
        <div style={{
          fontFamily: 'monospace', fontSize: '24px', fontWeight: 700,
          color: timerRunning ? '#dc2626' : 'var(--theme-text)',
          minWidth: '90px',
        }}>
          {String(Math.floor(timerSeconds / 3600)).padStart(2, '0')}:{String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
        </div>

        {!timerRunning && timerSeconds > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {[-5, -1, 1, 5, 15, 30].map((m) => (
              <button
                key={m}
                onClick={() => setTimerSeconds((p) => Math.max(0, p + m * 60))}
                style={{ width: Math.abs(m) >= 15 ? '32px' : '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: Math.abs(m) >= 15 ? '12px' : '14px', fontWeight: 700, color: '#64748b' }}
                title={`${m > 0 ? '+' : ''}${m} min`}
              >
                {m > 0 ? `+${m}` : String(m)}
              </button>
            ))}
          </div>
        )}

        {!timerRunning && timerSeconds === 0 && (
          <button onClick={() => handleTimerStart(true)} style={{ ...s.btn('#dc2626', false), fontSize: '12px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            &#9654; Démarrer
          </button>
        )}
        {timerRunning && (
          <button onClick={handleTimerStop} style={{ ...s.btn('#374151', false), fontSize: '12px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            &#9208; Pause
          </button>
        )}
        {!timerRunning && timerSeconds > 0 && (
          <>
            <button onClick={() => handleTimerStart(false)} style={{ ...s.btn('#dc2626', false), fontSize: '12px', padding: '6px 14px' }}>
              &#9654; Reprendre
            </button>
            <input
              type="text"
              value={timerDescription}
              onChange={(e) => setTimerDescription(e.target.value)}
              placeholder="Description..."
              style={{ ...s.input, fontSize: '12px', flex: 1, minWidth: '120px' }}
            />
            <button
              onClick={handleTimerSave}
              disabled={addingTime || timerSeconds < 60}
              style={{ ...s.btn('#16a34a', addingTime || timerSeconds < 60), fontSize: '12px', padding: '6px 14px' }}
              title={timerSeconds < 60 ? 'Minimum 1 minute' : `Sauvegarder ${Math.round(timerSeconds / 60)} min`}
            >
              &#128190; {Math.round(timerSeconds / 60)} min
            </button>
            <button onClick={handleTimerDiscard} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#94a3b8', padding: '4px' }} title="Annuler">
              &#10005;
            </button>
          </>
        )}
        {timerRunning && (
          <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
            &#9679; Enregistrement en cours — session maintenue active
          </span>
        )}
      </div>

      {/* Manual time entry */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: C.textSecondary, marginBottom: '3px', fontWeight: 600 }}>Min</label>
          <input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" style={{ ...s.input, width: '80px' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '11px', color: C.textSecondary, marginBottom: '3px', fontWeight: 600 }}>Description</label>
          <input type="text" value={timeDescription} onChange={(e) => setTimeDescription(e.target.value)} placeholder="Travail effectué..." style={{ ...s.input, width: '100%' }} />
        </div>
        <button onClick={handleAddTime} disabled={addingTime || !duration} style={s.btn(C.amber, addingTime || !duration)}>
          {addingTime ? '...' : '+ Temps'}
        </button>
        {timeSuccess && <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>{timeSuccess}</span>}
      </div>

      {timeEntries.length > 0 && (
        <div style={{ fontSize: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, fontSize: '11px', color: C.textSecondary }}>Date</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, fontSize: '11px', color: C.textSecondary }}>Durée</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, fontSize: '11px', color: C.textSecondary }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {timeEntries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 8px', color: '#374151' }}>
                    {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </td>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: '#374151' }}>{entry.duration} min</td>
                  <td style={{ padding: '6px 8px', color: C.textSecondary }}>{entry.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
