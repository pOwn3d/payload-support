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

export function AISummaryPanel({
  showAiSummary, setShowAiSummary, aiSummary, aiGenerating, aiSaving, aiSaved,
  handleAiGenerate, handleAiSave,
}: AISummaryPanelProps) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <button
        onClick={() => { setShowAiSummary(!showAiSummary); if (!showAiSummary && !aiSummary) handleAiGenerate() }}
        style={{
          ...s.ghostBtn('#7c3aed', false),
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
          backgroundColor: '#faf5ff', border: '1px solid #e9d5ff',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#7c3aed', margin: 0 }}>
              Synthèse IA
            </h4>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleAiGenerate}
                disabled={aiGenerating}
                style={{ ...s.outlineBtn('#7c3aed', aiGenerating), fontSize: '11px', padding: '4px 10px' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#7c3aed', fontSize: '13px' }}>
              Analyse de la conversation en cours...
            </div>
          ) : aiSummary ? (
            <div
              style={{ fontSize: '13px', lineHeight: '1.7', color: '#1e1b4b', whiteSpace: 'pre-wrap' }}
              dangerouslySetInnerHTML={{
                __html: aiSummary
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n/g, '<br/>'),
              }}
            />
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
