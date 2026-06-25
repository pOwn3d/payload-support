export type ChannelProvider = 'whatsapp' | 'messenger'

/**
 * Send an outbound reply to a social channel (WhatsApp / Messenger) via the Meta
 * Graph API. RUNTIME-only: requires provider credentials in the environment.
 * Returns `{ ok: false }` (and logs) when credentials are missing or the call fails.
 */
export async function sendChannelReply(provider: ChannelProvider, to: string, text: string): Promise<{ ok: boolean }> {
  try {
    if (provider === 'whatsapp') {
      const token = process.env.WHATSAPP_TOKEN
      const phoneId = process.env.WHATSAPP_PHONE_ID
      if (!token || !phoneId) return { ok: false }
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
      })
      return { ok: res.ok }
    }
    if (provider === 'messenger') {
      const token = process.env.MESSENGER_PAGE_TOKEN
      if (!token) return { ok: false }
      const res = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: to }, message: { text } }),
      })
      return { ok: res.ok }
    }
    return { ok: false }
  } catch (err) {
    console.error('[support] Channel send failed:', err)
    return { ok: false }
  }
}
