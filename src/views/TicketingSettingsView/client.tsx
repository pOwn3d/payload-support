'use client'

import React, { useState, useEffect } from 'react'
import { V, btnStyle } from '../shared/adminTokens'
import { AdminViewHeader } from '../shared/AdminViewHeader'
import { getFeatures, saveFeatures, DEFAULT_FEATURES, type TicketingFeatures } from '../shared/config'

// ---- Types ----

interface FeatureConfig {
  key: keyof TicketingFeatures
  label: string
  description: string
  category: 'core' | 'communication' | 'productivity' | 'advanced'
}

interface EmailSettings { fromAddress: string; fromName: string; replyToAddress: string }
interface AISettings { provider: 'anthropic' | 'openai' | 'gemini' | 'ollama'; apiKey: string; model: string; enableSentiment: boolean; enableSynthesis: boolean; enableSuggestion: boolean; enableRewrite: boolean }
interface SLASettings { firstResponseMinutes: number; resolutionMinutes: number; businessHoursOnly: boolean; escalationEmail: string }
interface AutoCloseSettings { enabled: boolean; daysBeforeClose: number; reminderDaysBefore: number }
interface LocaleSettings { language: 'fr' | 'en' }
interface AllSettings { email: EmailSettings; ai: AISettings; sla: SLASettings; autoClose: AutoCloseSettings; locale: LocaleSettings }

const DEFAULT_SETTINGS: AllSettings = {
  email: { fromAddress: '', fromName: 'Support', replyToAddress: '' },
  ai: { provider: 'ollama', apiKey: '', model: 'qwen2.5:32b', enableSentiment: true, enableSynthesis: true, enableSuggestion: true, enableRewrite: true },
  sla: { firstResponseMinutes: 120, resolutionMinutes: 1440, businessHoursOnly: true, escalationEmail: '' },
  autoClose: { enabled: true, daysBeforeClose: 7, reminderDaysBefore: 2 },
  locale: { language: 'fr' },
}

