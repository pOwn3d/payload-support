export interface Attachment {
  file: { id: number; url?: string; filename?: string; mimeType?: string; sizes?: Record<string, { url?: string }> } | number
}

export interface Message {
  id: string | number
  body: string
  bodyHtml?: string
  authorType: 'client' | 'admin' | 'email'
  isInternal?: boolean
  isSolution?: boolean
  attachments?: Attachment[]
  createdAt: string
  fromChat?: boolean
}

export interface TimeEntry {
  id: string | number
  duration: number
  description?: string
  date: string
}

export interface ClientInfo {
  id: number
  company: string
  firstName: string
  lastName: string
  email: string
  phone?: string
}

export interface CannedResponse {
  id: string | number
  title: string
  body: string
  category?: string
}

export interface ActivityEntry {
  id: string | number
  action: string
  detail?: string
  actorType?: string
  actorEmail?: string
  createdAt: string
}

export interface SatisfactionSurvey {
  id: string | number
  rating: number
  comment?: string
  createdAt: string
}
