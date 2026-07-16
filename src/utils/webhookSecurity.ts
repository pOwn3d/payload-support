import { createHash, timingSafeEqual } from 'crypto'

export interface InboundEmailLimits {
  maxRequestBytes: number
  maxAttachmentBytes: number
  maxAttachments: number
  maxSubjectLength: number
  maxNameLength: number
  maxEmailLength: number
  maxBodyLength: number
}

export const DEFAULT_INBOUND_EMAIL_LIMITS: InboundEmailLimits = {
  maxRequestBytes: 25 * 1024 * 1024,
  maxAttachmentBytes: 10 * 1024 * 1024,
  maxAttachments: 10,
  maxSubjectLength: 1_000,
  maxNameLength: 500,
  maxEmailLength: 320,
  maxBodyLength: 38_000,
}

interface InboundAttachment {
  filename?: string
  size?: number
  content?: string
}

export interface InboundEmailInput {
  senderEmail?: string
  senderName?: string
  recipientEmail?: string
  cc?: string
  subject?: string
  body?: string
  htmlBody?: string
  attachments?: InboundAttachment[]
}

export interface InboundEmailValidationError {
  code: 'request_too_large' | 'too_many_attachments' | 'attachment_too_large' | 'text_field_too_large'
  status: 413
}

export function verifySecret(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false
  const providedDigest = createHash('sha256').update(provided).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}

export function validateInboundEmailPayload(
  input: InboundEmailInput,
  contentLength?: number,
  limits: InboundEmailLimits = DEFAULT_INBOUND_EMAIL_LIMITS,
): InboundEmailValidationError | null {
  if (contentLength != null && contentLength > limits.maxRequestBytes) {
    return { code: 'request_too_large', status: 413 }
  }

  const attachments = Array.isArray(input.attachments) ? input.attachments : []
  if (attachments.length > limits.maxAttachments) {
    return { code: 'too_many_attachments', status: 413 }
  }
  for (const attachment of attachments) {
    const decodedSize = attachment.content ? Math.ceil(attachment.content.length * 0.75) : 0
    if (Math.max(Number(attachment.size || 0), decodedSize) > limits.maxAttachmentBytes) {
      return { code: 'attachment_too_large', status: 413 }
    }
  }

  const tooLong =
    (input.subject?.length || 0) > limits.maxSubjectLength ||
    (input.senderName?.length || 0) > limits.maxNameLength ||
    (input.senderEmail?.length || 0) > limits.maxEmailLength ||
    (input.recipientEmail?.length || 0) > limits.maxEmailLength ||
    (input.cc?.length || 0) > limits.maxEmailLength ||
    (input.body?.length || 0) > limits.maxBodyLength ||
    (input.htmlBody?.length || 0) > limits.maxBodyLength
  return tooLong ? { code: 'text_field_too_large', status: 413 } : null
}
