'use client'

import React from 'react'
import { s } from '../constants'

interface AISummaryPanelProps {
  showAiSummary: boolean
  setShowAiSummary: (v: boolean) => void
  aiSummary: string
  aiGenerating: boolean
  aiSaving: boolean
  aiSaved: boolean
  handleAiGenerate: () => void
  handleAiSave: () => void
}

export function renderAiSummary(summary: string): React.ReactNode[] {
  const lines = summary.split('\n')
  const result: React.ReactNode[] = []

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) result.push(<br key={`break-${lineIndex}`} />)
    line.split(/(\*\*.*?\*\*)/g).filter(Boolean).forEach((part, partIndex) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        result.push(<strong key={`${lineIndex}-${partIndex}`}>{part.slice(2, -2)}</strong>)
      } else {
        result.push(part)
      }
    })
  })

  return result
}

export function AISummaryPanel({
  showAiSummary, setShowAiSummary, aiSummary, aiGenerating, aiSaving, aiSaved,
  handleAiGenerate, handleAiSave,
}: AISummaryPanelProps) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <button
        onClick={() => { setShowAiSummary(!showAiSummary); if (!showAiSummary && !aiSummary) handleAiGenerate() }}
        style={{
          ...s.ghostBtn('#17807c', false),
          fontSize: '12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {showAiSummary ? 'Masquer la synthèse IA' : 'Synthèse IA'}
      </button>
      {showAiSummary && (
        <div style={{
          marginTop: '10px', padding: '14px 18px', borderRadius: '8px',
          backgroundColor: '#eef8f7', border: '1px solid #b8dcda',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#17807c', margin: 0 }}>
              Synthèse IA
            </h4>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleAiGenerate}
                disabled={aiGenerating}
                style={{ ...s.outlineBtn('#17807c', aiGenerating), fontSize: '11px', padding: '4px 10px' }}
              >
                {aiGenerating ? 'Génération...' : 'Régénérer'}
              </button>
              {aiSummary && !aiGenerating && (
                <button
                  onClick={handleAiSave}
                  disabled={aiSaving || aiSaved}
                  style={{ ...s.btn(aiSaved ? '#16a34a' : '#2563eb', aiSaving), fontSize: '11px', padding: '4px 10px' }}
                >
                  {aiSaved ? 'Sauvegardé' : aiSaving ? 'Sauvegarde...' : 'Sauvegarder (note interne)'}
                </button>
              )}
            </div>
          </div>
          {aiGenerating ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#17807c', fontSize: '13px' }}>
              Analyse de la conversation en cours...
            </div>
          ) : aiSummary ? (
            <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#1e1b4b', whiteSpace: 'pre-wrap' }}>
              {renderAiSummary(aiSummary)}
            </div>
          ) : (
            <p style={{ color: '#999', fontStyle: 'italic', fontSize: '13px', margin: 0 }}>
              Cliquez sur &quot;Régénérer&quot; pour lancer l&apos;analyse
            </p>
          )}
        </div>
      )}
    </div>
  )
}
