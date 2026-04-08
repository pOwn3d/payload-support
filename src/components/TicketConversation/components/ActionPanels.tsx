'use client'

import React, { useRef } from 'react'
import { s } from '../constants'

// ========== MERGE PANEL ==========
interface MergePanelProps {
  mergeTarget: string
  setMergeTarget: (v: string) => void
  mergeTargetInfo: { id: number; ticketNumber: string; subject: string } | null
  setMergeTargetInfo: (v: null) => void
  mergeError: string
  setMergeError: (v: string) => void
  merging: boolean
  handleMergeLookup: () => void
  handleMerge: () => void
}

export function MergePanel({
  mergeTarget, setMergeTarget, mergeTargetInfo, setMergeTargetInfo,
  mergeError, setMergeError, merging, handleMergeLookup, handleMerge,
}: MergePanelProps) {
  return (
    <div style={{ padding: '14px 18px', borderRadius: '8px', backgroundColor: '#fdf2f8', border: '1px solid #fbcfe8', marginBottom: '14px' }}>
      <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: '#831843' }}>Fusionner ce ticket dans un autre</h4>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
        <input
          type="text"
          value={mergeTarget}
          onChange={(e) => { setMergeTarget(e.target.value); setMergeTargetInfo(null); setMergeError('') }}
          placeholder="TK-0001"
          style={{ ...s.input, width: '130px' }}
        />
        <button onClick={handleMergeLookup} style={{ ...s.outlineBtn('#ec4899'), fontSize: '12px', padding: '6px 14px' }}>
          Rechercher
        </button>
        {mergeError && <span style={{ fontSize: '12px', color: '#be185d', fontWeight: 600 }}>{mergeError}</span>}
      </div>
      {mergeTargetInfo && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {mergeTargetInfo.ticketNumber} — {mergeTargetInfo.subject}
          </span>
          <button onClick={handleMerge} disabled={merging} style={{ ...s.btn('#ec4899', merging), color: '#fff', fontSize: '12px', padding: '6px 14px' }}>
            {merging ? 'Fusion...' : 'Confirmer la fusion'}
          </button>
        </div>
      )}
    </div>
  )
}

// ========== EXTERNAL MESSAGE PANEL ==========
interface ExtMessagePanelProps {
  extMsgBody: string
  setExtMsgBody: (v: string) => void
  extMsgAuthor: 'client' | 'admin'
  setExtMsgAuthor: (v: 'client' | 'admin') => void
  extMsgDate: string
  setExtMsgDate: (v: string) => void
  extMsgFiles: File[]
  setExtMsgFiles: React.Dispatch<React.SetStateAction<File[]>>
  sendingExtMsg: boolean
  handleSendExtMsg: () => void
  handleExtFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function ExtMessagePanel({
  extMsgBody, setExtMsgBody, extMsgAuthor, setExtMsgAuthor,
  extMsgDate, setExtMsgDate, extMsgFiles, setExtMsgFiles,
  sendingExtMsg, handleSendExtMsg, handleExtFileChange,
}: ExtMessagePanelProps) {
  const extFileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ padding: '14px 18px', borderRadius: '8px', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', marginBottom: '14px' }}>
      <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: '#312e81' }}>Ajouter un message reçu (email, SMS, WhatsApp...)</h4>
      <textarea
        value={extMsgBody}
        onChange={(e) => setExtMsgBody(e.target.value)}
        placeholder="Coller le contenu du message reçu..."
        rows={3}
        style={{ ...s.input, width: '100%', resize: 'vertical', marginBottom: '10px' }}
      />
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
        <select value={extMsgAuthor} onChange={(e) => setExtMsgAuthor(e.target.value as 'client' | 'admin')} style={{ ...s.input, fontSize: '12px' }}>
          <option value="client">Envoyé par le client</option>
          <option value="admin">Envoyé par le support</option>
        </select>
        <input
          type="datetime-local"
          value={extMsgDate}
          onChange={(e) => setExtMsgDate(e.target.value)}
          style={{ ...s.input, fontSize: '12px' }}
        />
        <input ref={extFileInputRef} type="file" multiple onChange={handleExtFileChange} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx,.txt,.zip" />
        <button type="button" onClick={() => extFileInputRef.current?.click()} style={{ ...s.ghostBtn('#6b7280'), fontSize: '12px', padding: '6px 12px' }}>
          + PJ
        </button>
      </div>
      {extMsgFiles.length > 0 && (
        <div style={{ marginBottom: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {extMsgFiles.map((file, i) => (
            <span key={i} style={{ ...s.badge('#f1f5f9', '#374151'), display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {file.name}
              <button type="button" onClick={() => setExtMsgFiles((prev) => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>&times;</button>
            </span>
          ))}
        </div>
      )}
      <button onClick={handleSendExtMsg} disabled={sendingExtMsg || !extMsgBody.trim()} style={s.btn('#818cf8', sendingExtMsg || !extMsgBody.trim())}>
        {sendingExtMsg ? 'Ajout...' : 'Ajouter (sans notification)'}
      </button>
    </div>
  )
}

// ========== SNOOZE PANEL ==========
interface SnoozePanelProps {
  snoozeSaving: boolean
  handleSnooze: (days: number | null, customDate?: string) => void
}

export function SnoozePanel({ snoozeSaving, handleSnooze }: SnoozePanelProps) {
  return (
    <div style={{ padding: '14px 18px', borderRadius: '8px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', marginBottom: '14px' }}>
      <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: '#5b21b6' }}>Snooze — masquer temporairement</h4>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => handleSnooze(1)} disabled={snoozeSaving} style={{ ...s.outlineBtn('#8b5cf6', snoozeSaving), fontSize: '12px' }}>1 jour</button>
        <button onClick={() => handleSnooze(3)} disabled={snoozeSaving} style={{ ...s.outlineBtn('#8b5cf6', snoozeSaving), fontSize: '12px' }}>3 jours</button>
        <button onClick={() => handleSnooze(7)} disabled={snoozeSaving} style={{ ...s.outlineBtn('#8b5cf6', snoozeSaving), fontSize: '12px' }}>1 semaine</button>
        <input
          type="datetime-local"
          onChange={(e) => { if (e.target.value) handleSnooze(null, e.target.value) }}
          style={{ ...s.input, fontSize: '12px' }}
        />
      </div>
    </div>
  )
}
