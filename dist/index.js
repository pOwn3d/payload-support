import crypto3, { createHmac } from 'crypto';

var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/types.ts
var DEFAULT_FEATURES = {
  timeTracking: true,
  ai: true,
  satisfaction: true,
  chat: true,
  emailTracking: true,
  canned: true,
  merge: true,
  snooze: true,
  externalMessages: true,
  clientHistory: true,
  activityLog: true,
  splitTicket: true,
  scheduledReplies: true,
  autoClose: true,
  autoCloseDays: 7,
  roundRobin: false,
  sla: true,
  webhooks: true,
  macros: true,
  customStatuses: false,
  collisionDetection: true,
  signatures: true,
  chatbot: true,
  bulkActions: true,
  commandPalette: true,
  knowledgeBase: true,
  pendingEmails: true,
  authLogs: true
};

// src/utils/slugs.ts
var DEFAULT_SLUGS = {
  tickets: "tickets",
  ticketMessages: "ticket-messages",
  supportClients: "support-clients",
  timeEntries: "time-entries",
  cannedResponses: "canned-responses",
  ticketActivityLog: "ticket-activity-log",
  satisfactionSurveys: "satisfaction-surveys",
  knowledgeBase: "knowledge-base",
  chatMessages: "chat-messages",
  pendingEmails: "pending-emails",
  emailLogs: "email-logs",
  authLogs: "auth-logs",
  webhookEndpoints: "webhook-endpoints",
  slaPolicies: "sla-policies",
  macros: "macros",
  ticketStatuses: "ticket-statuses",
  users: "users",
  media: "media"
};
function resolveSlugs(overrides) {
  return { ...DEFAULT_SLUGS, ...overrides };
}

// src/utils/auth.ts
var AuthError = class extends Error {
  statusCode;
  constructor(message, statusCode) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
};
function requireAdmin(req, slugs) {
  if (!req.user) throw new AuthError("Authentication required", 401);
  if (req.user.collection !== slugs.users) throw new AuthError("Admin access required", 403);
}
function requireClient(req, slugs) {
  if (!req.user) throw new AuthError("Authentication required", 401);
  if (req.user.collection !== slugs.supportClients) throw new AuthError("Client access required", 403);
}
function handleAuthError(error) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.statusCode });
  }
  return null;
}

// src/utils/readSettings.ts
var PREF_KEY = "support-settings";
var USER_PREFS_KEY_PREFIX = "support-user-prefs";
var DEFAULT_SETTINGS = {
  email: { fromAddress: "", fromName: "Support", replyToAddress: "" },
  ai: { provider: "anthropic", model: "claude-haiku-4-5-20251001", enableSentiment: true, enableSynthesis: true, enableSuggestion: true, enableRewrite: true },
  sla: { firstResponseMinutes: 120, resolutionMinutes: 1440, businessHoursOnly: true, escalationEmail: "" },
  autoClose: { enabled: true, daysBeforeClose: 7, reminderDaysBefore: 2 }
};
var DEFAULT_USER_PREFS = {
  locale: "fr",
  signature: ""
};
async function readSupportSettings(payload) {
  try {
    const prefs = await payload.find({
      collection: "payload-preferences",
      where: { key: { equals: PREF_KEY } },
      limit: 1,
      depth: 0,
      overrideAccess: true
    });
    if (prefs.docs.length > 0) {
      const stored = prefs.docs[0].value;
      return {
        email: { ...DEFAULT_SETTINGS.email, ...stored.email },
        ai: { ...DEFAULT_SETTINGS.ai, ...stored.ai },
        sla: { ...DEFAULT_SETTINGS.sla, ...stored.sla },
        autoClose: { ...DEFAULT_SETTINGS.autoClose, ...stored.autoClose }
      };
    }
  } catch {
  }
  return { ...DEFAULT_SETTINGS };
}
async function readUserPrefs(payload, userId) {
  try {
    const key = `${USER_PREFS_KEY_PREFIX}-${userId}`;
    const prefs = await payload.find({
      collection: "payload-preferences",
      where: { key: { equals: key } },
      limit: 1,
      depth: 0,
      overrideAccess: true
    });
    if (prefs.docs.length > 0) {
      const stored = prefs.docs[0].value;
      return {
        locale: stored.locale || DEFAULT_USER_PREFS.locale,
        signature: stored.signature ?? DEFAULT_USER_PREFS.signature
      };
    }
  } catch {
  }
  return { ...DEFAULT_USER_PREFS };
}

