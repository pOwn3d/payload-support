import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { RateLimiter } from '../utils/rateLimiter'
import { readSupportSettings } from '../utils/readSettings'
import crypto from 'crypto'

interface ParsedConversation {
  client: { email: string; name: string; company: string }
  subject: string
  messages: { from: 'client' | 'admin'; name: string; date: string; content: string }[]
}

const importLimiter = new RateLimiter(3_600_000, 10) // 10 per hour

function parseStructuredMarkdown(markdown: string): ParsedConversation | null {
  const clientMatch = markdown.match(
    /\*\*Client\s*:\*\*\s*(.+?)\s*[—–-]\s*(.+?)\s*\(([^)]+@[^)]+)\)/i,
  )
  const subjectMatch = markdown.match(/\*\*Sujet\s*:\*\*\s*(.+)/i)

  if (!clientMatch || !subjectMatch) return null

  const client = {
    name: clientMatch[1]!.trim(),
    company: clientMatch[2]!.trim(),
    email: clientMatch[3]!.trim().toLowerCase(),
  }

  const subject = subjectMatch[1]!.trim()
  const adminEmail = (process.env.CONTACT_EMAIL || 'admin@example.com').toLowerCase()

  const blocks = markdown.split(/## Message \d+/).slice(1)
  const messages: ParsedConversation['messages'] = []

  for (const block of blocks) {
    const fromMatch = block.match(/\*\*De\s*:\*\*\s*(.+?)\s*\(([^)]+)\)/)
    const dateMatch = block.match(/\*\*Date\s*:\*\*\s*(.+)/)

    if (!fromMatch) continue

    const name = fromMatch[1]!.trim()
    const email = fromMatch[2]!.trim().toLowerCase()
    const date = dateMatch ? dateMatch[1]!.trim() : ''

    const lines = block.split('\n')
    let contentStart = 0
    let foundDate = false
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.startsWith('**Date')) { foundDate = true; continue }
      if (foundDate && lines[i]!.trim() === '') { contentStart = i + 1; break }
    }

    const content = lines.slice(contentStart).join('\n').replace(/\n---\s*$/s, '').trim()
    if (!content) continue

    messages.push({
      from: email === adminEmail ? 'admin' : 'client',
      name,
      date,
      content,
    })
  }

  if (messages.length === 0) return null
  return { client, subject, messages }
}

