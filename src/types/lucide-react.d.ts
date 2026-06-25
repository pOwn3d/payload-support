/**
 * Ambient stub for 'lucide-react'.
 * lucide-react is an optional peer dependency — the host application installs it.
 * This stub satisfies TypeScript when the plugin is type-checked in isolation.
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
