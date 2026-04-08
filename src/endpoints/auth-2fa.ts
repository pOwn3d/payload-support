import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import crypto, { createHmac } from 'crypto'
import { RateLimiter } from '../utils/rateLimiter'
import { escapeHtml } from '../utils/emailTemplate'

const sendLimiter = new RateLimiter(60 * 60 * 1000, 3) // 3 per hour
const verifyLimiter = new RateLimiter(15 * 60 * 1000, 5) // 5 per 15 min

function generateSecureCode(): string {
  const buf = crypto.randomBytes(4)
  const num = buf.readUInt32BE(0) % 900000 + 100000
  return String(num)
}

function hashCode(code: string): string {
  const secret = process.env.PAYLOAD_SECRET || 'payload-support-2fa'
  return createHmac('sha256', secret).update(code).digest('hex')
}

/**
 * POST /api/support/2fa
 * Send or verify a 2FA code.
 */
export function createAuth2faEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/2fa',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload
        let body: { action?: string; email?: string; code?: string }
        try {
          body = await req.json!()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
        const { action, email, code } = body

        if (!action || !email) {
          return Response.json({ error: 'Paramètres manquants' }, { status: 400 })
        }

        const genericSendResponse = { success: true, message: 'Si un compte existe, un code a été envoyé.' }

        if (action === 'send') {
          if (sendLimiter.check(email)) {
            return Response.json(genericSendResponse)
          }

          const clients = await payload.find({
            collection: slugs.supportClients as any,
            where: { email: { equals: email } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })

          if (clients.docs.length === 0) {
            return Response.json(genericSendResponse)
          }

          const client = clients.docs[0] as any
          const plainCode = generateSecureCode()
          const twoFactorCode = hashCode(plainCode)
          const twoFactorExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()

          await payload.update({
            collection: slugs.supportClients as any,
            id: client.id,
            data: { twoFactorCode, twoFactorExpiry },
            overrideAccess: true,
          })

          await payload.sendEmail({
            to: email,
            subject: 'Code de vérification — Support',
            html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
              <p>Bonjour <strong>${escapeHtml(client.firstName || '')}</strong>,</p>
              <p>Votre code de vérification :</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="display: inline-block; font-size: 32px; font-weight: 900; letter-spacing: 8px; padding: 16px 32px; border: 3px solid #000; border-radius: 16px; background: #FFD600;">
                  ${plainCode}
                </span>
              </div>
              <p style="font-size: 13px; color: #6b7280;">Ce code est valable 10 minutes.</p>
            </div>`,
          })

          return Response.json(genericSendResponse)
        }

        if (action === 'verify') {
          if (!code) {
            return Response.json({ error: 'Code manquant' }, { status: 400 })
          }

          if (verifyLimiter.check(email)) {
            return Response.json(
              { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
              { status: 429 },
            )
          }

          const clients = await payload.find({
            collection: slugs.supportClients as any,
            where: { email: { equals: email } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })

          if (clients.docs.length === 0) {
            return Response.json({ error: 'Code incorrect' }, { status: 400 })
          }

          const client = clients.docs[0] as any
          const storedCode = client.twoFactorCode
          const storedExpiry = client.twoFactorExpiry

          if (!storedCode || !storedExpiry) {
            return Response.json({ error: 'Aucun code en attente' }, { status: 400 })
          }

          if (new Date() > new Date(storedExpiry)) {
            await payload.update({
              collection: slugs.supportClients as any,
              id: client.id,
              data: { twoFactorCode: '', twoFactorExpiry: '' },
              overrideAccess: true,
            })
            return Response.json({ error: 'Code expiré. Veuillez en demander un nouveau.' }, { status: 400 })
          }

          // Hash the submitted code and compare with stored hash (constant-time)
          const submittedHash = hashCode(String(code).padStart(6, '0'))
          const enc = new TextEncoder()
          const submittedBuffer = enc.encode(submittedHash)
          const storedBuffer = enc.encode(storedCode)
          if (submittedBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(submittedBuffer, storedBuffer)) {
            return Response.json({ error: 'Code incorrect' }, { status: 400 })
          }

          await payload.update({
            collection: slugs.supportClients as any,
            id: client.id,
            data: { twoFactorCode: '', twoFactorExpiry: '' },
            overrideAccess: true,
          })

          verifyLimiter.reset(email)

          return Response.json({ success: true, verified: true })
        }

        return Response.json({ error: 'Action invalide' }, { status: 400 })
      } catch (err) {
        console.error('[2fa] Error:', err)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