// src/endpoints/ai.ts
function getClient(aiSettings) {
  const Anthropic = __require("@anthropic-ai/sdk").default;
  if (aiSettings.provider === "ollama") {
    const baseURL = process.env.OLLAMA_API_URL || "https://ollama.orkelis.app/v1";
    return new Anthropic({ apiKey: "ollama", baseURL });
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
function getModel(aiSettings) {
  return aiSettings.model || "claude-haiku-4-5-20251001";
}
function createAiEndpoint(slugs) {
  return {
    path: "/support/ai",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const settings = await readSupportSettings(payload);
        const aiSettings = settings.ai;
        let body;
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const { action } = body;
        const anthropic = getClient(aiSettings);
        const model = getModel(aiSettings);
        if (action === "sentiment") {
          if (!aiSettings.enableSentiment) {
            return Response.json({ sentiment: "neutre", disabled: true });
          }
          const { text } = body;
          if (!text) return Response.json({ error: "text required" }, { status: 400 });
          const res = await anthropic.messages.create({
            model,
            max_tokens: 20,
            messages: [
              {
                role: "user",
                content: `Analyse le sentiment de ce message de support client. R\xE9ponds UNIQUEMENT par un seul mot parmi : frustr\xE9, m\xE9content, neutre, satisfait, urgent. Pas d'explication.

Message : "${text.slice(0, 500)}"`
              }
            ]
          });
          const raw = (res.content[0].type === "text" ? res.content[0].text : "").toLowerCase().trim();
          return Response.json({ sentiment: raw });
        }
        if (action === "synthesis") {
          if (!aiSettings.enableSynthesis) {
            return Response.json({ synthesis: "", disabled: true });
          }
          const { messages: msgs, ticketSubject, clientName, clientCompany } = body;
          const conversation = msgs.map((m) => {
            const author = m.authorType === "admin" ? "Support" : "Client";
            const date = new Date(m.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Paris"
            });
            return `[${date}] ${author}: ${m.body}`;
          }).join("\n\n");
          const prompt = `Tu es un agent de support technique senior. Analyse cette conversation de support et g\xE9n\xE8re une synth\xE8se structur\xE9e.

Sujet du ticket : ${ticketSubject}
Client : ${clientName || "Inconnu"}${clientCompany ? ` \u2014 ${clientCompany}` : ""}

Conversation :
${conversation}

G\xE9n\xE8re une synth\xE8se avec ces sections (en markdown) :
## R\xE9sum\xE9
2-3 phrases r\xE9sumant la situation

## Chronologie
- Points cl\xE9s de la conversation

## Probl\xE8me principal
Description du probl\xE8me ou de la demande

## Actions
- Ce qui a \xE9t\xE9 fait
- Prochaines \xE9tapes

## Notes importantes
Points d'attention \xE9ventuels`;
          const res = await anthropic.messages.create({
            model,
            max_tokens: 1e3,
            messages: [{ role: "user", content: prompt }]
          });
          const text = res.content[0].type === "text" ? res.content[0].text : "";
          return Response.json({ synthesis: text });
        }
        if (action === "suggest_reply") {
          if (!aiSettings.enableSuggestion) {
            return Response.json({ reply: "", disabled: true });
          }
          const { messages: msgs, clientName, clientCompany } = body;
          const conversation = msgs.slice(-10).map((m) => {
            const author = m.authorType === "admin" ? "Support" : "Client";
            return `${author}: ${m.body}`;
          }).join("\n\n");
          const prompt = `Tu es un agent de support technique. Tu r\xE9ponds de mani\xE8re professionnelle, chaleureuse et concise en fran\xE7ais.

Contexte client : ${clientCompany || ""} \u2014 ${clientName || "client"}

Conversation r\xE9cente :
${conversation}

R\xE9dige une r\xE9ponse appropri\xE9e au dernier message du client. Sois concis (3-5 phrases max), professionnel mais chaleureux. Tutoie si le client tutoie, vouvoie sinon. Ne mets pas de signature.`;
          const res = await anthropic.messages.create({
            model,
            max_tokens: 500,
            messages: [{ role: "user", content: prompt }]
          });
          const text = res.content[0].type === "text" ? res.content[0].text : "";
          return Response.json({ reply: text });
        }
        if (action === "rewrite") {
          if (!aiSettings.enableRewrite) {
            return Response.json({ rewritten: "", disabled: true });
          }
          const { text, style } = body;
          if (!text?.trim()) return Response.json({ error: "text required" }, { status: 400 });
          const styleInstructions = {
            auto: { tone: "Garde le ton actuel (neutre professionnel).", person: "IMPORTANT: Pr\xE9serve EXACTEMENT le tutoiement ou vouvoiement du texte original." },
            tutoyer: { tone: "Ton d\xE9contract\xE9 et direct, mais correct.", person: 'CRITIQUE: Utilise IMP\xC9RATIVEMENT le tutoiement partout (tu, ton, te, toi). Si le texte vouvoie, convertis TOUT en tutoiement. Exemple: "vous pouvez" \u2192 "tu peux", "votre" \u2192 "ton".' },
            vouvoyer: { tone: "Ton neutre et poli.", person: "CRITIQUE: Utilise IMP\xC9RATIVEMENT le vouvoiement partout (vous, votre, etc). Si le texte tutoie, convertis TOUT en vouvoiement." },
            formel: { tone: "Ton formel et institutionnel.", person: "Utilise le vouvoiement partout." },
            court: { tone: "Style concis et direct, phrases courtes, aller \xE0 l'essentiel.", person: "Pr\xE9serve le tutoiement/vouvoiement du texte original." },
            amical: { tone: "Ton chaleureux, amical, sympathique, avec un peu de cordialit\xE9.", person: "CRITIQUE: Utilise IMP\xC9RATIVEMENT le tutoiement partout. Convertis le vouvoiement en tutoiement." }
          };
          const styleGuide = styleInstructions[style || "auto"] || styleInstructions.auto;
          const prompt = `Reformule le texte ci-dessous en corrigeant les fautes d'orthographe/grammaire. Ne change pas le fond du message, am\xE9liore uniquement la forme.

TON REQUIS: ${styleGuide.tone}
FORME REQUISE: ${styleGuide.person}

R\xE9ponds UNIQUEMENT avec le texte reformul\xE9, sans commentaire ni explication.

Texte original :
${text}`;
          const res = await anthropic.messages.create({
            model,
            max_tokens: 500,
            messages: [{ role: "user", content: prompt }]
          });
          const rewritten = res.content[0].type === "text" ? res.content[0].text : "";
          return Response.json({ rewritten });
        }
        return Response.json({ error: "Invalid action" }, { status: 400 });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[support/ai] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/client-intelligence.ts
function getClient2(aiSettings) {
  const Anthropic = __require("@anthropic-ai/sdk").default;
  if (aiSettings.provider === "ollama") {
    const baseURL = process.env.OLLAMA_API_URL || "https://ollama.orkelis.app/v1";
    return new Anthropic({ apiKey: "ollama", baseURL });
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
function getModel2(aiSettings) {
  return aiSettings.model || "claude-haiku-4-5-20251001";
}
var CACHE_TTL_MS = 24 * 60 * 60 * 1e3;
function createClientIntelligenceEndpoint(slugs) {
  const getHandler = async (req) => {
    try {
      requireAdmin(req, slugs);
      const payload = req.payload;
      const url = new URL(req.url || "", "http://localhost");
      const clientId = url.searchParams.get("clientId");
      if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });
      const existing = await payload.find({
        collection: "client-summaries",
        where: { client: { equals: Number(clientId) } },
        limit: 1,
        depth: 0,
        overrideAccess: true
      });
      if (existing.docs.length > 0) {
        const cached = existing.docs[0];
        const age = Date.now() - new Date(cached.generatedAt || 0).getTime();
        if (age < CACHE_TTL_MS) {
          return Response.json({ ...cached, fromCache: true });
        }
      }
      return await generateSummary(payload, clientId, slugs, existing.docs[0]?.id);
    } catch (error) {
      const authResponse = handleAuthError(error);
      if (authResponse) return authResponse;
      console.error("[client-intelligence] Error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
  const postHandler = async (req) => {
    try {
      requireAdmin(req, slugs);
      const payload = req.payload;
      const body = await req.json?.() || {};
      const clientId = body.clientId;
      if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });
      const existing = await payload.find({
        collection: "client-summaries",
        where: { client: { equals: Number(clientId) } },
        limit: 1,
        depth: 0,
        overrideAccess: true
      });
      return await generateSummary(payload, clientId, slugs, existing.docs[0]?.id);
    } catch (error) {
      const authResponse = handleAuthError(error);
      if (authResponse) return authResponse;
      console.error("[client-intelligence] Refresh error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
  return [
    { path: "/support/client-intelligence", method: "get", handler: getHandler },
    { path: "/support/client-intelligence", method: "post", handler: postHandler }
  ];
}
async function generateSummary(payload, clientId, slugs, existingId) {
  const aiSettings = (await readSupportSettings(payload)).ai;
  if (!aiSettings.enableSynthesis) {
    return Response.json({ error: "AI synthesis disabled in settings" }, { status: 400 });
  }
  const client = await payload.findByID({
    collection: slugs.supportClients,
    id: Number(clientId),
    depth: 0,
    overrideAccess: true
  });
  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
  const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || client.company || client.email;
  const tickets = await payload.find({
    collection: slugs.tickets,
    where: { client: { equals: Number(clientId) } },
    sort: "-createdAt",
    limit: 50,
    depth: 0,
    overrideAccess: true
  });
  if (tickets.totalDocs === 0) {
    return Response.json({
      summary: "Aucun ticket pour ce client.",
      recurringTopics: [],
      patterns: [],
      keyFacts: [],
      ticketCount: 0,
      messageCount: 0
    });
  }
  const ticketIds = tickets.docs.slice(0, 20).map((t) => t.id);
  const messages = await payload.find({
    collection: slugs.ticketMessages,
    where: { ticket: { in: ticketIds.join(",") } },
    sort: "createdAt",
    limit: 200,
    depth: 0,
    overrideAccess: true
  });
  let avgSatisfaction = null;
  try {
    const surveys = await payload.find({
      collection: slugs.satisfactionSurveys || "satisfaction-surveys",
      where: { client: { equals: Number(clientId) } },
      limit: 50,
      depth: 0,
      overrideAccess: true
    });
    if (surveys.totalDocs > 0) {
      const ratings = surveys.docs.filter((s) => s.rating).map((s) => s.rating);
      if (ratings.length > 0) avgSatisfaction = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10;
    }
  } catch {
  }
  const ticketSummaries = tickets.docs.map((t) => {
    const msgs = messages.docs.filter((m) => {
      const mTicket = typeof m.ticket === "object" ? m.ticket.id : m.ticket;
      return mTicket === t.id;
    });
    const clientMsgs = msgs.filter((m) => m.authorType === "client" || m.authorType === "email");
    const adminMsgs = msgs.filter((m) => m.authorType === "admin");
    return `Ticket ${t.ticketNumber} (${t.status}) \u2014 "${t.subject}"
  Client: ${clientMsgs.map((m) => m.body?.slice(0, 200)).join(" | ")}
  Admin: ${adminMsgs.map((m) => m.body?.slice(0, 200)).join(" | ")}`;
  }).join("\n\n");
  const prompt = `Tu es un assistant d'analyse CRM pour un support technique. Analyse l'historique complet de ce client et g\xE9n\xE8re un rapport structur\xE9.

CLIENT : ${clientName} (${client.company || "pas de soci\xE9t\xE9"})
Email : ${client.email}
Nombre de tickets : ${tickets.totalDocs}
Satisfaction moyenne : ${avgSatisfaction ?? "non \xE9valu\xE9e"}

HISTORIQUE DES TICKETS :
${ticketSummaries.slice(0, 4e3)}

R\xE9ponds en JSON strict (pas de markdown, pas de commentaires) avec cette structure :
{
  "summary": "R\xE9sum\xE9 global du client en 2-3 phrases (qui il est, ce qu'il demande habituellement, son niveau de satisfaction)",
  "recurringTopics": [{"topic": "nom du sujet", "count": N, "lastSeen": "YYYY-MM-DD"}],
  "patterns": ["pattern 1 observ\xE9", "pattern 2 observ\xE9"],
  "keyFacts": ["fait cl\xE9 1 sur le client", "fait cl\xE9 2"]
}

Sois factuel. Ne d\xE9passe pas 5 items par tableau. R\xE9ponds UNIQUEMENT avec le JSON.`;
  const anthropic = getClient2(aiSettings);
  const model = getModel2(aiSettings);
  const res = await anthropic.messages.create({
    model,
    max_tokens: 1e3,
    messages: [{ role: "user", content: prompt }]
  });
  const rawText = res.content[0].type === "text" ? res.content[0].text : "{}";
  let parsed = {};
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    parsed = { summary: rawText, recurringTopics: [], patterns: [], keyFacts: [] };
  }
  const data = {
    client: Number(clientId),
    clientName,
    summary: parsed.summary || "R\xE9sum\xE9 non disponible",
    recurringTopics: parsed.recurringTopics || [],
    patterns: parsed.patterns || [],
    keyFacts: parsed.keyFacts || [],
    ticketCount: tickets.totalDocs,
    messageCount: messages.totalDocs,
    averageSatisfaction: avgSatisfaction,
    firstTicketAt: tickets.docs[tickets.docs.length - 1]?.createdAt || null,
    lastTicketAt: tickets.docs[0]?.createdAt || null,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    aiModel: model
  };
  let saved;
  if (existingId) {
    saved = await payload.update({
      collection: "client-summaries",
      id: existingId,
      data,
      overrideAccess: true
    });
  } else {
    saved = await payload.create({
      collection: "client-summaries",
      data,
      overrideAccess: true
    });
  }
  console.log(`[client-intelligence] Generated summary for ${clientName} (${tickets.totalDocs} tickets, ${messages.totalDocs} messages)`);
  return Response.json({ ...saved, fromCache: false });
}

// src/endpoints/search.ts
function createSearchEndpoint(slugs) {
  return {
    path: "/support/search",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const url = new URL(req.url);
        const q = url.searchParams.get("q")?.trim();
        if (!q || q.length < 2) {
          return Response.json({ tickets: [], clients: [], messages: [], articles: [] });
        }
        const [ticketsRes, clientsRes, messagesRes, articlesRes] = await Promise.all([
          payload.find({
            collection: slugs.tickets,
            where: {
              or: [
                { ticketNumber: { contains: q } },
                { subject: { contains: q } }
              ]
            },
            sort: "-updatedAt",
            limit: 8,
            depth: 1,
            overrideAccess: true
          }),
          payload.find({
            collection: slugs.supportClients,
            where: {
              or: [
                { firstName: { contains: q } },
                { lastName: { contains: q } },
                { email: { contains: q } },
                { company: { contains: q } }
              ]
            },
            limit: 5,
            depth: 0,
            overrideAccess: true
          }),
          payload.find({
            collection: slugs.ticketMessages,
            where: { body: { contains: q } },
            sort: "-createdAt",
            limit: 5,
            depth: 1,
            overrideAccess: true
          }),
          payload.find({
            collection: slugs.knowledgeBase,
            where: { title: { contains: q } },
            limit: 5,
            depth: 0,
            overrideAccess: true
          })
        ]);
        return Response.json({
          tickets: ticketsRes.docs.map((t) => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            status: t.status,
            client: typeof t.client === "object" ? { firstName: t.client?.firstName, company: t.client?.company } : null
          })),
          clients: clientsRes.docs.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            company: c.company
          })),
          messages: messagesRes.docs.map((m) => ({
            id: m.id,
            body: typeof m.body === "string" ? m.body.slice(0, 100) : "",
            ticketId: typeof m.ticket === "object" ? m.ticket?.id : m.ticket,
            ticketNumber: typeof m.ticket === "object" ? m.ticket?.ticketNumber : null
          })),
          articles: articlesRes.docs.map((a) => ({
            id: a.id,
            title: a.title,
            slug: a.slug
          }))
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[search] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/bulk-action.ts
function createBulkActionEndpoint(slugs) {
  return {
    path: "/support/bulk-action",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const { ticketIds, action, value } = await req.json();
        if (!ticketIds?.length || !action) {
          return Response.json({ error: "ticketIds and action required" }, { status: 400 });
        }
        let processed = 0;
        for (const ticketId of ticketIds) {
          try {
            switch (action) {
              case "close":
                await payload.update({
                  collection: slugs.tickets,
                  id: ticketId,
                  data: { status: "resolved", resolvedAt: (/* @__PURE__ */ new Date()).toISOString() },
                  overrideAccess: true
                });
                break;
              case "reopen":
                await payload.update({
                  collection: slugs.tickets,
                  id: ticketId,
                  data: { status: "open" },
                  overrideAccess: true
                });
                break;
              case "assign":
                if (value) {
                  await payload.update({
                    collection: slugs.tickets,
                    id: ticketId,
                    data: { assignedTo: Number(value) },
                    overrideAccess: true
                  });
                }
                break;
              case "set_priority":
                if (value) {
                  await payload.update({
                    collection: slugs.tickets,
                    id: ticketId,
                    data: { priority: String(value) },
                    overrideAccess: true
                  });
                }
                break;
              case "set_category":
                if (value) {
                  await payload.update({
                    collection: slugs.tickets,
                    id: ticketId,
                    data: { category: String(value) },
                    overrideAccess: true
                  });
                }
                break;
              case "delete":
                await payload.delete({
                  collection: slugs.tickets,
                  id: ticketId,
                  overrideAccess: true
                });
                break;
            }
            processed++;
          } catch (err) {
            console.error(`[bulk-action] Failed for ticket ${ticketId}:`, err);
          }
        }
        return Response.json({ processed, total: ticketIds.length });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[bulk-action] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/merge-tickets.ts
function createMergeTicketsEndpoint(slugs) {
  return {
    path: "/support/merge-tickets",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const { sourceTicketId, targetTicketId } = await req.json();
        if (!sourceTicketId || !targetTicketId) {
          return Response.json({ error: "sourceTicketId et targetTicketId requis" }, { status: 400 });
        }
        if (sourceTicketId === targetTicketId) {
          return Response.json({ error: "Impossible de fusionner un ticket avec lui-m\xEAme" }, { status: 400 });
        }
        const [source, target] = await Promise.all([
          payload.findByID({ collection: slugs.tickets, id: sourceTicketId, depth: 0, overrideAccess: true }),
          payload.findByID({ collection: slugs.tickets, id: targetTicketId, depth: 0, overrideAccess: true })
        ]);
        if (!source) return Response.json({ error: "Ticket source introuvable" }, { status: 404 });
        if (!target) return Response.json({ error: "Ticket cible introuvable" }, { status: 404 });
        const sourceClient = typeof source.client === "object" ? source.client.id : source.client;
        const targetClient = typeof target.client === "object" ? target.client.id : target.client;
        if (sourceClient !== targetClient) {
          return Response.json({ error: "Les deux tickets doivent appartenir au m\xEAme client" }, { status: 400 });
        }
        const messages = await payload.find({
          collection: slugs.ticketMessages,
          where: { ticket: { equals: sourceTicketId } },
          limit: 500,
          depth: 0,
          overrideAccess: true
        });
        for (const msg of messages.docs) {
          await payload.update({
            collection: slugs.ticketMessages,
            id: msg.id,
            data: { ticket: targetTicketId },
            overrideAccess: true
          });
        }
        const timeEntries = await payload.find({
          collection: slugs.timeEntries,
          where: { ticket: { equals: sourceTicketId } },
          limit: 500,
          depth: 0,
          overrideAccess: true
        });
        for (const entry of timeEntries.docs) {
          await payload.update({
            collection: slugs.timeEntries,
            id: entry.id,
            data: { ticket: targetTicketId },
            overrideAccess: true
          });
        }
        const sourceNumber = source.ticketNumber || `#${sourceTicketId}`;
        await payload.create({
          collection: slugs.ticketMessages,
          data: {
            ticket: targetTicketId,
            body: `Messages fusionn\xE9s depuis ${sourceNumber} (${messages.totalDocs} messages, ${timeEntries.totalDocs} entr\xE9es de temps)`,
            authorType: "admin",
            isInternal: true,
            skipNotification: true
          },
          overrideAccess: true
        });
        await payload.delete({
          collection: slugs.tickets,
          id: sourceTicketId,
          overrideAccess: true
        });
        const allTimeEntries = await payload.find({
          collection: slugs.timeEntries,
          where: { ticket: { equals: targetTicketId } },
          limit: 500,
          depth: 0,
          overrideAccess: true
        });
        const totalMinutes = allTimeEntries.docs.reduce(
          (sum, e) => sum + (e.duration || 0),
          0
        );
        await payload.update({
          collection: slugs.tickets,
          id: targetTicketId,
          data: { totalTimeMinutes: totalMinutes },
          overrideAccess: true
        });
        return Response.json({
          success: true,
          messagesMoved: messages.totalDocs,
          timeEntriesMoved: timeEntries.totalDocs,
          sourceTicket: sourceNumber,
          targetTicket: target.ticketNumber || `#${targetTicketId}`
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[merge-tickets] Error:", error);
        return Response.json({ error: "Erreur interne" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/split-ticket.ts
function createSplitTicketEndpoint(slugs) {
  return {
    path: "/support/split-ticket",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const { messageId, subject } = await req.json();
        if (!messageId) {
          return Response.json({ error: "messageId required" }, { status: 400 });
        }
        const message = await payload.findByID({
          collection: slugs.ticketMessages,
          id: messageId,
          depth: 1,
          overrideAccess: true
        });
        if (!message) {
          return Response.json({ error: "Message not found" }, { status: 404 });
        }
        const sourceTicket = typeof message.ticket === "object" ? message.ticket : null;
        if (!sourceTicket) {
          return Response.json({ error: "Cannot resolve source ticket" }, { status: 400 });
        }
        const clientId = typeof sourceTicket.client === "object" ? sourceTicket.client.id : sourceTicket.client;
        const newTicket = await payload.create({
          collection: slugs.tickets,
          data: {
            subject: subject || `Split: ${sourceTicket.subject}`,
            client: clientId,
            status: "open",
            priority: sourceTicket.priority || "normal",
            category: sourceTicket.category || "question",
            source: sourceTicket.source || "portal",
            relatedTickets: [sourceTicket.id]
          },
          overrideAccess: true
        });
        const attachments = message.attachments?.map((a) => ({
          file: typeof a.file === "object" ? a.file.id : a.file
        })) || [];
        await payload.create({
          collection: slugs.ticketMessages,
          data: {
            ticket: newTicket.id,
            body: message.body,
            bodyHtml: message.bodyHtml || void 0,
            authorType: message.authorType,
            authorClient: typeof message.authorClient === "object" ? message.authorClient?.id : message.authorClient,
            isInternal: false,
            skipNotification: true,
            ...attachments.length > 0 && { attachments }
          },
          overrideAccess: true
        });
        await payload.create({
          collection: slugs.ticketMessages,
          data: {
            ticket: sourceTicket.id,
            body: `Message extrait vers le ticket ${newTicket.ticketNumber}`,
            authorType: "admin",
            isInternal: true,
            skipNotification: true
          },
          overrideAccess: true
        });
        const existingRelated = Array.isArray(sourceTicket.relatedTickets) ? sourceTicket.relatedTickets.map((t) => typeof t === "object" ? t.id : t) : [];
        if (!existingRelated.includes(newTicket.id)) {
          await payload.update({
            collection: slugs.tickets,
            id: sourceTicket.id,
            data: { relatedTickets: [...existingRelated, newTicket.id] },
            overrideAccess: true
          });
        }
        await payload.create({
          collection: slugs.ticketActivityLog,
          data: {
            ticket: sourceTicket.id,
            action: "split",
            detail: `Message extrait vers ${newTicket.ticketNumber}`,
            actorType: "admin",
            actorEmail: req.user.email
          },
          overrideAccess: true
        });
        return Response.json({
          ticketId: newTicket.id,
          ticketNumber: newTicket.ticketNumber
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[split-ticket] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/typing.ts
var typingState = /* @__PURE__ */ new Map();
var TYPING_TTL = 5e3;
function cleanExpired(ticketId) {
  const state = typingState.get(ticketId);
  if (!state) return;
  const now = Date.now();
  if (state.admin && now - state.admin > TYPING_TTL) {
    state.admin = void 0;
    state.adminName = void 0;
  }
  if (state.client && now - state.client > TYPING_TTL) {
    state.client = void 0;
    state.clientName = void 0;
  }
  if (!state.admin && !state.client) typingState.delete(ticketId);
}
function createTypingPostEndpoint(slugs) {
  return {
    path: "/support/typing",
    method: "post",
    handler: async (req) => {
      try {
        if (!req.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { ticketId } = await req.json();
        if (!ticketId) {
          return Response.json({ error: "ticketId required" }, { status: 400 });
        }
        const key = String(ticketId);
        const state = typingState.get(key) || {};
        if (req.user.collection === slugs.users) {
          state.admin = Date.now();
          state.adminName = req.user.firstName || "Support";
        } else {
          state.client = Date.now();
          state.clientName = req.user.firstName || "Client";
        }
        typingState.set(key, state);
        return Response.json({ ok: true });
      } catch {
        return Response.json({ error: "Error" }, { status: 500 });
      }
    }
  };
}
function createTypingGetEndpoint(slugs) {
  return {
    path: "/support/typing",
    method: "get",
    handler: async (req) => {
      try {
        if (!req.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const url = new URL(req.url);
        const ticketId = url.searchParams.get("ticketId");
        if (!ticketId) {
          return Response.json({ error: "ticketId required" }, { status: 400 });
        }
        cleanExpired(ticketId);
        const state = typingState.get(ticketId);
        if (req.user.collection === slugs.users) {
          return Response.json({
            typing: !!state?.client,
            name: state?.clientName || null
          });
        } else {
          return Response.json({
            typing: !!state?.admin,
            name: state?.adminName || null
          });
        }
      } catch {
        return Response.json({ typing: false, name: null });
      }
    }
  };
}

// src/endpoints/presence.ts
var presenceState = /* @__PURE__ */ new Map();
var PRESENCE_TTL = 3e4;
function cleanExpired2(ticketId) {
  const viewers = presenceState.get(ticketId);
  if (!viewers) return;
  const now = Date.now();
  for (const [userId, entry] of viewers) {
    if (now - entry.ts > PRESENCE_TTL) {
      viewers.delete(userId);
    }
  }
  if (viewers.size === 0) presenceState.delete(ticketId);
}
function createPresencePostEndpoint(slugs) {
  return {
    path: "/support/presence",
    method: "post",
    handler: async (req) => {
      try {
        requireAdmin(req, slugs);
        const { ticketId, action } = await req.json();
        if (!ticketId || !action) {
          return Response.json({ error: "ticketId and action required" }, { status: 400 });
        }
        const key = String(ticketId);
        if (action === "join") {
          if (!presenceState.has(key)) {
            presenceState.set(key, /* @__PURE__ */ new Map());
          }
          presenceState.get(key).set(req.user.id, {
            name: req.user.firstName || req.user.email || "Admin",
            email: req.user.email || "",
            ts: Date.now()
          });
        } else if (action === "leave") {
          presenceState.get(key)?.delete(req.user.id);
          if (presenceState.get(key)?.size === 0) presenceState.delete(key);
        }
        return Response.json({ ok: true });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.warn("[presence] POST error:", error);
        return Response.json({ error: "Error" }, { status: 500 });
      }
    }
  };
}
function createPresenceGetEndpoint(slugs) {
  return {
    path: "/support/presence",
    method: "get",
    handler: async (req) => {
      try {
        requireAdmin(req, slugs);
        const url = new URL(req.url);
        const ticketId = url.searchParams.get("ticketId");
        if (!ticketId) {
          return Response.json({ error: "ticketId required" }, { status: 400 });
        }
        cleanExpired2(ticketId);
        const viewers = presenceState.get(ticketId);
        if (!viewers || viewers.size === 0) {
          return Response.json({ viewers: [] });
        }
        const result = [];
        for (const [userId, entry] of viewers) {
          if (userId !== req.user.id) {
            result.push({ name: entry.name, email: entry.email });
          }
        }
        return Response.json({ viewers: result });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        return Response.json({ viewers: [] });
      }
    }
  };
}

// src/endpoints/settings.ts
var PREF_KEY2 = "support-settings";
var DEFAULT_SUPPORT_SETTINGS = {
  email: { fromAddress: "", fromName: "Support", replyToAddress: "" },
  ai: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    enableSentiment: true,
    enableSynthesis: true,
    enableSuggestion: true,
    enableRewrite: true
  },
  sla: {
    firstResponseMinutes: 120,
    resolutionMinutes: 1440,
    businessHoursOnly: true,
    escalationEmail: ""
  },
  autoClose: { enabled: true, daysBeforeClose: 7, reminderDaysBefore: 2 }
};
function createSettingsGetEndpoint(slugs) {
  return {
    path: "/support/settings",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const prefs = await payload.find({
          collection: "payload-preferences",
          where: { key: { equals: PREF_KEY2 } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        let settings = { ...DEFAULT_SUPPORT_SETTINGS };
        if (prefs.docs.length > 0) {
          const stored = prefs.docs[0].value;
          settings = {
            email: { ...DEFAULT_SUPPORT_SETTINGS.email, ...stored.email },
            ai: { ...DEFAULT_SUPPORT_SETTINGS.ai, ...stored.ai },
            sla: { ...DEFAULT_SUPPORT_SETTINGS.sla, ...stored.sla },
            autoClose: { ...DEFAULT_SUPPORT_SETTINGS.autoClose, ...stored.autoClose }
          };
        }
        return Response.json(settings);
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.warn("[support/settings] GET error:", error);
        return Response.json({ error: "Error" }, { status: 500 });
      }
    }
  };
}
function createSettingsPostEndpoint(slugs) {
  return {
    path: "/support/settings",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const body = await req.json();
        const merged = {
          email: { ...DEFAULT_SUPPORT_SETTINGS.email, ...body.email },
          ai: { ...DEFAULT_SUPPORT_SETTINGS.ai, ...body.ai },
          sla: { ...DEFAULT_SUPPORT_SETTINGS.sla, ...body.sla },
          autoClose: { ...DEFAULT_SUPPORT_SETTINGS.autoClose, ...body.autoClose }
        };
        await payload.db.upsert({
          collection: "payload-preferences",
          data: {
            key: PREF_KEY2,
            user: { relationTo: req.user.collection, value: req.user.id },
            value: merged
          },
          req: { payload, user: req.user },
          where: {
            and: [
              { key: { equals: PREF_KEY2 } },
              { "user.value": { equals: req.user.id } },
              { "user.relationTo": { equals: req.user.collection } }
            ]
          }
        });
        return Response.json(merged);
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[support/settings] Error saving settings:", error);
        return Response.json({ error: "Error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/signature.ts
var PREF_KEY3 = "email-signature";
function createSignatureGetEndpoint(slugs) {
  return {
    path: "/support/signature",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const prefs = await payload.find({
          collection: "payload-preferences",
          where: { key: { equals: `${PREF_KEY3}-${req.user.id}` } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        const signature = prefs.docs.length > 0 ? prefs.docs[0].value?.signature || "" : "";
        return Response.json({ signature });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[signature] GET error:", error);
        return Response.json({ signature: "" });
      }
    }
  };
}
function createSignaturePostEndpoint(slugs) {
  return {
    path: "/support/signature",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const { signature } = await req.json();
        const key = `${PREF_KEY3}-${req.user.id}`;
        const existing = await payload.find({
          collection: "payload-preferences",
          where: { key: { equals: key } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        await payload.db.upsert({
          collection: "payload-preferences",
          data: {
            key,
            user: { relationTo: req.user.collection, value: req.user.id },
            value: { signature: signature || "" }
          },
          req: { payload, user: req.user },
          where: {
            and: [
              { key: { equals: key } },
              { "user.value": { equals: req.user.id } },
              { "user.relationTo": { equals: req.user.collection } }
            ]
          }
        });
        return Response.json({ signature: signature || "" });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[signature] POST error:", error);
        return Response.json({ error: "Error saving signature" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/round-robin-config.ts
var PREF_KEY4 = "support-round-robin";
function createRoundRobinConfigGetEndpoint(slugs) {
  return {
    path: "/support/round-robin-config",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const prefs = await payload.find({
          collection: "payload-preferences",
          where: { key: { equals: PREF_KEY4 } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        const enabled = prefs.docs.length > 0 ? prefs.docs[0].value?.enabled === true : false;
        return Response.json({ enabled });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.warn("[round-robin-config] GET error:", error);
        return Response.json({ error: "Error" }, { status: 500 });
      }
    }
  };
}
function createRoundRobinConfigPostEndpoint(slugs) {
  return {
    path: "/support/round-robin-config",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const { enabled } = await req.json();
        const existing = await payload.find({
          collection: "payload-preferences",
          where: { key: { equals: PREF_KEY4 } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        await payload.db.upsert({
          collection: "payload-preferences",
          data: {
            key: PREF_KEY4,
            user: { relationTo: req.user.collection, value: req.user.id },
            value: { enabled: !!enabled }
          },
          req: { payload, user: req.user },
          where: {
            and: [
              { key: { equals: PREF_KEY4 } },
              { "user.value": { equals: req.user.id } },
              { "user.relationTo": { equals: req.user.collection } }
            ]
          }
        });
        return Response.json({ enabled: !!enabled });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[round-robin-config] POST error:", error);
        return Response.json({ error: "Error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/sla-check.ts
function createSlaCheckEndpoint(slugs) {
  return {
    path: "/support/sla-check",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const now = /* @__PURE__ */ new Date();
        const nowISO = now.toISOString();
        const { docs: tickets } = await payload.find({
          collection: slugs.tickets,
          where: {
            and: [
              { status: { in: ["open", "waiting_client"] } },
              {
                or: [
                  { slaFirstResponseDue: { exists: true } },
                  { slaResolutionDue: { exists: true } }
                ]
              }
            ]
          },
          limit: 500,
          depth: 1,
          overrideAccess: true,
          select: {
            ticketNumber: true,
            subject: true,
            status: true,
            priority: true,
            client: true,
            assignedTo: true,
            slaPolicy: true,
            slaFirstResponseDue: true,
            slaResolutionDue: true,
            slaFirstResponseBreached: true,
            slaResolutionBreached: true,
            firstResponseAt: true,
            createdAt: true
          }
        });
        const breached = [];
        const atRisk = [];
        for (const ticket of tickets) {
          const t = ticket;
          const ticketData = {
            id: t.id,
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            client: t.client,
            assignedTo: t.assignedTo,
            createdAt: t.createdAt,
            breachTypes: [],
            riskTypes: []
          };
          if (t.slaFirstResponseDue && !t.firstResponseAt) {
            const deadline = new Date(t.slaFirstResponseDue);
            if (now > deadline) {
              ticketData.breachTypes.push("first_response");
            } else {
              const created = new Date(t.createdAt);
              const totalWindow = deadline.getTime() - created.getTime();
              const elapsed = now.getTime() - created.getTime();
              if (totalWindow > 0 && elapsed / totalWindow >= 0.8) {
                ticketData.riskTypes.push("first_response");
              }
            }
          }
          if (t.slaResolutionDue) {
            const deadline = new Date(t.slaResolutionDue);
            if (now > deadline) {
              ticketData.breachTypes.push("resolution");
            } else {
              const created = new Date(t.createdAt);
              const totalWindow = deadline.getTime() - created.getTime();
              const elapsed = now.getTime() - created.getTime();
              if (totalWindow > 0 && elapsed / totalWindow >= 0.8) {
                ticketData.riskTypes.push("resolution");
              }
            }
          }
          if (ticketData.breachTypes.length > 0) {
            breached.push(ticketData);
          } else if (ticketData.riskTypes.length > 0) {
            atRisk.push(ticketData);
          }
        }
        return new Response(JSON.stringify({ breached, atRisk, checkedAt: nowISO, totalChecked: tickets.length }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=60, stale-while-revalidate=120"
          }
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[sla-check] Error:", error);
        return Response.json({ error: "Internal error" }, { status: 500 });
      }
    }
  };
}

// src/utils/emailTemplate.ts
var DEFAULT_CONFIG = {
  brandName: "Support",
  brandColor: "#00E5FF",
  secondaryColor: "#FFD600",
  accentColor: "#FF8A00",
  logoUrl: "",
  supportEmail: process.env.SUPPORT_EMAIL || "",
  websiteUrl: process.env.NEXT_PUBLIC_SERVER_URL || "",
  phone: "",
  location: "",
  brandInitials: ""
};
function resolveConfig(config) {
  return { ...DEFAULT_CONFIG, ...config };
}
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function emailTrackingPixel(ticketId, messageId, baseUrl) {
  const url = process.env.NEXT_PUBLIC_SERVER_URL || "";
  const params = `t=${ticketId}${messageId ? `&m=${messageId}` : ""}`;
  return `<img src="${url}/api/support/track-open?${params}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
}
function emailRichContent(html, config) {
  const c = resolveConfig(config);
  const baseUrl = c.websiteUrl;
  function styleTag(input, tag, style) {
    const regex = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");
    return input.replace(regex, (_match, attrs) => {
      const cleanAttrs = (attrs || "").replace(/\s*style="[^"]*"/g, "");
      return `<${tag}${cleanAttrs} style="${style}">`;
    });
  }
  function convertFencedCodeBlocks(input) {
    if (!input.includes("```")) return input;
    const normalized = input.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div)>\s*<(p|div)[^>]*>/gi, "\n").replace(/<(p|div)[^>]*>/gi, "").replace(/<\/(p|div)>/gi, "\n");
    const codeBlocks = [];
    const withMarkers = normalized.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
      codeBlocks.push(renderCodeBlockHtml(lang || "", code || ""));
      return `\0CODEBLOCK_${codeBlocks.length - 1}\0`;
    });
    return withMarkers.split(/(\x00CODEBLOCK_\d+\x00)/g).map((chunk) => {
      const markerMatch = chunk.match(/^\x00CODEBLOCK_(\d+)\x00$/);
      if (markerMatch) return codeBlocks[parseInt(markerMatch[1], 10)];
      return chunk.split("\n").map((line) => line.trim() ? `<p>${line}</p>` : "").join("");
    }).join("");
  }
  let result = html.replace(/src="\/([^"]+)"/g, `src="${baseUrl}/$1"`);
  result = convertFencedCodeBlocks(result);
  result = styleTag(result, "blockquote", `border-left: 4px solid ${c.brandColor}; margin: 16px 0; padding: 12px 20px; background: #f0f9fa; border-radius: 0 8px 8px 0;`);
  result = styleTag(result, "img", "max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; display: block;");
  result = styleTag(result, "a", `color: ${c.brandColor}; text-decoration: underline; font-weight: 600;`);
  result = styleTag(result, "ul", "margin: 8px 0; padding-left: 24px;");
  result = styleTag(result, "ol", "margin: 8px 0; padding-left: 24px;");
  result = styleTag(result, "li", "margin: 4px 0; line-height: 1.6;");
  result = styleTag(result, "p", "margin: 0 0 12px 0; line-height: 1.75; font-size: 15px; color: #1f2937;");
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "").replace(/\bon\w+\s*=\s*"[^"]*"/gi, "").replace(/\bon\w+\s*=\s*'[^']*'/gi, "").replace(/javascript:/gi, "");
  return `<div style="font-size: 15px; line-height: 1.75; color: #1f2937;">${result}</div>`;
}
function getButtonColors(config) {
  return {
    primary: { bg: config.brandColor, text: "#000000", border: "#000000" },
    secondary: { bg: config.secondaryColor, text: "#000000", border: "#000000" },
    dark: { bg: "#000000", text: "#FFFFFF", border: "#000000" }
  };
}
function emailButton(text, url, color = "primary", config) {
  const c = resolveConfig(config);
  const colors = getButtonColors(c);
  const bc = colors[color];
  return `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${url}" style="display: inline-block; padding: 16px 40px; background: ${bc.bg}; color: ${bc.text}; font-weight: 800; font-size: 15px; text-decoration: none; border-radius: 10px; border: 2px solid ${bc.border}; letter-spacing: 0.02em;">
        ${text}
      </a>
    </div>
  `;
}
function renderCodeBlockHtml(lang, code) {
  const cleanCode = escapeHtml(code.replace(/\n$/, ""));
  const label = lang ? lang.trim() : "code";
  return `<div style="margin: 12px 0; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden; background: #0f172a;">
    <div style="padding: 6px 14px; background: #1e293b; border-bottom: 1px solid #334155; font-family: 'SF Mono', 'Fira Code', Consolas, monospace; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(label)}</div>
    <pre style="margin: 0; padding: 14px 16px; overflow-x: auto; background: #0f172a; color: #e2e8f0; font-family: 'SF Mono', 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.6; white-space: pre;"><code style="background: transparent; padding: 0; color: inherit; font-family: inherit; font-size: inherit;">${cleanCode}</code></pre>
  </div>`;
}
function emailQuote(content, borderColor, config) {
  const c = resolveConfig(config);
  const color = borderColor || c.brandColor;
  if (content && content.includes("```")) {
    const parts = [];
    const regex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        parts.push(`<p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.75; color: #333333; white-space: pre-wrap;">${escapeHtml(textBefore)}</p>`);
      }
      parts.push(renderCodeBlockHtml(match[1] || "", match[2] || ""));
      lastIndex = match.index + match[0].length;
    }
    const textAfter = content.slice(lastIndex).trim();
    if (textAfter) {
      parts.push(`<p style="margin: 12px 0 0 0; font-size: 15px; line-height: 1.75; color: #333333; white-space: pre-wrap;">${escapeHtml(textAfter)}</p>`);
    }
    return `
      <div style="margin: 24px 0; padding: 20px 24px; background: #f8f9fa; border-left: 4px solid ${color}; border-radius: 0 8px 8px 0;">
        ${parts.join("")}
      </div>
    `;
  }
  return `
    <div style="margin: 24px 0; padding: 20px 24px; background: #f8f9fa; border-left: 4px solid ${color}; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 15px; line-height: 1.75; color: #333333; white-space: pre-wrap;">${escapeHtml(content)}</p>
    </div>
  `;
}
function emailParagraph(text) {
  return `<p style="margin: 0 0 18px 0; font-size: 15px; line-height: 1.75; color: #1f2937;">${text}</p>`;
}
function emailFooter(config) {
  const logoHtml = config.logoUrl ? `<a href="${config.websiteUrl}">
            <img src="${config.logoUrl}" alt="${escapeHtml(config.brandName)}" width="100" height="47" style="display: block; border: 0;" />
          </a>` : `<a href="${config.websiteUrl}" style="font-size: 18px; font-weight: 900; color: #000000; text-decoration: none;">${escapeHtml(config.brandName)}</a>`;
  const contactParts = [];
  if (config.supportEmail) {
    contactParts.push(`<a href="mailto:${config.supportEmail}" style="color: #555555; text-decoration: none;">${config.supportEmail}</a>`);
  }
  if (config.phone) {
    contactParts.push(`<a href="tel:${config.phone.replace(/\s/g, "")}" style="color: #555555; text-decoration: none;">${config.phone}</a>`);
  }
  const locationParts = [];
  if (config.websiteUrl) {
    const displayUrl = config.websiteUrl.replace(/^https?:\/\//, "");
    locationParts.push(`<a href="${config.websiteUrl}" style="color: ${config.brandColor}; text-decoration: none; font-weight: 600;">${displayUrl}</a>`);
  }
  if (config.location) {
    locationParts.push(config.location);
  }
  const unsubscribeHtml = config.supportEmail ? `<p style="margin: 8px 0 0 0; font-size: 11px; color: #aaaaaa; line-height: 1.4;">
            <a href="mailto:${config.supportEmail}?subject=Unsubscribe" style="color: #aaaaaa; text-decoration: underline;">Se d&eacute;sinscrire</a>
          </p>` : "";
  return `
    <!-- Spacer -->
    <div style="height: 24px;"></div>

    <!-- Tricolor separator -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
      <tr>
        <td width="50%" height="3" bgcolor="${config.brandColor}" style="font-size:1px;line-height:1px;">&nbsp;</td>
        <td width="25%" height="3" bgcolor="${config.secondaryColor}" style="font-size:1px;line-height:1px;">&nbsp;</td>
        <td width="25%" height="3" bgcolor="${config.accentColor}" style="font-size:1px;line-height:1px;">&nbsp;</td>
      </tr>
    </table>

    <!-- Footer -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td width="120" valign="top" style="padding-right: 16px;">
          ${logoHtml}
        </td>
        <td valign="top">
          <p style="margin: 0; font-size: 14px; font-weight: 800; color: #000000; letter-spacing: 0.01em;">${escapeHtml(config.brandName)}</p>
          ${contactParts.length > 0 ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #555555; line-height: 1.5;">${contactParts.join(" &nbsp;&middot;&nbsp; ")}</p>` : ""}
          ${locationParts.length > 0 ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #888888; line-height: 1.4;">${locationParts.join(" &nbsp;&middot;&nbsp; ")}</p>` : ""}
          ${unsubscribeHtml}
        </td>
      </tr>
    </table>
  `;
}
function emailWrapper(title, body, options = {}, config) {
  const c = resolveConfig(config);
  const { headerColor = "primary", preheader } = options;
  const headerBg = headerColor === "secondary" ? c.secondaryColor : c.brandColor;
  const badgeHtml = c.brandInitials ? `<td width="48" align="right" valign="middle">
                    <div style="width: 36px; height: 36px; border-radius: 8px; background: #000; display: inline-block; text-align: center; line-height: 36px;">
                      <span style="color: #fff; font-weight: 900; font-size: 14px; letter-spacing: 0.05em;">${escapeHtml(c.brandInitials)}</span>
                    </div>
                  </td>` : "";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escapeHtml(preheader)}</div>` : ""}

  <!-- Outer wrapper -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f0f0f0; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main container \u2014 wider (660px) -->
        <table cellpadding="0" cellspacing="0" border="0" width="660" style="max-width: 660px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: ${headerBg}; padding: 32px 40px; border-radius: 12px 12px 0 0; border: 2px solid #000000; border-bottom: none;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #000000; font-size: 22px; font-weight: 800; line-height: 1.3; letter-spacing: -0.01em;">
                      ${escapeHtml(title)}
                    </h1>
                  </td>
                  ${badgeHtml}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background: #ffffff; padding: 40px; border: 2px solid #000000; border-top: none; border-radius: 0 0 12px 12px;">
              ${body}
              ${emailFooter(c)}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// src/endpoints/auto-close.ts
function createAutoCloseEndpoint(slugs) {
  return {
    path: "/support/auto-close",
    method: "get",
    handler: async (req) => {
      const secret = req.headers.get("x-cron-secret");
      const expectedSecret = process.env.CRON_SECRET;
      if (!expectedSecret || secret !== expectedSecret) {
        return Response.json({ error: "Non autoris\xE9" }, { status: 401 });
      }
      try {
        const payload = req.payload;
        const now = /* @__PURE__ */ new Date();
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
        const settings = await readSupportSettings(payload);
        if (!settings.autoClose.enabled) {
          return Response.json({ success: true, skipped: true, reason: "auto-close disabled in settings" });
        }
        const url = new URL(req.url);
        const totalDaysParam = url.searchParams.get("days");
        const totalDays = totalDaysParam ? parseInt(totalDaysParam, 10) : settings.autoClose.daysBeforeClose;
        const REMIND_AFTER_DAYS = Math.max(1, totalDays - settings.autoClose.reminderDaysBefore);
        const CLOSE_AFTER_REMIND_DAYS = settings.autoClose.reminderDaysBefore;
        const results = { reminded: 0, closed: 0, errors: 0 };
        const remindCutoff = new Date(now.getTime() - REMIND_AFTER_DAYS * 24 * 60 * 60 * 1e3);
        const ticketsToRemind = await payload.find({
          collection: slugs.tickets,
          where: {
            and: [
              { status: { equals: "waiting_client" } },
              { autoCloseRemindedAt: { exists: false } },
              { updatedAt: { less_than: remindCutoff.toISOString() } }
            ]
          },
          limit: 50,
          depth: 1,
          overrideAccess: true
        });
        for (const ticket of ticketsToRemind.docs) {
          try {
            const t = ticket;
            const client = typeof t.client === "object" ? t.client : null;
            if (!client?.email) continue;
            const ticketNumber = t.ticketNumber || "TK-????";
            const subject = t.subject || "Support";
            const portalUrl = `${baseUrl}/support/tickets/${t.id}`;
            await payload.sendEmail({
              to: client.email,
              replyTo: settings.email.replyToAddress || process.env.SUPPORT_REPLY_TO || "",
              subject: `Rappel : [${ticketNumber}] ${subject} \u2014 En attente de votre r\xE9ponse`,
              html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                <p>Bonjour <strong>${escapeHtml(client.firstName || "")}</strong>,</p>
                <p>Votre ticket <strong>${escapeHtml(ticketNumber)}</strong> \u2014 <em>${escapeHtml(subject)}</em> \u2014 est en attente de votre r\xE9ponse depuis ${REMIND_AFTER_DAYS} jours.</p>
                <p>Si le probl\xE8me est r\xE9solu ou si vous n'avez plus besoin d'assistance, ce ticket sera automatiquement marqu\xE9 comme r\xE9solu dans 2 jours.</p>
                <p><a href="${portalUrl}">R\xE9pondre au ticket</a></p>
              </div>`
            });
            await payload.update({
              collection: slugs.tickets,
              id: t.id,
              data: { autoCloseRemindedAt: now.toISOString() },
              overrideAccess: true
            });
            results.reminded++;
          } catch (err) {
            console.error(`[auto-close] Error reminding ticket ${ticket.id}:`, err);
            results.errors++;
          }
        }
        const closeCutoff = new Date(now.getTime() - CLOSE_AFTER_REMIND_DAYS * 24 * 60 * 60 * 1e3);
        const ticketsToClose = await payload.find({
          collection: slugs.tickets,
          where: {
            and: [
              { status: { equals: "waiting_client" } },
              { autoCloseRemindedAt: { less_than: closeCutoff.toISOString() } },
              {
                or: [
                  { lastClientMessageAt: { exists: false } },
                  { lastClientMessageAt: { less_than_equal: closeCutoff.toISOString() } }
                ]
              }
            ]
          },
          limit: 50,
          depth: 1,
          overrideAccess: true
        });
        for (const ticket of ticketsToClose.docs) {
          try {
            const t = ticket;
            const client = typeof t.client === "object" ? t.client : null;
            const ticketNumber = t.ticketNumber || "TK-????";
            const subject = t.subject || "Support";
            const closeTotalDays = REMIND_AFTER_DAYS + CLOSE_AFTER_REMIND_DAYS;
            await payload.create({
              collection: slugs.ticketMessages,
              data: {
                ticket: t.id,
                body: `Ticket r\xE9solu automatiquement \u2014 sans r\xE9ponse client depuis ${closeTotalDays} jours`,
                authorType: "admin",
                isInternal: true,
                skipNotification: true
              },
              overrideAccess: true
            });
            await payload.update({
              collection: slugs.tickets,
              id: t.id,
              data: { status: "resolved" },
              overrideAccess: true
            });
            if (client?.email) {
              const portalUrl = `${baseUrl}/support/tickets/${t.id}`;
              await payload.sendEmail({
                to: client.email,
                replyTo: settings.email.replyToAddress || process.env.SUPPORT_REPLY_TO || "",
                subject: `[${ticketNumber}] Ticket r\xE9solu \u2014 ${subject}`,
                html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                  <p>Bonjour <strong>${escapeHtml(client.firstName || "")}</strong>,</p>
                  <p>Votre ticket <strong>${escapeHtml(ticketNumber)}</strong> \u2014 <em>${escapeHtml(subject)}</em> \u2014 a \xE9t\xE9 r\xE9solu automatiquement apr\xE8s ${closeTotalDays} jours sans r\xE9ponse.</p>
                  <p>Si vous avez encore besoin d'aide, n'h\xE9sitez pas \xE0 rouvrir ce ticket ou \xE0 en cr\xE9er un nouveau.</p>
                  <p><a href="${portalUrl}">Consulter le ticket</a></p>
                </div>`
              });
            }
            results.closed++;
          } catch (err) {
            console.error(`[auto-close] Error closing ticket ${ticket.id}:`, err);
            results.errors++;
          }
        }
        return Response.json({
          success: true,
          ...results,
          timestamp: now.toISOString()
        });
      } catch (error) {
        console.error("[auto-close] Error:", error);
        return Response.json({ error: "Erreur interne" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/statuses.ts
function createStatusesEndpoint(slugs) {
  return {
    path: "/support/statuses",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        if (!req.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { docs } = await payload.find({
          collection: slugs.ticketStatuses,
          sort: "sortOrder",
          limit: 100,
          depth: 0,
          overrideAccess: true
        });
        return Response.json({
          statuses: docs.map((s) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            color: s.color,
            type: s.type,
            isDefault: s.isDefault,
            sortOrder: s.sortOrder
          }))
        });
      } catch (error) {
        console.error("[statuses] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/apply-macro.ts
function createApplyMacroEndpoint(slugs) {
  return {
    path: "/support/apply-macro",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const body = await req.json();
        const { macroId, ticketId } = body;
        if (!macroId || !ticketId) {
          return Response.json({ error: "macroId and ticketId are required" }, { status: 400 });
        }
        const macro = await payload.findByID({
          collection: slugs.macros,
          id: macroId,
          depth: 0,
          overrideAccess: true
        });
        if (!macro) return Response.json({ error: "Macro not found" }, { status: 404 });
        if (!macro.isActive) return Response.json({ error: "Macro is disabled" }, { status: 400 });
        const ticket = await payload.findByID({
          collection: slugs.tickets,
          id: ticketId,
          depth: 0,
          overrideAccess: true
        });
        if (!ticket) return Response.json({ error: "Ticket not found" }, { status: 404 });
        const appliedActions = [];
        const actions = macro.actions || [];
        for (const action of actions) {
          try {
            switch (action.type) {
              case "set_status":
                await payload.update({
                  collection: slugs.tickets,
                  id: ticketId,
                  data: { status: action.value },
                  overrideAccess: true
                });
                appliedActions.push({ type: action.type, value: action.value, success: true });
                break;
              case "set_priority":
                await payload.update({
                  collection: slugs.tickets,
                  id: ticketId,
                  data: { priority: action.value },
                  overrideAccess: true
                });
                appliedActions.push({ type: action.type, value: action.value, success: true });
                break;
              case "add_tag": {
                const currentTags = Array.isArray(ticket.tags) ? [...ticket.tags] : [];
                if (!currentTags.includes(action.value)) {
                  currentTags.push(action.value);
                }
                await payload.update({
                  collection: slugs.tickets,
                  id: ticketId,
                  data: { tags: currentTags },
                  overrideAccess: true
                });
                appliedActions.push({ type: action.type, value: action.value, success: true });
                break;
              }
              case "send_reply":
                await payload.create({
                  collection: slugs.ticketMessages,
                  data: {
                    ticket: ticketId,
                    body: action.value,
                    authorType: "admin",
                    isInternal: false
                  },
                  overrideAccess: true
                });
                appliedActions.push({ type: action.type, value: action.value, success: true });
                break;
              case "assign": {
                const userId = parseInt(action.value, 10);
                if (isNaN(userId)) {
                  appliedActions.push({ type: action.type, value: action.value, success: false, error: "Invalid user ID" });
                  break;
                }
                await payload.update({
                  collection: slugs.tickets,
                  id: ticketId,
                  data: { assignedTo: userId },
                  overrideAccess: true
                });
                appliedActions.push({ type: action.type, value: action.value, success: true });
                break;
              }
              default:
                appliedActions.push({ type: action.type, value: action.value, success: false, error: "Unknown action type" });
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            appliedActions.push({ type: action.type, value: action.value, success: false, error: errorMsg });
          }
        }
        return Response.json({
          applied: true,
          macroName: macro.name,
          ticketId,
          actions: appliedActions
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[apply-macro] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/purge-logs.ts
function createPurgeLogsEndpoint(slugs) {
  return {
    path: "/support/purge-logs",
    method: "delete",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const url = new URL(req.url);
        const collection = url.searchParams.get("collection");
        const days = Number(url.searchParams.get("days") || "0");
        const allowedCollections = {
          "email-logs": slugs.emailLogs,
          "auth-logs": slugs.authLogs
        };
        if (!collection || !allowedCollections[collection]) {
          return Response.json({ error: "Invalid collection. Use email-logs or auth-logs." }, { status: 400 });
        }
        const cutoff = days > 0 ? new Date(Date.now() - days * 864e5).toISOString() : null;
        const result = await payload.delete({
          collection: allowedCollections[collection],
          where: cutoff ? { createdAt: { less_than: cutoff } } : { id: { exists: true } },
          overrideAccess: true
        });
        const count = Array.isArray(result.docs) ? result.docs.length : 0;
        return Response.json({
          purged: count,
          collection,
          days: days || "all"
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[purge-logs] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/utils/rateLimiter.ts
var RateLimiter = class {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    const timer = setInterval(() => this.cleanup(), windowMs);
    timer.unref();
  }
  windowMs;
  maxRequests;
  store = /* @__PURE__ */ new Map();
  /**
   * Check if a key has exceeded the rate limit.
   * Returns true if the request should be blocked.
   */
  check(key) {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return false;
    }
    entry.count++;
    return entry.count > this.maxRequests;
  }
  /**
   * Reset the counter for a specific key.
   */
  reset(key) {
    this.store.delete(key);
  }
  /**
   * Remove expired entries from the store.
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
};

// src/endpoints/chatbot.ts
var chatbotLimiter = new RateLimiter(6e4, 10);
function createChatbotEndpoint(slugs) {
  return {
    path: "/support/chatbot",
    method: "post",
    handler: async (req) => {
      try {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
        if (chatbotLimiter.check(ip)) {
          return Response.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
        }
        let body;
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const { question } = body;
        if (!question?.trim() || question.trim().length < 5) {
          return Response.json({ error: "Question too short" }, { status: 400 });
        }
        const payload = req.payload;
        const articles = await payload.find({
          collection: slugs.knowledgeBase,
          where: { published: { equals: true } },
          limit: 100,
          depth: 0,
          overrideAccess: true
        });
        if (articles.docs.length === 0) {
          return Response.json({
            answer: null,
            confidence: 0,
            suggestion: "create_ticket",
            message: "Aucun article disponible. Cr\xE9ez un ticket pour obtenir de l'aide."
          });
        }
        const knowledgeContext = articles.docs.map((a) => `## ${a.title}
${JSON.stringify(a.body || "").slice(0, 500)}`).join("\n\n---\n\n");
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return Response.json({
            answer: null,
            confidence: 0,
            suggestion: "create_ticket",
            message: "Le chatbot IA n'est pas configur\xE9."
          });
        }
        const Anthropic = __require("@anthropic-ai/sdk").default;
        const anthropic = new Anthropic({ apiKey });
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `Tu es un assistant de support. Tu dois r\xE9pondre \xE0 la question du client en utilisant UNIQUEMENT les articles de la base de connaissances ci-dessous. Si la r\xE9ponse n'est pas dans la base, dis-le clairement.

BASE DE CONNAISSANCES :
${knowledgeContext}

QUESTION DU CLIENT :
${question}

R\xE9ponds en fran\xE7ais, de mani\xE8re concise et utile. Si tu ne trouves pas la r\xE9ponse dans la base, r\xE9ponds exactement "INCONNU" et rien d'autre.`
            }
          ]
        });
        const answer = response.content[0].type === "text" ? response.content[0].text : "";
        if (answer.trim() === "INCONNU" || answer.trim().length < 10) {
          return Response.json({
            answer: null,
            confidence: 0,
            suggestion: "create_ticket",
            message: "Je n'ai pas trouv\xE9 de r\xE9ponse dans notre base de connaissances. Souhaitez-vous cr\xE9er un ticket de support ?"
          });
        }
        return Response.json({
          answer: answer.trim(),
          confidence: 1,
          suggestion: "resolved",
          message: null
        });
      } catch (error) {
        console.error("[chatbot] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}
var chatSessionLimiter = new RateLimiter(36e5, 5);
var chatMessageLimiter = new RateLimiter(6e4, 15);
function createChatGetEndpoint(slugs) {
  return {
    path: "/support/chat",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireClient(req, slugs);
        const url = new URL(req.url);
        const session = url.searchParams.get("session");
        const after = url.searchParams.get("after");
        if (!session) {
          return Response.json({ error: "Session requise" }, { status: 400 });
        }
        const where = {
          session: { equals: session },
          client: { equals: req.user.id }
        };
        if (after) {
          where.createdAt = { greater_than: after };
        }
        const messages = await payload.find({
          collection: slugs.chatMessages,
          where,
          sort: "createdAt",
          limit: 100,
          depth: 1,
          overrideAccess: true
        });
        return new Response(JSON.stringify({ messages: messages.docs, session }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=300, stale-while-revalidate=600"
          }
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[support/chat] GET Error:", error);
        return Response.json({ error: "Erreur interne du serveur" }, { status: 500 });
      }
    }
  };
}
function createChatPostEndpoint(slugs) {
  return {
    path: "/support/chat",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireClient(req, slugs);
        let body;
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const { action, session, message } = body;
        const userId = String(req.user.id);
        if (action === "start") {
          if (chatSessionLimiter.check(userId)) {
            return Response.json({ error: "Trop de sessions cr\xE9\xE9es. R\xE9essayez plus tard." }, { status: 429 });
          }
          const sessionId = `chat_${crypto3.randomBytes(16).toString("hex")}`;
          const systemMsg = await payload.create({
            collection: slugs.chatMessages,
            data: {
              session: sessionId,
              client: req.user.id,
              senderType: "system",
              message: "Chat d\xE9marr\xE9. Un agent vous r\xE9pondra sous peu.",
              status: "active"
            },
            overrideAccess: true
          });
          return Response.json({ session: sessionId, messages: [systemMsg] });
        }
        if (action === "send" && session && message) {
          if (chatMessageLimiter.check(userId)) {
            return Response.json({ error: "Trop de messages. Attendez un moment." }, { status: 429 });
          }
          const trimmedMessage = String(message).trim();
          if (!trimmedMessage || trimmedMessage.length > 2e3) {
            return Response.json({ error: "Message invalide (1-2000 caract\xE8res)." }, { status: 400 });
          }
          const existing = await payload.find({
            collection: slugs.chatMessages,
            where: { session: { equals: session }, client: { equals: req.user.id } },
            limit: 1,
            overrideAccess: true
          });
          if (existing.docs.length === 0) {
            return Response.json({ error: "Session invalide" }, { status: 403 });
          }
          const newMsg = await payload.create({
            collection: slugs.chatMessages,
            data: {
              session,
              client: req.user.id,
              senderType: "client",
              message: trimmedMessage,
              status: "active"
            },
            overrideAccess: true
          });
          return Response.json({ message: newMsg });
        }
        if (action === "close" && session) {
          const existing = await payload.find({
            collection: slugs.chatMessages,
            where: { session: { equals: session }, client: { equals: req.user.id } },
            limit: 1,
            overrideAccess: true
          });
          if (existing.docs.length === 0) {
            return Response.json({ error: "Session invalide" }, { status: 403 });
          }
          await payload.create({
            collection: slugs.chatMessages,
            data: {
              session,
              client: req.user.id,
              senderType: "system",
              message: "Chat termin\xE9 par le client.",
              status: "closed"
            },
            overrideAccess: true
          });
          return Response.json({ closed: true });
        }
        return Response.json({ error: "Action invalide" }, { status: 400 });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[support/chat] POST Error:", error);
        return Response.json({ error: "Erreur interne du serveur" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/chat-stream.ts
function createChatStreamEndpoint(slugs) {
  return {
    path: "/support/chat-stream",
    method: "get",
    handler: async (req) => {
      try {
        requireClient(req, slugs);
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("session");
      const userId = req.user.id;
      if (!sessionId) {
        return Response.json({ error: "Missing session parameter" }, { status: 400 });
      }
      const existing = await req.payload.find({
        collection: slugs.chatMessages,
        where: {
          session: { equals: sessionId },
          client: { equals: userId }
        },
        limit: 1,
        overrideAccess: true
      });
      if (existing.docs.length === 0) {
        return Response.json({ error: "Session invalide" }, { status: 403 });
      }
      let lastCheck = (/* @__PURE__ */ new Date()).toISOString();
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "connected", session: sessionId })}

`)
          );
          const interval = setInterval(async () => {
            try {
              const messages = await req.payload.find({
                collection: slugs.chatMessages,
                where: {
                  session: { equals: sessionId },
                  createdAt: { greater_than: lastCheck }
                },
                sort: "createdAt",
                limit: 50,
                depth: 1,
                overrideAccess: true
              });
              if (messages.docs.length > 0) {
                const data = JSON.stringify({
                  type: "messages",
                  data: messages.docs
                });
                controller.enqueue(encoder.encode(`data: ${data}

`));
                lastCheck = messages.docs[messages.docs.length - 1].createdAt;
                const lastMsg = messages.docs[messages.docs.length - 1];
                if (lastMsg.status === "closed") {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "closed", session: sessionId })}

`
                    )
                  );
                }
              }
            } catch (error) {
              console.warn("[support] chat-stream SSE poll error:", error);
            }
          }, 2e3);
          const heartbeat = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(`: heartbeat

`));
            } catch {
            }
          }, 3e4);
          req.signal?.addEventListener("abort", () => {
            clearInterval(interval);
            clearInterval(heartbeat);
            try {
              controller.close();
            } catch {
            }
          });
        }
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no"
          // Disable nginx buffering
        }
      });
    }
  };
}

// src/endpoints/admin-chat.ts
var adminChatLimiter = new RateLimiter(6e4, 30);
function createAdminChatGetEndpoint(slugs) {
  return {
    path: "/support/admin-chat",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const url = new URL(req.url);
        const session = url.searchParams.get("session");
        const after = url.searchParams.get("after");
        if (session) {
          const where = { session: { equals: session } };
          if (after) where.createdAt = { greater_than: after };
          const messages = await payload.find({
            collection: slugs.chatMessages,
            where,
            sort: "createdAt",
            limit: 200,
            depth: 1,
            overrideAccess: true
          });
          return new Response(JSON.stringify({ messages: messages.docs, session }), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "private, max-age=300, stale-while-revalidate=600"
            }
          });
        }
        const recentMessages = await payload.find({
          collection: slugs.chatMessages,
          sort: "-createdAt",
          limit: 50,
          depth: 1,
          overrideAccess: true
        });
        const sessionsMap = /* @__PURE__ */ new Map();
        for (const msg of recentMessages.docs) {
          const m = msg;
          const sid = m.session;
          if (!sessionsMap.has(sid)) {
            sessionsMap.set(sid, {
              session: sid,
              client: m.client,
              lastMessage: m.message,
              lastMessageAt: m.createdAt,
              senderType: m.senderType,
              status: m.status || "active",
              messageCount: 0,
              unreadCount: 0
            });
          }
          const s = sessionsMap.get(sid);
          s.messageCount++;
          if (m.senderType === "client") s.unreadCount++;
          else if (m.senderType === "agent") s.unreadCount = 0;
        }
        const sessions = Array.from(sessionsMap.values()).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        const activeSessions = sessions.filter((s) => s.status === "active");
        const closedSessions = sessions.filter((s) => s.status === "closed");
        return new Response(JSON.stringify({ active: activeSessions, closed: closedSessions, totalActive: activeSessions.length }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=300, stale-while-revalidate=600"
          }
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[admin-chat] GET Error:", error);
        return Response.json({ error: "Erreur interne du serveur" }, { status: 500 });
      }
    }
  };
}
function createAdminChatPostEndpoint(slugs) {
  return {
    path: "/support/admin-chat",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        let body;
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const { action, session, message } = body;
        if (!session) {
          return Response.json({ error: "Session requise" }, { status: 400 });
        }
        const sessionMsg = await payload.find({
          collection: slugs.chatMessages,
          where: { session: { equals: session } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        if (sessionMsg.docs.length === 0) {
          return Response.json({ error: "Session introuvable" }, { status: 404 });
        }
        const clientId = typeof sessionMsg.docs[0].client === "object" ? sessionMsg.docs[0].client.id : sessionMsg.docs[0].client;
        if (action === "send" && message) {
          if (adminChatLimiter.check(String(req.user.id))) {
            return Response.json({ error: "Rate limit atteint." }, { status: 429 });
          }
          const trimmedMessage = String(message).trim();
          if (!trimmedMessage || trimmedMessage.length > 2e3) {
            return Response.json({ error: "Message invalide (1-2000 caract\xE8res)." }, { status: 400 });
          }
          const newMsg = await payload.create({
            collection: slugs.chatMessages,
            data: {
              session,
              client: clientId,
              senderType: "agent",
              agent: req.user.id,
              message: trimmedMessage,
              status: "active"
            },
            overrideAccess: true
          });
          try {
            const linkedTicket = await payload.find({
              collection: slugs.tickets,
              where: { chatSession: { equals: session } },
              limit: 1,
              depth: 0,
              overrideAccess: true
            });
            if (linkedTicket.docs.length > 0) {
              const ticketId = linkedTicket.docs[0].id;
              await payload.create({
                collection: slugs.ticketMessages,
                data: {
                  ticket: ticketId,
                  body: trimmedMessage,
                  authorType: "admin",
                  skipNotification: true
                },
                overrideAccess: true
              });
              await payload.update({
                collection: slugs.chatMessages,
                id: newMsg.id,
                data: { ticket: ticketId },
                overrideAccess: true
              });
            }
          } catch (err) {
            console.error("[admin-chat] Failed to link message to ticket:", err);
          }
          return Response.json({ message: newMsg });
        }
        if (action === "close") {
          await payload.create({
            collection: slugs.chatMessages,
            data: {
              session,
              client: clientId,
              senderType: "system",
              message: "Chat termin\xE9 par un agent.",
              status: "closed"
            },
            overrideAccess: true
          });
          try {
            const linkedTicket = await payload.find({
              collection: slugs.tickets,
              where: { chatSession: { equals: session } },
              limit: 1,
              depth: 0,
              overrideAccess: true
            });
            if (linkedTicket.docs.length > 0) {
              await payload.create({
                collection: slugs.ticketMessages,
                data: {
                  ticket: linkedTicket.docs[0].id,
                  body: "Session de chat termin\xE9e par un agent.",
                  authorType: "admin",
                  isInternal: true,
                  skipNotification: true
                },
                overrideAccess: true
              });
            }
          } catch (err) {
            console.error("[admin-chat] Failed to update ticket on close:", err);
          }
          return Response.json({ closed: true });
        }
        return Response.json({ error: "Action invalide" }, { status: 400 });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[admin-chat] POST Error:", error);
        return Response.json({ error: "Erreur interne du serveur" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/admin-chat-stream.ts
function createAdminChatStreamEndpoint(slugs) {
  return {
    path: "/support/admin-chat-stream",
    method: "get",
    handler: async (req) => {
      try {
        requireAdmin(req, slugs);
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("session");
      if (sessionId) {
        return createSessionStream(req, slugs, sessionId);
      }
      return createSessionListStream(req, slugs);
    }
  };
}
function createSessionStream(req, slugs, sessionId) {
  let lastCheck = (/* @__PURE__ */ new Date()).toISOString();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", session: sessionId })}

`
        )
      );
      const interval = setInterval(async () => {
        try {
          const messages = await req.payload.find({
            collection: slugs.chatMessages,
            where: {
              session: { equals: sessionId },
              createdAt: { greater_than: lastCheck }
            },
            sort: "createdAt",
            limit: 50,
            depth: 1,
            overrideAccess: true
          });
          if (messages.docs.length > 0) {
            const data = JSON.stringify({
              type: "messages",
              data: messages.docs
            });
            controller.enqueue(encoder.encode(`data: ${data}

`));
            lastCheck = messages.docs[messages.docs.length - 1].createdAt;
            const lastMsg = messages.docs[messages.docs.length - 1];
            if (lastMsg.status === "closed") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "closed", session: sessionId })}

`
                )
              );
            }
          }
        } catch (error) {
          console.warn("[support] admin-chat-stream SSE poll error:", error);
        }
      }, 2e3);
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat

`));
        } catch {
        }
      }, 3e4);
      req.signal?.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
        }
      });
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
function createSessionListStream(req, slugs) {
  const encoder = new TextEncoder();
  let lastSessionHash = "";
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", mode: "sessions" })}

`)
      );
      const interval = setInterval(async () => {
        try {
          const recentMessages = await req.payload.find({
            collection: slugs.chatMessages,
            sort: "-createdAt",
            limit: 50,
            depth: 1,
            overrideAccess: true
          });
          const sessionsMap = /* @__PURE__ */ new Map();
          for (const msg of recentMessages.docs) {
            const m = msg;
            const sid = m.session;
            if (!sessionsMap.has(sid)) {
              sessionsMap.set(sid, {
                session: sid,
                client: m.client,
                lastMessage: m.message,
                lastMessageAt: m.createdAt,
                senderType: m.senderType,
                status: m.status || "active",
                messageCount: 0,
                unreadCount: 0
              });
            }
            const s = sessionsMap.get(sid);
            s.messageCount++;
            if (m.senderType === "client") s.unreadCount++;
            else if (m.senderType === "agent") s.unreadCount = 0;
          }
          const sessions = Array.from(sessionsMap.values()).sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
          );
          const active = sessions.filter((s) => s.status === "active");
          const closed = sessions.filter((s) => s.status === "closed");
          const hash = JSON.stringify({ active: active.length, closed: closed.length, lastMsg: active[0]?.lastMessageAt });
          if (hash !== lastSessionHash) {
            lastSessionHash = hash;
            const data = JSON.stringify({
              type: "sessions",
              data: { active, closed, totalActive: active.length }
            });
            controller.enqueue(encoder.encode(`data: ${data}

`));
          }
        } catch (error) {
          console.warn("[support] admin-chat-stream sessions SSE error:", error);
        }
      }, 5e3);
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat

`));
        } catch {
        }
      }, 3e4);
      req.signal?.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
        }
      });
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

// src/endpoints/admin-stats.ts
function createAdminStatsEndpoint(slugs) {
  return {
    path: "/support/admin-stats",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const statuses = ["open", "waiting_client", "resolved"];
        const statusCounts = await Promise.all(
          statuses.map(async (status) => {
            const result = await payload.count({
              collection: slugs.tickets,
              where: { status: { equals: status } },
              overrideAccess: true
            });
            return [status, result.totalDocs];
          })
        );
        const byStatus = Object.fromEntries(statusCounts);
        const total = statusCounts.reduce((sum, [, count]) => sum + count, 0);
        const priorities = ["low", "normal", "high", "urgent"];
        const priorityCounts = await Promise.all(
          priorities.map(async (priority) => {
            const result = await payload.count({
              collection: slugs.tickets,
              where: { priority: { equals: priority } },
              overrideAccess: true
            });
            return [priority, result.totalDocs];
          })
        );
        const byPriority = Object.fromEntries(priorityCounts);
        const categories = ["bug", "content", "feature", "question", "hosting"];
        const categoryCounts = await Promise.all(
          categories.map(async (category) => {
            const result = await payload.count({
              collection: slugs.tickets,
              where: { category: { equals: category } },
              overrideAccess: true
            });
            return [category, result.totalDocs];
          })
        );
        const byCategory = Object.fromEntries(
          categoryCounts.filter(([, count]) => count > 0)
        );
        const now = /* @__PURE__ */ new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
        const [created7, created30] = await Promise.all([
          payload.count({
            collection: slugs.tickets,
            where: { createdAt: { greater_than_equal: sevenDaysAgo.toISOString() } },
            overrideAccess: true
          }),
          payload.count({
            collection: slugs.tickets,
            where: { createdAt: { greater_than_equal: thirtyDaysAgo.toISOString() } },
            overrideAccess: true
          })
        ]);
        const PAGE_SIZE2 = 100;
        const MAX_PAGES2 = 50;
        let totalResponseTimeMs = 0;
        let responseTimeCount = 0;
        let totalResolutionTimeMs = 0;
        let resolutionTimeCount = 0;
        let totalTimeMinutes = 0;
        let page = 1;
        let hasMore = true;
        while (hasMore && page <= MAX_PAGES2) {
          const batch = await payload.find({
            collection: slugs.tickets,
            limit: PAGE_SIZE2,
            page,
            depth: 0,
            overrideAccess: true,
            select: {
              firstResponseAt: true,
              resolvedAt: true,
              createdAt: true,
              totalTimeMinutes: true
            }
          });
          for (const t of batch.docs) {
            const doc = t;
            if (doc.firstResponseAt && doc.createdAt) {
              const responseTime = new Date(String(doc.firstResponseAt)).getTime() - new Date(String(doc.createdAt)).getTime();
              if (responseTime > 0) {
                totalResponseTimeMs += responseTime;
                responseTimeCount++;
              }
            }
            if (doc.resolvedAt && doc.createdAt) {
              const resolutionTime = new Date(String(doc.resolvedAt)).getTime() - new Date(String(doc.createdAt)).getTime();
              if (resolutionTime > 0) {
                totalResolutionTimeMs += resolutionTime;
                resolutionTimeCount++;
              }
            }
            totalTimeMinutes += doc.totalTimeMinutes || 0;
          }
          hasMore = batch.hasNextPage ?? false;
          page++;
        }
        const surveyCount = await payload.count({
          collection: slugs.satisfactionSurveys,
          overrideAccess: true
        });
        let satisfactionAvg = 0;
        if (surveyCount.totalDocs > 0) {
          let totalRating = 0;
          let surveyPage = 1;
          let surveyHasMore = true;
          while (surveyHasMore && surveyPage <= MAX_PAGES2) {
            const batch = await payload.find({
              collection: slugs.satisfactionSurveys,
              limit: PAGE_SIZE2,
              page: surveyPage,
              depth: 0,
              overrideAccess: true,
              select: { rating: true }
            });
            for (const s of batch.docs) {
              totalRating += s.rating || 0;
            }
            surveyHasMore = batch.hasNextPage ?? false;
            surveyPage++;
          }
          satisfactionAvg = Math.round(totalRating / surveyCount.totalDocs * 10) / 10;
        }
        const [clientCount, pendingEmailsCount] = await Promise.all([
          payload.count({
            collection: slugs.supportClients,
            overrideAccess: true
          }),
          payload.count({
            collection: slugs.pendingEmails,
            where: { status: { equals: "pending" } },
            overrideAccess: true
          })
        ]);
        return new Response(JSON.stringify({
          total,
          byStatus,
          byPriority,
          byCategory,
          createdLast7Days: created7.totalDocs,
          createdLast30Days: created30.totalDocs,
          avgResponseTimeHours: responseTimeCount > 0 ? Math.round(totalResponseTimeMs / responseTimeCount / (1e3 * 60 * 60) * 10) / 10 : null,
          avgResolutionTimeHours: resolutionTimeCount > 0 ? Math.round(totalResolutionTimeMs / resolutionTimeCount / (1e3 * 60 * 60) * 10) / 10 : null,
          totalTimeMinutes,
          satisfactionAvg,
          satisfactionCount: surveyCount.totalDocs,
          clientCount: clientCount.totalDocs,
          pendingEmailsCount: pendingEmailsCount.totalDocs
        }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=300, stale-while-revalidate=600"
          }
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[admin-stats] Error:", error);
        return Response.json({ error: "Internal error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/billing.ts
var PAGE_SIZE = 500;
var MAX_PAGES = 50;
function createBillingEndpoint(slugs) {
  return {
    path: "/support/billing",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const url = new URL(req.url);
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        if (!from || !to) {
          return Response.json({ error: "Missing from/to params" }, { status: 400 });
        }
        const projectId = url.searchParams.get("projectId");
        const toExclusive = new Date(to);
        toExclusive.setDate(toExclusive.getDate() + 1);
        const toExclusiveIso = toExclusive.toISOString();
        const ticketWhere = {
          and: [
            { billable: { equals: true } },
            ...projectId ? [{ project: { equals: Number(projectId) } }] : [],
            {
              or: [
                {
                  and: [
                    { updatedAt: { greater_than_equal: from } },
                    { updatedAt: { less_than: toExclusiveIso } }
                  ]
                },
                {
                  and: [
                    { createdAt: { greater_than_equal: from } },
                    { createdAt: { less_than: toExclusiveIso } }
                  ]
                },
                {
                  and: [
                    { resolvedAt: { greater_than_equal: from } },
                    { resolvedAt: { less_than: toExclusiveIso } }
                  ]
                }
              ]
            }
          ]
        };
        const allTickets = [];
        let ticketPage = 1;
        let ticketHasMore = true;
        while (ticketHasMore && ticketPage <= MAX_PAGES) {
          const batch = await payload.find({
            collection: slugs.tickets,
            where: ticketWhere,
            limit: PAGE_SIZE,
            page: ticketPage,
            depth: 2,
            overrideAccess: true
          });
          allTickets.push(...batch.docs);
          ticketHasMore = batch.hasNextPage ?? false;
          ticketPage++;
        }
        const allEntries = [];
        let entryPage = 1;
        let entryHasMore = true;
        while (entryHasMore && entryPage <= MAX_PAGES) {
          const batch = await payload.find({
            collection: slugs.timeEntries,
            where: {
              and: [
                { date: { greater_than_equal: from } },
                { date: { less_than_equal: to } }
              ]
            },
            limit: PAGE_SIZE,
            page: entryPage,
            depth: 0,
            overrideAccess: true
          });
          allEntries.push(...batch.docs);
          entryHasMore = batch.hasNextPage ?? false;
          entryPage++;
        }
        const entriesByTicket = /* @__PURE__ */ new Map();
        for (const entry of allEntries) {
          const e = entry;
          const ticketId = typeof e.ticket === "object" ? e.ticket.id : e.ticket;
          if (!entriesByTicket.has(ticketId)) entriesByTicket.set(ticketId, []);
          entriesByTicket.get(ticketId).push({
            duration: e.duration || 0,
            description: e.description || "",
            date: e.date || ""
          });
        }
        const projectGroups = /* @__PURE__ */ new Map();
        for (const ticket of allTickets) {
          const t = ticket;
          const ticketEntries = entriesByTicket.get(t.id) || [];
          const hasNoTimeEntries = ticketEntries.length === 0;
          const project = typeof t.project === "object" && t.project ? { id: t.project.id, name: t.project.name || "Sans nom" } : null;
          const projectKey = project ? String(project.id) : "no-project";
          if (!projectGroups.has(projectKey)) {
            let clientInfo = null;
            if (project && typeof t.project === "object" && t.project) {
              const proj = t.project;
              if (typeof proj.client === "object" && proj.client) {
                clientInfo = { company: proj.client.company || "" };
              }
            }
            if (!clientInfo && typeof t.client === "object" && t.client) {
              clientInfo = { company: t.client.company || "" };
            }
            projectGroups.set(projectKey, {
              project,
              client: clientInfo,
              tickets: [],
              totalMinutes: 0,
              totalBilledAmount: 0
            });
          }
          const ticketTotalMinutes = ticketEntries.reduce((sum, e) => sum + e.duration, 0);
          const billedAmount = t.billedAmount || null;
          projectGroups.get(projectKey).tickets.push({
            id: t.id,
            ticketNumber: t.ticketNumber || "",
            subject: t.subject || "",
            status: t.status || "",
            entries: ticketEntries,
            totalMinutes: ticketTotalMinutes,
            billedAmount,
            hasNoTimeEntries,
            aiSummary: t.aiSummary || null,
            aiSummaryGeneratedAt: t.aiSummaryGeneratedAt || null,
            aiSummaryStatus: t.aiSummaryStatus || null
          });
          projectGroups.get(projectKey).totalMinutes += ticketTotalMinutes;
          if (billedAmount) projectGroups.get(projectKey).totalBilledAmount += billedAmount;
        }
        const groups = Array.from(projectGroups.values());
        const grandTotalMinutes = groups.reduce((sum, g) => sum + g.totalMinutes, 0);
        const grandTotalBilledAmount = groups.reduce((sum, g) => sum + g.totalBilledAmount, 0);
        const ticketsWithoutTime = groups.reduce(
          (sum, g) => sum + g.tickets.filter((t) => t.hasNoTimeEntries).length,
          0
        );
        return new Response(JSON.stringify({
          groups,
          grandTotalMinutes,
          grandTotalBilledAmount,
          ticketsWithoutTime
        }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=300, stale-while-revalidate=600"
          }
        });
      } catch (err) {
        const authResponse = handleAuthError(err);
        if (authResponse) return authResponse;
        console.error("[billing] Error:", err);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/utils/generateTicketSynthesis.ts
function getClient3(aiSettings) {
  const Anthropic = __require("@anthropic-ai/sdk").default;
  if (aiSettings.provider === "ollama") {
    const baseURL = process.env.OLLAMA_API_URL || "https://ollama.orkelis.app/v1";
    return new Anthropic({ apiKey: "ollama", baseURL });
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
function getModel3(aiSettings) {
  return aiSettings.model || "claude-haiku-4-5-20251001";
}
async function generateTicketSynthesis(args) {
  const { payload, slugs, ticketId } = args;
  const settings = await readSupportSettings(payload);
  if (settings.ai.enableSynthesis === false) {
    return { summary: "", generatedAt: (/* @__PURE__ */ new Date()).toISOString(), status: "skipped", reason: "synthesis disabled" };
  }
  const ticket = await payload.findByID({
    collection: slugs.tickets,
    id: ticketId,
    depth: 1,
    overrideAccess: true
  });
  if (!ticket) {
    return { summary: "", generatedAt: (/* @__PURE__ */ new Date()).toISOString(), status: "error", reason: "ticket not found" };
  }
  await payload.update({
    collection: slugs.tickets,
    id: ticketId,
    data: { aiSummaryStatus: "pending" },
    overrideAccess: true
  }).catch(() => {
  });
  const messagesResult = await payload.find({
    collection: slugs.ticketMessages,
    where: { ticket: { equals: ticketId } },
    sort: "createdAt",
    limit: 500,
    depth: 0,
    overrideAccess: true
  });
  const messages = messagesResult.docs;
  if (messages.length === 0) {
    const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await payload.update({
      collection: slugs.tickets,
      id: ticketId,
      data: {
        aiSummary: "(Aucun message dans ce ticket)",
        aiSummaryGeneratedAt: generatedAt,
        aiSummaryStatus: "done"
      },
      overrideAccess: true
    });
    return { summary: "(Aucun message dans ce ticket)", generatedAt, status: "done" };
  }
  const conversation = messages.map((m) => {
    const author = m.authorType === "admin" ? "Support" : "Client";
    const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris"
    }) : "";
    return `[${date}] ${author}: ${m.body || ""}`;
  }).join("\n\n");
  const clientObj = typeof ticket.client === "object" && ticket.client ? ticket.client : null;
  const clientCompany = clientObj?.company || "";
  const clientName = clientObj ? [clientObj.firstName, clientObj.lastName].filter(Boolean).join(" ") : "";
  const prompt = `Tu es un consultant technique qui prepare un recap factuel pour une facturation client.

Sujet du ticket : ${ticket.subject || "(sans sujet)"}
Client : ${clientName || "Inconnu"}${clientCompany ? ` \u2014 ${clientCompany}` : ""}

Conversation complete du ticket :
${conversation}

Genere un recap factuel sous forme d'une liste a puces courtes et actionnables, decrivant CE QUI A ETE FAIT cote support pendant ce ticket. C'est destine a etre colle dans un devis ou une facture.

Regles strictes :
- Une puce = une action realisee, formulee en groupe nominal court (ex : "Diagnostic configuration DNS et authentification Mailchimp")
- Pas de phrases completes, pas de "j'ai fait", pas de pronoms
- Pas de salutations, pas d'introduction, pas de conclusion
- Pas de markdown autre que les puces "- "
- 5 a 10 puces maximum, ordonnees chronologiquement
- Ne mentionne PAS le client par son nom dans les puces
- Si le ticket n'a pas abouti, decris quand meme le travail d'analyse realise

Reponds UNIQUEMENT avec la liste de puces, rien d'autre.`;
  const anthropic = getClient3(settings.ai);
  const model = getModel3(settings.ai);
  try {
    const res = await anthropic.messages.create({
      model,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }]
    });
    const summary = res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
    const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await payload.update({
      collection: slugs.tickets,
      id: ticketId,
      data: {
        aiSummary: summary,
        aiSummaryGeneratedAt: generatedAt,
        aiSummaryStatus: "done"
      },
      overrideAccess: true
    });
    return { summary, generatedAt, status: "done" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await payload.update({
      collection: slugs.tickets,
      id: ticketId,
      data: { aiSummaryStatus: "error" },
      overrideAccess: true
    }).catch(() => {
    });
    return { summary: "", generatedAt: (/* @__PURE__ */ new Date()).toISOString(), status: "error", reason: message };
  }
}

// src/endpoints/ticket-synthesis.ts
function createTicketSynthesisEndpoint(slugs) {
  return {
    path: "/support/ticket-synthesis",
    method: "post",
    handler: async (req) => {
      try {
        requireAdmin(req, slugs);
        const payload = req.payload;
        const url = new URL(req.url || "", "http://localhost");
        const ticketIdRaw = url.searchParams.get("ticketId");
        const force = url.searchParams.get("force") === "true";
        if (!ticketIdRaw) {
          return Response.json({ error: "ticketId required" }, { status: 400 });
        }
        const ticketId = Number(ticketIdRaw);
        if (Number.isNaN(ticketId)) {
          return Response.json({ error: "ticketId must be a number" }, { status: 400 });
        }
        if (!force) {
          const existing = await payload.findByID({
            collection: slugs.tickets,
            id: ticketId,
            depth: 0,
            overrideAccess: true
          });
          if (existing?.aiSummary && existing.aiSummaryStatus === "done") {
            return Response.json({
              summary: existing.aiSummary,
              generatedAt: existing.aiSummaryGeneratedAt,
              status: "cached"
            });
          }
        }
        const result = await generateTicketSynthesis({ payload, slugs, ticketId });
        return Response.json(result);
      } catch (err) {
        const authResponse = handleAuthError(err);
        if (authResponse) return authResponse;
        console.error("[support/ticket-synthesis] Error:", err);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/email-stats.ts
function createEmailStatsEndpoint(slugs) {
  return {
    path: "/support/email-stats",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        if (!req.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const url = new URL(req.url);
        const days = Math.min(Number(url.searchParams.get("days")) || 7, 365);
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString();
        const allDocs = [];
        const MAX_PAGES2 = 50;
        let page = 1;
        let hasMore = true;
        while (hasMore && page <= MAX_PAGES2) {
          const result = await payload.find({
            collection: slugs.emailLogs,
            where: { createdAt: { greater_than: cutoff } },
            sort: "-createdAt",
            limit: 500,
            page,
            depth: 0,
            overrideAccess: true,
            select: {
              status: true,
              processingTimeMs: true,
              action: true,
              createdAt: true
            }
          });
          allDocs.push(
            ...result.docs.map((d) => ({
              status: d.status,
              processingTimeMs: d.processingTimeMs,
              action: d.action,
              createdAt: d.createdAt
            }))
          );
          hasMore = result.hasNextPage;
          page++;
        }
        const total = allDocs.length;
        const success = allDocs.filter((d) => d.status === "success").length;
        const errors = allDocs.filter((d) => d.status === "error").length;
        const ignored = allDocs.filter((d) => d.status === "ignored").length;
        const successRate = total > 0 ? Math.round(success / total * 1e3) / 10 : 0;
        const withTime = allDocs.filter((d) => typeof d.processingTimeMs === "number" && d.processingTimeMs > 0);
        const avgProcessingTime = withTime.length > 0 ? Math.round(withTime.reduce((sum, d) => sum + (d.processingTimeMs || 0), 0) / withTime.length) : 0;
        const dailyMap = /* @__PURE__ */ new Map();
        for (const doc of allDocs) {
          const day = doc.createdAt.slice(0, 10);
          const entry = dailyMap.get(day) || { success: 0, error: 0, ignored: 0 };
          if (doc.status === "success") entry.success++;
          else if (doc.status === "error") entry.error++;
          else if (doc.status === "ignored") entry.ignored++;
          dailyMap.set(day, entry);
        }
        const actionMap = /* @__PURE__ */ new Map();
        for (const doc of allDocs) {
          const action = doc.action || "unknown";
          actionMap.set(action, (actionMap.get(action) || 0) + 1);
        }
        return Response.json({
          total,
          success,
          errors,
          ignored,
          successRate,
          avgProcessingTime,
          daily: Object.fromEntries(dailyMap),
          actions: Object.fromEntries(actionMap)
        });
      } catch (err) {
        console.error("[email-stats] Error:", err);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/satisfaction.ts
function createSatisfactionEndpoint(slugs) {
  return {
    path: "/support/satisfaction",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireClient(req, slugs);
        const body = await req.json();
        const { ticketId, rating, comment } = body;
        if (!ticketId || !rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
          return Response.json(
            { error: "ticketId et rating (entier 1-5) sont requis." },
            { status: 400 }
          );
        }
        if (comment && typeof comment === "string" && comment.length > 5e3) {
          return Response.json(
            { error: "Le commentaire ne peut pas d\xE9passer 5000 caract\xE8res." },
            { status: 400 }
          );
        }
        const ticket = await payload.findByID({
          collection: slugs.tickets,
          id: ticketId,
          depth: 0,
          overrideAccess: false,
          user: req.user
        });
        if (!ticket) {
          return Response.json({ error: "Ticket introuvable." }, { status: 404 });
        }
        if (ticket.status !== "resolved") {
          return Response.json(
            { error: "Le ticket doit \xEAtre r\xE9solu pour laisser un avis." },
            { status: 400 }
          );
        }
        const existing = await payload.find({
          collection: slugs.satisfactionSurveys,
          where: { ticket: { equals: ticketId } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        if (existing.docs.length > 0) {
          return Response.json(
            { error: "Vous avez d\xE9j\xE0 \xE9valu\xE9 ce ticket." },
            { status: 409 }
          );
        }
        const survey = await payload.create({
          collection: slugs.satisfactionSurveys,
          data: {
            source: "ticket",
            ticket: ticketId,
            client: req.user.id,
            rating: Math.round(rating),
            ...comment ? { comment: comment.trim() } : {}
          },
          overrideAccess: true
        });
        return Response.json({ success: true, survey });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[satisfaction] Error:", error);
        return Response.json({ error: "Erreur interne." }, { status: 500 });
      }
    }
  };
}
var TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);
function generateTrackingToken(ticketId, messageId, secret) {
  return createHmac("sha256", secret).update(`${ticketId}:${messageId}`).digest("hex").substring(0, 16);
}
function createTrackOpenEndpoint(slugs) {
  return {
    path: "/support/track-open",
    method: "get",
    handler: async (req) => {
      const url = new URL(req.url);
      const ticketId = url.searchParams.get("t");
      const messageId = url.searchParams.get("m");
      const sig = url.searchParams.get("sig");
      const parsedId = ticketId ? Number(ticketId) : NaN;
      const parsedMsgId = messageId ? Number(messageId) : NaN;
      const secret = process.env.PAYLOAD_SECRET || "";
      if (secret && ticketId && messageId && sig) {
        const expected = generateTrackingToken(ticketId, messageId, secret);
        if (sig !== expected) {
          return new Response(TRANSPARENT_GIF, {
            status: 200,
            headers: {
              "Content-Type": "image/gif",
              "Content-Length": String(TRANSPARENT_GIF.length),
              "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
            }
          });
        }
      } else if (secret && (!sig || !ticketId || !messageId)) {
        return new Response(TRANSPARENT_GIF, {
          status: 200,
          headers: {
            "Content-Type": "image/gif",
            "Content-Length": String(TRANSPARENT_GIF.length),
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
          }
        });
      }
      if (ticketId && Number.isInteger(parsedId) && parsedId > 0) {
        try {
          const payload = req.payload;
          const ticket = await payload.findByID({
            collection: slugs.tickets,
            id: parsedId,
            depth: 0,
            overrideAccess: true,
            select: { lastClientReadAt: true }
          });
          if (ticket) {
            const lastRead = ticket.lastClientReadAt ? new Date(ticket.lastClientReadAt).getTime() : 0;
            const fiveMinAgo = Date.now() - 5 * 60 * 1e3;
            if (lastRead < fiveMinAgo) {
              await payload.update({
                collection: slugs.tickets,
                id: parsedId,
                data: { lastClientReadAt: (/* @__PURE__ */ new Date()).toISOString() },
                overrideAccess: true
              });
            }
          }
          if (Number.isInteger(parsedMsgId) && parsedMsgId > 0) {
            const msg = await payload.findByID({
              collection: slugs.ticketMessages,
              id: parsedMsgId,
              depth: 0,
              overrideAccess: true,
              select: { emailOpenedAt: true }
            });
            if (msg && !msg.emailOpenedAt) {
              await payload.update({
                collection: slugs.ticketMessages,
                id: parsedMsgId,
                data: { emailOpenedAt: (/* @__PURE__ */ new Date()).toISOString() },
                overrideAccess: true
              });
              const ticketInfo = await payload.findByID({
                collection: slugs.tickets,
                id: parsedId,
                depth: 1,
                overrideAccess: true,
                select: { ticketNumber: true, subject: true, client: true }
              });
              const clientName = typeof ticketInfo?.client === "object" ? ticketInfo.client?.firstName || "Client" : "Client";
              try {
                await payload.create({
                  collection: "admin-notifications",
                  data: {
                    title: `Email ouvert \u2014 ${ticketInfo?.ticketNumber || "TK-????"}`,
                    message: `${clientName} a ouvert votre email pour "${ticketInfo?.subject || "ticket"}"`,
                    type: "email_opened",
                    link: `/admin/ticket?id=${parsedId}`
                  },
                  overrideAccess: true
                });
              } catch {
              }
            }
          }
        } catch (err) {
          console.error("[track-open] Error:", err);
        }
      }
      return new Response(TRANSPARENT_GIF, {
        status: 200,
        headers: {
          "Content-Type": "image/gif",
          "Content-Length": String(TRANSPARENT_GIF.length),
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
    }
  };
}

// src/endpoints/export-csv.ts
function createExportCsvEndpoint(slugs) {
  return {
    path: "/support/export-csv",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const PAGE_SIZE2 = 500;
        let page = 1;
        let hasMore = true;
        const allDocs = [];
        while (hasMore) {
          const batch = await payload.find({
            collection: slugs.tickets,
            limit: PAGE_SIZE2,
            page,
            depth: 1,
            sort: "-createdAt",
            overrideAccess: true
          });
          allDocs.push(...batch.docs);
          hasMore = batch.hasNextPage ?? false;
          page++;
        }
        const csvHeaders = [
          "N\xB0 Ticket",
          "Sujet",
          "Statut",
          "Priorit\xE9",
          "Cat\xE9gorie",
          "Client",
          "Email Client",
          "Projet",
          "Tags",
          "Assign\xE9 \xE0",
          "Temps (min)",
          "Cr\xE9\xE9 le",
          "Premi\xE8re r\xE9ponse",
          "R\xE9solu le"
        ];
        const csvRows = allDocs.map((t) => {
          const client = typeof t.client === "object" ? t.client : null;
          const project = typeof t.project === "object" ? t.project : null;
          const assignedTo = typeof t.assignedTo === "object" ? t.assignedTo : null;
          const tags = Array.isArray(t.tags) ? t.tags.join(", ") : "";
          return [
            String(t.ticketNumber || ""),
            `"${String(t.subject || "").replace(/"/g, '""')}"`,
            String(t.status || ""),
            String(t.priority || ""),
            String(t.category || ""),
            client ? `"${String(client.company || "").replace(/"/g, '""')}"` : "",
            client ? String(client.email || "") : "",
            project ? `"${String(project.name || "").replace(/"/g, '""')}"` : "",
            `"${tags}"`,
            assignedTo ? String(assignedTo.email || "") : "",
            String(t.totalTimeMinutes || 0),
            t.createdAt ? new Date(String(t.createdAt)).toISOString() : "",
            t.firstResponseAt ? new Date(String(t.firstResponseAt)).toISOString() : "",
            t.resolvedAt ? new Date(String(t.resolvedAt)).toISOString() : ""
          ].join(",");
        });
        const csv = [csvHeaders.join(","), ...csvRows].join("\n");
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="tickets-export-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv"`
          }
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[export-csv] Error:", error);
        return Response.json({ error: "Internal error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/export-data.ts
function createExportDataEndpoint(slugs) {
  return {
    path: "/support/export-data",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireClient(req, slugs);
        const [clientData, ticketsResult, messagesResult, surveysResult] = await Promise.all([
          payload.findByID({
            collection: slugs.supportClients,
            id: req.user.id,
            depth: 0,
            overrideAccess: true
          }),
          payload.find({
            collection: slugs.tickets,
            where: { client: { equals: req.user.id } },
            limit: 1e3,
            depth: 0,
            overrideAccess: true
          }),
          payload.find({
            collection: slugs.ticketMessages,
            where: {
              "ticket.client": { equals: req.user.id },
              authorType: { equals: "client" }
            },
            limit: 5e3,
            depth: 0,
            overrideAccess: true
          }),
          payload.find({
            collection: slugs.satisfactionSurveys,
            where: { client: { equals: req.user.id } },
            limit: 500,
            depth: 0,
            overrideAccess: true
          })
        ]);
        const c = clientData;
        const exportData = {
          exportDate: (/* @__PURE__ */ new Date()).toISOString(),
          exportType: "RGPD - Export des donn\xE9es personnelles",
          profile: {
            email: c.email,
            firstName: c.firstName,
            lastName: c.lastName,
            company: c.company,
            phone: c.phone || null,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt
          },
          tickets: ticketsResult.docs.map((t) => ({
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            category: t.category,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt
          })),
          messages: messagesResult.docs.map((m) => ({
            ticketId: m.ticket,
            body: m.body,
            createdAt: m.createdAt
          })),
          surveys: surveysResult.docs.map((s) => ({
            ticketId: s.ticket,
            rating: s.rating,
            comment: s.comment,
            createdAt: s.createdAt
          }))
        };
        const json = JSON.stringify(exportData, null, 2);
        return new Response(json, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="support-export-${req.user.id}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json"`
          }
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[export-data] Error:", error);
        return Response.json({ error: "Erreur interne" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/pending-emails-process.ts
function createPendingEmailsProcessEndpoint(slugs) {
  return {
    path: "/support/pending-emails/:id/process",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const id = req.routeParams?.id;
        const body = await req.json();
        const { action, ticketId, clientId: overrideClientId } = body;
        if (!["create_ticket", "add_to_ticket", "ignore"].includes(action)) {
          return Response.json({ error: "Invalid action" }, { status: 400 });
        }
        const pendingEmail = await payload.findByID({
          collection: slugs.pendingEmails,
          id: Number(id),
          depth: 1,
          overrideAccess: true
        });
        if (!pendingEmail) {
          return Response.json({ error: "Pending email not found" }, { status: 404 });
        }
        if (pendingEmail.status !== "pending") {
          return Response.json({ error: "Email already processed" }, { status: 409 });
        }
        let clientId = overrideClientId || (typeof pendingEmail.client === "object" ? pendingEmail.client?.id : pendingEmail.client);
        let clientDoc = typeof pendingEmail.client === "object" ? pendingEmail.client : null;
        if (overrideClientId && overrideClientId !== clientDoc?.id) {
          clientDoc = await payload.findByID({
            collection: slugs.supportClients,
            id: overrideClientId,
            depth: 0,
            overrideAccess: true
          });
          await payload.update({
            collection: slugs.pendingEmails,
            id: Number(id),
            data: { client: overrideClientId },
            overrideAccess: true
          });
        }
        const settings = await readSupportSettings(payload);
        const clientEmail = clientDoc?.email || pendingEmail.senderEmail || "";
        const clientName = clientDoc?.firstName || pendingEmail.senderName || clientEmail;
        const portalUrl = `${process.env.NEXT_PUBLIC_SERVER_URL || ""}/support/dashboard`;
        if (!clientId && action !== "ignore") {
          return Response.json({ error: "No client associated with this pending email" }, { status: 400 });
        }
        const attachments = pendingEmail.attachments?.map((a) => ({
          file: typeof a.file === "object" ? a.file.id : a.file
        })) || [];
        if (action === "ignore") {
          await payload.update({
            collection: slugs.pendingEmails,
            id: Number(id),
            data: {
              status: "ignored",
              processedAction: "ignored",
              processedAt: (/* @__PURE__ */ new Date()).toISOString()
            },
            overrideAccess: true
          });
          return Response.json({ action: "ignored", pendingEmailId: Number(id) });
        }
        if (action === "create_ticket") {
          const newTicket = await payload.create({
            collection: slugs.tickets,
            data: {
              subject: pendingEmail.subject,
              client: clientId,
              status: "open",
              priority: "normal",
              category: "question",
              source: "email"
            },
            overrideAccess: true
          });
          await payload.create({
            collection: slugs.ticketMessages,
            data: {
              ticket: newTicket.id,
              body: pendingEmail.body,
              authorType: "email",
              authorClient: clientId,
              isInternal: false,
              ...attachments.length > 0 && { attachments }
            },
            overrideAccess: true
          });
          try {
            await payload.sendEmail({
              to: clientEmail,
              replyTo: settings.email.replyToAddress || process.env.SUPPORT_REPLY_TO || "",
              subject: `[${newTicket.ticketNumber}] ${pendingEmail.subject}`,
              html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                <p>Bonjour <strong>${escapeHtml(clientName)}</strong>,</p>
                <p>Votre demande a \xE9t\xE9 enregistr\xE9e sous le num\xE9ro <strong>${newTicket.ticketNumber}</strong>.</p>
                <p>Sujet : ${escapeHtml(pendingEmail.subject)}</p>
                <p><a href="${portalUrl}">Acc\xE9der \xE0 mon espace</a></p>
                <p style="font-size: 14px; color: #666;">Vous pouvez aussi r\xE9pondre directement \xE0 cet email.</p>
              </div>`
            });
          } catch (err) {
            console.error("[pending-email-process] Failed to send notification:", err);
          }
          await payload.update({
            collection: slugs.pendingEmails,
            id: Number(id),
            data: {
              status: "processed",
              processedAction: "ticket_created",
              processedTicket: newTicket.id,
              processedAt: (/* @__PURE__ */ new Date()).toISOString()
            },
            overrideAccess: true
          });
          return Response.json({
            action: "ticket_created",
            ticketNumber: newTicket.ticketNumber,
            ticketId: newTicket.id
          });
        }
        if (action === "add_to_ticket") {
          if (!ticketId) {
            return Response.json({ error: "ticketId is required for add_to_ticket" }, { status: 400 });
          }
          const targetTicket = await payload.findByID({
            collection: slugs.tickets,
            id: ticketId,
            depth: 0,
            overrideAccess: true
          });
          if (!targetTicket) {
            return Response.json({ error: "Target ticket not found" }, { status: 404 });
          }
          await payload.create({
            collection: slugs.ticketMessages,
            data: {
              ticket: ticketId,
              body: pendingEmail.body,
              authorType: "email",
              authorClient: clientId,
              isInternal: false,
              ...attachments.length > 0 && { attachments }
            },
            overrideAccess: true
          });
          if (targetTicket.status === "resolved") {
            await payload.update({
              collection: slugs.tickets,
              id: ticketId,
              data: { status: "open" },
              overrideAccess: true
            });
          }
          await payload.update({
            collection: slugs.pendingEmails,
            id: Number(id),
            data: {
              status: "processed",
              processedAction: "message_added",
              processedTicket: ticketId,
              processedAt: (/* @__PURE__ */ new Date()).toISOString()
            },
            overrideAccess: true
          });
          return Response.json({
            action: "message_added",
            ticketNumber: targetTicket.ticketNumber,
            ticketId: targetTicket.id
          });
        }
        return Response.json({ error: "Invalid action" }, { status: 400 });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[pending-email-process] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/resend-notification.ts
var resendLimiter = new RateLimiter(60 * 60 * 1e3, 10);
function createResendNotificationEndpoint(slugs) {
  return {
    path: "/support/resend-notification",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        if (resendLimiter.check(String(req.user.id))) {
          return Response.json(
            { error: "Trop de renvois. R\xE9essayez dans une heure." },
            { status: 429 }
          );
        }
        let body;
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const { messageId } = body;
        if (!messageId) {
          return Response.json({ error: "messageId requis" }, { status: 400 });
        }
        const message = await payload.findByID({
          collection: slugs.ticketMessages,
          id: messageId,
          depth: 0,
          overrideAccess: true
        });
        if (!message) {
          return Response.json({ error: "Message introuvable" }, { status: 404 });
        }
        const ticketId = typeof message.ticket === "object" ? message.ticket.id : message.ticket;
        const ticket = await payload.findByID({
          collection: slugs.tickets,
          id: ticketId,
          depth: 1,
          overrideAccess: true
        });
        if (!ticket) {
          return Response.json({ error: "Ticket introuvable" }, { status: 404 });
        }
        const client = typeof ticket.client === "object" ? ticket.client : null;
        if (!client?.email) {
          return Response.json({ error: "Client sans email" }, { status: 400 });
        }
        const settings = await readSupportSettings(payload);
        const ticketNumber = ticket.ticketNumber || "TK-????";
        const subject = ticket.subject || "Support";
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
        const portalUrl = `${baseUrl}/support/tickets/${ticketId}`;
        const preview = message.body?.length > 500 ? message.body.slice(0, 500) + "..." : message.body;
        await payload.sendEmail({
          to: client.email,
          replyTo: settings.email.replyToAddress || process.env.SUPPORT_REPLY_TO || "",
          subject: `Re: [${ticketNumber}] ${subject}`,
          html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <p>Bonjour <strong>${escapeHtml(client.firstName || "")}</strong>,</p>
            <p>Notre \xE9quipe a apport\xE9 une r\xE9ponse \xE0 votre ticket <strong>${escapeHtml(ticketNumber)}</strong> \u2014 <em>${escapeHtml(subject)}</em>.</p>
            <blockquote style="border-left: 4px solid #ccc; padding: 8px 16px; margin: 16px 0; color: #555;">${escapeHtml(preview)}</blockquote>
            <p><a href="${portalUrl}">Consulter le ticket</a></p>
          </div>`
        });
        return Response.json({ success: true });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[resend-notification] Error:", error);
        return Response.json({ error: "Erreur interne" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/seed-kb.ts
var KB_ARTICLES = [
  {
    title: "Comment cr\xE9er un ticket de support ?",
    slug: "comment-creer-un-ticket",
    category: "getting-started",
    body: `Pour cr\xE9er un ticket de support, connectez-vous \xE0 votre espace client puis cliquez sur "Nouveau ticket". Remplissez le sujet et la description de votre demande. Vous pouvez ajouter des pi\xE8ces jointes (captures d'\xE9cran, documents) pour nous aider \xE0 comprendre votre probl\xE8me. Notre \xE9quipe vous r\xE9pondra dans les meilleurs d\xE9lais.`
  },
  {
    title: "Comment suivre l'avancement de mon ticket ?",
    slug: "suivre-avancement-ticket",
    category: "tickets",
    body: "Rendez-vous sur votre tableau de bord support. Vous y trouverez la liste de tous vos tickets avec leur statut actuel (Ouvert, En attente, R\xE9solu). Cliquez sur un ticket pour voir la conversation compl\xE8te et ajouter des messages. Vous recevez aussi des notifications par email \xE0 chaque r\xE9ponse de notre \xE9quipe."
  },
  {
    title: "Quels sont les d\xE9lais de r\xE9ponse ?",
    slug: "delais-de-reponse",
    category: "tickets",
    body: `Notre \xE9quipe s'engage \xE0 r\xE9pondre \xE0 votre ticket dans un d\xE9lai de 2 heures ouvr\xE9es (lundi-vendredi, 9h-18h). Les tickets marqu\xE9s "Urgent" sont trait\xE9s en priorit\xE9. En dehors des heures ouvr\xE9es, votre ticket sera trait\xE9 d\xE8s la reprise d'activit\xE9.`
  },
  {
    title: "Comment modifier mon mot de passe ?",
    slug: "modifier-mot-de-passe",
    category: "account",
    body: 'Acc\xE9dez \xE0 votre profil depuis le menu en haut \xE0 droite. Dans la section "S\xE9curit\xE9", vous trouverez le formulaire de changement de mot de passe. Entrez votre mot de passe actuel puis d\xE9finissez votre nouveau mot de passe (minimum 8 caract\xE8res). Cliquez sur "Sauvegarder" pour confirmer.'
  },
  {
    title: "Comment activer l'authentification \xE0 deux facteurs (2FA) ?",
    slug: "activer-2fa",
    category: "account",
    body: `L'authentification \xE0 deux facteurs renforce la s\xE9curit\xE9 de votre compte. Acc\xE9dez \xE0 votre profil, section "S\xE9curit\xE9", et activez le toggle 2FA. Lors de votre prochaine connexion, un code de v\xE9rification sera envoy\xE9 par email. Entrez ce code pour acc\xE9der \xE0 votre espace.`
  },
  {
    title: "Comment ajouter des pi\xE8ces jointes \xE0 un ticket ?",
    slug: "ajouter-pieces-jointes",
    category: "tickets",
    body: `Vous pouvez joindre des fichiers \xE0 vos messages en cliquant sur le bouton "Joindre un fichier" sous l'\xE9diteur de message, ou en glissant-d\xE9posant directement vos fichiers. Les formats accept\xE9s sont : images (PNG, JPG, GIF), documents (PDF, DOC, DOCX, TXT) et archives (ZIP). Taille maximale : 5 Mo par fichier.`
  },
  {
    title: "Mon site web ne s'affiche plus, que faire ?",
    slug: "site-ne-saffiche-plus",
    category: "technical",
    body: "Si votre site ne s'affiche plus : 1) V\xE9rifiez votre connexion internet. 2) Videz le cache de votre navigateur. 3) Essayez en navigation priv\xE9e. 4) Si le probl\xE8me persiste, cr\xE9ez un ticket urgent en pr\xE9cisant le message d'erreur et l'URL concern\xE9e."
  },
  {
    title: "Comment demander une modification sur mon site ?",
    slug: "demander-modification-site",
    category: "getting-started",
    body: `Cr\xE9ez un ticket avec la cat\xE9gorie "Modification de contenu". D\xE9crivez pr\xE9cis\xE9ment la modification souhait\xE9e : page concern\xE9e, texte \xE0 modifier, images \xE0 remplacer, etc. Joignez des captures d'\xE9cran si n\xE9cessaire.`
  },
  {
    title: "Quels sont les tarifs de support ?",
    slug: "tarifs-support",
    category: "billing",
    body: "Le support technique est inclus dans votre contrat de maintenance. Les demandes de modification de contenu et les nouvelles fonctionnalit\xE9s sont factur\xE9es au temps pass\xE9 selon le taux horaire d\xE9fini dans votre contrat."
  },
  {
    title: "Comment exporter mes donn\xE9es personnelles (RGPD) ?",
    slug: "export-donnees-rgpd",
    category: "account",
    body: `Conform\xE9ment au RGPD, vous pouvez demander l'export de toutes vos donn\xE9es personnelles. Rendez-vous dans votre profil, section "Donn\xE9es personnelles", et cliquez sur "Exporter mes donn\xE9es".`
  },
  {
    title: "Comment fonctionne la connexion Google (SSO) ?",
    slug: "connexion-google-sso",
    category: "account",
    body: `Vous pouvez vous connecter avec votre compte Google. Sur la page de connexion, cliquez sur "Se connecter avec Google". Si c'est votre premi\xE8re connexion, un compte sera automatiquement cr\xE9\xE9.`
  },
  {
    title: "Que signifient les diff\xE9rents statuts de ticket ?",
    slug: "statuts-ticket",
    category: "tickets",
    body: "Ouvert : votre ticket a \xE9t\xE9 re\xE7u et est en cours de traitement. En attente : nous attendons une r\xE9ponse de votre part. R\xE9solu : le probl\xE8me a \xE9t\xE9 r\xE9solu. Vous pouvez rouvrir un ticket r\xE9solu en y r\xE9pondant."
  }
];
function createSeedKbEndpoint(slugs) {
  return {
    path: "/support/seed-kb",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        let created = 0;
        let skipped = 0;
        for (const article of KB_ARTICLES) {
          const existing = await payload.find({
            collection: slugs.knowledgeBase,
            where: { slug: { equals: article.slug } },
            limit: 1,
            depth: 0,
            overrideAccess: true
          });
          if (existing.docs.length > 0) {
            skipped++;
            continue;
          }
          const lexicalBody = {
            root: {
              type: "root",
              children: article.body.split(". ").map((sentence) => ({
                type: "paragraph",
                children: [{ type: "text", text: sentence.trim() + (sentence.endsWith(".") ? "" : "."), version: 1 }],
                direction: "ltr",
                format: "",
                indent: 0,
                version: 1
              })),
              direction: "ltr",
              format: "",
              indent: 0,
              version: 1
            }
          };
          await payload.create({
            collection: slugs.knowledgeBase,
            data: {
              title: article.title,
              slug: article.slug,
              category: article.category,
              body: lexicalBody,
              published: true,
              sortOrder: created + 1
            },
            overrideAccess: true
          });
          created++;
        }
        return Response.json({ created, skipped, total: KB_ARTICLES.length });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[seed-kb] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/login.ts
var loginLimiter = new RateLimiter(15 * 6e4, 10);
function createLoginEndpoint(slugs) {
  return {
    path: "/support/login",
    method: "post",
    handler: async (req) => {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
      if (loginLimiter.check(ip)) {
        return Response.json(
          { error: "Trop de tentatives. R\xE9essayez dans quelques minutes." },
          { status: 429 }
        );
      }
      const payload = req.payload;
      let body;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      const { email, password } = body;
      const userAgent = req.headers.get("user-agent") || "";
      if (!email || !password) {
        return Response.json({ error: "Email et mot de passe requis." }, { status: 400 });
      }
      try {
        const result = await payload.login({
          collection: slugs.supportClients,
          data: { email, password }
        });
        payload.create({
          collection: slugs.authLogs,
          data: { email, success: true, action: "login", ipAddress: ip, userAgent },
          overrideAccess: true
        }).catch(() => {
        });
        const headers = new Headers({ "Content-Type": "application/json" });
        if (result.token) {
          const secure = process.env.NODE_ENV === "production";
          headers.append(
            "Set-Cookie",
            `payload-token=${result.token}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=7200`
          );
        }
        return new Response(
          JSON.stringify({
            message: "Login successful",
            user: result.user,
            token: result.token,
            exp: result.exp
          }),
          { status: 200, headers }
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
        let errorReason = "Identifiants incorrects";
        if (errorMessage.includes("locked") || errorMessage.includes("verrouill\xE9") || errorMessage.includes("Too many")) {
          errorReason = "Compte verrouill\xE9 (trop de tentatives)";
        }
        payload.create({
          collection: slugs.authLogs,
          data: { email, success: false, action: "login", errorReason, ipAddress: ip, userAgent },
          overrideAccess: true
        }).catch(() => {
        });
        return Response.json(
          { errors: [{ message: "Email ou mot de passe incorrect." }] },
          { status: 401 }
        );
      }
    }
  };
}
var sendLimiter = new RateLimiter(60 * 60 * 1e3, 3);
var verifyLimiter = new RateLimiter(15 * 60 * 1e3, 5);
function generateSecureCode() {
  const buf = crypto3.randomBytes(4);
  const num = buf.readUInt32BE(0) % 9e5 + 1e5;
  return String(num);
}
function hashCode(code) {
  const secret = process.env.PAYLOAD_SECRET || "payload-support-2fa";
  return createHmac("sha256", secret).update(code).digest("hex");
}
function createAuth2faEndpoint(slugs) {
  return {
    path: "/support/2fa",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        let body;
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const { action, email, code } = body;
        if (!action || !email) {
          return Response.json({ error: "Param\xE8tres manquants" }, { status: 400 });
        }
        const genericSendResponse = { success: true, message: "Si un compte existe, un code a \xE9t\xE9 envoy\xE9." };
        if (action === "send") {
          if (sendLimiter.check(email)) {
            return Response.json(genericSendResponse);
          }
          const clients = await payload.find({
            collection: slugs.supportClients,
            where: { email: { equals: email } },
            limit: 1,
            depth: 0,
            overrideAccess: true
          });
          if (clients.docs.length === 0) {
            return Response.json(genericSendResponse);
          }
          const client = clients.docs[0];
          const plainCode = generateSecureCode();
          const twoFactorCode = hashCode(plainCode);
          const twoFactorExpiry = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
          await payload.update({
            collection: slugs.supportClients,
            id: client.id,
            data: { twoFactorCode, twoFactorExpiry },
            overrideAccess: true
          });
          await payload.sendEmail({
            to: email,
            subject: "Code de v\xE9rification \u2014 Support",
            html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
              <p>Bonjour <strong>${escapeHtml(client.firstName || "")}</strong>,</p>
              <p>Votre code de v\xE9rification :</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="display: inline-block; font-size: 32px; font-weight: 900; letter-spacing: 8px; padding: 16px 32px; border: 3px solid #000; border-radius: 16px; background: #FFD600;">
                  ${plainCode}
                </span>
              </div>
              <p style="font-size: 13px; color: #6b7280;">Ce code est valable 10 minutes.</p>
            </div>`
          });
          return Response.json(genericSendResponse);
        }
        if (action === "verify") {
          if (!code) {
            return Response.json({ error: "Code manquant" }, { status: 400 });
          }
          if (verifyLimiter.check(email)) {
            return Response.json(
              { error: "Trop de tentatives. R\xE9essayez dans 15 minutes." },
              { status: 429 }
            );
          }
          const clients = await payload.find({
            collection: slugs.supportClients,
            where: { email: { equals: email } },
            limit: 1,
            depth: 0,
            overrideAccess: true
          });
          if (clients.docs.length === 0) {
            return Response.json({ error: "Code incorrect" }, { status: 400 });
          }
          const client = clients.docs[0];
          const storedCode = client.twoFactorCode;
          const storedExpiry = client.twoFactorExpiry;
          if (!storedCode || !storedExpiry) {
            return Response.json({ error: "Aucun code en attente" }, { status: 400 });
          }
          if (/* @__PURE__ */ new Date() > new Date(storedExpiry)) {
            await payload.update({
              collection: slugs.supportClients,
              id: client.id,
              data: { twoFactorCode: "", twoFactorExpiry: "" },
              overrideAccess: true
            });
            return Response.json({ error: "Code expir\xE9. Veuillez en demander un nouveau." }, { status: 400 });
          }
          const submittedHash = hashCode(String(code).padStart(6, "0"));
          const enc = new TextEncoder();
          const submittedBuffer = enc.encode(submittedHash);
          const storedBuffer = enc.encode(storedCode);
          if (submittedBuffer.length !== storedBuffer.length || !crypto3.timingSafeEqual(submittedBuffer, storedBuffer)) {
            return Response.json({ error: "Code incorrect" }, { status: 400 });
          }
          await payload.update({
            collection: slugs.supportClients,
            id: client.id,
            data: { twoFactorCode: "", twoFactorExpiry: "" },
            overrideAccess: true
          });
          verifyLimiter.reset(email);
          return Response.json({ success: true, verified: true });
        }
        return Response.json({ error: "Action invalide" }, { status: 400 });
      } catch (err) {
        console.error("[2fa] Error:", err);
        return Response.json({ error: "Erreur interne" }, { status: 500 });
      }
    }
  };
}
function createOAuthGoogleEndpoint(slugs, options) {
  return {
    path: "/support/oauth/google",
    method: "post",
    handler: async (req) => {
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
      const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return Response.json(
          { error: "Google OAuth non configur\xE9." },
          { status: 501 }
        );
      }
      try {
        const body = await req.json();
        const { action, code, state: queryState, cookieState } = body;
        if (action === "login") {
          const oauthState = crypto3.randomBytes(32).toString("hex");
          const redirectUri = `${baseUrl}/api/support/oauth/google`;
          const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "openid email profile",
            state: oauthState,
            prompt: "select_account"
          });
          return Response.json({
            url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
            state: oauthState
          });
        }
        if (code) {
          if (!cookieState || !queryState || cookieState !== queryState) {
            return Response.json({ error: "state_mismatch" }, { status: 400 });
          }
          const redirectUri = `${baseUrl}/api/support/oauth/google`;
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: GOOGLE_CLIENT_ID,
              client_secret: GOOGLE_CLIENT_SECRET,
              redirect_uri: redirectUri,
              grant_type: "authorization_code"
            })
          });
          const tokens = await tokenRes.json();
          if (!tokens.access_token) {
            return Response.json({ error: "oauth_failed" }, { status: 400 });
          }
          const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
          });
          const profile = await profileRes.json();
          if (!profile.email) {
            return Response.json({ error: "no_email" }, { status: 400 });
          }
          const payload = req.payload;
          const existing = await payload.find({
            collection: slugs.supportClients,
            where: { email: { equals: profile.email } },
            limit: 1,
            depth: 0,
            overrideAccess: true
          });
          let clientDoc = existing.docs[0];
          if (!clientDoc) {
            const allowedDomains = options?.allowedEmailDomains;
            if (allowedDomains && allowedDomains.length > 0) {
              const emailDomain = profile.email.split("@")[1]?.toLowerCase();
              const isAllowed = allowedDomains.some(
                (d) => d.toLowerCase() === emailDomain
              );
              if (!isAllowed) {
                return Response.json(
                  { error: "Inscription non autoris\xE9e pour ce domaine email." },
                  { status: 403 }
                );
              }
            }
            const autoPassword = crypto3.randomBytes(48).toString("base64url");
            const fullName = profile.name || profile.email.split("@")[0];
            const nameParts = fullName.split(" ");
            clientDoc = await payload.create({
              collection: slugs.supportClients,
              data: {
                email: profile.email,
                firstName: nameParts[0] || fullName,
                lastName: nameParts.slice(1).join(" ") || "-",
                company: fullName,
                password: autoPassword
              },
              overrideAccess: true
            });
          }
          const tempPassword = crypto3.randomBytes(48).toString("base64url");
          await payload.update({
            collection: slugs.supportClients,
            id: clientDoc.id,
            data: { password: tempPassword },
            overrideAccess: true
          });
          const loginResult = await payload.login({
            collection: slugs.supportClients,
            data: { email: profile.email, password: tempPassword }
          });
          const postLoginPassword = crypto3.randomBytes(48).toString("base64url");
          await payload.update({
            collection: slugs.supportClients,
            id: clientDoc.id,
            data: { password: postLoginPassword },
            overrideAccess: true
          });
          if (!loginResult.token) {
            return Response.json({ error: "login_failed" }, { status: 400 });
          }
          return Response.json({
            token: loginResult.token,
            user: loginResult.user,
            exp: loginResult.exp
          });
        }
        return Response.json({ error: "Action invalide" }, { status: 400 });
      } catch (err) {
        console.error("[oauth/google] Error:", err);
        return Response.json({ error: "oauth_error" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/delete-account.ts
function createDeleteAccountEndpoint(slugs) {
  return {
    path: "/support/delete-account",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireClient(req, slugs);
        const body = await req.json();
        const { confirmPassword } = body;
        if (!confirmPassword) {
          return Response.json(
            { error: "Mot de passe requis pour confirmer la suppression." },
            { status: 400 }
          );
        }
        try {
          await payload.login({
            collection: slugs.supportClients,
            data: { email: req.user.email, password: confirmPassword }
          });
        } catch {
          return Response.json(
            { error: "Mot de passe incorrect." },
            { status: 403 }
          );
        }
        const clientId = req.user.id;
        const tickets = await payload.find({
          collection: slugs.tickets,
          where: { client: { equals: clientId } },
          limit: 1e4,
          depth: 0,
          overrideAccess: true,
          select: { id: true }
        });
        const ticketIds = tickets.docs.map((t) => t.id);
        if (ticketIds.length > 0) {
          await payload.delete({
            collection: slugs.ticketMessages,
            where: { ticket: { in: ticketIds } },
            overrideAccess: true
          });
          await payload.delete({
            collection: slugs.ticketActivityLog,
            where: { ticket: { in: ticketIds } },
            overrideAccess: true
          });
          await payload.delete({
            collection: slugs.timeEntries,
            where: { ticket: { in: ticketIds } },
            overrideAccess: true
          });
          await payload.delete({
            collection: slugs.tickets,
            where: { client: { equals: clientId } },
            overrideAccess: true
          });
        }
        await payload.delete({
          collection: slugs.satisfactionSurveys,
          where: { client: { equals: clientId } },
          overrideAccess: true
        });
        await payload.delete({
          collection: slugs.chatMessages,
          where: { client: { equals: clientId } },
          overrideAccess: true
        });
        await payload.delete({
          collection: slugs.supportClients,
          id: clientId,
          overrideAccess: true
        });
        const headers = new Headers({ "Content-Type": "application/json" });
        const secure = process.env.NODE_ENV === "production";
        headers.append(
          "Set-Cookie",
          `payload-token=; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=0`
        );
        return new Response(
          JSON.stringify({
            deleted: true,
            message: "Votre compte et toutes vos donn\xE9es ont \xE9t\xE9 supprim\xE9s d\xE9finitivement."
          }),
          { status: 200, headers }
        );
      } catch (err) {
        const authResponse = handleAuthError(err);
        if (authResponse) return authResponse;
        console.error("[delete-account] Error:", err);
        return Response.json({ error: "Erreur interne" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/merge-clients.ts
function createMergeClientsEndpoint(slugs) {
  return {
    path: "/support/merge-clients",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const { sourceId, targetId } = await req.json();
        if (!sourceId || !targetId || sourceId === targetId) {
          return Response.json({ error: "sourceId and targetId are required and must be different" }, { status: 400 });
        }
        const [source, target] = await Promise.all([
          payload.findByID({ collection: slugs.supportClients, id: sourceId, depth: 0, overrideAccess: true }),
          payload.findByID({ collection: slugs.supportClients, id: targetId, depth: 0, overrideAccess: true })
        ]);
        if (!source || !target) {
          return Response.json({ error: "Source or target client not found" }, { status: 404 });
        }
        const results = {
          tickets: 0,
          ticketMessages: 0,
          chatMessages: 0,
          pendingEmails: 0,
          satisfactionSurveys: 0
        };
        const tickets = await payload.find({
          collection: slugs.tickets,
          where: { client: { equals: sourceId } },
          limit: 500,
          depth: 0,
          overrideAccess: true
        });
        for (const ticket of tickets.docs) {
          await payload.update({ collection: slugs.tickets, id: ticket.id, data: { client: targetId }, overrideAccess: true });
          results.tickets++;
        }
        const messages = await payload.find({
          collection: slugs.ticketMessages,
          where: { authorClient: { equals: sourceId } },
          limit: 1e3,
          depth: 0,
          overrideAccess: true
        });
        for (const msg of messages.docs) {
          await payload.update({ collection: slugs.ticketMessages, id: msg.id, data: { authorClient: targetId }, overrideAccess: true });
          results.ticketMessages++;
        }
        const chats = await payload.find({
          collection: slugs.chatMessages,
          where: { client: { equals: sourceId } },
          limit: 1e3,
          depth: 0,
          overrideAccess: true
        });
        for (const chat of chats.docs) {
          await payload.update({ collection: slugs.chatMessages, id: chat.id, data: { client: targetId }, overrideAccess: true });
          results.chatMessages++;
        }
        const pendingEmails = await payload.find({
          collection: slugs.pendingEmails,
          where: { client: { equals: sourceId } },
          limit: 500,
          depth: 0,
          overrideAccess: true
        });
        for (const pe of pendingEmails.docs) {
          await payload.update({ collection: slugs.pendingEmails, id: pe.id, data: { client: targetId }, overrideAccess: true });
          results.pendingEmails++;
        }
        const surveys = await payload.find({
          collection: slugs.satisfactionSurveys,
          where: { client: { equals: sourceId } },
          limit: 500,
          depth: 0,
          overrideAccess: true
        });
        for (const survey of surveys.docs) {
          await payload.update({ collection: slugs.satisfactionSurveys, id: survey.id, data: { client: targetId }, overrideAccess: true });
          results.satisfactionSurveys++;
        }
        await payload.delete({
          collection: slugs.supportClients,
          id: sourceId,
          overrideAccess: true
        });
        const sourceLabel = `${source.firstName} ${source.lastName} (${source.email})`;
        const targetLabel = `${target.firstName} ${target.lastName} (${target.email})`;
        return Response.json({
          success: true,
          message: `Client "${sourceLabel}" fusionn\xE9 dans "${targetLabel}"`,
          merged: results,
          deletedClientId: sourceId,
          targetClientId: targetId
        });
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[merge-clients] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}
var importLimiter = new RateLimiter(36e5, 10);
function parseStructuredMarkdown(markdown) {
  const clientMatch = markdown.match(
    /\*\*Client\s*:\*\*\s*(.+?)\s*[—–-]\s*(.+?)\s*\(([^)]+@[^)]+)\)/i
  );
  const subjectMatch = markdown.match(/\*\*Sujet\s*:\*\*\s*(.+)/i);
  if (!clientMatch || !subjectMatch) return null;
  const client = {
    name: clientMatch[1].trim(),
    company: clientMatch[2].trim(),
    email: clientMatch[3].trim().toLowerCase()
  };
  const subject = subjectMatch[1].trim();
  const adminEmail = (process.env.CONTACT_EMAIL || "admin@example.com").toLowerCase();
  const blocks = markdown.split(/## Message \d+/).slice(1);
  const messages = [];
  for (const block of blocks) {
    const fromMatch = block.match(/\*\*De\s*:\*\*\s*(.+?)\s*\(([^)]+)\)/);
    const dateMatch = block.match(/\*\*Date\s*:\*\*\s*(.+)/);
    if (!fromMatch) continue;
    const name = fromMatch[1].trim();
    const email = fromMatch[2].trim().toLowerCase();
    const date = dateMatch ? dateMatch[1].trim() : "";
    const lines = block.split("\n");
    let contentStart = 0;
    let foundDate = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("**Date")) {
        foundDate = true;
        continue;
      }
      if (foundDate && lines[i].trim() === "") {
        contentStart = i + 1;
        break;
      }
    }
    const content = lines.slice(contentStart).join("\n").replace(/\n---\s*$/s, "").trim();
    if (!content) continue;
    messages.push({
      from: email === adminEmail ? "admin" : "client",
      name,
      date,
      content
    });
  }
  if (messages.length === 0) return null;
  return { client, subject, messages };
}
async function parseMarkdownWithAI(markdown) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const Anthropic = __require("@anthropic-ai/sdk").default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Parse this email conversation markdown and return strict JSON.

Extract:
- Client info (the external person, NOT the admin)
- Subject
- All messages chronologically

The admin email is: ${process.env.CONTACT_EMAIL || "admin@example.com"}

Return JSON: { "client": { "email": "", "name": "", "company": "" }, "subject": "", "messages": [{ "from": "client"|"admin", "name": "", "date": "", "content": "" }] }

Markdown:
---
${markdown}
---

ONLY JSON, nothing else.`
        }
      ]
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.client?.email || !parsed.messages?.length) return null;
    return {
      client: {
        email: parsed.client.email.toLowerCase().trim(),
        name: parsed.client.name || parsed.client.email.split("@")[0],
        company: parsed.client.company || "Non renseign\xE9"
      },
      subject: parsed.subject || "Conversation import\xE9e",
      messages: parsed.messages.map((m) => ({
        from: m.from === "admin" ? "admin" : "client",
        name: m.name || "",
        date: m.date || "",
        content: m.content || ""
      }))
    };
  } catch (err) {
    console.error("[import-conversation] AI parsing failed:", err);
    return null;
  }
}
function createImportConversationEndpoint(slugs) {
  return {
    path: "/support/import-conversation",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        const webhookSecret = req.headers.get("x-webhook-secret");
        let isAuthed = false;
        if (webhookSecret && process.env.SUPPORT_WEBHOOK_SECRET && webhookSecret === process.env.SUPPORT_WEBHOOK_SECRET) {
          isAuthed = true;
        } else if (req.user && req.user.collection === slugs.users) {
          isAuthed = true;
        }
        if (!isAuthed) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        if (importLimiter.check(ip)) {
          return Response.json({ error: "Rate limit exceeded. Maximum 10 imports per hour." }, { status: 429 });
        }
        let body;
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const { markdown, previewOnly } = body;
        if (!markdown || typeof markdown !== "string") {
          return Response.json({ error: "markdown field is required (string)" }, { status: 400 });
        }
        if (markdown.length > 512e3) {
          return Response.json({ error: "Markdown too large (max 500KB)" }, { status: 400 });
        }
        let conversation = parseStructuredMarkdown(markdown);
        let parseMethod = "structured";
        if (!conversation) {
          conversation = await parseMarkdownWithAI(markdown);
          parseMethod = "ai";
        }
        if (!conversation) {
          return Response.json({
            error: "Could not parse conversation. Expected format: **Client :** Name \u2014 Company (email), **Sujet :** Subject, ## Message N blocks."
          }, { status: 422 });
        }
        if (previewOnly) {
          return Response.json({
            action: "preview",
            parseMethod,
            client: conversation.client,
            subject: conversation.subject,
            messageCount: conversation.messages.length,
            messages: conversation.messages.map((m) => ({
              from: m.from,
              name: m.name,
              date: m.date,
              preview: m.content.length > 100 ? m.content.substring(0, 100) + "..." : m.content
            }))
          });
        }
        if (!conversation.client.email.includes("@")) {
          return Response.json({ error: "Invalid client email extracted" }, { status: 422 });
        }
        const settings = await readSupportSettings(payload);
        const adminEmail = (process.env.CONTACT_EMAIL || "").toLowerCase();
        const blockedEmails = [adminEmail, settings.email.replyToAddress || process.env.SUPPORT_REPLY_TO || ""].filter(Boolean);
        if (blockedEmails.includes(conversation.client.email)) {
          return Response.json({ error: "Cannot create ticket from system email address" }, { status: 400 });
        }
        const clientResult = await payload.find({
          collection: slugs.supportClients,
          where: { email: { equals: conversation.client.email } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        let client = clientResult.docs[0];
        let isNewClient = false;
        if (!client) {
          const nameParts = conversation.client.name.split(" ");
          const randomPassword = crypto3.randomBytes(48).toString("base64url");
          client = await payload.create({
            collection: slugs.supportClients,
            data: {
              email: conversation.client.email,
              password: randomPassword,
              firstName: nameParts[0] || "Inconnu",
              lastName: nameParts.slice(1).join(" ") || conversation.client.email.split("@")[0] || "Inconnu",
              company: conversation.client.company || "Non renseign\xE9"
            },
            overrideAccess: true
          });
          isNewClient = true;
        }
        const adminUsers = await payload.find({
          collection: slugs.users,
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        const adminUserId = adminUsers.docs[0]?.id;
        const ticket = await payload.create({
          collection: slugs.tickets,
          data: {
            subject: conversation.subject,
            client: client.id,
            status: "open",
            priority: "normal",
            category: "question"
          },
          overrideAccess: true
        });
        let importedCount = 0;
        for (const msg of conversation.messages) {
          const isAdmin = msg.from === "admin";
          await payload.create({
            collection: slugs.ticketMessages,
            data: {
              ticket: ticket.id,
              body: msg.content,
              authorType: isAdmin ? "admin" : "email",
              ...isAdmin && adminUserId ? { authorAdmin: adminUserId } : {},
              ...!isAdmin ? { authorClient: client.id } : {},
              isInternal: false,
              skipNotification: true
            },
            overrideAccess: true
          });
          importedCount++;
        }
        return Response.json({
          action: "conversation_imported",
          parseMethod,
          ticketNumber: ticket.ticketNumber,
          ticketId: ticket.id,
          clientEmail: conversation.client.email,
          clientName: conversation.client.name,
          clientCompany: conversation.client.company,
          isNewClient,
          messagesImported: importedCount
        });
      } catch (error) {
        console.error("[import-conversation] Error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  };
}

// src/utils/fireWebhooks.ts
async function fireWebhooks(payload, slugs, event, data) {
  try {
    const endpoints = await payload.find({
      collection: slugs.webhookEndpoints,
      where: {
        active: { equals: true },
        events: { contains: event }
      },
      limit: 50,
      depth: 0,
      overrideAccess: true
    });
    if (endpoints.docs.length === 0) return;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    await Promise.allSettled(
      endpoints.docs.map(async (endpoint) => {
        try {
          const res = await fetch(endpoint.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...endpoint.secret ? { "X-Webhook-Secret": endpoint.secret } : {}
            },
            body: JSON.stringify({ event, data, timestamp }),
            signal: AbortSignal.timeout(1e4)
          });
          try {
            await payload.update({
              collection: slugs.webhookEndpoints,
              id: endpoint.id,
              data: {
                lastTriggeredAt: timestamp,
                lastStatus: res.status
              },
              overrideAccess: true
            });
          } catch {
          }
        } catch (error) {
          console.warn(`[support] Webhook delivery failed: ${endpoint.url}`, error);
          try {
            await payload.update({
              collection: slugs.webhookEndpoints,
              id: endpoint.id,
              data: {
                lastTriggeredAt: timestamp,
                lastStatus: 0
              },
              overrideAccess: true
            });
          } catch {
          }
        }
      })
    );
  } catch (error) {
    console.error("[support] Failed to fire webhooks:", error);
  }
}

// src/endpoints/process-scheduled.ts
function createProcessScheduledEndpoint(slugs) {
  return {
    path: "/support/process-scheduled",
    method: "post",
    handler: async (req) => {
      const secret = req.headers.get("x-cron-secret");
      const expectedSecret = process.env.CRON_SECRET;
      if (!expectedSecret || secret !== expectedSecret) {
        return Response.json({ error: "Non autoris\xE9" }, { status: 401 });
      }
      try {
        const payload = req.payload;
        const now = /* @__PURE__ */ new Date();
        const settings = await readSupportSettings(payload);
        const replyTo = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || "";
        const results = { processed: 0, errors: 0 };
        const scheduled = await payload.find({
          collection: slugs.ticketMessages,
          where: {
            and: [
              { scheduledAt: { less_than_equal: now.toISOString() } },
              {
                or: [
                  { scheduledSent: { equals: false } },
                  { scheduledSent: { exists: false } }
                ]
              }
            ]
          },
          limit: 100,
          depth: 0,
          overrideAccess: true
        });
        for (const message of scheduled.docs) {
          try {
            const msg = message;
            const ticketId = typeof msg.ticket === "object" ? msg.ticket.id : msg.ticket;
            const ticket = await payload.findByID({
              collection: slugs.tickets,
              id: ticketId,
              depth: 1,
              overrideAccess: true
            });
            if (!ticket) {
              console.warn(`[process-scheduled] Ticket ${ticketId} not found for message ${msg.id}`);
              results.errors++;
              continue;
            }
            const t = ticket;
            const client = typeof t.client === "object" ? t.client : null;
            if (client?.email && msg.authorType === "admin" && !msg.isInternal) {
              const ticketNumber = t.ticketNumber || "TK-????";
              const subject = t.subject || "Support";
              const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
              const preview = msg.body?.length > 500 ? msg.body.slice(0, 500) + "..." : msg.body;
              await payload.sendEmail({
                to: client.email,
                ...replyTo ? { replyTo } : {},
                subject: `Re: [${ticketNumber}] ${subject}`,
                html: `<p>Bonjour ${escapeHtml(client.firstName || "")},</p><p>Notre \xE9quipe a r\xE9pondu \xE0 votre ticket <strong>${escapeHtml(ticketNumber)}</strong>.</p><blockquote style="border-left:4px solid #2563eb;padding:12px;margin:16px 0;background:#f8fafc;">${escapeHtml(preview)}</blockquote><p><a href="${baseUrl}/support/tickets/${ticketId}">Consulter le ticket</a></p>`
              });
              await payload.update({
                collection: slugs.ticketMessages,
                id: msg.id,
                data: {
                  scheduledSent: true,
                  emailSentAt: now.toISOString(),
                  emailSentTo: client.email
                },
                overrideAccess: true
              });
            } else {
              await payload.update({
                collection: slugs.ticketMessages,
                id: msg.id,
                data: { scheduledSent: true },
                overrideAccess: true
              });
            }
            if (msg.authorType === "admin" && !msg.isInternal) {
              await payload.update({
                collection: slugs.tickets,
                id: ticketId,
                data: { status: "waiting_client" },
                overrideAccess: true
              });
            }
            fireWebhooks(payload, slugs, "ticket_replied", {
              ticketId,
              messageId: msg.id,
              authorType: msg.authorType,
              scheduled: true,
              body: msg.body?.length > 500 ? msg.body.slice(0, 500) + "..." : msg.body
            });
            results.processed++;
          } catch (err) {
            console.error(`[process-scheduled] Error processing message ${message.id}:`, err);
            results.errors++;
          }
        }
        return Response.json({
          success: true,
          ...results,
          timestamp: now.toISOString()
        });
      } catch (error) {
        console.error("[process-scheduled] Error:", error);
        return Response.json({ error: "Erreur interne" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/user-prefs.ts
var PREF_KEY_PREFIX = "support-user-prefs";
var DEFAULT_USER_PREFS2 = {
  locale: "fr",
  signature: ""
};
function createUserPrefsGetEndpoint(slugs) {
  return {
    path: "/support/user-prefs",
    method: "get",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const key = `${PREF_KEY_PREFIX}-${req.user.id}`;
        const prefs = await payload.find({
          collection: "payload-preferences",
          where: { key: { equals: key } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        let userPrefs = { ...DEFAULT_USER_PREFS2 };
        if (prefs.docs.length > 0) {
          const stored = prefs.docs[0].value;
          userPrefs = {
            locale: stored.locale || DEFAULT_USER_PREFS2.locale,
            signature: stored.signature ?? DEFAULT_USER_PREFS2.signature
          };
        }
        return Response.json(userPrefs);
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.warn("[support/user-prefs] GET error:", error);
        return Response.json({ error: "Error" }, { status: 500 });
      }
    }
  };
}
function createUserPrefsPostEndpoint(slugs) {
  return {
    path: "/support/user-prefs",
    method: "post",
    handler: async (req) => {
      try {
        const payload = req.payload;
        requireAdmin(req, slugs);
        const body = await req.json();
        const key = `${PREF_KEY_PREFIX}-${req.user.id}`;
        const existing = await payload.find({
          collection: "payload-preferences",
          where: { key: { equals: key } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        let current = { ...DEFAULT_USER_PREFS2 };
        if (existing.docs.length > 0) {
          const stored = existing.docs[0].value;
          current = {
            locale: stored.locale || DEFAULT_USER_PREFS2.locale,
            signature: stored.signature ?? DEFAULT_USER_PREFS2.signature
          };
        }
        const merged = {
          locale: body.locale || current.locale,
          signature: body.signature ?? current.signature
        };
        await payload.db.upsert({
          collection: "payload-preferences",
          data: {
            key,
            user: { relationTo: req.user.collection, value: req.user.id },
            value: merged
          },
          req: { payload, user: req.user },
          where: {
            and: [
              { key: { equals: key } },
              { "user.value": { equals: req.user.id } },
              { "user.relationTo": { equals: req.user.collection } }
            ]
          }
        });
        return Response.json(merged);
      } catch (error) {
        const authResponse = handleAuthError(error);
        if (authResponse) return authResponse;
        console.error("[support/user-prefs] POST error:", error);
        return Response.json({ error: "Error saving user preferences" }, { status: 500 });
      }
    }
  };
}

// src/endpoints/index.ts
function createSupportEndpoints(slugs, options) {
  const f = options?.features;
  const endpoints = [
    createSearchEndpoint(slugs),
    createSettingsGetEndpoint(slugs),
    createSettingsPostEndpoint(slugs),
    createAdminStatsEndpoint(slugs),
    createExportCsvEndpoint(slugs),
    createExportDataEndpoint(slugs),
    createSeedKbEndpoint(slugs),
    createLoginEndpoint(slugs),
    createAuth2faEndpoint(slugs),
    createOAuthGoogleEndpoint(slugs, options?.oauth),
    createDeleteAccountEndpoint(slugs),
    createMergeClientsEndpoint(slugs),
    createImportConversationEndpoint(slugs),
    createPurgeLogsEndpoint(slugs),
    createResendNotificationEndpoint(slugs),
    createUserPrefsGetEndpoint(slugs),
    createUserPrefsPostEndpoint(slugs)
  ];
  if (!f || f.ai !== false) {
    endpoints.push(createAiEndpoint(slugs));
    endpoints.push(...createClientIntelligenceEndpoint(slugs));
    endpoints.push(createTicketSynthesisEndpoint(slugs));
  }
  if (!f || f.bulkActions !== false) endpoints.push(createBulkActionEndpoint(slugs));
  if (!f || f.merge !== false) endpoints.push(createMergeTicketsEndpoint(slugs));
  if (!f || f.splitTicket !== false) endpoints.push(createSplitTicketEndpoint(slugs));
  if (!f || f.collisionDetection !== false) {
    endpoints.push(createTypingPostEndpoint(slugs), createTypingGetEndpoint(slugs));
    endpoints.push(createPresencePostEndpoint(slugs), createPresenceGetEndpoint(slugs));
  }
  if (!f || f.signatures !== false) {
    endpoints.push(createSignatureGetEndpoint(slugs), createSignaturePostEndpoint(slugs));
  }
  if (!f || f.sla !== false) endpoints.push(createSlaCheckEndpoint(slugs));
  if (!f || f.autoClose !== false) endpoints.push(createAutoCloseEndpoint(slugs));
  if (!f || f.customStatuses !== false) endpoints.push(createStatusesEndpoint(slugs));
  if (!f || f.macros !== false) endpoints.push(createApplyMacroEndpoint(slugs));
  if (!f || f.roundRobin !== false) {
    endpoints.push(createRoundRobinConfigGetEndpoint(slugs), createRoundRobinConfigPostEndpoint(slugs));
  }
  if (!f || f.chatbot !== false) endpoints.push(createChatbotEndpoint(slugs));
  if (!f || f.chat !== false) {
    endpoints.push(createChatGetEndpoint(slugs), createChatPostEndpoint(slugs));
    endpoints.push(createChatStreamEndpoint(slugs));
    endpoints.push(createAdminChatGetEndpoint(slugs), createAdminChatPostEndpoint(slugs));
    endpoints.push(createAdminChatStreamEndpoint(slugs));
  }
  if (!f || f.timeTracking !== false) endpoints.push(createBillingEndpoint(slugs));
  if (!f || f.satisfaction !== false) endpoints.push(createSatisfactionEndpoint(slugs));
  if (!f || f.emailTracking !== false) {
    endpoints.push(createEmailStatsEndpoint(slugs), createTrackOpenEndpoint(slugs));
  }
  if (!f || f.pendingEmails !== false) endpoints.push(createPendingEmailsProcessEndpoint(slugs));
  if (!f || f.scheduledReplies !== false) endpoints.push(createProcessScheduledEndpoint(slugs));
  return endpoints;
}

// src/utils/adminNotification.ts
async function createAdminNotification(payload, data, collectionSlug = "admin-notifications") {
  try {
    await payload.create({
      collection: collectionSlug,
      data: {
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link,
        recipient: data.recipient,
        read: false
      },
      overrideAccess: true
    });
  } catch (err) {
    console.error("[notification] Failed to create:", err);
  }
}
function dispatchWebhook(data, event, payload, slugs) {
  void _dispatch(data, event, payload, slugs);
}
async function _dispatch(data, event, payload, slugs) {
  try {
    const { docs: endpoints } = await payload.find({
      collection: slugs.webhookEndpoints,
      where: {
        and: [
          { active: { equals: true } },
          { events: { contains: event } }
        ]
      },
      limit: 50,
      depth: 0,
      overrideAccess: true
    });
    if (endpoints.length === 0) return;
    const body = JSON.stringify({ event, data, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    for (const endpoint of endpoints) {
      void _sendToEndpoint(endpoint, body, payload, slugs);
    }
  } catch (err) {
    console.error(`[webhook] Failed to fetch endpoints for event ${event}:`, err);
  }
}
async function _sendToEndpoint(endpoint, body, payload, slugs) {
  try {
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "PayloadSupport-Webhook/1.0"
    };
    if (endpoint.secret) {
      const signature = crypto3.createHmac("sha256", endpoint.secret).update(body).digest("hex");
      headers["X-Webhook-Signature"] = signature;
    }
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(1e4)
      // 10s timeout
    });
    await payload.update({
      collection: slugs.webhookEndpoints,
      id: endpoint.id,
      data: {
        lastTriggeredAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastStatus: response.status
      },
      overrideAccess: true
    });
    if (!response.ok) {
      console.warn(`[webhook] ${endpoint.name || endpoint.url} returned ${response.status}`);
    }
  } catch (err) {
    console.error(`[webhook] Failed to call ${endpoint.name || endpoint.url}:`, err);
    try {
      await payload.update({
        collection: slugs.webhookEndpoints,
        id: endpoint.id,
        data: {
          lastTriggeredAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastStatus: 0
        },
        overrideAccess: true
      });
    } catch {
    }
  }
}

// src/hooks/ticketStatusEmail.ts
var STATUS_LABELS = {
  open: "Ouvert",
  waiting_client: "En attente client",
  resolved: "Resolu"
};
async function resolveClient(doc, payload, clientSlug) {
  const client = doc.client;
  if (!client) return null;
  if (typeof client === "object" && client !== null && typeof client.email === "string") {
    return {
      email: client.email,
      firstName: client.firstName || "",
      notifyOnStatusChange: client.notifyOnStatusChange !== false
    };
  }
  const clientId = typeof client === "number" ? client : client?.id;
  if (!clientId) return null;
  try {
    const clientData = await payload.findByID({
      collection: clientSlug,
      id: clientId,
      depth: 0,
      overrideAccess: true
    });
    if (!clientData?.email) return null;
    return {
      email: clientData.email,
      firstName: clientData.firstName || "",
      notifyOnStatusChange: clientData.notifyOnStatusChange !== false
    };
  } catch {
    return null;
  }
}
function createTicketStatusEmail(slugs) {
  return async ({ doc, previousDoc, operation, req }) => {
    const { payload } = req;
    const settings = await readSupportSettings(payload);
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
    const supportEmail = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || "";
    if (operation === "create") {
      try {
        const client = await resolveClient(doc, payload, slugs.supportClients);
        if (!client?.email) return doc;
        const ticketNumber = doc.ticketNumber || "TK-????";
        const subject = doc.subject || "Support";
        const ticketUrl = `${baseUrl}/support/tickets/${doc.id}`;
        await payload.sendEmail({
          to: client.email,
          ...supportEmail ? { replyTo: supportEmail } : {},
          subject: `[${ticketNumber}] Demande enregistree \u2014 ${subject}`,
          html: emailWrapper(`Votre demande a ete enregistree`, [
            emailParagraph(`Bonjour <strong>${escapeHtml(client.firstName)}</strong>,`),
            emailParagraph(`Nous avons bien recu votre demande de support. Voici les details :`),
            `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">N&deg; Ticket</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;"><strong>${escapeHtml(String(ticketNumber))}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">Sujet</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;">${escapeHtml(String(subject))}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">Statut</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;">${STATUS_LABELS[doc.status] || doc.status}</td>
              </tr>
            </table>`,
            emailParagraph("Notre equipe vous repondra dans les meilleurs delais."),
            emailButton("Consulter le ticket", ticketUrl)
          ].join(""))
        });
        payload.logger.info(`[tickets] Creation notification sent to ${client.email} for ${ticketNumber}`);
      } catch (error) {
        payload.logger.error(`[tickets] Failed to send creation email: ${error}`);
      }
      return doc;
    }
    if (operation === "update" && previousDoc?.status !== doc.status) {
      if (doc.status === "resolved") return doc;
      try {
        const client = await resolveClient(doc, payload, slugs.supportClients);
        if (!client?.email) return doc;
        if (!client.notifyOnStatusChange) return doc;
        const ticketNumber = doc.ticketNumber || "TK-????";
        const subject = doc.subject || "Support";
        const statusLabel = STATUS_LABELS[doc.status] || doc.status;
        const previousStatusLabel = STATUS_LABELS[previousDoc?.status] || previousDoc?.status || "N/A";
        const ticketUrl = `${baseUrl}/support/tickets/${doc.id}`;
        let contextMessage = "";
        if (doc.status === "waiting_client") {
          contextMessage = emailParagraph(
            "Nous avons besoin d'informations supplementaires de votre part pour continuer le traitement de votre demande. Merci de consulter le ticket et de nous repondre."
          );
        }
        await payload.sendEmail({
          to: client.email,
          ...supportEmail ? { replyTo: supportEmail } : {},
          subject: `[${ticketNumber}] Statut mis a jour : ${statusLabel}`,
          html: emailWrapper(`Mise a jour de votre ticket`, [
            emailParagraph(`Bonjour <strong>${escapeHtml(client.firstName)}</strong>,`),
            emailParagraph(`Le statut de votre ticket a ete mis a jour :`),
            `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">N&deg; Ticket</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;"><strong>${escapeHtml(String(ticketNumber))}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">Sujet</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;">${escapeHtml(String(subject))}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">Ancien statut</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;">${escapeHtml(String(previousStatusLabel))}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 12px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em;">Nouveau statut</td>
                <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;"><strong>${escapeHtml(String(statusLabel))}</strong></td>
              </tr>
            </table>`,
            contextMessage,
            emailButton("Consulter le ticket", ticketUrl)
          ].join(""))
        });
        payload.logger.info(`[tickets] Status change notification sent to ${client.email} for ${ticketNumber} (${previousDoc?.status} -> ${doc.status})`);
      } catch (error) {
        payload.logger.error(`[tickets] Failed to send status change email: ${error}`);
      }
    }
    return doc;
  };
}

// src/hooks/checkSLA.ts
function calculateBusinessHoursDeadline(start, minutes) {
  const BUSINESS_START = 9;
  const BUSINESS_END = 18;
  let remaining = minutes;
  const current = new Date(start);
  current.setMilliseconds(0);
  current.setSeconds(0);
  moveToBusinessHours(current, BUSINESS_START, BUSINESS_END);
  while (remaining > 0) {
    const day = current.getDay();
    if (day === 0) {
      current.setDate(current.getDate() + 1);
      current.setHours(BUSINESS_START, 0, 0, 0);
      continue;
    }
    if (day === 6) {
      current.setDate(current.getDate() + 2);
      current.setHours(BUSINESS_START, 0, 0, 0);
      continue;
    }
    const currentMinuteOfDay = current.getHours() * 60 + current.getMinutes();
    const endOfDayMinute = BUSINESS_END * 60;
    const minutesLeftToday = Math.max(0, endOfDayMinute - currentMinuteOfDay);
    if (remaining <= minutesLeftToday) {
      current.setMinutes(current.getMinutes() + remaining);
      remaining = 0;
    } else {
      remaining -= minutesLeftToday;
      current.setDate(current.getDate() + 1);
      current.setHours(BUSINESS_START, 0, 0, 0);
    }
  }
  return current;
}
function moveToBusinessHours(date, startHour, endHour) {
  const day = date.getDay();
  const hour = date.getHours();
  if (day === 0) {
    date.setDate(date.getDate() + 1);
    date.setHours(startHour, 0, 0, 0);
    return;
  }
  if (day === 6) {
    date.setDate(date.getDate() + 2);
    date.setHours(startHour, 0, 0, 0);
    return;
  }
  if (hour < startHour) {
    date.setHours(startHour, 0, 0, 0);
    return;
  }
  if (hour >= endHour) {
    date.setDate(date.getDate() + 1);
    date.setHours(startHour, 0, 0, 0);
    const newDay = date.getDay();
    if (newDay === 6) {
      date.setDate(date.getDate() + 2);
    } else if (newDay === 0) {
      date.setDate(date.getDate() + 1);
    }
  }
}
function calculateCalendarDeadline(start, minutes) {
  return new Date(start.getTime() + minutes * 60 * 1e3);
}
function field(doc, key) {
  return doc?.[key] ?? void 0;
}
function resolveId(value) {
  if (value === null || value === void 0) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "object") return value.id;
  return null;
}
async function resolveSlaPolicy(payload, ticket, slugs) {
  const policyRef = field(ticket, "slaPolicy");
  if (policyRef) {
    const policyId = typeof policyRef === "object" && policyRef !== null ? policyRef.id : policyRef;
    if (policyId) {
      try {
        if (typeof policyRef === "object" && policyRef.firstResponseTime) {
          return policyRef;
        }
        return await payload.findByID({
          collection: slugs.slaPolicies,
          id: policyId,
          depth: 0,
          overrideAccess: true
        });
      } catch {
      }
    }
  }
  const priority = field(ticket, "priority") || "normal";
  try {
    const defaults = await payload.find({
      collection: slugs.slaPolicies,
      where: {
        and: [
          { isDefault: { equals: true } },
          { priority: { equals: priority } }
        ]
      },
      limit: 1,
      depth: 0,
      overrideAccess: true
    });
    if (defaults.docs.length > 0) {
      return defaults.docs[0];
    }
  } catch {
  }
  return null;
}
async function handleSlaBreach(payload, ticket, type, slugs, notificationSlug) {
  const ticketNumber = ticket.ticketNumber || "TK-????";
  const subject = ticket.subject || "Support";
  const typeLabel = type === "first_response" ? "premiere reponse" : "resolution";
  await createAdminNotification(payload, {
    title: `SLA depasse : ${ticketNumber}`,
    message: `Le delai de ${typeLabel} a ete depasse pour le ticket ${ticketNumber} \u2014 ${subject}`,
    type: "sla_alert",
    link: `/admin/collections/${slugs.tickets}/${ticket.id}`
  }, notificationSlug);
  const policyRef = field(ticket, "slaPolicy");
  if (!policyRef) return;
  let policy = null;
  try {
    const policyId = typeof policyRef === "object" && policyRef !== null ? policyRef.id : policyRef;
    if (!policyId) return;
    if (typeof policyRef === "object" && policyRef.escalateOnBreach !== void 0) {
      policy = policyRef;
    } else {
      policy = await payload.findByID({
        collection: slugs.slaPolicies,
        id: policyId,
        depth: 0,
        overrideAccess: true
      });
    }
  } catch {
    return;
  }
  if (!policy?.escalateOnBreach || !policy.escalateTo) return;
  try {
    const escalateToId = typeof policy.escalateTo === "object" ? policy.escalateTo.id : policy.escalateTo;
    if (!escalateToId) return;
    const escalateUser = typeof policy.escalateTo === "object" && policy.escalateTo.email ? policy.escalateTo : await payload.findByID({
      collection: slugs.users,
      id: escalateToId,
      depth: 0,
      overrideAccess: true
    });
    if (!escalateUser?.email) return;
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
    const adminUrl = `${baseUrl}/admin/collections/${slugs.tickets}/${ticket.id}`;
    const settings = await readSupportSettings(payload);
    const supportEmail = settings.email.replyToAddress || settings.sla.escalationEmail || process.env.SUPPORT_EMAIL || "";
    await payload.sendEmail({
      to: escalateUser.email,
      ...supportEmail ? { replyTo: supportEmail } : {},
      subject: `SLA depasse : [${ticketNumber}] ${subject}`,
      html: emailWrapper(`SLA depasse \u2014 ${ticketNumber}`, [
        emailParagraph(`Le delai de <strong>${typeLabel}</strong> a ete depasse pour le ticket <strong>${ticketNumber}</strong> \u2014 <em>${subject}</em>.`),
        emailParagraph(`Ce ticket necessite une attention immediate.`),
        emailButton("Ouvrir le ticket", adminUrl, "dark")
      ].join(""))
    });
    console.log(`[sla] Escalation email sent to ${escalateUser.email} for ${ticketNumber} (${type})`);
  } catch (err) {
    console.error("[sla] Failed to send escalation email:", err);
  }
}
function createAssignSlaDeadlines(slugs, notificationSlug = "admin-notifications") {
  return async ({ doc, previousDoc, operation, req }) => {
    const { payload } = req;
    const isCreate = operation === "create";
    const policyChanged = operation === "update" && (resolveId(field(doc, "slaPolicy")) !== resolveId(field(previousDoc, "slaPolicy")) || field(doc, "priority") !== field(previousDoc, "priority"));
    if (!isCreate && !policyChanged) return doc;
    try {
      const policy = await resolveSlaPolicy(payload, doc, slugs);
      if (!policy) return doc;
      const createdAt = new Date(doc.createdAt);
      const businessOnly = policy.businessHoursOnly;
      const firstResponseMinutes = policy.firstResponseTime;
      const resolutionMinutes = policy.resolutionTime;
      const calcDeadline = businessOnly ? calculateBusinessHoursDeadline : calculateCalendarDeadline;
      const slaFirstResponseDue = calcDeadline(createdAt, firstResponseMinutes).toISOString();
      const slaResolutionDue = calcDeadline(createdAt, resolutionMinutes).toISOString();
      const updateData = {
        slaFirstResponseDue,
        slaResolutionDue
      };
      if (!field(doc, "slaPolicy") && policy.id) {
        updateData.slaPolicy = policy.id;
      }
      await payload.update({
        collection: slugs.tickets,
        id: doc.id,
        data: updateData,
        overrideAccess: true
      });
    } catch (err) {
      console.error("[sla] Failed to assign SLA deadlines:", err);
    }
    return doc;
  };
}
function createCheckSlaOnResolve(slugs, notificationSlug = "admin-notifications") {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== "update") return doc;
    if (previousDoc?.status === doc.status) return doc;
    if (doc.status !== "resolved") return doc;
    if (!doc.slaResolutionDue) return doc;
    if (doc.slaResolutionBreached !== void 0 && doc.slaResolutionBreached !== null) return doc;
    try {
      const { payload } = req;
      const now = /* @__PURE__ */ new Date();
      const deadline = new Date(doc.slaResolutionDue);
      const breached = now > deadline;
      await payload.update({
        collection: slugs.tickets,
        id: doc.id,
        data: { slaResolutionBreached: breached },
        overrideAccess: true
      });
      if (breached) {
        await handleSlaBreach(payload, doc, "resolution", slugs, notificationSlug);
      }
    } catch (err) {
      console.error("[sla] Failed to check SLA on resolve:", err);
    }
    return doc;
  };
}
function createCheckSlaOnReply(slugs, notificationSlug = "admin-notifications") {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return doc;
    if (doc.authorType !== "admin" || doc.isInternal) return doc;
    try {
      const { payload } = req;
      const ticketId = typeof doc.ticket === "object" ? doc.ticket.id : doc.ticket;
      const ticket = await payload.findByID({
        collection: slugs.tickets,
        id: ticketId,
        depth: 1,
        overrideAccess: true
      });
      if (!ticket) return doc;
      if (ticket.slaFirstResponseBreached !== void 0 && ticket.slaFirstResponseBreached !== null) return doc;
      if (!ticket.slaFirstResponseDue) return doc;
      const now = /* @__PURE__ */ new Date();
      const deadline = new Date(ticket.slaFirstResponseDue);
      const breached = now > deadline;
      await payload.update({
        collection: slugs.tickets,
        id: ticketId,
        data: { slaFirstResponseBreached: breached },
        overrideAccess: true
      });
      if (breached) {
        await handleSlaBreach(payload, ticket, "first_response", slugs, notificationSlug);
      }
    } catch (err) {
      console.error("[sla] Failed to check SLA on reply:", err);
    }
    return doc;
  };
}

// src/collections/Tickets.ts
function createAssignTicketNumber(slugs) {
  return async ({ data, operation, req }) => {
    if (operation === "create") {
      let retries = 3;
      while (retries > 0) {
        try {
          const countResult = await req.payload.count({
            collection: slugs.tickets,
            overrideAccess: true
          });
          const baseNumber = countResult.totalDocs + 1;
          data.ticketNumber = `TK-${String(baseNumber).padStart(4, "0")}`;
          const existing = await req.payload.find({
            collection: slugs.tickets,
            where: { ticketNumber: { equals: data.ticketNumber } },
            limit: 1,
            depth: 0,
            overrideAccess: true
          });
          if (existing.docs.length > 0) {
            const suffix = Date.now() % 1e4;
            data.ticketNumber = `TK-${String(baseNumber + suffix).padStart(4, "0")}`;
          }
          break;
        } catch (error) {
          if (retries > 1 && (error?.message?.includes("UNIQUE") || error?.message?.includes("unique") || error?.code === "SQLITE_CONSTRAINT")) {
            retries--;
            continue;
          }
          throw error;
        }
      }
    }
    return data;
  };
}
function createAssignClientOnCreate(slugs) {
  return async ({ data, operation, req }) => {
    if (operation === "create" && req.user?.collection === slugs.supportClients && !data.client) {
      data.client = req.user.id;
    }
    return data;
  };
}
var autoPaidAt = async ({ data, operation, originalDoc }) => {
  if (operation !== "update") return data;
  if (data.paymentStatus === "paid" && originalDoc?.paymentStatus !== "paid" && !data.paidAt) {
    data.paidAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  return data;
};
function createRestrictClientUpdates(slugs) {
  return async ({ data, operation, req, originalDoc }) => {
    if (operation !== "update") return data;
    if (req.user?.collection !== slugs.supportClients) return data;
    const allowedStatuses = ["open", "resolved"];
    const newData = {};
    if (data.status && allowedStatuses.includes(data.status)) {
      newData.status = data.status;
    }
    return { ...originalDoc, ...newData };
  };
}
function createAutoAssignAdmin(slugs) {
  return async ({ data, operation, req }) => {
    if (operation === "create" && !data.assignedTo) {
      const { payload } = req;
      let roundRobinEnabled = false;
      try {
        const prefs = await payload.find({
          collection: "payload-preferences",
          where: { key: { equals: "support-round-robin" } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        if (prefs.docs.length > 0) {
          roundRobinEnabled = prefs.docs[0].value?.enabled === true;
        }
      } catch (err) {
        console.warn("[support] Failed to read round-robin preferences:", err);
      }
      const admins = await payload.find({
        collection: slugs.users,
        limit: 100,
        depth: 0,
        overrideAccess: true
      });
      if (admins.docs.length === 0) return data;
      if (roundRobinEnabled && admins.docs.length > 1) {
        const counts = await Promise.all(
          admins.docs.map(async (admin) => {
            const result = await payload.count({
              collection: slugs.tickets,
              where: { assignedTo: { equals: admin.id }, status: { in: ["open", "waiting_client"] } },
              overrideAccess: true
            });
            return { id: admin.id, count: result.totalDocs };
          })
        );
        counts.sort((a, b) => a.count - b.count);
        data.assignedTo = counts[0].id;
      } else {
        data.assignedTo = admins.docs[0].id;
      }
    }
    return data;
  };
}
function createTrackSLA(slugs) {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== "update") return doc;
    const statusChanged = previousDoc?.status !== doc.status;
    if (statusChanged && doc.status === "resolved" && !doc.resolvedAt) {
      await req.payload.update({
        collection: slugs.tickets,
        id: doc.id,
        data: { resolvedAt: (/* @__PURE__ */ new Date()).toISOString() },
        overrideAccess: true
      });
    }
    return doc;
  };
}
function createTrackAiSummaryOnResolve(slugs) {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== "update" || !previousDoc) return doc;
    const wasResolved = previousDoc.status === "resolved";
    const isResolved = doc.status === "resolved";
    if (wasResolved && !isResolved && doc.aiSummary) {
      try {
        await req.payload.update({
          collection: slugs.tickets,
          id: doc.id,
          data: { aiSummary: null, aiSummaryGeneratedAt: null, aiSummaryStatus: null },
          overrideAccess: true
        });
      } catch (err) {
        console.error("[support] Failed to clear ai summary on reopen:", err);
      }
      return doc;
    }
    if (!wasResolved && isResolved && !doc.aiSummary) {
      setImmediate(() => {
        generateTicketSynthesis({ payload: req.payload, slugs, ticketId: doc.id }).catch((err) => console.error("[support] Background ai synthesis failed:", err));
      });
    }
    return doc;
  };
}
function createLogTicketActivity(slugs) {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== "update" || !previousDoc) return doc;
    const changes = [];
    const trackedFields = ["status", "priority", "category", "assignedTo"];
    const displayVal = (val) => {
      if (val === null || val === void 0 || val === "") return "(vide)";
      if (typeof val === "object") {
        const obj = val;
        return String(obj.email || obj.name || obj.title || obj.id || JSON.stringify(val));
      }
      return String(val);
    };
    for (const field2 of trackedFields) {
      const oldVal = previousDoc[field2];
      const newVal = doc[field2];
      const oldId = typeof oldVal === "object" && oldVal !== null ? oldVal.id : oldVal;
      const newId = typeof newVal === "object" && newVal !== null ? newVal.id : newVal;
      if (oldId !== newId) {
        changes.push({ field: field2, oldValue: displayVal(oldVal), newValue: displayVal(newVal) });
      }
    }
    if (changes.length === 0) return doc;
    const actorType = req.user?.collection === slugs.users ? "admin" : "client";
    for (const change of changes) {
      try {
        await req.payload.create({
          collection: slugs.ticketActivityLog,
          data: {
            ticket: doc.id,
            action: `${change.field}_changed`,
            detail: `${change.field}: ${change.oldValue || "(vide)"} \u2192 ${change.newValue}`,
            actorType,
            actorEmail: req.user?.email || "system"
          },
          overrideAccess: true
        });
      } catch (err) {
        console.error("[support] Failed to log activity:", err);
      }
    }
    return doc;
  };
}
function createNotifyOnAssignment(slugs) {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== "update" || !previousDoc) return doc;
    const oldAssigned = typeof previousDoc.assignedTo === "object" ? previousDoc.assignedTo?.id : previousDoc.assignedTo;
    const newAssigned = typeof doc.assignedTo === "object" ? doc.assignedTo?.id : doc.assignedTo;
    if (!newAssigned || oldAssigned === newAssigned) return doc;
    try {
      const assignee = typeof doc.assignedTo === "object" && doc.assignedTo?.email ? doc.assignedTo : await req.payload.findByID({ collection: slugs.users, id: newAssigned, depth: 0, overrideAccess: true });
      if (!assignee?.email) return doc;
      const settings = await readSupportSettings(req.payload);
      const ticketNumber = doc.ticketNumber || "TK-????";
      const subject = doc.subject || "Support";
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
      const replyTo = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || "";
      await req.payload.sendEmail({
        to: assignee.email,
        ...replyTo ? { replyTo } : {},
        subject: `Ticket assigne : [${ticketNumber}] ${subject}`,
        html: `<p>Le ticket <strong>${escapeHtml(ticketNumber)}</strong> \u2014 <em>${escapeHtml(subject)}</em> \u2014 vous a ete assigne.</p><p><a href="${baseUrl}/admin/collections/${slugs.tickets}/${doc.id}">Ouvrir le ticket</a></p>`
      });
    } catch (err) {
      console.error("[support] Failed to notify on assignment:", err);
    }
    return doc;
  };
}
function createNotifyClientOnResolve(slugs) {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== "update" || !previousDoc) return doc;
    if (previousDoc.status === doc.status || doc.status !== "resolved") return doc;
    try {
      const client = typeof doc.client === "object" ? doc.client : null;
      const clientId = typeof doc.client === "number" ? doc.client : client?.id;
      const clientData = client?.email ? client : clientId ? await req.payload.findByID({
        collection: slugs.supportClients,
        id: clientId,
        depth: 0,
        overrideAccess: true
      }) : null;
      if (!clientData?.email || clientData.notifyOnStatusChange === false) return doc;
      const settings = await readSupportSettings(req.payload);
      const ticketNumber = doc.ticketNumber || "TK-????";
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
      const replyTo = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || "";
      await req.payload.sendEmail({
        to: clientData.email,
        ...replyTo ? { replyTo } : {},
        subject: `[${ticketNumber}] Ticket resolu`,
        html: `<p>Bonjour ${escapeHtml(clientData.firstName || "")},</p><p>Votre ticket <strong>${escapeHtml(ticketNumber)}</strong> a ete resolu.</p><p><a href="${baseUrl}/support/tickets/${doc.id}">Consulter le ticket</a></p>`
      });
    } catch (err) {
      console.error("[support] Failed to notify client on resolve:", err);
    }
    return doc;
  };
}
function createAutoCalculateSLA(slugs) {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return doc;
    try {
      const { payload } = req;
      const ticketPriority = doc.priority || "normal";
      let policy = null;
      const byPriority = await payload.find({
        collection: slugs.slaPolicies,
        where: { priority: { equals: ticketPriority } },
        limit: 1,
        depth: 0,
        overrideAccess: true
      });
      if (byPriority.docs.length > 0) {
        policy = byPriority.docs[0];
      } else {
        const defaults = await payload.find({
          collection: slugs.slaPolicies,
          where: { isDefault: { equals: true } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });
        if (defaults.docs.length > 0) {
          policy = defaults.docs[0];
        }
      }
      if (!policy) return doc;
      const now = /* @__PURE__ */ new Date();
      const firstResponseMinutes = policy.firstResponseTime || 240;
      const resolutionMinutes = policy.resolutionTime || 1440;
      const firstResponseDue = new Date(now.getTime() + firstResponseMinutes * 6e4);
      const resolutionDue = new Date(now.getTime() + resolutionMinutes * 6e4);
      await payload.update({
        collection: slugs.tickets,
        id: doc.id,
        data: {
          slaPolicy: policy.id,
          slaFirstResponseDue: firstResponseDue.toISOString(),
          slaResolutionDue: resolutionDue.toISOString()
        },
        overrideAccess: true
      });
    } catch (err) {
      console.error("[support] Failed to auto-calculate SLA:", err);
    }
    return doc;
  };
}
function createFireTicketWebhooks(slugs) {
  return async ({ doc, previousDoc, operation, req }) => {
    const { payload } = req;
    if (operation === "create") {
      fireWebhooks(payload, slugs, "ticket_created", {
        id: doc.id,
        ticketNumber: doc.ticketNumber,
        subject: doc.subject,
        status: doc.status,
        priority: doc.priority,
        category: doc.category
      });
      return doc;
    }
    if (operation === "update" && previousDoc) {
      if (previousDoc.status !== doc.status && doc.status === "resolved") {
        fireWebhooks(payload, slugs, "ticket_resolved", {
          id: doc.id,
          ticketNumber: doc.ticketNumber,
          subject: doc.subject,
          previousStatus: previousDoc.status
        });
        const clientId = typeof doc.client === "object" ? doc.client?.id : doc.client;
        if (clientId) {
          payload.update({
            collection: "client-summaries",
            where: { client: { equals: clientId } },
            data: { generatedAt: (/* @__PURE__ */ new Date(0)).toISOString() },
            // Force cache expiry
            overrideAccess: true
          }).catch(() => {
          });
        }
      }
      const oldAssigned = typeof previousDoc.assignedTo === "object" ? previousDoc.assignedTo?.id : previousDoc.assignedTo;
      const newAssigned = typeof doc.assignedTo === "object" ? doc.assignedTo?.id : doc.assignedTo;
      if (newAssigned && oldAssigned !== newAssigned) {
        fireWebhooks(payload, slugs, "ticket_assigned", {
          id: doc.id,
          ticketNumber: doc.ticketNumber,
          subject: doc.subject,
          assignedTo: newAssigned
        });
      }
    }
    return doc;
  };
}
function createNotifyAdminOnNewTicket(slugs, notificationSlug) {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return doc;
    try {
      const ticketNumber = doc.ticketNumber || "TK-????";
      const subject = doc.subject || "Support";
      await createAdminNotification(req.payload, {
        title: `Nouveau ticket : ${ticketNumber}`,
        message: `${ticketNumber} \u2014 ${subject}`,
        type: "new_ticket",
        link: `/admin/collections/${slugs.tickets}/${doc.id}`
      }, notificationSlug);
    } catch (err) {
      console.error("[support] Failed to create admin notification on new ticket:", err);
    }
    return doc;
  };
}
function createDispatchWebhookOnTicket(slugs) {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation === "create") {
      dispatchWebhook(
        { ticketId: doc.id, ticketNumber: doc.ticketNumber, subject: doc.subject },
        "ticket_created",
        req.payload,
        slugs
      );
    }
    if (operation === "update" && previousDoc?.status !== doc.status && doc.status === "resolved") {
      dispatchWebhook(
        { ticketId: doc.id, ticketNumber: doc.ticketNumber, subject: doc.subject },
        "ticket_resolved",
        req.payload,
        slugs
      );
    }
    return doc;
  };
}
function createCascadeDelete(slugs) {
  return async ({ id, req }) => {
    const collections = [slugs.ticketMessages, slugs.ticketActivityLog, slugs.timeEntries, slugs.satisfactionSurveys];
    for (const slug of collections) {
      await req.payload.delete({
        collection: slug,
        where: { ticket: { equals: id } },
        overrideAccess: true
      });
    }
  };
}
function createTicketsCollection(slugs, options) {
  const notificationSlug = options?.notificationSlug || "admin-notifications";
  const dynamicFields = [];
  dynamicFields.push({
    name: "conversation",
    type: "ui",
    admin: {
      components: {
        Field: options?.conversationComponent || "@consilioweb/payload-support/components/TicketConversation"
      }
    }
  });
  if (options?.projectCollectionSlug) {
    dynamicFields.push({
      name: "project",
      type: "relationship",
      relationTo: options.projectCollectionSlug,
      label: "Projet",
      admin: { position: "sidebar" }
    });
  }
  const billingFields = [
    {
      type: "row",
      fields: [
        {
          name: "billingType",
          type: "select",
          label: "Type de facturation",
          defaultValue: "hourly",
          options: [
            { label: "Au temps pass\xE9", value: "hourly" },
            { label: "Forfait", value: "flat" }
          ],
          admin: { width: "33%" }
        },
        {
          name: "flatRateAmount",
          type: "number",
          label: "Montant forfait (EUR)",
          admin: {
            width: "33%",
            condition: (data) => data?.billingType === "flat"
          }
        },
        {
          name: "billedAmount",
          type: "number",
          label: "Montant factur\xE9 (EUR)",
          admin: { width: "33%" }
        }
      ]
    },
    {
      type: "row",
      fields: [
        ...options?.documentsCollectionSlug ? [
          {
            name: "quote",
            type: "upload",
            relationTo: options.documentsCollectionSlug,
            label: "Devis",
            admin: { width: "50%" }
          },
          {
            name: "invoice",
            type: "upload",
            relationTo: options.documentsCollectionSlug,
            label: "Facture",
            admin: { width: "50%" }
          }
        ] : []
      ]
    },
    {
      type: "row",
      fields: [
        {
          name: "paymentStatus",
          type: "select",
          label: "Statut de paiement",
          defaultValue: "unpaid",
          options: [
            { label: "Non pay\xE9", value: "unpaid" },
            { label: "Paiement partiel", value: "partial" },
            { label: "Pay\xE9", value: "paid" }
          ],
          access: { update: ({ req }) => req.user?.collection === "users" },
          admin: { width: "50%", condition: (data) => !!data?.invoice }
        },
        {
          name: "paidAt",
          type: "date",
          label: "Pay\xE9 le",
          admin: { width: "33%", date: { displayFormat: "dd/MM/yyyy HH:mm" } }
        }
      ]
    }
  ];
  return {
    slug: slugs.tickets,
    labels: { singular: "Ticket", plural: "Tickets" },
    admin: {
      useAsTitle: "subject",
      group: "Support",
      defaultColumns: ["ticketNumber", "subject", "status", "priority", "category", "client", "updatedAt"],
      listSearchableFields: ["ticketNumber", "subject"]
    },
    fields: [
      // Conversation UI field first
      ...dynamicFields,
      { name: "subject", type: "text", required: true, label: "Sujet" },
      {
        type: "row",
        fields: [
          {
            name: "status",
            type: "select",
            defaultValue: "open",
            label: "Statut",
            options: [
              { label: "Ouvert", value: "open" },
              { label: "En attente client", value: "waiting_client" },
              { label: "Resolu", value: "resolved" }
            ],
            admin: { width: "50%" }
          },
          {
            name: "priority",
            type: "select",
            defaultValue: "normal",
            label: "Priorite",
            options: [
              { label: "Basse", value: "low" },
              { label: "Normale", value: "normal" },
              { label: "Haute", value: "high" },
              { label: "Urgente", value: "urgent" }
            ],
            admin: { width: "50%" }
          }
        ]
      },
      {
        type: "row",
        fields: [
          { name: "client", type: "relationship", relationTo: slugs.supportClients, required: true, label: "Client", admin: { width: "50%" } }
        ]
      },
      // Billing collapsible
      {
        type: "collapsible",
        label: "Facturation",
        admin: { initCollapsed: true },
        fields: billingFields
      },
      // AI Synthesis collapsible — auto-filled when ticket is resolved
      {
        type: "collapsible",
        label: "Synthese IA",
        admin: {
          initCollapsed: true,
          description: "Recap factuel genere automatiquement au passage en resolu. Sert au copier-coller dans devis/factures."
        },
        fields: [
          {
            name: "aiSummary",
            type: "textarea",
            label: "Synthese",
            admin: {
              readOnly: true,
              rows: 8,
              description: "Vide tant que le ticket n'est pas resolu. Effacee si le ticket est reouvert."
            }
          },
          {
            type: "row",
            fields: [
              {
                name: "aiSummaryGeneratedAt",
                type: "date",
                label: "Genere le",
                admin: { readOnly: true, width: "50%", date: { displayFormat: "dd/MM/yyyy HH:mm" } }
              },
              {
                name: "aiSummaryStatus",
                type: "select",
                label: "Statut",
                options: [
                  { label: "En cours", value: "pending" },
                  { label: "Genere", value: "done" },
                  { label: "Erreur", value: "error" }
                ],
                admin: { readOnly: true, width: "50%" }
              }
            ]
          }
        ]
      },
      // SLA & Delais
      {
        type: "collapsible",
        label: "SLA & Delais",
        admin: { initCollapsed: true },
        fields: [
          {
            type: "row",
            fields: [
              { name: "firstResponseAt", type: "date", label: "Premiere reponse", admin: { readOnly: true, width: "50%", date: { displayFormat: "dd/MM/yyyy HH:mm" } } },
              { name: "resolvedAt", type: "date", label: "Date de resolution", admin: { readOnly: true, width: "50%", date: { displayFormat: "dd/MM/yyyy HH:mm" } } }
            ]
          },
          {
            type: "row",
            fields: [
              { name: "slaFirstResponseDue", type: "date", label: "Echeance 1ere reponse (SLA)", admin: { readOnly: true, width: "50%", date: { displayFormat: "dd/MM/yyyy HH:mm" } } },
              { name: "slaResolutionDue", type: "date", label: "Echeance resolution (SLA)", admin: { readOnly: true, width: "50%", date: { displayFormat: "dd/MM/yyyy HH:mm" } } }
            ]
          },
          {
            type: "row",
            fields: [
              { name: "slaFirstResponseBreached", type: "checkbox", label: "1ere reponse depassee", admin: { readOnly: true, width: "50%" } },
              { name: "slaResolutionBreached", type: "checkbox", label: "Resolution depassee", admin: { readOnly: true, width: "50%" } }
            ]
          }
        ]
      },
      // Systeme
      {
        type: "collapsible",
        label: "Systeme",
        admin: { initCollapsed: true },
        fields: [
          { name: "chatSession", type: "text", label: "Session Chat", admin: { readOnly: true } },
          {
            type: "row",
            fields: [
              { name: "lastClientReadAt", type: "date", label: "Derniere lecture client", admin: { readOnly: true, width: "50%", date: { displayFormat: "dd/MM/yyyy HH:mm" } } },
              { name: "lastAdminReadAt", type: "date", label: "Derniere lecture admin", admin: { readOnly: true, width: "50%", date: { displayFormat: "dd/MM/yyyy HH:mm" } } },
              { name: "lastClientMessageAt", type: "date", label: "Dernier message client", admin: { readOnly: true, width: "50%", date: { displayFormat: "dd/MM/yyyy HH:mm" } } }
            ]
          },
          { name: "mergedInto", type: "relationship", relationTo: slugs.tickets, label: "Fusionne dans", admin: { readOnly: true } },
          { name: "autoCloseRemindedAt", type: "date", label: "Rappel auto-close envoye", admin: { readOnly: true, date: { displayFormat: "dd/MM/yyyy HH:mm" } } }
        ]
      },
      // Sidebar
      { name: "ticketNumber", type: "text", unique: true, label: "N\xB0 Ticket", admin: { position: "sidebar" } },
      { name: "slaPolicy", type: "relationship", relationTo: slugs.slaPolicies, label: "Politique SLA", admin: { position: "sidebar" } },
      {
        name: "category",
        type: "select",
        label: "Categorie",
        options: [
          { label: "Bug / Dysfonctionnement", value: "bug" },
          { label: "Modification de contenu", value: "content" },
          { label: "Nouvelle fonctionnalite", value: "feature" },
          { label: "Question / Aide", value: "question" },
          { label: "Hebergement / Domaine", value: "hosting" }
        ],
        admin: { position: "sidebar" }
      },
      { name: "assignedTo", type: "relationship", relationTo: slugs.users, label: "Assigne a", admin: { position: "sidebar" } },
      {
        name: "source",
        type: "select",
        defaultValue: "portal",
        label: "Source",
        options: [
          { label: "Portail client", value: "portal" },
          { label: "Chat en direct", value: "live-chat" },
          { label: "Email", value: "email" },
          { label: "Admin", value: "admin" }
        ],
        admin: { position: "sidebar" }
      },
      {
        name: "tags",
        type: "select",
        hasMany: true,
        label: "Tags",
        options: [
          { label: "Urgent client", value: "urgent-client" },
          { label: "Facturable", value: "facturable" },
          { label: "Bug critique", value: "bug-critique" },
          { label: "En attente info", value: "attente-info" },
          { label: "Evolution", value: "evolution" },
          { label: "Maintenance", value: "maintenance" },
          { label: "Design", value: "design" },
          { label: "SEO", value: "seo" },
          { label: "SMS", value: "sms" },
          { label: "WhatsApp", value: "whatsapp" }
        ],
        admin: { position: "sidebar" }
      },
      { name: "relatedTickets", type: "relationship", relationTo: slugs.tickets, hasMany: true, label: "Tickets lies", admin: { position: "sidebar" } },
      { name: "snoozeUntil", type: "date", label: "Snooze jusqu'au", admin: { position: "sidebar", date: { pickerAppearance: "dayAndTime", displayFormat: "dd/MM/yyyy HH:mm" } } },
      // Billing sidebar
      { name: "billable", type: "checkbox", defaultValue: true, label: "Facturable", admin: { position: "sidebar" } },
      {
        name: "showTimeToClient",
        type: "checkbox",
        defaultValue: true,
        label: "Afficher le temps au client",
        admin: {
          position: "sidebar",
          description: "Auto-d\xE9sactiv\xE9 en mode forfait",
          condition: (data) => data?.billingType !== "flat"
        }
      },
      { name: "totalTimeMinutes", type: "number", defaultValue: 0, label: "Temps total (minutes)", admin: { readOnly: true, position: "sidebar" } }
    ],
    hooks: {
      beforeChange: [
        createAssignTicketNumber(slugs),
        createAssignClientOnCreate(slugs),
        createAutoAssignAdmin(slugs),
        autoPaidAt,
        createRestrictClientUpdates(slugs)
      ],
      afterChange: [
        createTrackSLA(slugs),
        createTrackAiSummaryOnResolve(slugs),
        createAutoCalculateSLA(slugs),
        createAssignSlaDeadlines(slugs, notificationSlug),
        createCheckSlaOnResolve(slugs, notificationSlug),
        createLogTicketActivity(slugs),
        createNotifyOnAssignment(slugs),
        createNotifyClientOnResolve(slugs),
        createTicketStatusEmail(slugs),
        createNotifyAdminOnNewTicket(slugs, notificationSlug),
        createFireTicketWebhooks(slugs),
        createDispatchWebhookOnTicket(slugs)
      ],
      beforeDelete: [createCascadeDelete(slugs)]
    },
    access: {
      create: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) return true;
        return false;
      },
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) {
          return { client: { equals: req.user.id } };
        }
        return false;
      },
      update: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) {
          return { client: { equals: req.user.id } };
        }
        return false;
      },
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    timestamps: true
  };
}

// src/collections/TicketMessages.ts
function createAssignAuthor(slugs) {
  return async ({ data, operation, req }) => {
    if (operation === "create" && req.user?.collection === slugs.supportClients) {
      data.authorType = "client";
      data.authorClient = req.user.id;
      data.isInternal = false;
    }
    return data;
  };
}
function createAutoUpdateStatus(slugs) {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return doc;
    if (doc.scheduledAt && !doc.scheduledSent) return doc;
    try {
      const ticketId = typeof doc.ticket === "object" ? doc.ticket.id : doc.ticket;
      const ticket = await req.payload.findByID({ collection: slugs.tickets, id: ticketId, depth: 0, overrideAccess: true });
      if (!ticket) return doc;
      const updateData = {};
      if (!doc.isInternal) {
        if (doc.authorType === "admin") {
          updateData.status = "waiting_client";
        } else if (doc.authorType === "client" || doc.authorType === "email") {
          updateData.lastClientMessageAt = (/* @__PURE__ */ new Date()).toISOString();
          if (ticket.status && ["waiting_client", "resolved"].includes(ticket.status)) {
            updateData.status = "open";
          }
        }
      }
      await req.payload.update({ collection: slugs.tickets, id: ticketId, data: updateData, overrideAccess: true });
    } catch (err) {
      console.error("[support] Failed to auto-update ticket status:", err);
    }
    return doc;
  };
}
function createNotifyClient(slugs) {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return doc;
    if (doc.authorType !== "admin" || doc.isInternal || doc.skipNotification) return doc;
    if (doc.scheduledAt && !doc.scheduledSent) return doc;
    try {
      const ticketId = typeof doc.ticket === "object" ? doc.ticket.id : doc.ticket;
      const ticket = await req.payload.findByID({ collection: slugs.tickets, id: ticketId, depth: 1, overrideAccess: true });
      if (!ticket) return doc;
      const client = typeof ticket.client === "object" ? ticket.client : null;
      if (!client?.email) return doc;
      if (client.notifyOnReply === false) return doc;
      const settings = await readSupportSettings(req.payload);
      const ticketNumber = ticket.ticketNumber || "TK-????";
      const subject = ticket.subject || "Support";
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
      const supportEmail = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || "";
      const portalUrl = `${baseUrl}/support/tickets/${ticketId}`;
      const rawContent = doc.bodyHtml ? emailRichContent(doc.bodyHtml) : emailQuote(doc.body?.length > 500 ? doc.body.slice(0, 500) + "..." : doc.body);
      await req.payload.sendEmail({
        to: client.email,
        ...supportEmail ? { replyTo: supportEmail } : {},
        subject: `Re: [${ticketNumber}] ${subject}`,
        html: emailWrapper(`Nouvelle reponse \u2014 ${ticketNumber}`, [
          emailParagraph(`Bonjour <strong>${escapeHtml(client.firstName || "")}</strong>,`),
          emailParagraph(`Notre equipe a apporte une reponse a votre ticket <strong>${escapeHtml(ticketNumber)}</strong> \u2014 <em>${escapeHtml(subject)}</em>.`),
          rawContent,
          emailButton("Consulter le ticket", portalUrl),
          emailParagraph('<span style="font-size: 13px; color: #6b7280;">Vous pouvez egalement repondre directement a cet email. Votre message sera automatiquement ajoute au ticket.</span>'),
          emailTrackingPixel(ticketId, doc.id)
        ].join(""))
      });
      await req.payload.update({
        collection: slugs.ticketMessages,
        id: doc.id,
        data: { emailSentAt: (/* @__PURE__ */ new Date()).toISOString(), emailSentTo: client.email },
        overrideAccess: true
      });
    } catch (err) {
      console.error("[support] Failed to notify client:", err);
    }
    return doc;
  };
}
function createTrackFirstResponse(slugs) {
  return async ({ doc, operation, req }) => {
    if (operation !== "create" || doc.authorType !== "admin" || doc.isInternal) return doc;
    try {
      const ticketId = typeof doc.ticket === "object" ? doc.ticket.id : doc.ticket;
      const ticket = await req.payload.findByID({ collection: slugs.tickets, id: ticketId, depth: 0, overrideAccess: true });
      if (ticket && !ticket.firstResponseAt) {
        await req.payload.update({ collection: slugs.tickets, id: ticketId, data: { firstResponseAt: (/* @__PURE__ */ new Date()).toISOString() }, overrideAccess: true });
      }
    } catch (err) {
      console.error("[support] Failed to track first response:", err);
    }
    return doc;
  };
}
function createSyncTicketReplyToChat(slugs) {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return doc;
    if (doc.authorType !== "admin" || doc.isInternal) return doc;
    try {
      const { payload } = req;
      const ticketId = typeof doc.ticket === "object" ? doc.ticket.id : doc.ticket;
      const ticket = await payload.findByID({
        collection: slugs.tickets,
        id: ticketId,
        depth: 0,
        overrideAccess: true
      });
      if (!ticket?.chatSession) return doc;
      if (doc.skipNotification) return doc;
      const clientId = typeof ticket.client === "object" ? ticket.client.id : ticket.client;
      await payload.create({
        collection: slugs.chatMessages,
        data: {
          session: ticket.chatSession,
          client: clientId,
          senderType: "agent",
          message: doc.body,
          status: "active",
          ticket: ticketId
        },
        overrideAccess: true
      });
    } catch (err) {
      console.error("[support] Failed to sync reply to chat:", err);
    }
    return doc;
  };
}
function createNotifyAdminOnClientMessage(slugs, notificationSlug) {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return doc;
    if (doc.authorType !== "client" && doc.authorType !== "email") return doc;
    if (doc.skipNotification) return doc;
    try {
      const { payload } = req;
      const ticketId = typeof doc.ticket === "object" ? doc.ticket.id : doc.ticket;
      const ticket = await payload.findByID({
        collection: slugs.tickets,
        id: ticketId,
        depth: 1,
        overrideAccess: true
      });
      if (!ticket) return doc;
      const client = typeof ticket.client === "object" ? ticket.client : null;
      const settings = await readSupportSettings(payload);
      const clientName = client?.firstName || "Client";
      const clientEmail = client?.email || "inconnu";
      const ticketNumber = ticket.ticketNumber || "TK-????";
      const subject = ticket.subject || "Support";
      const supportEmail = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || "";
      const contactEmail = process.env.CONTACT_EMAIL || supportEmail;
      const assignedAdmin = typeof ticket.assignedTo === "object" ? ticket.assignedTo : null;
      const assignedEmail = assignedAdmin?.email;
      const primaryEmail = contactEmail;
      const ccEmail = assignedEmail && assignedEmail !== contactEmail ? assignedEmail : void 0;
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
      const adminUrl = `${baseUrl}/admin/collections/${slugs.tickets}/${ticketId}`;
      const messageCount = await payload.count({
        collection: slugs.ticketMessages,
        where: { ticket: { equals: ticketId } },
        overrideAccess: true
      });
      const isNewTicket = messageCount.totalDocs <= 1;
      if (!isNewTicket) {
        await createAdminNotification(payload, {
          title: `Reponse client \u2014 ${ticketNumber}`,
          message: `${clientName} a repondu au ticket ${ticketNumber}`,
          type: "client_message",
          link: `/admin/collections/${slugs.tickets}/${ticketId}`
        }, notificationSlug);
      }
      const preview = doc.body?.length > 500 ? doc.body.slice(0, 500) + "..." : doc.body;
      const headerTitle = isNewTicket ? `Nouveau ticket ${ticketNumber}` : `Nouveau message \u2014 ${ticketNumber}`;
      if (primaryEmail) {
        await payload.sendEmail({
          to: primaryEmail,
          ...ccEmail ? { cc: ccEmail } : {},
          ...clientEmail !== "inconnu" ? { replyTo: clientEmail } : supportEmail ? { replyTo: supportEmail } : {},
          subject: `${isNewTicket ? "Nouveau ticket" : "Reponse client"} [${ticketNumber}] ${subject}`,
          html: emailWrapper(headerTitle, [
            emailParagraph(`<strong>${escapeHtml(clientName)}</strong> (${escapeHtml(clientEmail)}) a ${isNewTicket ? "ouvert un nouveau ticket" : "repondu au ticket"} <strong>${escapeHtml(ticketNumber)}</strong> :`),
            `<p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #374151;">Sujet : ${escapeHtml(subject)}</p>`,
            emailQuote(preview, isNewTicket ? "#FFD600" : "#00E5FF"),
            emailButton("Ouvrir dans l'admin", adminUrl, "dark")
          ].join(""), { headerColor: isNewTicket ? "secondary" : "primary" })
        });
      }
      console.log(`[support] Admin notified for ${ticketNumber} (${isNewTicket ? "new" : "reply"})`);
    } catch (err) {
      console.error("[support] Failed to notify admin on client message:", err);
    }
    return doc;
  };
}
function createFireMessageWebhooks(slugs) {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return doc;
    if (doc.scheduledAt && !doc.scheduledSent) return doc;
    if (doc.isInternal) return doc;
    const ticketId = typeof doc.ticket === "object" ? doc.ticket.id : doc.ticket;
    fireWebhooks(req.payload, slugs, "ticket_replied", {
      ticketId,
      messageId: doc.id,
      authorType: doc.authorType,
      body: doc.body?.length > 500 ? doc.body.slice(0, 500) + "..." : doc.body
    });
    return doc;
  };
}
function createDispatchWebhookOnReply(slugs) {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return doc;
    if (doc.isInternal) return doc;
    if (doc.scheduledAt && !doc.scheduledSent) return doc;
    const ticketId = typeof doc.ticket === "object" ? doc.ticket.id : doc.ticket;
    dispatchWebhook(
      { ticketId, messageId: doc.id, authorType: doc.authorType },
      "ticket_replied",
      req.payload,
      slugs
    );
    return doc;
  };
}
function createTicketMessagesCollection(slugs, options) {
  const notificationSlug = options?.notificationSlug || "admin-notifications";
  return {
    slug: slugs.ticketMessages,
    labels: { singular: "Message", plural: "Messages" },
    admin: { hidden: true, group: "Support", defaultColumns: ["ticket", "authorType", "createdAt"] },
    fields: [
      { name: "ticket", type: "relationship", relationTo: slugs.tickets, required: true, label: "Ticket" },
      { name: "body", type: "textarea", required: true, label: "Message" },
      { name: "bodyHtml", type: "textarea", label: "Message HTML", admin: { hidden: true } },
      {
        type: "row",
        fields: [
          {
            name: "authorType",
            type: "select",
            label: "Type d'auteur",
            defaultValue: "admin",
            options: [
              { label: "Client", value: "client" },
              { label: "Support", value: "admin" },
              { label: "Email entrant", value: "email" }
            ],
            admin: { width: "50%" }
          },
          {
            name: "authorClient",
            type: "relationship",
            relationTo: slugs.supportClients,
            label: "Auteur (client)",
            admin: { width: "50%", condition: (data) => data?.authorType === "client" || data?.authorType === "email" }
          }
        ]
      },
      {
        name: "attachments",
        type: "array",
        label: "Pieces jointes",
        fields: [{ name: "file", type: "upload", relationTo: slugs.media, required: true, label: "Fichier" }]
      },
      { name: "isInternal", type: "checkbox", defaultValue: false, label: "Note interne", admin: { position: "sidebar" } },
      { name: "isSolution", type: "checkbox", defaultValue: false, label: "Reponse solution", admin: { position: "sidebar" } },
      { name: "skipNotification", type: "checkbox", defaultValue: false, label: "Sans notification", admin: { position: "sidebar", condition: (data) => data?.skipNotification === true } },
      { name: "scheduledAt", type: "date", label: "Programme pour", admin: { date: { pickerAppearance: "dayAndTime" }, position: "sidebar", condition: (data) => !!data?.scheduledAt } },
      { name: "scheduledSent", type: "checkbox", defaultValue: false, admin: { hidden: true } },
      { name: "editedAt", type: "date", label: "Modifie le", admin: { hidden: true } },
      { name: "deletedAt", type: "date", label: "Supprime le", admin: { hidden: true } },
      { name: "emailSentAt", type: "date", label: "Email envoye le", admin: { hidden: true } },
      { name: "emailSentTo", type: "text", label: "Email envoye a", admin: { hidden: true } },
      { name: "emailOpenedAt", type: "date", label: "Email ouvert le", admin: { hidden: true } }
    ],
    hooks: {
      beforeChange: [createAssignAuthor(slugs)],
      afterChange: [
        createAutoUpdateStatus(slugs),
        createNotifyClient(slugs),
        createTrackFirstResponse(slugs),
        createCheckSlaOnReply(slugs, notificationSlug),
        createSyncTicketReplyToChat(slugs),
        createNotifyAdminOnClientMessage(slugs, notificationSlug),
        createFireMessageWebhooks(slugs),
        createDispatchWebhookOnReply(slugs)
      ]
    },
    access: {
      create: ({ req }) => req.user?.collection === slugs.users || req.user?.collection === slugs.supportClients,
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) {
          return {
            and: [
              { "ticket.client": { equals: req.user.id } },
              { isInternal: { equals: false } },
              { or: [{ scheduledAt: { exists: false } }, { scheduledSent: { equals: true } }] }
            ]
          };
        }
        return false;
      },
      update: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) {
          return { and: [{ authorClient: { equals: req.user.id } }, { authorType: { equals: "client" } }] };
        }
        return false;
      },
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    timestamps: true
  };
}

// src/collections/SupportClients.ts
function createSendInvitationOnCreate(slugs) {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return doc;
    if (req.user?.collection !== slugs.users) return doc;
    try {
      const { payload } = req;
      const settings = await readSupportSettings(payload);
      const token = await payload.forgotPassword({
        collection: slugs.supportClients,
        data: { email: doc.email },
        disableEmail: true
      });
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
      const resetUrl = `${baseUrl}/support/reset-password?token=${token}`;
      const replyTo = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || "";
      await payload.sendEmail({
        to: doc.email,
        ...replyTo ? { replyTo } : {},
        subject: "Activez votre compte support",
        html: emailWrapper("Bienvenue sur votre espace support", [
          emailParagraph(`Bonjour <strong>${escapeHtml(doc.firstName || "")}</strong>,`),
          emailParagraph("Un espace support a ete cree pour vous. Vous pourrez y soumettre vos demandes, suivre vos tickets et echanger directement avec notre equipe."),
          emailParagraph("Pour activer votre compte, cliquez sur le bouton ci-dessous pour definir votre mot de passe :"),
          emailButton("Definir mon mot de passe", resetUrl),
          `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151; line-height: 1.6;">&#8226; Soumettre des demandes de support</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151; line-height: 1.6;">&#8226; Suivre l'avancement de vos tickets en temps reel</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151; line-height: 1.6;">&#8226; Joindre des fichiers et captures d'ecran</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151; line-height: 1.6;">&#8226; Consulter l'historique complet de vos echanges</td></tr>
          </table>`,
          emailParagraph('<span style="font-size: 13px; color: #6b7280;">Ce lien est valable 1 heure.</span>')
        ].join(""))
      });
    } catch (err) {
      console.error("[support-clients] Failed to send invitation email:", err);
    }
    return doc;
  };
}
function createSupportClientsCollection(slugs) {
  return {
    slug: slugs.supportClients,
    labels: {
      singular: "Client Support",
      plural: "Clients Support"
    },
    auth: {
      tokenExpiration: 7200,
      // 2 hours
      maxLoginAttempts: 10,
      lockTime: 300 * 1e3,
      // 5 minutes
      cookies: {
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax"
      },
      forgotPassword: {
        generateEmailSubject: () => "Reinitialisation de votre mot de passe",
        generateEmailHTML: (args) => {
          const token = args?.token || "";
          const user = args?.user;
          const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
          const resetUrl = `${baseUrl}/support/reset-password?token=${token}`;
          const name = user?.firstName || "";
          return emailWrapper("Reinitialisation de mot de passe", [
            emailParagraph(`Bonjour${name ? ` <strong>${escapeHtml(name)}</strong>` : ""},`),
            emailParagraph("Vous avez demande la reinitialisation de votre mot de passe pour votre espace support."),
            emailParagraph("Cliquez sur le bouton ci-dessous pour definir un nouveau mot de passe :"),
            emailButton("Definir mon mot de passe", resetUrl),
            emailParagraph(`<span style="font-size: 13px; color: #6b7280;">Ce lien est valable 1 heure. Si vous n'avez pas effectue cette demande, vous pouvez ignorer cet email.</span>`)
          ].join(""));
        }
      }
    },
    admin: {
      useAsTitle: "company",
      group: "Support",
      defaultColumns: ["company", "email", "firstName", "lastName", "createdAt"]
    },
    fields: [
      {
        type: "row",
        fields: [
          {
            name: "company",
            type: "text",
            required: true,
            label: "Entreprise",
            admin: { width: "50%" }
          },
          {
            name: "phone",
            type: "text",
            label: "Telephone",
            admin: { width: "50%" }
          }
        ]
      },
      {
        type: "row",
        fields: [
          {
            name: "firstName",
            type: "text",
            required: true,
            label: "Prenom",
            admin: { width: "50%" }
          },
          {
            name: "lastName",
            type: "text",
            required: true,
            label: "Nom",
            admin: { width: "50%" }
          }
        ]
      },
      {
        name: "twoFactorEnabled",
        type: "checkbox",
        defaultValue: false,
        label: "2FA active",
        admin: {
          description: "Verification par email a chaque connexion",
          position: "sidebar"
        }
      },
      {
        name: "twoFactorCode",
        type: "text",
        admin: { hidden: true }
      },
      {
        name: "twoFactorExpiry",
        type: "date",
        admin: { hidden: true }
      },
      {
        name: "notifyOnReply",
        type: "checkbox",
        defaultValue: true,
        label: "Notifications reponses",
        admin: {
          description: "Recevoir un email a chaque reponse du support",
          position: "sidebar"
        }
      },
      {
        name: "notifyOnStatusChange",
        type: "checkbox",
        defaultValue: true,
        label: "Notifications statut",
        admin: {
          description: "Recevoir un email quand le statut d'un ticket change",
          position: "sidebar"
        }
      },
      {
        name: "notes",
        type: "textarea",
        label: "Notes internes",
        admin: {
          description: "Visible uniquement par les admins",
          position: "sidebar"
        }
      }
    ],
    hooks: {
      afterChange: [createSendInvitationOnCreate(slugs)]
    },
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) {
          return { id: { equals: req.user.id } };
        }
        return false;
      },
      delete: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) {
          return { id: { equals: req.user.id } };
        }
        return false;
      }
    },
    timestamps: true
  };
}

// src/collections/TimeEntries.ts
function createRecalculateTicketTime(slugs) {
  return async ({ doc, req }) => {
    if (!doc.ticket) return;
    const { payload } = req;
    const ticketId = typeof doc.ticket === "object" ? doc.ticket.id : doc.ticket;
    let totalMinutes = 0;
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const entries = await payload.find({
        collection: slugs.timeEntries,
        where: { ticket: { equals: ticketId } },
        limit: 100,
        page,
        depth: 0,
        overrideAccess: true,
        select: { duration: true }
      });
      for (const entry of entries.docs) {
        totalMinutes += entry.duration || 0;
      }
      hasMore = entries.hasNextPage ?? false;
      page++;
    }
    await payload.update({
      collection: slugs.tickets,
      id: ticketId,
      data: { totalTimeMinutes: totalMinutes },
      overrideAccess: true
    });
  };
}
function createTimeEntriesCollection(slugs) {
  return {
    slug: slugs.timeEntries,
    labels: {
      singular: "Entr\xE9e de temps",
      plural: "Entr\xE9es de temps"
    },
    admin: {
      group: "Gestion",
      defaultColumns: ["ticket", "duration", "description", "date"]
    },
    fields: [
      {
        name: "ticket",
        type: "relationship",
        relationTo: slugs.tickets,
        required: true,
        label: "Ticket"
      },
      {
        type: "row",
        fields: [
          {
            name: "duration",
            type: "number",
            required: true,
            label: "Dur\xE9e (minutes)",
            min: 1,
            admin: { width: "50%" }
          },
          {
            name: "date",
            type: "date",
            required: true,
            label: "Date",
            defaultValue: () => (/* @__PURE__ */ new Date()).toISOString(),
            admin: { width: "50%", date: { displayFormat: "dd/MM/yyyy" } }
          }
        ]
      },
      {
        name: "description",
        type: "textarea",
        label: "Description du travail"
      }
    ],
    hooks: {
      afterChange: [createRecalculateTicketTime(slugs)]
    },
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    timestamps: true
  };
}

// src/collections/CannedResponses.ts
function createCannedResponsesCollection(slugs) {
  return {
    slug: slugs.cannedResponses,
    labels: {
      singular: "R\xE9ponse pr\xE9-enregistr\xE9e",
      plural: "R\xE9ponses pr\xE9-enregistr\xE9es"
    },
    admin: {
      hidden: true,
      useAsTitle: "title",
      group: "Gestion",
      defaultColumns: ["title", "category", "updatedAt"]
    },
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
        label: "Titre",
        admin: {
          description: 'Nom court pour identifier la r\xE9ponse (ex: "Accus\xE9 r\xE9ception")'
        }
      },
      {
        name: "category",
        type: "select",
        label: "Cat\xE9gorie",
        options: [
          { label: "G\xE9n\xE9ral", value: "general" },
          { label: "Bug", value: "bug" },
          { label: "Contenu", value: "content" },
          { label: "Fonctionnalit\xE9", value: "feature" },
          { label: "H\xE9bergement", value: "hosting" },
          { label: "Cl\xF4ture", value: "closing" }
        ]
      },
      {
        name: "body",
        type: "textarea",
        required: true,
        label: "Contenu",
        admin: {
          description: "Utilisez {{clientName}} pour le pr\xE9nom du client, {{ticketNumber}} pour le num\xE9ro"
        }
      },
      {
        name: "sortOrder",
        type: "number",
        label: "Ordre",
        defaultValue: 0,
        admin: {
          position: "sidebar"
        }
      }
    ],
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    timestamps: true
  };
}

// src/collections/TicketActivityLog.ts
function createTicketActivityLogCollection(slugs) {
  return {
    slug: slugs.ticketActivityLog,
    labels: {
      singular: "Activit\xE9 ticket",
      plural: "Activit\xE9s tickets"
    },
    admin: {
      hidden: true,
      group: "Gestion",
      defaultColumns: ["ticket", "action", "actorEmail", "createdAt"]
    },
    fields: [
      {
        name: "ticket",
        type: "relationship",
        relationTo: slugs.tickets,
        required: true,
        label: "Ticket"
      },
      {
        name: "action",
        type: "text",
        required: true,
        label: "Action",
        admin: {
          description: "Ex: status_changed, priority_changed, assigned, merged"
        }
      },
      {
        name: "detail",
        type: "text",
        label: "D\xE9tail",
        admin: {
          description: 'Ex: "status: open \u2192 in_progress"'
        }
      },
      {
        type: "row",
        fields: [
          {
            name: "actorType",
            type: "select",
            label: "Type acteur",
            options: [
              { label: "Admin", value: "admin" },
              { label: "Client", value: "client" },
              { label: "Syst\xE8me", value: "system" }
            ],
            admin: { width: "50%" }
          },
          {
            name: "actorEmail",
            type: "text",
            label: "Email acteur",
            admin: { width: "50%" }
          }
        ]
      }
    ],
    access: {
      create: () => false,
      // Created only by hooks via overrideAccess
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) {
          return { "ticket.client": { equals: req.user.id } };
        }
        return false;
      },
      update: () => false,
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    timestamps: true
  };
}

// src/collections/SatisfactionSurveys.ts
function createSatisfactionSurveysCollection(slugs) {
  return {
    slug: slugs.satisfactionSurveys,
    labels: {
      singular: "Enqu\xEAte satisfaction",
      plural: "Enqu\xEAtes satisfaction"
    },
    admin: {
      hidden: true,
      group: "Support",
      defaultColumns: ["source", "rating", "client", "createdAt"]
    },
    fields: [
      {
        name: "source",
        type: "select",
        options: [
          { label: "Ticket", value: "ticket" },
          { label: "Live Chat", value: "live-chat" }
        ],
        defaultValue: "ticket",
        required: true,
        label: "Source",
        admin: {
          description: "Ticket de support ou session de chat en direct"
        }
      },
      {
        name: "ticket",
        type: "relationship",
        relationTo: slugs.tickets,
        unique: true,
        label: "Ticket",
        admin: {
          condition: (data) => data?.source === "ticket"
        }
      },
      {
        name: "chatSession",
        type: "text",
        unique: true,
        label: "Session Chat",
        admin: {
          condition: (data) => data?.source === "live-chat",
          description: "ID de la session live chat"
        }
      },
      {
        name: "client",
        type: "relationship",
        relationTo: slugs.supportClients,
        required: true,
        label: "Client"
      },
      {
        name: "rating",
        type: "number",
        required: true,
        min: 1,
        max: 5,
        label: "Note (1-5)",
        admin: {
          description: "1 = Tr\xE8s insatisfait, 5 = Tr\xE8s satisfait"
        }
      },
      {
        name: "comment",
        type: "textarea",
        label: "Commentaire",
        admin: {
          description: "Feedback libre du client"
        }
      }
    ],
    access: {
      create: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) return true;
        return false;
      },
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) {
          return { client: { equals: req.user.id } };
        }
        return false;
      },
      update: () => false,
      // Surveys are immutable once submitted
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    timestamps: true
  };
}

// src/collections/KnowledgeBase.ts
function createKnowledgeBaseCollection(slugs) {
  return {
    slug: slugs.knowledgeBase,
    labels: {
      singular: "Article FAQ",
      plural: "Base de connaissances"
    },
    admin: {
      hidden: true,
      useAsTitle: "title",
      group: "Support",
      defaultColumns: ["title", "category", "published", "sortOrder", "updatedAt"]
    },
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
        label: "Titre / Question"
      },
      {
        name: "slug",
        type: "text",
        required: true,
        unique: true,
        label: "Slug",
        admin: {
          description: "URL-friendly identifier (auto-generated from title if empty)"
        }
      },
      {
        name: "category",
        type: "select",
        required: true,
        label: "Cat\xE9gorie",
        options: [
          { label: "Premiers pas", value: "getting-started" },
          { label: "Tickets & Support", value: "tickets" },
          { label: "Compte & Profil", value: "account" },
          { label: "Facturation", value: "billing" },
          { label: "Technique", value: "technical" },
          { label: "G\xE9n\xE9ral", value: "general" }
        ]
      },
      {
        name: "body",
        type: "richText",
        required: true,
        label: "Contenu"
      },
      {
        name: "published",
        type: "checkbox",
        defaultValue: true,
        label: "Publi\xE9",
        admin: { position: "sidebar" }
      },
      {
        name: "sortOrder",
        type: "number",
        defaultValue: 0,
        label: "Ordre",
        admin: { position: "sidebar" }
      }
    ],
    hooks: {
      beforeChange: [
        async ({ data, operation }) => {
          if (operation === "create" && !data.slug && data.title) {
            data.slug = data.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          }
          return data;
        }
      ]
    },
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users,
      // Public read for published articles (support-clients + unauthenticated)
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        return { published: { equals: true } };
      }
    },
    timestamps: true
  };
}

// src/collections/ChatMessages.ts
function createChatMessagesCollection(slugs) {
  return {
    slug: slugs.chatMessages,
    labels: {
      singular: "Message Chat",
      plural: "Messages Chat"
    },
    admin: {
      hidden: true,
      useAsTitle: "message",
      group: "Support",
      defaultColumns: ["session", "senderType", "message", "createdAt"]
    },
    access: {
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) {
          return { client: { equals: req.user.id } };
        }
        return false;
      },
      create: ({ req }) => !!req.user,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    fields: [
      {
        name: "session",
        type: "text",
        required: true,
        index: true,
        label: "Session ID",
        admin: { description: "Identifiant unique de la session de chat" }
      },
      {
        name: "client",
        type: "relationship",
        relationTo: slugs.supportClients,
        required: true,
        label: "Client"
      },
      {
        name: "senderType",
        type: "select",
        required: true,
        defaultValue: "client",
        options: [
          { label: "Client", value: "client" },
          { label: "Agent", value: "agent" },
          { label: "Syst\xE8me", value: "system" }
        ],
        label: "Type d'exp\xE9diteur"
      },
      {
        name: "agent",
        type: "relationship",
        relationTo: slugs.users,
        label: "Agent",
        admin: {
          condition: (data) => data?.senderType === "agent"
        }
      },
      {
        name: "message",
        type: "textarea",
        required: true,
        label: "Message"
      },
      {
        name: "status",
        type: "select",
        defaultValue: "active",
        options: [
          { label: "Actif", value: "active" },
          { label: "Ferm\xE9", value: "closed" }
        ],
        label: "Statut de la session",
        admin: { position: "sidebar" }
      },
      {
        name: "ticket",
        type: "relationship",
        relationTo: slugs.tickets,
        label: "Ticket li\xE9",
        admin: {
          position: "sidebar",
          description: "Ticket cr\xE9\xE9 automatiquement pour cette session"
        }
      }
    ],
    timestamps: true
  };
}

// src/collections/PendingEmails.ts
function createPendingEmailsCollection(slugs) {
  return {
    slug: slugs.pendingEmails,
    admin: {
      group: "Support",
      useAsTitle: "subject",
      defaultColumns: ["status", "senderEmail", "subject", "createdAt"],
      hidden: true
      // Managed via custom admin view
    },
    access: {
      read: ({ req }) => Boolean(req.user?.collection === slugs.users),
      update: ({ req }) => Boolean(req.user?.collection === slugs.users),
      delete: ({ req }) => Boolean(req.user?.collection === slugs.users),
      create: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        const webhookSecret = req.headers.get("x-webhook-secret");
        if (webhookSecret && process.env.SUPPORT_WEBHOOK_SECRET && webhookSecret === process.env.SUPPORT_WEBHOOK_SECRET) return true;
        return false;
      }
    },
    fields: [
      {
        name: "senderEmail",
        type: "email",
        required: true,
        index: true
      },
      {
        name: "senderName",
        type: "text"
      },
      {
        name: "subject",
        type: "text",
        required: true
      },
      {
        name: "rawSubject",
        type: "text",
        admin: { readOnly: true }
      },
      {
        name: "body",
        type: "textarea",
        required: true
      },
      {
        name: "bodyHtml",
        type: "textarea",
        admin: { readOnly: true }
      },
      {
        name: "client",
        type: "relationship",
        relationTo: slugs.supportClients
      },
      {
        name: "attachments",
        type: "array",
        fields: [
          {
            name: "file",
            type: "upload",
            relationTo: slugs.media,
            required: true
          }
        ]
      },
      {
        name: "status",
        type: "select",
        defaultValue: "pending",
        index: true,
        options: [
          { label: "En attente", value: "pending" },
          { label: "Trait\xE9", value: "processed" },
          { label: "Ignor\xE9", value: "ignored" }
        ]
      },
      {
        name: "processedAction",
        type: "select",
        options: [
          { label: "Ticket cr\xE9\xE9", value: "ticket_created" },
          { label: "Message ajout\xE9", value: "message_added" },
          { label: "Ignor\xE9", value: "ignored" }
        ],
        admin: { condition: (data) => data?.status !== "pending" }
      },
      {
        name: "processedTicket",
        type: "relationship",
        relationTo: slugs.tickets,
        admin: { condition: (data) => data?.processedAction === "ticket_created" || data?.processedAction === "message_added" }
      },
      {
        name: "processedAt",
        type: "date",
        admin: { condition: (data) => data?.status !== "pending" }
      },
      {
        name: "suggestedTickets",
        type: "json",
        admin: { readOnly: true }
      },
      {
        name: "cc",
        type: "text"
      },
      {
        name: "recipientEmail",
        type: "text"
      }
    ]
  };
}

// src/collections/EmailLogs.ts
function createEmailLogsCollection(slugs) {
  return {
    slug: slugs.emailLogs,
    labels: {
      singular: "Journal email",
      plural: "Journal des emails"
    },
    admin: {
      group: "Support",
      defaultColumns: ["status", "action", "senderEmail", "subject", "createdAt"],
      useAsTitle: "subject",
      enableRichTextRelationship: false
    },
    access: {
      read: ({ req }) => req.user?.collection === slugs.users,
      create: () => false,
      // Logs are system-generated (server-side uses overrideAccess)
      update: () => false,
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    fields: [
      {
        name: "status",
        type: "select",
        required: true,
        index: true,
        options: [
          { label: "Succ\xE8s", value: "success" },
          { label: "Ignor\xE9", value: "ignored" },
          { label: "Erreur", value: "error" }
        ]
      },
      {
        name: "action",
        type: "text",
        index: true,
        admin: { description: "Action effectu\xE9e (ticket_created, message_added, ignored, error...)" }
      },
      {
        name: "senderEmail",
        type: "email",
        index: true
      },
      {
        name: "senderName",
        type: "text"
      },
      {
        name: "subject",
        type: "text"
      },
      {
        name: "recipientEmail",
        type: "text",
        admin: { description: "Champ TO (peut \xEAtre vide)" }
      },
      {
        name: "cc",
        type: "text",
        admin: { description: "Champ CC" }
      },
      {
        name: "ticketNumber",
        type: "text",
        admin: { description: "Num\xE9ro du ticket cr\xE9\xE9 ou mis \xE0 jour" }
      },
      {
        name: "errorMessage",
        type: "textarea",
        admin: { description: "Message d'erreur si \xE9chec" }
      },
      {
        name: "attachments",
        type: "json",
        admin: { description: "M\xE9tadonn\xE9es des pi\xE8ces jointes [{filename, size, contentType}]" }
      },
      {
        name: "httpStatus",
        type: "number",
        admin: { description: "Code HTTP de la r\xE9ponse" }
      },
      {
        name: "processingTimeMs",
        type: "number",
        admin: { description: "Temps de traitement en ms" }
      }
    ],
    timestamps: true
  };
}

// src/collections/AuthLogs.ts
function createAuthLogsCollection(slugs) {
  return {
    slug: slugs.authLogs,
    labels: {
      singular: "Journal d'authentification",
      plural: "Journal d'authentification"
    },
    admin: {
      group: "Support",
      defaultColumns: ["email", "success", "action", "errorReason", "createdAt"],
      useAsTitle: "email"
    },
    access: {
      read: ({ req }) => req.user?.collection === slugs.users,
      create: () => false,
      // Logs are system-generated (server-side uses overrideAccess)
      update: () => false,
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    fields: [
      {
        name: "email",
        type: "email",
        required: true,
        index: true
      },
      {
        name: "success",
        type: "checkbox",
        defaultValue: false,
        index: true
      },
      {
        name: "action",
        type: "select",
        required: true,
        index: true,
        options: [
          { label: "Connexion", value: "login" },
          { label: "D\xE9connexion", value: "logout" },
          { label: "Mot de passe oubli\xE9", value: "forgot-password" },
          { label: "Inscription", value: "register" }
        ]
      },
      {
        name: "errorReason",
        type: "text",
        admin: { description: "Raison de l'\xE9chec (mot de passe incorrect, compte verrouill\xE9, etc.)" }
      },
      {
        name: "ipAddress",
        type: "text"
      },
      {
        name: "userAgent",
        type: "text"
      }
    ],
    timestamps: true
  };
}

// src/collections/WebhookEndpoints.ts
function createWebhookEndpointsCollection(slugs) {
  return {
    slug: slugs.webhookEndpoints,
    labels: {
      singular: "Webhook",
      plural: "Webhooks"
    },
    admin: {
      useAsTitle: "name",
      group: "Support",
      defaultColumns: ["name", "url", "events", "active", "lastTriggeredAt", "lastStatus"]
    },
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
        label: "Nom",
        admin: {
          description: "Ex: Slack notifications, n8n workflow\u2026"
        }
      },
      {
        name: "url",
        type: "text",
        required: true,
        label: "URL",
        admin: {
          description: "URL du webhook \xE0 appeler (POST)"
        }
      },
      {
        name: "secret",
        type: "text",
        label: "Secret HMAC",
        admin: {
          description: "Secret optionnel pour signer les payloads (HMAC-SHA256, header X-Webhook-Signature)"
        }
      },
      {
        name: "events",
        type: "select",
        hasMany: true,
        required: true,
        label: "\xC9v\xE9nements",
        options: [
          { label: "Ticket cr\xE9\xE9", value: "ticket_created" },
          { label: "Ticket r\xE9solu", value: "ticket_resolved" },
          { label: "R\xE9ponse au ticket", value: "ticket_replied" },
          { label: "Ticket assign\xE9", value: "ticket_assigned" },
          { label: "SLA d\xE9pass\xE9", value: "sla_breached" }
        ],
        admin: {
          description: "\xC9v\xE9nements qui d\xE9clenchent ce webhook"
        }
      },
      {
        name: "active",
        type: "checkbox",
        defaultValue: true,
        label: "Actif"
      },
      {
        name: "lastTriggeredAt",
        type: "date",
        label: "Dernier d\xE9clenchement",
        admin: {
          readOnly: true,
          date: { displayFormat: "dd/MM/yyyy HH:mm" },
          position: "sidebar"
        }
      },
      {
        name: "lastStatus",
        type: "number",
        label: "Dernier statut HTTP",
        admin: {
          readOnly: true,
          position: "sidebar"
        }
      }
    ],
    timestamps: true
  };
}

// src/collections/SlaPolicies.ts
function createSlaPoliciesCollection(slugs) {
  return {
    slug: slugs.slaPolicies,
    labels: {
      singular: "Politique SLA",
      plural: "Politiques SLA"
    },
    admin: {
      useAsTitle: "name",
      group: "Support",
      defaultColumns: ["name", "priority", "firstResponseTime", "resolutionTime", "businessHoursOnly", "isDefault"]
    },
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
        label: "Nom",
        admin: {
          description: "Ex: Standard, Premium, Urgence"
        }
      },
      {
        type: "row",
        fields: [
          {
            name: "firstResponseTime",
            type: "number",
            required: true,
            label: "D\xE9lai 1\xE8re r\xE9ponse (min)",
            min: 1,
            admin: {
              width: "50%",
              description: "Temps cible en minutes pour la premi\xE8re r\xE9ponse"
            }
          },
          {
            name: "resolutionTime",
            type: "number",
            required: true,
            label: "D\xE9lai r\xE9solution (min)",
            min: 1,
            admin: {
              width: "50%",
              description: "Temps cible en minutes pour la r\xE9solution compl\xE8te"
            }
          }
        ]
      },
      {
        name: "priority",
        type: "select",
        required: true,
        label: "Priorit\xE9",
        options: [
          { label: "Basse", value: "low" },
          { label: "Normale", value: "normal" },
          { label: "Haute", value: "high" },
          { label: "Urgente", value: "urgent" }
        ],
        admin: {
          description: "Priorit\xE9 de ticket \xE0 laquelle cette politique s'applique"
        }
      },
      {
        type: "row",
        fields: [
          {
            name: "businessHoursOnly",
            type: "checkbox",
            defaultValue: true,
            label: "Heures ouvr\xE9es uniquement",
            admin: {
              width: "50%",
              description: "Compter uniquement les heures ouvr\xE9es (lun-ven, 9h-18h)"
            }
          },
          {
            name: "escalateOnBreach",
            type: "checkbox",
            defaultValue: false,
            label: "Escalade auto sur d\xE9passement",
            admin: {
              width: "50%",
              description: "Notifier automatiquement en cas de d\xE9passement SLA"
            }
          }
        ]
      },
      {
        name: "escalateTo",
        type: "relationship",
        relationTo: slugs.users,
        label: "Escalader \xE0",
        admin: {
          description: "Utilisateur \xE0 notifier en cas de d\xE9passement SLA",
          condition: (data) => data?.escalateOnBreach === true
        }
      },
      {
        name: "isDefault",
        type: "checkbox",
        defaultValue: false,
        label: "Politique par d\xE9faut",
        admin: {
          description: "Utiliser cette politique pour les tickets sans SLA sp\xE9cifique (par priorit\xE9)"
        }
      }
    ],
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    timestamps: true
  };
}

// src/collections/Macros.ts
function createMacrosCollection(slugs) {
  return {
    slug: slugs.macros,
    labels: {
      singular: "Macro",
      plural: "Macros"
    },
    admin: {
      useAsTitle: "name",
      group: "Support",
      defaultColumns: ["name", "description", "sortOrder", "isActive", "updatedAt"]
    },
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
        label: "Nom",
        admin: {
          description: 'Nom court pour identifier la macro (ex: "Cl\xF4turer & remercier")'
        }
      },
      {
        name: "description",
        type: "text",
        label: "Description",
        admin: {
          description: "Description optionnelle de ce que fait la macro"
        }
      },
      {
        name: "actions",
        type: "array",
        required: true,
        label: "Actions",
        minRows: 1,
        admin: {
          description: "Liste des actions ex\xE9cut\xE9es dans l'ordre"
        },
        fields: [
          {
            name: "type",
            type: "select",
            required: true,
            label: "Type d'action",
            options: [
              { label: "Changer le statut", value: "set_status" },
              { label: "Changer la priorit\xE9", value: "set_priority" },
              { label: "Ajouter un tag", value: "add_tag" },
              { label: "Envoyer une r\xE9ponse", value: "send_reply" },
              { label: "Assigner", value: "assign" }
            ]
          },
          {
            name: "value",
            type: "text",
            required: true,
            label: "Valeur",
            admin: {
              description: "Statut, priorit\xE9, tag, corps de la r\xE9ponse, ou ID utilisateur selon le type"
            }
          }
        ]
      },
      {
        name: "sortOrder",
        type: "number",
        defaultValue: 0,
        label: "Ordre",
        admin: {
          position: "sidebar"
        }
      },
      {
        name: "isActive",
        type: "checkbox",
        defaultValue: true,
        label: "Active",
        admin: {
          position: "sidebar",
          description: "D\xE9sactiver pour masquer la macro sans la supprimer"
        }
      }
    ],
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    timestamps: true
  };
}

// src/collections/TicketStatuses.ts
function createTicketStatusesCollection(slugs) {
  return {
    slug: slugs.ticketStatuses,
    labels: {
      singular: "Statut de ticket",
      plural: "Statuts de ticket"
    },
    admin: {
      useAsTitle: "name",
      group: "Support",
      defaultColumns: ["name", "slug", "type", "color", "isDefault", "sortOrder"]
    },
    fields: [
      {
        type: "row",
        fields: [
          {
            name: "name",
            type: "text",
            required: true,
            label: "Nom",
            admin: {
              width: "50%",
              description: 'Libell\xE9 affich\xE9 (ex: "Ouvert", "En attente client")'
            }
          },
          {
            name: "slug",
            type: "text",
            required: true,
            unique: true,
            label: "Slug",
            admin: {
              width: "50%",
              description: 'Identifiant technique unique (ex: "open", "waiting_client")'
            }
          }
        ]
      },
      {
        type: "row",
        fields: [
          {
            name: "color",
            type: "text",
            required: true,
            label: "Couleur",
            admin: {
              width: "50%",
              description: "Couleur hexad\xE9cimale (ex: #22c55e)"
            }
          },
          {
            name: "type",
            type: "select",
            required: true,
            label: "Type s\xE9mantique",
            options: [
              { label: "Ouvert", value: "open" },
              { label: "En attente", value: "pending" },
              { label: "Ferm\xE9", value: "closed" }
            ],
            admin: {
              width: "50%",
              description: "Type logique pour la logique SLA et auto-close"
            }
          }
        ]
      },
      {
        name: "isDefault",
        type: "checkbox",
        defaultValue: false,
        label: "Statut par d\xE9faut",
        admin: {
          position: "sidebar",
          description: "Statut assign\xE9 automatiquement aux nouveaux tickets"
        }
      },
      {
        name: "sortOrder",
        type: "number",
        defaultValue: 0,
        label: "Ordre",
        admin: {
          position: "sidebar"
        }
      }
    ],
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true;
        if (req.user?.collection === slugs.supportClients) return true;
        return false;
      },
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users
    },
    timestamps: true
  };
}

// src/collections/ClientSummaries.ts
function createClientSummariesCollection(slugs) {
  return {
    slug: "client-summaries",
    labels: { singular: "R\xE9sum\xE9 client", plural: "R\xE9sum\xE9s clients" },
    admin: {
      group: "Support",
      hidden: true,
      // Not directly editable — managed via API
      defaultColumns: ["client", "generatedAt", "ticketCount"],
      useAsTitle: "clientName"
    },
    fields: [
      {
        name: "client",
        type: "relationship",
        relationTo: slugs.supportClients,
        required: true,
        index: true,
        label: "Client"
      },
      {
        name: "clientName",
        type: "text",
        label: "Nom client",
        admin: { readOnly: true }
      },
      // ── AI-generated content ──
      {
        name: "summary",
        type: "textarea",
        label: "R\xE9sum\xE9 global",
        admin: { readOnly: true }
      },
      {
        name: "recurringTopics",
        type: "json",
        label: "Sujets r\xE9currents",
        admin: { readOnly: true }
        // Array of { topic: string, count: number, lastSeen: string }
      },
      {
        name: "patterns",
        type: "json",
        label: "Patterns d\xE9tect\xE9s",
        admin: { readOnly: true }
        // Array of strings: "Revient souvent pour X", "Préfère le tutoiement", etc.
      },
      {
        name: "keyFacts",
        type: "json",
        label: "Faits cl\xE9s",
        admin: { readOnly: true }
        // Array of strings: "Hébergé chez OVH", "Site WordPress", etc.
      },
      // ── Stats ──
      {
        name: "ticketCount",
        type: "number",
        label: "Nombre de tickets analys\xE9s",
        defaultValue: 0,
        admin: { readOnly: true }
      },
      {
        name: "messageCount",
        type: "number",
        label: "Nombre de messages analys\xE9s",
        defaultValue: 0,
        admin: { readOnly: true }
      },
      {
        name: "averageSatisfaction",
        type: "number",
        label: "Satisfaction moyenne",
        admin: { readOnly: true }
      },
      {
        name: "firstTicketAt",
        type: "date",
        label: "Premier ticket",
        admin: { readOnly: true }
      },
      {
        name: "lastTicketAt",
        type: "date",
        label: "Dernier ticket",
        admin: { readOnly: true }
      },
      // ── Meta ──
      {
        name: "generatedAt",
        type: "date",
        label: "G\xE9n\xE9r\xE9 le",
        admin: { readOnly: true, date: { displayFormat: "dd/MM/yyyy HH:mm" } }
      },
      {
        name: "aiModel",
        type: "text",
        label: "Mod\xE8le IA utilis\xE9",
        admin: { readOnly: true }
      }
    ],
    access: {
      create: ({ req }) => req.user?.collection === "users",
      read: ({ req }) => req.user?.collection === "users",
      update: ({ req }) => req.user?.collection === "users",
      delete: ({ req }) => req.user?.collection === "users"
    },
    timestamps: true
  };
}

// src/plugin.ts
function viewConfig(component, path) {
  return { Component: component, path };
}
function supportPlugin(config) {
  const features = {
    ...DEFAULT_FEATURES,
    ...config?.features
  };
  const bp = config?.basePath || "/support";
  const viewsBase = "@consilioweb/payload-support/views";
  const slugs = resolveSlugs({
    ...config?.collectionSlugs,
    users: config?.userCollectionSlug || "users"
  });
  return (incomingConfig) => {
    const existingCollections = incomingConfig.collections || [];
    const ticketOptions = {
      conversationComponent: config?.conversationComponent,
      projectCollectionSlug: config?.projectCollectionSlug,
      documentsCollectionSlug: config?.documentsCollectionSlug,
      notificationSlug: config?.notificationSlug
    };
    const messageOptions = {
      notificationSlug: config?.notificationSlug
    };
    const supportCollections = [
      createTicketsCollection(slugs, ticketOptions),
      createTicketMessagesCollection(slugs, messageOptions),
      createSupportClientsCollection(slugs),
      createCannedResponsesCollection(slugs),
      createTicketActivityLogCollection(slugs),
      createSatisfactionSurveysCollection(slugs),
      createKnowledgeBaseCollection(slugs)
    ];
    if (features.authLogs !== false) supportCollections.push(createAuthLogsCollection(slugs));
    if (features.timeTracking !== false) supportCollections.push(createTimeEntriesCollection(slugs));
    if (features.emailTracking !== false) supportCollections.push(createEmailLogsCollection(slugs));
    if (features.webhooks !== false) supportCollections.push(createWebhookEndpointsCollection(slugs));
    if (features.sla !== false) supportCollections.push(createSlaPoliciesCollection(slugs));
    if (features.macros !== false) supportCollections.push(createMacrosCollection(slugs));
    if (features.customStatuses !== false) supportCollections.push(createTicketStatusesCollection(slugs));
    if (features.chat) supportCollections.push(createChatMessagesCollection(slugs));
    if (features.pendingEmails) supportCollections.push(createPendingEmailsCollection(slugs));
    if (features.ai !== false) supportCollections.push(createClientSummariesCollection(slugs));
    const existingViews = incomingConfig.admin?.components?.views || {};
    const supportViews = {
      "support-inbox": viewConfig(`${viewsBase}#TicketInboxView`, `${bp}/inbox`),
      "support-dashboard": viewConfig(`${viewsBase}#SupportDashboardView`, `${bp}/dashboard`),
      "support-ticket": viewConfig(`${viewsBase}#TicketDetailView`, `${bp}/ticket`),
      "support-new-ticket": viewConfig(`${viewsBase}#NewTicketView`, `${bp}/new-ticket`),
      "support-settings": viewConfig(`${viewsBase}#TicketingSettingsView`, `${bp}/settings`),
      "support-logs": viewConfig(`${viewsBase}#LogsView`, `${bp}/logs`),
      "support-crm": viewConfig(`${viewsBase}#CrmView`, `${bp}/crm`),
      "support-billing": viewConfig(`${viewsBase}#BillingView`, `${bp}/billing`),
      "support-import": viewConfig(`${viewsBase}#ImportConversationView`, `/import-conversation`)
    };
    if (features.chat) {
      supportViews["support-chat"] = viewConfig(`${viewsBase}#ChatView`, `${bp}/chat`);
    }
    if (features.pendingEmails) {
      supportViews["support-emails"] = viewConfig(`${viewsBase}#PendingEmailsView`, `${bp}/emails`);
    }
    if (features.emailTracking) {
      supportViews["support-tracking"] = viewConfig(`${viewsBase}#EmailTrackingView`, `${bp}/tracking`);
    }
    if (features.timeTracking) {
      supportViews["support-time"] = viewConfig(`${viewsBase}#TimeDashboardView`, `${bp}/time`);
    }
    const existingEndpoints = incomingConfig.endpoints || [];
    const supportEndpoints = createSupportEndpoints(slugs, {
      oauth: { allowedEmailDomains: config?.allowedEmailDomains },
      features
    });
    return {
      ...incomingConfig,
      collections: config?.skipCollections ? existingCollections : [...existingCollections, ...supportCollections],
      endpoints: config?.skipEndpoints ? existingEndpoints : [...existingEndpoints, ...supportEndpoints],
      admin: {
        ...incomingConfig.admin,
        components: {
          ...incomingConfig.admin?.components,
          views: config?.skipViews ? existingViews : { ...existingViews, ...supportViews }
        }
      }
    };
  };
}

export { DEFAULT_FEATURES, DEFAULT_SETTINGS, DEFAULT_SLUGS, DEFAULT_USER_PREFS, calculateBusinessHoursDeadline, createAdminNotification, createAssignSlaDeadlines, createAuthLogsCollection, createCannedResponsesCollection, createChatMessagesCollection, createCheckSlaOnReply, createCheckSlaOnResolve, createEmailLogsCollection, createKnowledgeBaseCollection, createMacrosCollection, createPendingEmailsCollection, createSatisfactionSurveysCollection, createSlaPoliciesCollection, createSupportClientsCollection, createTicketActivityLogCollection, createTicketMessagesCollection, createTicketStatusEmail, createTicketStatusesCollection, createTicketsCollection, createTimeEntriesCollection, createWebhookEndpointsCollection, dispatchWebhook, readSupportSettings, readUserPrefs, resolveSlugs, supportPlugin };
