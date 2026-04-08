import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Hooks ───────────────────────────────────────────────

function createSendInvitationOnCreate(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc

    // Only when an admin creates the client (not self-registration)
    if (req.user?.collection !== slugs.users) return doc

    try {
      const { payload } = req

      // Generate reset token without sending the default forgotPassword email
      const token = await payload.forgotPassword({
        collection: slugs.supportClients,
        data: { email: doc.email },
        disableEmail: true,
      })

      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
      const resetUrl = `${baseUrl}/support/reset-password?token=${token}`

      await payload.sendEmail({
        to: doc.email,
        subject: 'Activez votre compte support',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<h2>Bienvenue sur votre espace support</h2>
<p>Bonjour <strong>${doc.firstName || ''}</strong>,</p>
<p>Un espace support a été créé pour vous. Vous pourrez y soumettre vos demandes, suivre vos tickets et échanger directement avec notre équipe.</p>
<p>Pour activer votre compte, cliquez sur le lien ci-dessous pour définir votre mot de passe :</p>
<p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Définir mon mot de passe</a></p>
<ul>
<li>Soumettre des demandes de support</li>
<li>Suivre l'avancement de vos tickets en temps réel</li>
<li>Joindre des fichiers et captures d'écran</li>
<li>Consulter l'historique complet de vos échanges</li>
</ul>
<p style="font-size:13px;color:#6b7280;">Ce lien est valable 1 heure.</p>
</div>`,
      })

      console.log(`[support-clients] Invitation email sent to ${doc.email}`)
    } catch (err) {
      console.error('[support-clients] Failed to send invitation email:', err)
    }

    return doc
  }
}

// ─── Collection factory ──────────────────────────────────

export function createSupportClientsCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.supportClients,
    labels: {
      singular: 'Client Support',
      plural: 'Clients Support',
    },
    auth: {
      tokenExpiration: 7200, // 2 hours
      maxLoginAttempts: 10,
      lockTime: 300 * 1000, // 5 minutes
      cookies: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
      },
      forgotPassword: {
        generateEmailSubject: () => 'Réinitialisation de votre mot de passe',
        generateEmailHTML: (args) => {
          const token = args?.token || ''
          const user = args?.user as { firstName?: string } | undefined
          const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
          const resetUrl = `${baseUrl}/support/reset-password?token=${token}`
          const name = user?.firstName || ''

          return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<h2>Réinitialisation de mot de passe</h2>
<p>Bonjour${name ? ` <strong>${name}</strong>` : ''},</p>
<p>Vous avez demandé la réinitialisation de votre mot de passe pour votre espace support.</p>
<p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
<p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Définir mon mot de passe</a></p>
<p style="font-size:13px;color:#6b7280;">Ce lien est valable 1 heure. Si vous n'avez pas effectué cette demande, vous pouvez ignorer cet email.</p>
</div>`
        },
      },
    },
    admin: {
      useAsTitle: 'company',
      group: 'Support',
      defaultColumns: ['company', 'email', 'firstName', 'lastName', 'createdAt'],
    },
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'company',
            type: 'text',
            required: true,
            label: 'Entreprise',
            admin: { width: '50%' },
          },
          {
            name: 'phone',
            type: 'text',
            label: 'Téléphone',
            admin: { width: '50%' },
          },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'firstName',
            type: 'text',
            required: true,
            label: 'Prénom',
            admin: { width: '50%' },
          },
          {
            name: 'lastName',
            type: 'text',
            required: true,
            label: 'Nom',
            admin: { width: '50%' },
          },
        ],
      },
      {
        name: 'twoFactorEnabled',
        type: 'checkbox',
        defaultValue: false,
        label: '2FA activé',
        admin: {
          description: 'Vérification par email à chaque connexion',
          position: 'sidebar',
        },
      },
      {
        name: 'twoFactorCode',
        type: 'text',
        admin: { hidden: true },
      },
      {
        name: 'twoFactorExpiry',
        type: 'date',
        admin: { hidden: true },
      },
      {
        name: 'notifyOnReply',
        type: 'checkbox',
        defaultValue: true,
        label: 'Notifications réponses',
        admin: {
          description: 'Recevoir un email à chaque réponse du support',
          position: 'sidebar',
        },
      },
      {
        name: 'notifyOnStatusChange',
        type: 'checkbox',
        defaultValue: true,
        label: 'Notifications statut',
        admin: {
          description: 'Recevoir un email quand le statut d\'un ticket change',
          position: 'sidebar',
        },
      },
      {
        name: 'notes',
        type: 'textarea',
        label: 'Notes internes',
        admin: {
          description: 'Visible uniquement par les admins',
          position: 'sidebar',
        },
      },
    ],
    hooks: {
      afterChange: [createSendInvitationOnCreate(slugs)],
    },
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) {
          return { id: { equals: req.user.id } }
        }
        return false
      },
      delete: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) {
          return { id: { equals: req.user.id } }
        }
        return false
      },
    },
    timestamps: true,
  }
}
