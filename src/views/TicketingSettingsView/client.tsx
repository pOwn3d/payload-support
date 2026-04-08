'use client'

import React, { useState, useEffect } from 'react'
import { Settings, Mail, Bot, Clock, Timer, Globe, FileSignature } from 'lucide-react'
import { V, btnStyle } from '../shared/adminTokens'
import { AdminViewHeader } from '../shared/AdminViewHeader'
import { getFeatures, saveFeatures, DEFAULT_FEATURES, type TicketingFeatures } from '../TicketConversation/config'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import ts from './TicketingSettings.module.scss'

/* ============================================
 * Types
 * ============================================ */

interface FeatureConfig {
  key: keyof TicketingFeatures
  label: string
  description: string
  category: 'core' | 'communication' | 'productivity' | 'advanced'
}

interface EmailSettings {
  fromAddress: string
  fromName: string
  replyToAddress: string
}

interface AISettings {
  provider: 'anthropic' | 'openai' | 'gemini' | 'ollama'
  apiKey: string
  model: string
  enableSentiment: boolean
  enableSynthesis: boolean
  enableSuggestion: boolean
  enableRewrite: boolean
}

interface SLASettings {
  firstResponseMinutes: number
  resolutionMinutes: number
  businessHoursOnly: boolean
  escalationEmail: string
}

interface AutoCloseSettings {
  enabled: boolean
  daysBeforeClose: number
  reminderDaysBefore: number
}

interface LocaleSettings {
  language: 'fr' | 'en'
}

interface AllSettings {
  email: EmailSettings
  ai: AISettings
  sla: SLASettings
  autoClose: AutoCloseSettings
  locale: LocaleSettings
}

/* ============================================
 * Constants
 * ============================================ */

const DEFAULT_SETTINGS: AllSettings = {
  email: {
    fromAddress: '',
    fromName: 'Support ConsilioWEB',
    replyToAddress: '',
  },
  ai: {
    provider: 'ollama',
    apiKey: '',
    model: 'qwen2.5:32b',
    enableSentiment: true,
    enableSynthesis: true,
    enableSuggestion: true,
    enableRewrite: true,
  },
  sla: {
    firstResponseMinutes: 120,
    resolutionMinutes: 1440,
    businessHoursOnly: true,
    escalationEmail: '',
  },
  autoClose: {
    enabled: true,
    daysBeforeClose: 7,
    reminderDaysBefore: 2,
  },
  locale: {
    language: 'fr',
  },
}

/** Fetch global settings from the backend API */
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
        locale: DEFAULT_SETTINGS.locale, // locale is now per-user
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS
}

