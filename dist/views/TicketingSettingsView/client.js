"use client";
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { Settings, Mail, Bot, Clock, Timer, Globe, FileSignature } from 'lucide-react';
import { V, btnStyle } from '../shared/adminTokens.js';
import { AdminViewHeader } from '../shared/AdminViewHeader.js';
import { getFeatures, saveFeatures, DEFAULT_FEATURES } from '../../components/TicketConversation/config.js';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import ts from '../../styles/TicketingSettings.module.scss';

const DEFAULT_SETTINGS = {
  email: {
    fromAddress: "",
    fromName: "Support ConsilioWEB",
    replyToAddress: ""
  },
  ai: {
    provider: "ollama",
    apiKey: "",
    model: "qwen2.5:32b",
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
  autoClose: {
    enabled: true,
    daysBeforeClose: 7,
    reminderDaysBefore: 2
  },
  locale: {
    language: "fr"
  }
};
async function fetchSettingsFromAPI() {
  try {
    const res = await fetch("/api/support/settings", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      return {
        email: { ...DEFAULT_SETTINGS.email, ...data.email },
        ai: { ...DEFAULT_SETTINGS.ai, apiKey: "", ...data.ai },
        sla: { ...DEFAULT_SETTINGS.sla, ...data.sla },
        autoClose: { ...DEFAULT_SETTINGS.autoClose, ...data.autoClose },
        locale: DEFAULT_SETTINGS.locale
        // locale is now per-user
      };
    }
  } catch {
  }
  return DEFAULT_SETTINGS;
}
async function saveSettingsToAPI(settings) {
  try {
    const toSave = {
      email: settings.email,
      ai: { ...settings.ai, apiKey: void 0 },
      sla: settings.sla,
      autoClose: settings.autoClose
      // locale excluded — saved per-user via user-prefs
    };
    const res = await fetch("/api/support/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(toSave)
    });
    return res.ok;
  } catch {
    return false;
  }
}
async function fetchUserPrefs() {
  try {
    const res = await fetch("/api/support/user-prefs", { credentials: "include" });
    if (res.ok) return await res.json();
  } catch {
  }
  return { locale: "fr", signature: "" };
}
async function saveUserPrefs(prefs) {
  try {
    const res = await fetch("/api/support/user-prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(prefs)
    });
    return res.ok;
  } catch {
    return false;
  }
}
const FEATURE_LIST = [
  // Core
  { key: "canned", label: "R\xE9ponses rapides", description: "Templates de r\xE9ponses pr\xE9-enregistr\xE9es avec variables dynamiques", category: "core" },
  { key: "scheduledReplies", label: "R\xE9ponses programm\xE9es", description: "Envoyer une r\xE9ponse \xE0 une date/heure future", category: "core" },
  { key: "activityLog", label: "Journal d'activit\xE9", description: "Timeline des actions sur chaque ticket (changements de statut, assignation...)", category: "core" },
  // Communication
  { key: "emailTracking", label: "Suivi des emails", description: "Tracking d'envoi et d'ouverture des notifications email", category: "communication" },
  { key: "chat", label: "Live Chat", description: "Chat en temps r\xE9el avec conversion en ticket", category: "communication" },
  { key: "externalMessages", label: "Messages externes", description: "Ajouter manuellement des messages re\xE7us par email, SMS, WhatsApp...", category: "communication" },
  // Productivity
  { key: "ai", label: "Intelligence Artificielle", description: "Analyse de sentiment, synth\xE8se, suggestion de r\xE9ponse, reformulation", category: "productivity" },
  { key: "timeTracking", label: "Suivi du temps", description: "Timer, entr\xE9es manuelles, facturation", category: "productivity" },
  { key: "satisfaction", label: "Enqu\xEAtes satisfaction", description: "Score CSAT apr\xE8s r\xE9solution du ticket", category: "productivity" },
  // Advanced
  { key: "merge", label: "Fusion de tickets", description: "Combiner deux tickets en un seul", category: "advanced" },
  { key: "splitTicket", label: "Extraction de message", description: "Extraire un message en nouveau ticket li\xE9", category: "advanced" },
  { key: "snooze", label: "Snooze", description: "Masquer temporairement un ticket et rappel automatique", category: "advanced" },
  { key: "clientHistory", label: "Historique client", description: "Tickets pass\xE9s, projets et notes internes du client", category: "advanced" }
];
const CATEGORIES = [
  { key: "core", label: "Fonctionnalit\xE9s de base", color: V.blue },
  { key: "communication", label: "Communication", color: V.green },
  { key: "productivity", label: "Productivit\xE9", color: V.amber },
  { key: "advanced", label: "Avanc\xE9", color: "#7c3aed" }
];
const Toggle = ({ checked, onChange, color = V.blue, size = "md" }) => {
  const w = size === "sm" ? 36 : 40;
  const h = size === "sm" ? 20 : 22;
  const knob = size === "sm" ? 16 : 18;
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "switch",
      "aria-checked": checked,
      tabIndex: 0,
      onClick: onChange,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange();
        }
      },
      style: {
        width: w,
        height: h,
        borderRadius: h / 2,
        flexShrink: 0,
        backgroundColor: checked ? color : "var(--theme-elevation-300)",
        position: "relative",
        transition: "background 150ms",
        cursor: "pointer"
      },
      children: /* @__PURE__ */ jsx("div", { style: {
        width: knob,
        height: knob,
        borderRadius: "50%",
        backgroundColor: "#fff",
        position: "absolute",
        top: (h - knob) / 2,
        left: checked ? w - knob - (h - knob) / 2 : (h - knob) / 2,
        transition: "left 150ms",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
      } })
    }
  );
};
const CollapsibleSection = ({ title, icon, color, defaultOpen = true, children, badge }) => {
  const [open, setOpen] = useState(defaultOpen);
  return /* @__PURE__ */ jsxs("div", { className: ts.sectionWrapper, children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: ts.sectionHeader,
        onClick: () => setOpen(!open),
        role: "button",
        tabIndex: 0,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        },
        "aria-expanded": open,
        children: [
          /* @__PURE__ */ jsx("div", { className: ts.sectionIcon, style: { backgroundColor: color }, children: icon }),
          /* @__PURE__ */ jsx("span", { className: ts.sectionTitle, children: title }),
          badge,
          /* @__PURE__ */ jsx("span", { className: `${ts.sectionChevron} ${open ? ts.open : ""}`, children: "\u25BC" })
        ]
      }
    ),
    open && /* @__PURE__ */ jsx("div", { className: ts.sectionBody, children })
  ] });
};
const FieldRow = ({ label, description, children }) => /* @__PURE__ */ jsxs("div", { className: ts.fieldRow, children: [
  /* @__PURE__ */ jsxs("div", { className: ts.fieldLabel, children: [
    label,
    description && /* @__PURE__ */ jsx("div", { className: ts.fieldDescription, children: description })
  ] }),
  /* @__PURE__ */ jsx("div", { className: ts.fieldContent, children })
] });
const TicketingSettingsClient = () => {
  const { t } = useTranslation();
  const [features, setFeatures] = useState(() => getFeatures());
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [signature, setSignature] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSettingsFromAPI(), fetchUserPrefs()]).then(([s, prefs]) => {
      if (!cancelled) {
        setSettings({ ...s, locale: { language: prefs.locale || "fr" } });
        setSignature(prefs.signature || "");
        setLoadingSettings(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const handleToggle = (key) => {
    const updated = { ...features, [key]: !features[key] };
    setFeatures(updated);
    setSaved(false);
  };
  const updateEmail = (field, value) => {
    setSettings((prev) => ({ ...prev, email: { ...prev.email, [field]: value } }));
    setSaved(false);
  };
  const updateAI = (field, value) => {
    setSettings((prev) => ({ ...prev, ai: { ...prev.ai, [field]: value } }));
    setSaved(false);
  };
  const updateSLA = (field, value) => {
    setSettings((prev) => ({ ...prev, sla: { ...prev.sla, [field]: value } }));
    setSaved(false);
  };
  const updateAutoClose = (field, value) => {
    setSettings((prev) => ({ ...prev, autoClose: { ...prev.autoClose, [field]: value } }));
    setSaved(false);
  };
  const updateLocale = (field, value) => {
    setSettings((prev) => ({ ...prev, locale: { ...prev.locale, [field]: value } }));
    setSaved(false);
  };
  const handleSave = async () => {
    setSaving(true);
    saveFeatures(features);
    const [settingsOk, prefsOk] = await Promise.all([
      saveSettingsToAPI(settings),
      saveUserPrefs({ locale: settings.locale.language, signature })
    ]);
    setSaving(false);
    if (settingsOk && prefsOk) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3e3);
    }
  };
  const handleReset = () => {
    setFeatures({ ...DEFAULT_FEATURES });
    setSettings({ ...DEFAULT_SETTINGS });
    setSignature("");
    setSaved(false);
  };
  const enabledCount = Object.entries(features).filter(([k, v]) => typeof v === "boolean" && v).length;
  const totalCount = Object.entries(features).filter(([k, v]) => typeof v === "boolean").length;
  const smtpHost = process.env.NEXT_PUBLIC_SMTP_HOST || "(non configure)";
  const smtpPort = process.env.NEXT_PUBLIC_SMTP_PORT || "\u2014";
  return /* @__PURE__ */ jsxs("div", { className: ts.page, children: [
    /* @__PURE__ */ jsx(
      AdminViewHeader,
      {
        icon: /* @__PURE__ */ jsx(Settings, { size: 24 }),
        title: t("settingsView.configTitle"),
        subtitle: t("settings.subtitle", { enabled: String(enabledCount), total: String(totalCount) }),
        actions: /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8 }, children: [
          /* @__PURE__ */ jsx("button", { onClick: handleReset, style: btnStyle("var(--theme-elevation-400)", { small: true }), children: t("settingsView.reset") }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleSave,
              disabled: saving,
              style: btnStyle(saved ? V.green : V.blue, { small: true }),
              children: saving ? "..." : saved ? t("settingsView.saved") : t("common.save")
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx("p", { className: ts.intro, children: t("settingsView.intro") }),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        title: t("settingsView.features"),
        icon: /* @__PURE__ */ jsx(Settings, { size: 16 }),
        color: V.blue,
        badge: /* @__PURE__ */ jsxs("span", { className: ts.badge, style: { backgroundColor: "#dbeafe", color: "#1e40af" }, children: [
          enabledCount,
          "/",
          totalCount
        ] }),
        children: [
          /* @__PURE__ */ jsx("p", { className: ts.sectionDescription, children: t("settingsView.featuresDescription") }),
          CATEGORIES.map((cat) => {
            const categoryFeatures = FEATURE_LIST.filter((f) => f.category === cat.key);
            return /* @__PURE__ */ jsxs("div", { className: ts.categoryGroup, children: [
              /* @__PURE__ */ jsxs("h3", { className: ts.categoryHeading, style: { color: cat.color }, children: [
                /* @__PURE__ */ jsx("span", { className: ts.categoryDot, style: { backgroundColor: cat.color } }),
                cat.label
              ] }),
              /* @__PURE__ */ jsx("div", { className: ts.featureList, children: categoryFeatures.map((feat) => {
                const enabled = features[feat.key];
                return /* @__PURE__ */ jsxs(
                  "div",
                  {
                    onClick: () => handleToggle(feat.key),
                    className: `${ts.featureCard} ${enabled ? ts.enabled : ""}`,
                    role: "switch",
                    "aria-checked": !!enabled,
                    tabIndex: 0,
                    onKeyDown: (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggle(feat.key);
                      }
                    },
                    children: [
                      /* @__PURE__ */ jsx(Toggle, { checked: !!enabled, onChange: () => handleToggle(feat.key), color: cat.color }),
                      /* @__PURE__ */ jsxs("div", { style: { flex: 1 }, children: [
                        /* @__PURE__ */ jsx("div", { className: ts.featureLabel, children: feat.label }),
                        /* @__PURE__ */ jsx("div", { className: ts.featureDesc, children: feat.description })
                      ] })
                    ]
                  },
                  feat.key
                );
              }) })
            ] }, cat.key);
          })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        title: "Configuration Email",
        icon: /* @__PURE__ */ jsx(Mail, { size: 16 }),
        color: "#ea580c",
        defaultOpen: false,
        children: [
          /* @__PURE__ */ jsx("p", { className: ts.sectionDescription, children: "Parametres d'envoi des notifications email. L'adresse SMTP est configuree via les variables d'environnement du serveur." }),
          /* @__PURE__ */ jsx(FieldRow, { label: "Adresse expediteur", description: "Adresse email affichee dans le champ From", children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "email",
              value: settings.email.fromAddress,
              onChange: (e) => updateEmail("fromAddress", e.target.value),
              placeholder: "support@example.com",
              className: ts.input
            }
          ) }),
          /* @__PURE__ */ jsx(FieldRow, { label: "Nom expediteur", description: "Nom affiche a cote de l'adresse email", children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: settings.email.fromName,
              onChange: (e) => updateEmail("fromName", e.target.value),
              placeholder: "Support ConsilioWEB",
              className: ts.input
            }
          ) }),
          /* @__PURE__ */ jsx(FieldRow, { label: "Adresse Reply-To", description: "Si differente de l'adresse expediteur", children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "email",
              value: settings.email.replyToAddress,
              onChange: (e) => updateEmail("replyToAddress", e.target.value),
              placeholder: "(identique a l'expediteur)",
              className: ts.input
            }
          ) }),
          /* @__PURE__ */ jsx("div", { className: ts.separator }),
          /* @__PURE__ */ jsx(FieldRow, { label: "Serveur SMTP", description: "Configure via variables d'environnement", children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: smtpHost,
              readOnly: true,
              className: ts.inputReadonly
            }
          ) }),
          /* @__PURE__ */ jsx(FieldRow, { label: "Port SMTP", children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: smtpPort,
              readOnly: true,
              className: ts.inputReadonly,
              style: { maxWidth: 100 }
            }
          ) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        title: "Intelligence Artificielle",
        icon: /* @__PURE__ */ jsx(Bot, { size: 16 }),
        color: "#7c3aed",
        defaultOpen: false,
        badge: features.ai ? /* @__PURE__ */ jsx("span", { className: ts.badge, style: { backgroundColor: "#dcfce7", color: "#166534" }, children: "Active" }) : /* @__PURE__ */ jsx("span", { className: ts.badge, style: { backgroundColor: "#fee2e2", color: "#991b1b" }, children: "Inactive" }),
        children: [
          /* @__PURE__ */ jsx("p", { className: ts.sectionDescription, children: `Configurez le fournisseur d'IA et activez/d\xE9sactivez chaque fonctionnalit\xE9 ind\xE9pendamment. Les fonctionnalit\xE9s IA n\xE9cessitent que le flag "Intelligence Artificielle" soit actif dans la section pr\xE9c\xE9dente.` }),
          /* @__PURE__ */ jsx(FieldRow, { label: "Fournisseur", description: "Service d'IA utilise pour l'analyse", children: /* @__PURE__ */ jsxs(
            "select",
            {
              value: settings.ai.provider,
              onChange: (e) => updateAI("provider", e.target.value),
              className: ts.select,
              children: [
                /* @__PURE__ */ jsx("option", { value: "ollama", children: "Ollama (local / tunnel)" }),
                /* @__PURE__ */ jsx("option", { value: "anthropic", children: "Anthropic (Claude)" }),
                /* @__PURE__ */ jsx("option", { value: "openai", children: "OpenAI (GPT)" }),
                /* @__PURE__ */ jsx("option", { value: "gemini", children: "Google (Gemini)" })
              ]
            }
          ) }),
          settings.ai.provider !== "ollama" && /* @__PURE__ */ jsx(FieldRow, { label: "Cle API", description: "Cle secrete du fournisseur (non stockee en clair)", children: /* @__PURE__ */ jsxs("div", { className: ts.apiKeyRow, children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: showApiKey ? "text" : "password",
                value: settings.ai.apiKey,
                onChange: (e) => updateAI("apiKey", e.target.value),
                placeholder: "sk-...",
                className: ts.input,
                style: { flex: 1 }
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setShowApiKey(!showApiKey),
                className: ts.apiKeyToggle,
                children: showApiKey ? "Masquer" : "Afficher"
              }
            )
          ] }) }),
          /* @__PURE__ */ jsx(FieldRow, { label: "Modele", description: "Nom du modele a utiliser", children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: settings.ai.model,
              onChange: (e) => updateAI("model", e.target.value),
              placeholder: "qwen2.5:32b",
              className: ts.input
            }
          ) }),
          /* @__PURE__ */ jsx("div", { className: ts.separator }),
          /* @__PURE__ */ jsx("p", { className: ts.aiSubFeaturesLabel, children: "Fonctionnalit\xE9s IA individuelles" }),
          [
            { key: "enableSentiment", label: "Analyse de sentiment", desc: "Detecte le niveau de frustration ou satisfaction du client" },
            { key: "enableSynthesis", label: "Synthese automatique", desc: "Resume les conversations longues en quelques phrases" },
            { key: "enableSuggestion", label: "Suggestion de reponse", desc: "Propose un brouillon de reponse base sur le contexte" },
            { key: "enableRewrite", label: "Reformulation", desc: "Reformule un message pour le rendre plus professionnel" }
          ].map((item) => /* @__PURE__ */ jsxs("div", { className: ts.aiToggleRow, children: [
            /* @__PURE__ */ jsx(
              Toggle,
              {
                checked: settings.ai[item.key],
                onChange: () => updateAI(item.key, !settings.ai[item.key]),
                color: "#7c3aed",
                size: "sm"
              }
            ),
            /* @__PURE__ */ jsxs("div", { style: { flex: 1 }, children: [
              /* @__PURE__ */ jsx("span", { className: ts.aiToggleLabel, children: item.label }),
              /* @__PURE__ */ jsx("span", { className: ts.aiToggleDesc, children: item.desc })
            ] })
          ] }, item.key))
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        title: "SLA (Accords de niveau de service)",
        icon: /* @__PURE__ */ jsx(Clock, { size: 16 }),
        color: "#0891b2",
        defaultOpen: false,
        children: [
          /* @__PURE__ */ jsx("p", { className: ts.sectionDescription, children: "Definissez les delais de reponse et de resolution attendus. Ces seuils sont utilises pour le suivi de performance et les alertes d'escalade." }),
          /* @__PURE__ */ jsx(FieldRow, { label: "Premiere reponse", description: "D\xE9lai maximum en minutes (d\xE9faut : 120 = 2h)", children: /* @__PURE__ */ jsxs("div", { className: ts.slaInline, children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: 1,
                value: settings.sla.firstResponseMinutes,
                onChange: (e) => updateSLA("firstResponseMinutes", parseInt(e.target.value) || 0),
                className: ts.numberInput
              }
            ),
            /* @__PURE__ */ jsxs("span", { className: ts.slaHint, children: [
              "minutes (",
              Math.floor(settings.sla.firstResponseMinutes / 60),
              "h",
              String(settings.sla.firstResponseMinutes % 60).padStart(2, "0"),
              ")"
            ] })
          ] }) }),
          /* @__PURE__ */ jsx(FieldRow, { label: "R\xE9solution", description: "D\xE9lai maximum en minutes (d\xE9faut : 1440 = 24h)", children: /* @__PURE__ */ jsxs("div", { className: ts.slaInline, children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: 1,
                value: settings.sla.resolutionMinutes,
                onChange: (e) => updateSLA("resolutionMinutes", parseInt(e.target.value) || 0),
                className: ts.numberInput
              }
            ),
            /* @__PURE__ */ jsxs("span", { className: ts.slaHint, children: [
              "minutes (",
              Math.floor(settings.sla.resolutionMinutes / 60),
              "h",
              String(settings.sla.resolutionMinutes % 60).padStart(2, "0"),
              ")"
            ] })
          ] }) }),
          /* @__PURE__ */ jsxs("div", { className: ts.toggleRow, children: [
            /* @__PURE__ */ jsx(
              Toggle,
              {
                checked: settings.sla.businessHoursOnly,
                onChange: () => updateSLA("businessHoursOnly", !settings.sla.businessHoursOnly),
                color: "#0891b2",
                size: "sm"
              }
            ),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("span", { className: ts.inlineLabel, children: "Heures ouvrables uniquement" }),
              /* @__PURE__ */ jsx("div", { className: ts.inlineDesc, children: "Le decompte SLA est suspendu en dehors des heures de bureau (Lun-Ven, 9h-18h)" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: ts.separator }),
          /* @__PURE__ */ jsx(FieldRow, { label: "Email d'escalade", description: "Adresse notifiee en cas de depassement SLA", children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "email",
              value: settings.sla.escalationEmail,
              onChange: (e) => updateSLA("escalationEmail", e.target.value),
              placeholder: "admin@example.com",
              className: ts.input
            }
          ) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        title: "Fermeture automatique",
        icon: /* @__PURE__ */ jsx(Timer, { size: 16 }),
        color: "#d97706",
        defaultOpen: false,
        badge: settings.autoClose.enabled ? /* @__PURE__ */ jsxs("span", { className: ts.badge, style: { backgroundColor: "#dcfce7", color: "#166534" }, children: [
          settings.autoClose.daysBeforeClose,
          "j"
        ] }) : /* @__PURE__ */ jsx("span", { className: ts.badge, style: { backgroundColor: "#e5e7eb", color: "#374151" }, children: "Off" }),
        children: [
          /* @__PURE__ */ jsx("p", { className: ts.sectionDescription, children: "Les tickets en attente client sans reponse seront automatiquement resolus apres le delai configure. Un email de rappel est envoye avant la fermeture." }),
          /* @__PURE__ */ jsxs("div", { className: ts.toggleRow, style: { paddingBottom: 14 }, children: [
            /* @__PURE__ */ jsx(
              Toggle,
              {
                checked: settings.autoClose.enabled,
                onChange: () => updateAutoClose("enabled", !settings.autoClose.enabled),
                color: "#d97706"
              }
            ),
            /* @__PURE__ */ jsx("span", { className: ts.inlineLabel, children: "Activer la fermeture automatique" })
          ] }),
          settings.autoClose.enabled && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(FieldRow, { label: "Delai avant fermeture", description: "Nombre de jours sans reponse du client", children: /* @__PURE__ */ jsxs("div", { className: ts.slaInline, children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  min: 1,
                  max: 90,
                  value: settings.autoClose.daysBeforeClose,
                  onChange: (e) => updateAutoClose("daysBeforeClose", parseInt(e.target.value) || 7),
                  className: ts.numberInput
                }
              ),
              /* @__PURE__ */ jsx("span", { className: ts.slaHint, children: "jours" })
            ] }) }),
            /* @__PURE__ */ jsx(FieldRow, { label: "Rappel avant fermeture", description: "Email de rappel envoye X jours avant", children: /* @__PURE__ */ jsxs("div", { className: ts.slaInline, children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  min: 1,
                  max: settings.autoClose.daysBeforeClose - 1,
                  value: settings.autoClose.reminderDaysBefore,
                  onChange: (e) => updateAutoClose("reminderDaysBefore", parseInt(e.target.value) || 2),
                  className: ts.numberInput
                }
              ),
              /* @__PURE__ */ jsxs("span", { className: ts.slaHint, children: [
                "jours avant (rappel a J-",
                settings.autoClose.reminderDaysBefore,
                ")"
              ] })
            ] }) })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: {
      marginTop: 32,
      marginBottom: 16,
      padding: "12px 16px",
      borderRadius: 8,
      background: "linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%)",
      border: "1px solid #c7d2fe"
    }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: 15, color: "#1e293b" }, children: "Mes preferences" }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 13, color: "#64748b", marginTop: 2 }, children: "Ces reglages sont propres a votre compte et ne s'appliquent qu'a vous." })
    ] }),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        title: "Langue et localisation",
        icon: /* @__PURE__ */ jsx(Globe, { size: 16 }),
        color: "#16a34a",
        defaultOpen: false,
        children: [
          /* @__PURE__ */ jsx("p", { className: ts.sectionDescription, children: "Langue de l'interface du module de support et des notifications email envoyees aux clients." }),
          /* @__PURE__ */ jsx(FieldRow, { label: "Langue", description: "Langue principale du module", children: /* @__PURE__ */ jsxs(
            "select",
            {
              value: settings.locale.language,
              onChange: (e) => updateLocale("language", e.target.value),
              className: ts.select,
              children: [
                /* @__PURE__ */ jsx("option", { value: "fr", children: "Francais" }),
                /* @__PURE__ */ jsx("option", { value: "en", children: "English" })
              ]
            }
          ) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        title: "Signature email",
        icon: /* @__PURE__ */ jsx(FileSignature, { size: 16 }),
        color: "#6366f1",
        defaultOpen: false,
        children: [
          /* @__PURE__ */ jsx("p", { className: ts.sectionDescription, children: "Signature ajoutee automatiquement en bas de chaque reponse email envoyee au client. Supporte le texte brut et le HTML basique." }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              value: signature,
              onChange: (e) => {
                setSignature(e.target.value);
                setSaved(false);
              },
              placeholder: "Cordialement,\nL'equipe ConsilioWEB",
              rows: 6,
              className: ts.signatureTextarea
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs(CollapsibleSection, { title: "Purge des logs", icon: /* @__PURE__ */ jsx(Settings, { size: 18 }), color: "#ef4444", defaultOpen: false, children: [
      /* @__PURE__ */ jsx("p", { className: ts.sectionDescription, children: "Supprimez les anciens logs pour lib\xE9rer de l'espace. Cette action est irr\xE9versible." }),
      /* @__PURE__ */ jsx("div", { className: ts.purgeGroup, children: ["email-logs", "auth-logs"].map((col) => /* @__PURE__ */ jsxs("div", { className: ts.purgeCategory, children: [
        /* @__PURE__ */ jsx("span", { className: ts.purgeCategoryLabel, children: col === "email-logs" ? "Logs Email" : "Logs Auth" }),
        /* @__PURE__ */ jsx("div", { className: ts.purgeButtons, children: [
          { label: "7 jours", days: 7 },
          { label: "30 jours", days: 30 },
          { label: "90 jours", days: 90 },
          { label: "Tout", days: 0 }
        ].map((opt) => /* @__PURE__ */ jsx(
          "button",
          {
            onClick: async () => {
              if (!window.confirm(`Supprimer les logs ${col} de plus de ${opt.days || "tous les"} jours ?`)) return;
              try {
                const res = await fetch(`/api/support/purge-logs?collection=${col}&days=${opt.days}`, { method: "DELETE", credentials: "include" });
                if (res.ok) {
                  const d = await res.json();
                  alert(`${d.purged} log(s) supprim\xE9(s)`);
                }
              } catch {
                alert("Erreur");
              }
            },
            style: { ...btnStyle(opt.days === 0 ? "#ef4444" : "var(--theme-elevation-500)", { small: true }), fontSize: 11 },
            children: opt.label
          },
          opt.days
        )) })
      ] }, col)) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: ts.bottomBar, children: [
      /* @__PURE__ */ jsx("button", { onClick: handleReset, style: btnStyle("var(--theme-elevation-400)", { small: true }), children: "R\xE9initialiser tout" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleSave,
          disabled: saving,
          style: btnStyle(saved ? V.green : V.blue, { small: true }),
          children: saving ? "Sauvegarde..." : saved ? "\u2713 Sauvegard\xE9" : "Sauvegarder les modifications"
        }
      )
    ] })
  ] });
};

export { TicketingSettingsClient };
