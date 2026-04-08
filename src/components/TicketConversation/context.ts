import { createContext, useContext } from 'react'
import type { Message, TimeEntry, ClientInfo, CannedResponse, ActivityEntry, SatisfactionSurvey } from './types'

/**
 * Handle interface for the RichTextEditor component.
 * When used inside the plugin, the consumer must provide a compatible editor
 * or leave the ref unused.
 */
export interface RichTextEditorHandle {
  setContent: (html: string) => void
  clear: () => void
  focus: () => void
}

export interface TicketContextValue {
  // Identity
  id: string | number | undefined

  // Core data
  messages: Message[]
  timeEntries: TimeEntry[]
  client: ClientInfo | null
  cannedResponses: CannedResponse[]
  activityLog: ActivityEntry[]
  satisfaction: SatisfactionSurvey | null
  loading: boolean

  // Ticket metadata
  currentStatus: string
  ticketNumber: string
  ticketSubject: string
  ticketSource: string
  chatSession: string
  snoozeUntil: string | null
  lastClientReadAt: string | null

  // Client history
  clientTickets: Array<{ id: number; ticketNumber: string; subject: string; status: string; createdAt: string }>
  clientProjects: Array<{ id: number; name: string; status: string }>
  clientNotes: string

  // AI
  clientSentiment: { emoji: string; label: string; color: string } | null

  // Typing
  clientTyping: boolean
  clientTypingName: string

  // Actions
  fetchAll: () => void
  sendAdminTyping: () => void

  // Reply editor ref
  replyEditorRef: React.RefObject<RichTextEditorHandle | null>
}

export const TicketContext = createContext<TicketContextValue | null>(null)

export function useTicketContext(): TicketContextValue {
  const ctx = useContext(TicketContext)
  if (!ctx) throw new Error('useTicketContext must be used within TicketContext.Provider')
  return ctx
}
