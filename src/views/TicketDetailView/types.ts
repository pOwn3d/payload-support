export interface Message {
  id: string | number; body: string; bodyHtml?: string; authorType: 'client' | 'admin' | 'email'
  isInternal?: boolean; isSolution?: boolean; createdAt: string; fromChat?: boolean
  fromAlias?: string
  attachments?: Array<{ file: { id: number; url?: string; filename?: string; mimeType?: string } | number }>
}

export interface ClientInfo { id: number; company: string; firstName: string; lastName: string; email: string; phone?: string }
export interface TimeEntry { id: string | number; duration: number; description?: string; date: string }
export interface ActivityEntry { id: string | number; action: string; detail?: string; actorType?: string; createdAt: string }
