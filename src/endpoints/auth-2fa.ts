import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import crypto from 'crypto'

// Rate limiters
const sendLimits = new Map<string, { count: number; resetAt: number }>()
const verifyLimits = new Map<string, { count: number; resetAt: number }>()

function isSendLimited(key: string): boolean {
  const now = Date.now()
  const entry = sendLimits.get(key)
  if (!entry || now > entry.resetAt) {
    sendLimits.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }
  entry.count++
  return entry.count > 3
}

function isVerifyLimited(key: string): boolean {
  const now = Date.now()
  const entry = verifyLimits.get(key)
  if (!entry || now > entry.resetAt) {
    verifyLimits.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return false
  }
  entry.count++
  return entry.count > 5
}

function resetVerifyLimit(key: string) {
  verifyLimits.delete(key)
}

function generateSecureCode(): string {
  const buf = crypto.randomBytes(4)
  const num = buf.readUInt32BE(0) % 900000 + 100000
  return String(num)
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
        const body = await req.json!()
        const { action, email, code } = body

        if (!action || !email) {
          return Response.json({ error: 'Paramètres manquants' }, { status: 400 })
        }

        const genericSendResponse = { success: true, message: 'Si un compte existe, un code a été envoyé.' }

        if (action === 'send') {
          if (isSendLimited(email)) {
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
          const twoFactorCode = generateSecureCode()
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
              <p>Bonjour <strong>${client.firstName || ''}</strong>,</p>
              <p>Votre code de vérification :</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="display: inline-block; font-size: 32px; font-weight: 900; letter-spacing: 8px; padding: 16px 32px; border: 3px solid #000; border-radius: 16px; background: #FFD600;">
                  ${twoFactorCode}
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

          if (isVerifyLimited(email)) {
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

          // Constant-time comparison
          const enc = new TextEncoder()
          const codeBuffer = enc.encode(String(code).padStart(6, '0'))
          const storedBuffer = enc.encode(storedCode)
          if (codeBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(codeBuffer, storedBuffer)) {
            return Response.json({ error: 'Code incorrect' }, { status: 400 })
          }

          await payload.update({
            collection: slugs.supportClients as any,
            id: client.id,
            data: { twoFactorCode: '', twoFactorExpiry: '' },
            overrideAccess: true,
          })

          resetVerifyLimit(email)

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