/** Save global settings to the backend API */
async function saveSettingsToAPI(settings: AllSettings): Promise<boolean> {
  try {
    const toSave = {
      email: settings.email,
      ai: { ...settings.ai, apiKey: undefined },
      sla: settings.sla,
      autoClose: settings.autoClose,
      // locale excluded — saved per-user via user-prefs
    }
    const res = await fetch('/api/support/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(toSave),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Fetch per-user preferences (locale + signature) */
async function fetchUserPrefs(): Promise<{ locale: string; signature: string }> {
  try {
    const res = await fetch('/api/support/user-prefs', { credentials: 'include' })
    if (res.ok) return await res.json()
  } catch { /* ignore */ }
  return { locale: 'fr', signature: '' }
}

/** Save per-user preferences */
async function saveUserPrefs(prefs: { locale: string; signature: string }): Promise<boolean> {
  try {
    const res = await fetch('/api/support/user-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(prefs),
    })
    return res.ok
  } catch { return false }
}

/** @deprecated — kept for backward compat, use fetchUserPrefs instead */
async function fetchSignature(): Promise<string> {
  const prefs = await fetchUserPrefs()
  return prefs.signature
  return ''
}

/** Save email signature to backend */
async function saveSignatureToAPI(signature: string): Promise<boolean> {
  try {
    const res = await fetch('/api/support/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ signature }),
    })
    return res.ok
  } catch {
    return false
  }
}

const FEATURE_LIST: FeatureConfig[] = [
  // Core
  { key: 'canned', label: 'Réponses rapides', description: 'Templates de réponses pré-enregistrées avec variables dynamiques', category: 'core' },
  { key: 'scheduledReplies', label: 'Réponses programmées', description: 'Envoyer une réponse à une date/heure future', category: 'core' },
  { key: 'activityLog', label: 'Journal d\'activité', description: 'Timeline des actions sur chaque ticket (changements de statut, assignation...)', category: 'core' },
  // Communication
  { key: 'emailTracking', label: 'Suivi des emails', description: 'Tracking d\'envoi et d\'ouverture des notifications email', category: 'communication' },
  { key: 'chat', label: 'Live Chat', description: 'Chat en temps réel avec conversion en ticket', category: 'communication' },
  { key: 'externalMessages', label: 'Messages externes', description: 'Ajouter manuellement des messages reçus par email, SMS, WhatsApp...', category: 'communication' },
  // Productivity
  { key: 'ai', label: 'Intelligence Artificielle', description: 'Analyse de sentiment, synthèse, suggestion de réponse, reformulation', category: 'productivity' },
  { key: 'timeTracking', label: 'Suivi du temps', description: 'Timer, entrées manuelles, facturation', category: 'productivity' },
{ key: 'satisfaction', label: 'Enquêtes satisfaction', description: 'Score CSAT après résolution du ticket', category: 'productivity' },
  // Advanced
  { key: 'merge', label: 'Fusion de tickets', description: 'Combiner deux tickets en un seul', category: 'advanced' },
  { key: 'splitTicket', label: 'Extraction de message', description: 'Extraire un message en nouveau ticket lié', category: 'advanced' },
  { key: 'snooze', label: 'Snooze', description: 'Masquer temporairement un ticket et rappel automatique', category: 'advanced' },
  { key: 'clientHistory', label: 'Historique client', description: 'Tickets passés, projets et notes internes du client', category: 'advanced' },
]

const CATEGORIES = [
  { key: 'core', label: 'Fonctionnalités de base', color: V.blue },
  { key: 'communication', label: 'Communication', color: V.green },
  { key: 'productivity', label: 'Productivité', color: V.amber },
  { key: 'advanced', label: 'Avancé', color: '#7c3aed' },
]

/* ============================================
 * Small reusable components
 * ============================================ */

const Toggle: React.FC<{
  checked: boolean
  onChange: () => void
  color?: string
  size?: 'sm' | 'md'
}> = ({ checked, onChange, color = V.blue, size = 'md' }) => {
  const w = size === 'sm' ? 36 : 40
  const h = size === 'sm' ? 20 : 22
  const knob = size === 'sm' ? 16 : 18
  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange() } }}
      style={{
        width: w, height: h, borderRadius: h / 2, flexShrink: 0,
        backgroundColor: checked ? color : 'var(--theme-elevation-300)',
        position: 'relative', transition: 'background 150ms',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: knob, height: knob, borderRadius: '50%', backgroundColor: '#fff',
        position: 'absolute', top: (h - knob) / 2,
        left: checked ? w - knob - (h - knob) / 2 : (h - knob) / 2,
        transition: 'left 150ms',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </div>
  )
}

const CollapsibleSection: React.FC<{
  title: string
  icon: React.ReactNode
  color: string
  defaultOpen?: boolean
  children: React.ReactNode
  badge?: React.ReactNode
}> = ({ title, icon, color, defaultOpen = true, children, badge }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={ts.sectionWrapper}>
      <div
        className={ts.sectionHeader}
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open) } }}
        aria-expanded={open}
      >
        <div className={ts.sectionIcon} style={{ backgroundColor: color }}>{icon}</div>
        <span className={ts.sectionTitle}>{title}</span>
        {badge}
        <span className={`${ts.sectionChevron} ${open ? ts.open : ''}`}>
          &#9660;
        </span>
      </div>
      {open && <div className={ts.sectionBody}>{children}</div>}
    </div>
  )
}

const FieldRow: React.FC<{
  label: string
  description?: string
  children: React.ReactNode
}> = ({ label, description, children }) => (
  <div className={ts.fieldRow}>
    <div className={ts.fieldLabel}>
      {label}
      {description && <div className={ts.fieldDescription}>{description}</div>}
    </div>
    <div className={ts.fieldContent}>{children}</div>
  </div>
)

/* ============================================
 * Main Component
 * ============================================ */

