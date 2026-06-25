// "Send as" aliases — host-configured via NEXT_PUBLIC_SUPPORT_SEND_ALIASES
// (comma-separated). Kept config-driven so the plugin carries no hardcoded
// brand identity. Empty by default: the composer then offers only "self".
export const ALIASES: Array<{ value: string; label: string }> = (process.env.NEXT_PUBLIC_SUPPORT_SEND_ALIASES || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)
  .map((value) => ({ value, label: `En tant que : ${value}` }))

export const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open: { bg: '#dbeafe', color: '#1e40af' },
  waiting_client: { bg: '#fef3c7', color: '#92400e' },
  resolved: { bg: '#dcfce7', color: '#166534' },
}

export const REWRITE_STYLES = [
  { id: 'auto', label: '✏️ Auto', desc: 'Garde le ton actuel' },
  { id: 'tutoyer', label: '👋 Tutoyer', desc: 'Passe en tu' },
  { id: 'vouvoyer', label: '🎩 Vouvoyer', desc: 'Passe en vous' },
  { id: 'formel', label: '💼 Formel', desc: 'Ton professionnel' },
  { id: 'amical', label: '😊 Amical', desc: 'Ton chaleureux' },
  { id: 'court', label: '⚡ Court', desc: 'Version concise' },
]
