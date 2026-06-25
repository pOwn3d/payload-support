export interface ChatMessage {
  id: number | string
  body: string
  senderType: 'client' | 'agent' | 'system'
  createdAt: string
}

export interface LiveChatSession {
  clientToken: string
  email: string
  name: string
  sessionId?: string
}

export type Screen = 'closed' | 'identify' | 'chat' | 'rating'