export const TicketingSettingsClient: React.FC = () => {
  const { t } = useTranslation()
  const [features, setFeatures] = useState<TicketingFeatures>(() => getFeatures())
  const [settings, setSettings] = useState<AllSettings>(DEFAULT_SETTINGS)
  const [signature, setSignature] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)

  // Load settings + signature from backend on mount
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchSettingsFromAPI(), fetchUserPrefs()]).then(([s, prefs]) => {
      if (!cancelled) {
        setSettings({ ...s, locale: { language: (prefs.locale as 'fr' | 'en') || 'fr' } })
        setSignature(prefs.signature || '')
        setLoadingSettings(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const handleToggle = (key: keyof TicketingFeatures) => {
    const updated = { ...features, [key]: !features[key] }
    setFeatures(updated)
    setSaved(false)
  }

  const updateEmail = (field: keyof EmailSettings, value: string) => {
    setSettings((prev) => ({ ...prev, email: { ...prev.email, [field]: value } }))
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

  const updateLocale = <K extends keyof LocaleSettings>(field: K, value: LocaleSettings[K]) => {
    setSettings((prev) => ({ ...prev, locale: { ...prev.locale, [field]: value } }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    // Save features to localStorage (UI-only flags)
    saveFeatures(features)
    // Save global settings + per-user prefs
    const [settingsOk, prefsOk] = await Promise.all([
      saveSettingsToAPI(settings),
      saveUserPrefs({ locale: settings.locale.language, signature }),
    ])
    setSaving(false)
    if (settingsOk && prefsOk) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const handleReset = () => {
    setFeatures({ ...DEFAULT_FEATURES })
    setSettings({ ...DEFAULT_SETTINGS })
    setSignature('')
    setSaved(false)
  }

  const enabledCount = Object.entries(features).filter(([k, v]) => typeof v === 'boolean' && v).length
  const totalCount = Object.entries(features).filter(([k, v]) => typeof v === 'boolean').length

  // Read SMTP info from env (displayed as read-only)
  const smtpHost = process.env.NEXT_PUBLIC_SMTP_HOST || '(non configure)'
  const smtpPort = process.env.NEXT_PUBLIC_SMTP_PORT || '—'

  return (
    <div className={ts.page}>
      <AdminViewHeader
        icon={<Settings size={24} />}
        title={t('settingsView.configTitle')}
        subtitle={t('settings.subtitle', { enabled: String(enabledCount), total: String(totalCount) })}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleReset} style={btnStyle('var(--theme-elevation-400)', { small: true })}>
              {t('settingsView.reset')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={btnStyle(saved ? V.green : V.blue, { small: true })}
            >
              {saving ? '...' : saved ? t('settingsView.saved') : t('common.save')}
            </button>
          </div>
        }
      />

      <p className={ts.intro}>
        {t('settingsView.intro')}
      </p>

      {/* ========================================
       * SECTION 1 — Feature Flags
       * ======================================== */}
      <CollapsibleSection
        title={t('settingsView.features')}
        icon={<Settings size={16} />}
        color={V.blue}
        badge={
          <span className={ts.badge} style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
            {enabledCount}/{totalCount}
          </span>
        }
      >
        <p className={ts.sectionDescription}>
          Activez ou desactivez les fonctionnalites du module. Les fonctionnalites desactivees sont completement masquees de l&apos;interface.
        </p>

        {CATEGORIES.map((cat) => {
          const categoryFeatures = FEATURE_LIST.filter((f) => f.category === cat.key)
          return (
            <div key={cat.key} className={ts.categoryGroup}>
              <h3 className={ts.categoryHeading} style={{ color: cat.color }}>
                <span className={ts.categoryDot} style={{ backgroundColor: cat.color }} />
                {cat.label}
              </h3>
              <div className={ts.featureList}>
                {categoryFeatures.map((feat) => {
                  const enabled = features[feat.key]
                  return (
                    <div
                      key={feat.key}
                      onClick={() => handleToggle(feat.key)}
                      className={`${ts.featureCard} ${enabled ? ts.enabled : ''}`}
                      role="switch"
                      aria-checked={!!enabled}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(feat.key) } }}
                    >
                      <Toggle checked={!!enabled} onChange={() => handleToggle(feat.key)} color={cat.color} />
                      <div style={{ flex: 1 }}>
                        <div className={ts.featureLabel}>{feat.label}</div>
                        <div className={ts.featureDesc}>{feat.description}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </CollapsibleSection>

      {/* ========================================
       * SECTION 2 — Email Configuration
       * ======================================== */}
      <CollapsibleSection
        title={t('settingsView.emailConfig')}
        icon={<Mail size={16} />}
        color="#ea580c"
        defaultOpen={false}
      >
        <p className={ts.sectionDescription}>
          Parametres d&apos;envoi des notifications email. L&apos;adresse SMTP est configuree via les variables d&apos;environnement du serveur.
        </p>

        <FieldRow label="Adresse expediteur" description="Adresse email affichee dans le champ From">
          <input
            type="email"
            value={settings.email.fromAddress}
            onChange={(e) => updateEmail('fromAddress', e.target.value)}
            placeholder="support@example.com"
            className={ts.input}
          />
        </FieldRow>

        <FieldRow label="Nom expediteur" description="Nom affiche a cote de l'adresse email">
          <input
            type="text"
            value={settings.email.fromName}
            onChange={(e) => updateEmail('fromName', e.target.value)}
            placeholder="Support ConsilioWEB"
            className={ts.input}
          />
        </FieldRow>

        <FieldRow label="Adresse Reply-To" description="Si differente de l'adresse expediteur">
          <input
            type="email"
            value={settings.email.replyToAddress}
            onChange={(e) => updateEmail('replyToAddress', e.target.value)}
            placeholder="(identique a l'expediteur)"
            className={ts.input}
          />
        </FieldRow>

        <div className={ts.separator} />

        <FieldRow label="Serveur SMTP" description="Configure via variables d'environnement">
          <input
            type="text"
            value={smtpHost}
            readOnly
            className={ts.inputReadonly}
          />
        </FieldRow>

        <FieldRow label="Port SMTP">
          <input
            type="text"
            value={smtpPort}
            readOnly
            className={ts.inputReadonly}
            style={{ maxWidth: 100 }}
          />
        </FieldRow>
      </CollapsibleSection>

      {/* ========================================
       * SECTION 3 — AI Configuration
       * ======================================== */}
      <CollapsibleSection
        title={t('settingsView.aiTitle')}
        icon={<Bot size={16} />}
        color="#7c3aed"
        defaultOpen={false}
        badge={
          features.ai
            ? <span className={ts.badge} style={{ backgroundColor: '#dcfce7', color: '#166534' }}>Active</span>
            : <span className={ts.badge} style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Inactive</span>
        }
      >
        <p className={ts.sectionDescription}>
          Configurez le fournisseur d&apos;IA et activez/désactivez chaque fonctionnalité indépendamment.
          Les fonctionnalités IA nécessitent que le flag &quot;Intelligence Artificielle&quot; soit actif dans la section précédente.
        </p>

        <FieldRow label="Fournisseur" description="Service d'IA utilise pour l'analyse">
          <select
            value={settings.ai.provider}
            onChange={(e) => updateAI('provider', e.target.value as AISettings['provider'])}
            className={ts.select}
          >
            <option value="ollama">Ollama (local / tunnel)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="gemini">Google (Gemini)</option>
          </select>
        </FieldRow>

        {settings.ai.provider !== 'ollama' && (
          <FieldRow label="Cle API" description="Cle secrete du fournisseur (non stockee en clair)">
            <div className={ts.apiKeyRow}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.ai.apiKey}
                onChange={(e) => updateAI('apiKey', e.target.value)}
                placeholder="sk-..."
                className={ts.input}
                style={{ flex: 1 }}
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className={ts.apiKeyToggle}
              >
                {showApiKey ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </FieldRow>
        )}

        <FieldRow label="Modele" description="Nom du modele a utiliser">
          <input
            type="text"
            value={settings.ai.model}
            onChange={(e) => updateAI('model', e.target.value)}
            placeholder="qwen2.5:32b"
            className={ts.input}
          />
        </FieldRow>

        <div className={ts.separator} />

        <p className={ts.aiSubFeaturesLabel}>
          Fonctionnalités IA individuelles
        </p>

        {([
          { key: 'enableSentiment' as const, label: 'Analyse de sentiment', desc: 'Detecte le niveau de frustration ou satisfaction du client' },
          { key: 'enableSynthesis' as const, label: 'Synthese automatique', desc: 'Resume les conversations longues en quelques phrases' },
          { key: 'enableSuggestion' as const, label: 'Suggestion de reponse', desc: 'Propose un brouillon de reponse base sur le contexte' },
          { key: 'enableRewrite' as const, label: 'Reformulation', desc: 'Reformule un message pour le rendre plus professionnel' },
        ]).map((item) => (
          <div key={item.key} className={ts.aiToggleRow}>
            <Toggle
              checked={settings.ai[item.key]}
              onChange={() => updateAI(item.key, !settings.ai[item.key])}
              color="#7c3aed"
              size="sm"
            />
            <div style={{ flex: 1 }}>
              <span className={ts.aiToggleLabel}>{item.label}</span>
              <span className={ts.aiToggleDesc}>{item.desc}</span>
            </div>
          </div>
        ))}
      </CollapsibleSection>

      {/* ========================================
       * SECTION 4 — SLA Configuration
       * ======================================== */}
      <CollapsibleSection
        title={t('settingsView.slaTitle')}
        icon={<Clock size={16} />}
        color="#0891b2"
        defaultOpen={false}
      >
        <p className={ts.sectionDescription}>
          Definissez les delais de reponse et de resolution attendus. Ces seuils sont utilises pour le suivi de performance et les alertes d&apos;escalade.
        </p>

        <FieldRow label="Premiere reponse" description="Délai maximum en minutes (défaut : 120 = 2h)">
          <div className={ts.slaInline}>
            <input
              type="number"
              min={1}
              value={settings.sla.firstResponseMinutes}
              onChange={(e) => updateSLA('firstResponseMinutes', parseInt(e.target.value) || 0)}
              className={ts.numberInput}
            />
            <span className={ts.slaHint}>
              minutes ({Math.floor(settings.sla.firstResponseMinutes / 60)}h{String(settings.sla.firstResponseMinutes % 60).padStart(2, '0')})
            </span>
          </div>
        </FieldRow>

        <FieldRow label="Résolution" description="Délai maximum en minutes (défaut : 1440 = 24h)">
          <div className={ts.slaInline}>
            <input
              type="number"
              min={1}
              value={settings.sla.resolutionMinutes}
              onChange={(e) => updateSLA('resolutionMinutes', parseInt(e.target.value) || 0)}
              className={ts.numberInput}
            />
            <span className={ts.slaHint}>
              minutes ({Math.floor(settings.sla.resolutionMinutes / 60)}h{String(settings.sla.resolutionMinutes % 60).padStart(2, '0')})
            </span>
          </div>
        </FieldRow>

        <div className={ts.toggleRow}>
          <Toggle
            checked={settings.sla.businessHoursOnly}
            onChange={() => updateSLA('businessHoursOnly', !settings.sla.businessHoursOnly)}
            color="#0891b2"
            size="sm"
          />
          <div>
            <span className={ts.inlineLabel}>Heures ouvrables uniquement</span>
            <div className={ts.inlineDesc}>
              Le decompte SLA est suspendu en dehors des heures de bureau (Lun-Ven, 9h-18h)
            </div>
          </div>
        </div>

        <div className={ts.separator} />

        <FieldRow label="Email d'escalade" description="Adresse notifiee en cas de depassement SLA">
          <input
            type="email"
            value={settings.sla.escalationEmail}
            onChange={(e) => updateSLA('escalationEmail', e.target.value)}
            placeholder="admin@example.com"
            className={ts.input}
          />
        </FieldRow>
      </CollapsibleSection>

      {/* ========================================
       * SECTION 5 — Auto-Close
       * ======================================== */}
      <CollapsibleSection
        title={t('settingsView.autoCloseTitle')}
        icon={<Timer size={16} />}
        color="#d97706"
        defaultOpen={false}
        badge={
          settings.autoClose.enabled
            ? <span className={ts.badge} style={{ backgroundColor: '#dcfce7', color: '#166534' }}>{settings.autoClose.daysBeforeClose}j</span>
            : <span className={ts.badge} style={{ backgroundColor: '#e5e7eb', color: '#374151' }}>Off</span>
        }
      >
        <p className={ts.sectionDescription}>
          Les tickets en attente client sans reponse seront automatiquement resolus apres le delai configure.
          Un email de rappel est envoye avant la fermeture.
        </p>

        <div className={ts.toggleRow} style={{ paddingBottom: 14 }}>
          <Toggle
            checked={settings.autoClose.enabled}
            onChange={() => updateAutoClose('enabled', !settings.autoClose.enabled)}
            color="#d97706"
          />
          <span className={ts.inlineLabel}>
            Activer la fermeture automatique
          </span>
        </div>

        {settings.autoClose.enabled && (
          <>
            <FieldRow label="Delai avant fermeture" description="Nombre de jours sans reponse du client">
              <div className={ts.slaInline}>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={settings.autoClose.daysBeforeClose}
                  onChange={(e) => updateAutoClose('daysBeforeClose', parseInt(e.target.value) || 7)}
                  className={ts.numberInput}
                />
                <span className={ts.slaHint}>jours</span>
              </div>
            </FieldRow>

            <FieldRow label="Rappel avant fermeture" description="Email de rappel envoye X jours avant">
              <div className={ts.slaInline}>
                <input
                  type="number"
                  min={1}
                  max={settings.autoClose.daysBeforeClose - 1}
                  value={settings.autoClose.reminderDaysBefore}
                  onChange={(e) => updateAutoClose('reminderDaysBefore', parseInt(e.target.value) || 2)}
                  className={ts.numberInput}
                />
                <span className={ts.slaHint}>
                  jours avant (rappel a J-{settings.autoClose.reminderDaysBefore})
                </span>
              </div>
            </FieldRow>
          </>
        )}
      </CollapsibleSection>

      {/* ────────────────────────────────────────
       * MES PRÉFÉRENCES (per-user)
       * ──────────────────────────────────────── */}
      <div style={{
        marginTop: 32,
        marginBottom: 16,
        padding: '12px 16px',
        borderRadius: 8,
        background: 'linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%)',
        border: '1px solid #c7d2fe',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{t('settingsView.myPreferences')}</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          {t('settingsView.myPreferencesDesc')}
        </div>
      </div>

      {/* ========================================
       * SECTION 6 — Locale (per-user)
       * ======================================== */}
      <CollapsibleSection
        title={t('settingsView.localeTitle')}
        icon={<Globe size={16} />}
        color="#16a34a"
        defaultOpen={false}
      >
        <p className={ts.sectionDescription}>
          Langue de l&apos;interface du module de support et des notifications email envoyees aux clients.
        </p>

        <FieldRow label="Langue" description="Langue principale du module">
          <select
            value={settings.locale.language}
            onChange={(e) => updateLocale('language', e.target.value as 'fr' | 'en')}
            className={ts.select}
          >
            <option value="fr">Francais</option>
            <option value="en">English</option>
          </select>
        </FieldRow>
      </CollapsibleSection>

      {/* ========================================
       * SECTION 7 — Email Signature
       * ======================================== */}
      <CollapsibleSection
        title={t('settingsView.signatureTitle')}
        icon={<FileSignature size={16} />}
        color="#6366f1"
        defaultOpen={false}
      >
        <p className={ts.sectionDescription}>
          Signature ajoutee automatiquement en bas de chaque reponse email envoyee au client.
          Supporte le texte brut et le HTML basique.
        </p>

        <textarea
          value={signature}
          onChange={(e) => { setSignature(e.target.value); setSaved(false) }}
          placeholder="Cordialement,&#10;L'equipe ConsilioWEB"
          rows={6}
          className={ts.signatureTextarea}
        />
      </CollapsibleSection>

      {/* Purge logs section */}
      <CollapsibleSection title="Purge des logs" icon={<Settings size={18} />} color="#ef4444" defaultOpen={false}>
        <p className={ts.sectionDescription}>
          Supprimez les anciens logs pour libérer de l&apos;espace. Cette action est irréversible.
        </p>
        <div className={ts.purgeGroup}>
          {['email-logs', 'auth-logs'].map((col) => (
            <div key={col} className={ts.purgeCategory}>
              <span className={ts.purgeCategoryLabel}>
                {col === 'email-logs' ? 'Logs Email' : 'Logs Auth'}
              </span>
              <div className={ts.purgeButtons}>
                {[
                  { label: '7 jours', days: 7 },
                  { label: '30 jours', days: 30 },
                  { label: '90 jours', days: 90 },
                  { label: 'Tout', days: 0 },
                ].map((opt) => (
                  <button
                    key={opt.days}
                    onClick={async () => {
                      if (!window.confirm(`Supprimer les logs ${col} de plus de ${opt.days || 'tous les'} jours ?`)) return
                      try {
                        const res = await fetch(`/api/support/purge-logs?collection=${col}&days=${opt.days}`, { method: 'DELETE', credentials: 'include' })
                        if (res.ok) { const d = await res.json(); alert(`${d.purged} log(s) supprimé(s)`) }
                      } catch { alert('Erreur') }
                    }}
                    style={{ ...btnStyle(opt.days === 0 ? '#ef4444' : 'var(--theme-elevation-500)', { small: true }), fontSize: 11 }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Bottom save bar */}
      <div className={ts.bottomBar}>
        <button onClick={handleReset} style={btnStyle('var(--theme-elevation-400)', { small: true })}>
          {t('settingsView.resetAll')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={btnStyle(saved ? V.green : V.blue, { small: true })}
        >
          {saving ? t('settingsView.saving') : saved ? t('settingsView.saved') : t('settingsView.saveChanges')}
        </button>
      </div>
    </div>
  )
}
