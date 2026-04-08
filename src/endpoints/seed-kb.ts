import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

const KB_ARTICLES = [
  {
    title: 'Comment créer un ticket de support ?',
    slug: 'comment-creer-un-ticket',
    category: 'getting-started',
    body: 'Pour créer un ticket de support, connectez-vous à votre espace client puis cliquez sur "Nouveau ticket". Remplissez le sujet et la description de votre demande. Vous pouvez ajouter des pièces jointes (captures d\'écran, documents) pour nous aider à comprendre votre problème. Notre équipe vous répondra dans les meilleurs délais.',
  },
  {
    title: 'Comment suivre l\'avancement de mon ticket ?',
    slug: 'suivre-avancement-ticket',
    category: 'tickets',
    body: 'Rendez-vous sur votre tableau de bord support. Vous y trouverez la liste de tous vos tickets avec leur statut actuel (Ouvert, En attente, Résolu). Cliquez sur un ticket pour voir la conversation complète et ajouter des messages. Vous recevez aussi des notifications par email à chaque réponse de notre équipe.',
  },
  {
    title: 'Quels sont les délais de réponse ?',
    slug: 'delais-de-reponse',
    category: 'tickets',
    body: 'Notre équipe s\'engage à répondre à votre ticket dans un délai de 2 heures ouvrées (lundi-vendredi, 9h-18h). Les tickets marqués "Urgent" sont traités en priorité. En dehors des heures ouvrées, votre ticket sera traité dès la reprise d\'activité.',
  },
  {
    title: 'Comment modifier mon mot de passe ?',
    slug: 'modifier-mot-de-passe',
    category: 'account',
    body: 'Accédez à votre profil depuis le menu en haut à droite. Dans la section "Sécurité", vous trouverez le formulaire de changement de mot de passe. Entrez votre mot de passe actuel puis définissez votre nouveau mot de passe (minimum 8 caractères). Cliquez sur "Sauvegarder" pour confirmer.',
  },
  {
    title: 'Comment activer l\'authentification à deux facteurs (2FA) ?',
    slug: 'activer-2fa',
    category: 'account',
    body: 'L\'authentification à deux facteurs renforce la sécurité de votre compte. Accédez à votre profil, section "Sécurité", et activez le toggle 2FA. Lors de votre prochaine connexion, un code de vérification sera envoyé par email. Entrez ce code pour accéder à votre espace.',
  },
  {
    title: 'Comment ajouter des pièces jointes à un ticket ?',
    slug: 'ajouter-pieces-jointes',
    category: 'tickets',
    body: 'Vous pouvez joindre des fichiers à vos messages en cliquant sur le bouton "Joindre un fichier" sous l\'éditeur de message, ou en glissant-déposant directement vos fichiers. Les formats acceptés sont : images (PNG, JPG, GIF), documents (PDF, DOC, DOCX, TXT) et archives (ZIP). Taille maximale : 5 Mo par fichier.',
  },
  {
    title: 'Mon site web ne s\'affiche plus, que faire ?',
    slug: 'site-ne-saffiche-plus',
    category: 'technical',
    body: 'Si votre site ne s\'affiche plus : 1) Vérifiez votre connexion internet. 2) Videz le cache de votre navigateur. 3) Essayez en navigation privée. 4) Si le problème persiste, créez un ticket urgent en précisant le message d\'erreur et l\'URL concernée.',
  },
  {
    title: 'Comment demander une modification sur mon site ?',
    slug: 'demander-modification-site',
    category: 'getting-started',
    body: 'Créez un ticket avec la catégorie "Modification de contenu". Décrivez précisément la modification souhaitée : page concernée, texte à modifier, images à remplacer, etc. Joignez des captures d\'écran si nécessaire.',
  },
  {
    title: 'Quels sont les tarifs de support ?',
    slug: 'tarifs-support',
    category: 'billing',
    body: 'Le support technique est inclus dans votre contrat de maintenance. Les demandes de modification de contenu et les nouvelles fonctionnalités sont facturées au temps passé selon le taux horaire défini dans votre contrat.',
  },
  {
    title: 'Comment exporter mes données personnelles (RGPD) ?',
    slug: 'export-donnees-rgpd',
    category: 'account',
    body: 'Conformément au RGPD, vous pouvez demander l\'export de toutes vos données personnelles. Rendez-vous dans votre profil, section "Données personnelles", et cliquez sur "Exporter mes données".',
  },
  {
    title: 'Comment fonctionne la connexion Google (SSO) ?',
    slug: 'connexion-google-sso',
    category: 'account',
    body: 'Vous pouvez vous connecter avec votre compte Google. Sur la page de connexion, cliquez sur "Se connecter avec Google". Si c\'est votre première connexion, un compte sera automatiquement créé.',
  },
  {
    title: 'Que signifient les différents statuts de ticket ?',
    slug: 'statuts-ticket',
    category: 'tickets',
    body: 'Ouvert : votre ticket a été reçu et est en cours de traitement. En attente : nous attendons une réponse de votre part. Résolu : le problème a été résolu. Vous pouvez rouvrir un ticket résolu en y répondant.',
  },
]

/**
 * POST /api/support/seed-kb
 * Seed the knowledge base with default FAQ articles. Admin-only.
 */
export function createSeedKbEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/seed-kb',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        let created = 0
        let skipped = 0

        for (const article of KB_ARTICLES) {
          const existing = await payload.find({
            collection: slugs.knowledgeBase as any,
            where: { slug: { equals: article.slug } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })

          if (existing.docs.length > 0) {
            skipped++
            continue
          }

          const lexicalBody = {
            root: {
              type: 'root',
              children: article.body.split('. ').map((sentence) => ({
                type: 'paragraph',
                children: [{ type: 'text', text: sentence.trim() + (sentence.endsWith('.') ? '' : '.'), version: 1 }],
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
              })),
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            },
          }

          await payload.create({
            collection: slugs.knowledgeBase as any,
            data: {
              title: article.title,
              slug: article.slug,
              category: article.category,
              body: lexicalBody as any,
              published: true,
              sortOrder: created + 1,
            },
            overrideAccess: true,
          })
          created++
        }

        return Response.json({ created, skipped, total: KB_ARTICLES.length })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[seed-kb] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