async function fetchSettingsFromAPI(): Promise<AllSettings> {
  try {
    const res = await fetch('/api/support/settings', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      return {
        email: { ...DEFAULT_SETTINGS.email, ...data.email },
        ai: { ...DEFAULT_SETTINGS.ai, apiKey: '', ...data.ai },
        sla: { ...DEFAULT_SETTINGS.sla, ...data.sla },
        autoClose: { ...DEFAULT_SETTINGS.autoClose, ...data.autoClose },
        locale: { ...DEFAULT_SETTINGS.locale, ...data.locale },
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS
}

async function saveSettingsToAPI(settings: AllSettings): Promise<boolean> {
  try {
    const toSave = { ...settings, ai: { ...settings.ai, apiKey: undefined } }
    const res = await fetch('/api/support/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(toSave) })
    return res.ok
  } catch { return false }
}

async function fetchSignature(): Promise<string> {
  try {
    const res = await fetch('/api/support/signature', { credentials: 'include' })
    if (res.ok) { const data = await res.json(); return data.signature || '' }
  } catch { /* ignore */ }
  return ''
}

async function saveSignatureToAPI(signature: string): Promise<boolean> {
  try {
    const res = await fetch('/api/support/signature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ signature }) })
    return res.ok
  } catch { return false }
}

const FEATURE_LIST: FeatureConfig[] = [
  { key: 'canned', label: 'Reponses rapides', description: 'Templates de reponses pre-enregistrees avec variables dynamiques', category: 'core' },
  { key: 'scheduledReplies', label: 'Reponses programmees', description: 'Envoyer une reponse a une date/heure future', category: 'core' },
  { key: 'activityLog', label: 'Journal d\'activite', description: 'Timeline des actions sur chaque ticket', category: 'core' },
  { key: 'emailTracking', label: 'Suivi des emails', description: 'Tracking d\'envoi et d\'ouverture des notifications email', category: 'communication' },
  { key: 'chat', label: 'Live Chat', description: 'Chat en temps reel avec conversion en ticket', category: 'communication' },
  { key: 'externalMessages', label: 'Messages externes', description: 'Ajouter manuellement des messages recus par email, SMS, WhatsApp...', category: 'communication' },
  { key: 'ai', label: 'Intelligence Artificielle', description: 'Analyse de sentiment, synthese, suggestion de reponse, reformulation', category: 'productivity' },
  { key: 'timeTracking', label: 'Suivi du temps', description: 'Timer, entrees manuelles, facturation', category: 'productivity' },
  { key: 'satisfaction', label: 'Enquetes satisfaction', description: 'Score CSAT apres resolution du ticket', category: 'productivity' },
  { key: 'merge', label: 'Fusion de tickets', description: 'Combiner deux tickets en un seul', category: 'advanced' },
  { key: 'splitTicket', label: 'Extraction de message', description: 'Extraire un message en nouveau ticket lie', category: 'advanced' },
  { key: 'snooze', label: 'Snooze', description: 'Masquer temporairement un ticket et rappel automatique', category: 'advanced' },
  { key: 'clientHistory', label: 'Historique client', description: 'Tickets passes, projets et notes internes du client', category: 'advanced' },
]

const CATEGORIES_LIST = [
  { key: 'core', label: 'Fonctionnalites de base', color: V.blue },
  { key: 'communication', label: 'Communication', color: V.green },
  { key: 'productivity', label: 'Productivite', color: V.amber },
  { key: 'advanced', label: 'Avance', color: '#7c3aed' },
]

// ---- Toggle component ----

const Toggle: React.FC<{ checked: boolean; onChange: () => void; color?: string }> = ({ checked, onChange, color = V.blue }) => (
  <div
    role="switch"
    aria-checked={checked}
    tabIndex={0}
    onClick={onChange}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange() } }}
    style={{ width: 40, height: 22, borderRadius: 11, flexShrink: 0, backgroundColor: checked ? color : 'var(--theme-elevation-300)', position: 'relative', transition: 'background 150ms', cursor: 'pointer' }}
  >
    <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: 2, left: checked ? 20 : 2, transition: 'left 150ms', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
  </div>
)

// ---- Main Component ----

export const TicketingSettingsClient: React.FC = () => {
  const [features, setFeatures] = useState<TicketingFeatures>(() => getFeatures())
  const [settings, setSettings] = useState<AllSettings>(DEFAULT_SETTINGS)
  const [signature, setSignature] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchSettingsFromAPI(), fetchSignature()]).then(([s, sig]) => {
      if (!cancelled) { setSettings(s); setSignature(sig) }
    })
    return () => { cancelled = true }
  }, [])

  const handleToggle = (key: keyof TicketingFeatures) => {
    const updated = { ...features, [key]: !features[key] }
    setFeatures(updated)
    setSaved(false)
  }

  const updateAI = <K extends keyof AISettings>(field: K, value: AISettings[K]) => {
    setSettings((prev) => ({ ...prev, ai: { ...prev.ai, [field]: value } }))
    setSaved(false)
  }

  const updateSLA = <K extends keyof SLASettings>(field: K, value: SLASettings[K]) => {
    setSettings((prev) => ({ ...prev, sla: { ...prev.sla, [field]: value } }))
    setSaved(false)
  }

  const updateAutoClose = <K extends keyof AutoCloseSettings>(field: K, value: AutoCloseSettings[K]) => {
    setSettings((prev) => ({ ...prev, autoClose: { ...prev.autoClose, [field]: value } }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    saveFeatures(features)
    const [settingsOk, signatureOk] = await Promise.all([saveSettingsToAPI(settings), saveSignatureToAPI(signature)])
    setSaving(false)
    if (settingsOk && signatureOk) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }

  const handleReset = () => {
    setFeatures({ ...DEFAULT_FEATURES })
    setSettings({ ...DEFAULT_SETTINGS })
    setSignature('')
    setSaved(false)
  }

  const enabledCount = Object.entries(features).filter(([, v]) => typeof v === 'boolean' && v).length
  const totalCount = Object.entries(features).filter(([, v]) => typeof v === 'boolean').length

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--theme-elevation-200)', fontSize: 13, color: 'var(--theme-text)', background: 'var(--theme-elevation-0)' }
  const selectStyle = inputStyle
  const numberInputStyle: React.CSSProperties = { ...inputStyle, width: 100 }

  return (
    <div style={{ padding: '20px 30px', maxWidth: 900, margin: '0 auto' }}>
      <AdminViewHeader
        icon={<span style={{ fontSize: 24 }}>&#9881;</span>}
        title="Configuration du module Support"
        subtitle={`${enabledCount}/${totalCount} fonctionnalites activees`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleReset} style={btnStyle('var(--theme-elevation-400)', { small: true })}>Reinitialiser</button>
            <button onClick={handleSave} disabled={saving} style={btnStyle(saved ? V.green : V.blue, { small: true })}>
              {saving ? '...' : saved ? 'Sauvegarde' : 'Sauvegarder'}
            </button>
          </div>
        }
      />

      <p style={{ fontSize: 13, color: 'var(--theme-elevation-500)', marginBottom: 24 }}>
        Configurez le module de support : fonctionnalites, email, IA, SLA et fermeture automatique.
      </p>

      {/* Feature Flags */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--theme-text)' }}>Fonctionnalites</h2>
        {CATEGORIES_LIST.map((cat) => {
          const categoryFeatures = FEATURE_LIST.filter((f) => f.category === cat.key)
          return (
            <div key={cat.key} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: cat.color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
                {cat.label}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {categoryFeatures.map((feat) => {
                  const enabled = features[feat.key]
                  return (
                    <div key={feat.key} onClick={() => handleToggle(feat.key)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 8, border: `1px solid ${enabled ? cat.color + '44' : 'var(--theme-elevation-200)'}`, background: enabled ? cat.color + '08' : 'var(--theme-elevation-0)', cursor: 'pointer' }}>
                      <Toggle checked={!!enabled} onChange={() => handleToggle(feat.key)} color={cat.color} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text)' }}>{feat.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>{feat.description}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Configuration */}
      <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-200)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--theme-text)' }}>Intelligence Artificielle</h2>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Fournisseur</label>
          <select value={settings.ai.provider} onChange={(e) => updateAI('provider', e.target.value as AISettings['provider'])} style={selectStyle}>
            <option value="ollama">Ollama (local / tunnel)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="gemini">Google (Gemini)</option>
          </select>
        </div>
        {settings.ai.provider !== 'ollama' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Cle API</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type={showApiKey ? 'text' : 'password'} value={settings.ai.apiKey} onChange={(e) => updateAI('apiKey', e.target.value)} placeholder="sk-..." style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => setShowApiKey(!showApiKey)} style={btnStyle('var(--theme-elevation-400)', { small: true })}>{showApiKey ? 'Masquer' : 'Afficher'}</button>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Modele</label>
          <input type="text" value={settings.ai.model} onChange={(e) => updateAI('model', e.target.value)} placeholder="qwen2.5:32b" style={inputStyle} />
        </div>
        {(['enableSentiment', 'enableSynthesis', 'enableSuggestion', 'enableRewrite'] as const).map((key) => (
          <div key={key} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}>
            <Toggle checked={settings.ai[key]} onChange={() => updateAI(key, !settings.ai[key])} color="#7c3aed" />
            <span style={{ fontSize: 13 }}>{key.replace('enable', '')}</span>
          </div>
        ))}
      </div>

      {/* SLA */}
      <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-200)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--theme-text)' }}>SLA</h2>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Premiere reponse (minutes)</label>
          <input type="number" min={1} value={settings.sla.firstResponseMinutes} onChange={(e) => updateSLA('firstResponseMinutes', parseInt(e.target.value) || 0)} style={numberInputStyle} />
          <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)', marginLeft: 8 }}>({Math.floor(settings.sla.firstResponseMinutes / 60)}h{String(settings.sla.firstResponseMinutes % 60).padStart(2, '0')})</span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Resolution (minutes)</label>
          <input type="number" min={1} value={settings.sla.resolutionMinutes} onChange={(e) => updateSLA('resolutionMinutes', parseInt(e.target.value) || 0)} style={numberInputStyle} />
          <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)', marginLeft: 8 }}>({Math.floor(settings.sla.resolutionMinutes / 60)}h{String(settings.sla.resolutionMinutes % 60).padStart(2, '0')})</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}>
          <Toggle checked={settings.sla.businessHoursOnly} onChange={() => updateSLA('businessHoursOnly', !settings.sla.businessHoursOnly)} color="#0891b2" />
          <span style={{ fontSize: 13 }}>Heures ouvrables uniquement</span>
        </div>
      </div>

      {/* Auto-Close */}
      <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-200)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--theme-text)' }}>Fermeture automatique</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', marginBottom: 12 }}>
          <Toggle checked={settings.autoClose.enabled} onChange={() => updateAutoClose('enabled', !settings.autoClose.enabled)} color="#d97706" />
          <span style={{ fontSize: 13 }}>Activer la fermeture automatique</span>
        </div>
        {settings.autoClose.enabled && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Delai avant fermeture (jours)</label>
              <input type="number" min={1} max={90} value={settings.autoClose.daysBeforeClose} onChange={(e) => updateAutoClose('daysBeforeClose', parseInt(e.target.value) || 7)} style={numberInputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Rappel avant fermeture (jours)</label>
              <input type="number" min={1} max={settings.autoClose.daysBeforeClose - 1} value={settings.autoClose.reminderDaysBefore} onChange={(e) => updateAutoClose('reminderDaysBefore', parseInt(e.target.value) || 2)} style={numberInputStyle} />
            </div>
          </>
        )}
      </div>

      {/* Email Signature */}
      <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-200)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--theme-text)' }}>Signature email</h2>
        <textarea value={signature} onChange={(e) => { setSignature(e.target.value); setSaved(false) }} placeholder="Cordialement,&#10;L'equipe Support" rows={6} style={{ ...inputStyle, minHeight: 120, fontFamily: 'inherit', resize: 'vertical' as const }} />
      </div>

      {/* Bottom save bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 0' }}>
        <button onClick={handleReset} style={btnStyle('var(--theme-elevation-400)', { small: true })}>Reinitialiser tout</button>
        <button onClick={handleSave} disabled={saving} style={btnStyle(saved ? V.green : V.blue, { small: true })}>
          {saving ? 'Sauvegarde...' : saved ? 'Sauvegarde' : 'Sauvegarder les modifications'}
        </button>
      </div>
    </div>
  )
}