async function parseMarkdownWithAI(markdown: string): Promise<ParsedConversation | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  try {
    const Anthropic = require('@anthropic-ai/sdk').default
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Parse this email conversation markdown and return strict JSON.

Extract:
- Client info (the external person, NOT the admin)
- Subject
- All messages chronologically

The admin email is: ${process.env.CONTACT_EMAIL || 'admin@example.com'}

Return JSON: { "client": { "email": "", "name": "", "company": "" }, "subject": "", "messages": [{ "from": "client"|"admin", "name": "", "date": "", "content": "" }] }

Markdown:
---
${markdown}
---

ONLY JSON, nothing else.`,
        },
      ],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.client?.email || !parsed.messages?.length) return null

    return {
      client: {
        email: parsed.client.email.toLowerCase().trim(),
        name: parsed.client.name || parsed.client.email.split('@')[0],
        company: parsed.client.company || 'Non renseigné',
      },
      subject: parsed.subject || 'Conversation importée',
      messages: parsed.messages.map((m: any) => ({
        from: m.from === 'admin' ? 'admin' : 'client',
        name: m.name || '',
        date: m.date || '',
        content: m.content || '',
      })),
    }
  } catch (err) {
    console.error('[import-conversation] AI parsing failed:', err)
    return null
  }
}

/**
 * POST /api/support/import-conversation
 * Import a conversation from markdown into the ticket system.
 */
export function createImportConversationEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/import-conversation',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        // Auth: admin session OR webhook secret
        const webhookSecret = req.headers.get('x-webhook-secret')
        let isAuthed = false

        if (webhookSecret && process.env.SUPPORT_WEBHOOK_SECRET && webhookSecret === process.env.SUPPORT_WEBHOOK_SECRET) {
          isAuthed = true
        } else if (req.user && req.user.collection === slugs.users) {
          isAuthed = true
        }

        if (!isAuthed) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        if (importLimiter.check(ip)) {
          return Response.json({ error: 'Rate limit exceeded. Maximum 10 imports per hour.' }, { status: 429 })
        }

        let body: { markdown?: string; previewOnly?: boolean }
        try {
          body = await req.json!()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
        const { markdown, previewOnly } = body

        if (!markdown || typeof markdown !== 'string') {
          return Response.json({ error: 'markdown field is required (string)' }, { status: 400 })
        }

        if (markdown.length > 512_000) {
          return Response.json({ error: 'Markdown too large (max 500KB)' }, { status: 400 })
        }

        let conversation = parseStructuredMarkdown(markdown)
        let parseMethod = 'structured'

        if (!conversation) {
          conversation = await parseMarkdownWithAI(markdown)
          parseMethod = 'ai'
        }

        if (!conversation) {
          return Response.json({
            error: 'Could not parse conversation. Expected format: **Client :** Name — Company (email), **Sujet :** Subject, ## Message N blocks.',
          }, { status: 422 })
        }

        if (previewOnly) {
          return Response.json({
            action: 'preview',
            parseMethod,
            client: conversation.client,
            subject: conversation.subject,
            messageCount: conversation.messages.length,
            messages: conversation.messages.map((m) => ({
              from: m.from,
              name: m.name,
              date: m.date,
              preview: m.content.length > 100 ? m.content.substring(0, 100) + '...' : m.content,
            })),
          })
        }

        if (!conversation.client.email.includes('@')) {
          return Response.json({ error: 'Invalid client email extracted' }, { status: 422 })
        }

        const settings = await readSupportSettings(payload)
        const adminEmail = (process.env.CONTACT_EMAIL || '').toLowerCase()
        const blockedEmails = [adminEmail, settings.email.replyToAddress || process.env.SUPPORT_REPLY_TO || ''].filter(Boolean)
        if (blockedEmails.includes(conversation.client.email)) {
          return Response.json({ error: 'Cannot create ticket from system email address' }, { status: 400 })
        }

        // Find or create support client
        const clientResult = await payload.find({
          collection: slugs.supportClients as any,
          where: { email: { equals: conversation.client.email } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        let client = clientResult.docs[0]
        let isNewClient = false

        if (!client) {
          const nameParts = conversation.client.name.split(' ')
          const randomPassword = crypto.randomBytes(48).toString('base64url')

          client = await payload.create({
            collection: slugs.supportClients as any,
            data: {
              email: conversation.client.email,
              password: randomPassword,
              firstName: nameParts[0] || 'Inconnu',
              lastName: nameParts.slice(1).join(' ') || conversation.client.email.split('@')[0] || 'Inconnu',
              company: conversation.client.company || 'Non renseigné',
            },
            overrideAccess: true,
          })
          isNewClient = true
        }

        // Find admin user for authorAdmin
        const adminUsers = await payload.find({
          collection: slugs.users as any,
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const adminUserId = adminUsers.docs[0]?.id

        // Create ticket
        const ticket = await payload.create({
          collection: slugs.tickets as any,
          data: {
            subject: conversation.subject,
            client: client.id,
            status: 'open',
            priority: 'normal',
            category: 'question',
          },
          overrideAccess: true,
        }) as any

        // Import messages
        let importedCount = 0
        for (const msg of conversation.messages) {
          const isAdmin = msg.from === 'admin'

          await payload.create({
            collection: slugs.ticketMessages as any,
            data: {
              ticket: ticket.id,
              body: msg.content,
              authorType: isAdmin ? 'admin' : 'email',
              ...(isAdmin && adminUserId ? { authorAdmin: adminUserId } : {}),
              ...(!isAdmin ? { authorClient: client.id } : {}),
              isInternal: false,
              skipNotification: true,
            },
            overrideAccess: true,
          })
          importedCount++
        }

        return Response.json({
          action: 'conversation_imported',
          parseMethod,
          ticketNumber: ticket.ticketNumber,
          ticketId: ticket.id,
          clientEmail: conversation.client.email,
          clientName: conversation.client.name,
          clientCompany: conversation.client.company,
          isNewClient,
          messagesImported: importedCount,
        })
      } catch (error) {
        console.error('[import-conversation] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
