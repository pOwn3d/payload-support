/**
 * Ambient stub for 'lucide-react'.
 *
 * lucide-react is a REQUIRED peer dependency — three unconditionally registered
 * components import it statically, so a host without it fails at build time.
 * It is deliberately not a devDependency here; this stub is what lets the plugin
 * type-check in isolation without pulling the icon set into the repo.
 *
 * Keep the icon list below in sync with the actual imports:
 *   src/portal/LiveChat.tsx
 *   src/views/PendingEmailsView/client.tsx
 *   src/views/TicketingSettingsView/client.tsx
 */
declare module 'lucide-react' {
  import type { FC, SVGProps } from 'react'
  type LucideIcon = FC<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>
  // Export every named icon as LucideIcon so any import resolves cleanly
  const MessageCircle: LucideIcon
  const Send: LucideIcon
  const X: LucideIcon
  const Minimize2: LucideIcon
  const ArrowLeft: LucideIcon
  const Inbox: LucideIcon
  const Plus: LucideIcon
  const Link2: LucideIcon
  const Search: LucideIcon
  const ChevronDown: LucideIcon
  const ChevronUp: LucideIcon
  const Paperclip: LucideIcon
  const Settings: LucideIcon
  const Mail: LucideIcon
  const Bot: LucideIcon
  const Clock: LucideIcon
  const Timer: LucideIcon
  const Globe: LucideIcon
  const FileSignature: LucideIcon
  export {
    MessageCircle, Send, X, Minimize2, ArrowLeft,
    Inbox, Plus, Link2, Search, ChevronDown, ChevronUp, Paperclip,
    Settings, Mail, Bot, Clock, Timer, Globe, FileSignature,
  }
}
