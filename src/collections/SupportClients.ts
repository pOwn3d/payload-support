import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { escapeHtml, emailWrapper, emailButton, emailParagraph } from '../utils/emailTemplate'

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
        html: emailWrapper('Bienvenue sur votre espace support', [
          emailParagraph(`Bonjour <strong>${escapeHtml(doc.firstName || '')}</strong>,`),
          emailParagraph('Un espace support a ete cree pour vous. Vous pourrez y soumettre vos demandes, suivre vos tickets et echanger directement avec notre equipe.'),
          emailParagraph('Pour activer votre compte, cliquez sur le bouton ci-dessous pour definir votre mot de passe :'),
          emailButton('Definir mon mot de passe', resetUrl),
          `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151; line-height: 1.6;">&#8226; Soumettre des demandes de support</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151; line-height: 1.6;">&#8226; Suivre l'avancement de vos tickets en temps reel</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151; line-height: 1.6;">&#8226; Joindre des fichiers et captures d'ecran</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151; line-height: 1.6;">&#8226; Consulter l'historique complet de vos echanges</td></tr>
          </table>`,
          emailParagraph('<span style="font-size: 13px; color: #6b7280;">Ce lien est valable 1 heure.</span>'),
        ].join('')),
      })

      // Invitation email sent successfully
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
        generateEmailSubject: () => 'Reinitialisation de votre mot de passe',
        generateEmailHTML: (args) => {
          const token = args?.token || ''
          const user = args?.user as { firstName?: string } | undefined
          const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
          const resetUrl = `${baseUrl}/support/reset-password?token=${token}`
          const name = user?.firstName || ''

          return emailWrapper('Reinitialisation de mot de passe', [
            emailParagraph(`Bonjour${name ? ` <strong>${escapeHtml(name)}</strong>` : ''},`),
            emailParagraph('Vous avez demande la reinitialisation de votre mot de passe pour votre espace support.'),
            emailParagraph('Cliquez sur le bouton ci-dessous pour definir un nouveau mot de passe :'),
            emailButton('Definir mon mot de passe', resetUrl),
            emailParagraph('<span style="font-size: 13px; color: #6b7280;">Ce lien est valable 1 heure. Si vous n\'avez pas effectue cette demande, vous pouvez ignorer cet email.</span>'),
          ].join(''))
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
            label: 'Telephone',
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
            label: 'Prenom',
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
        label: '2FA active',
        admin: {
          description: 'Verification par email a chaque connexion',
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
        label: 'Notifications reponses',
        admin: {
          description: 'Recevoir un email a chaque reponse du support',
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
