'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');
var lucideReact = require('lucide-react');
var adminTokens = require('../shared/adminTokens');
var AdminViewHeader = require('../shared/AdminViewHeader');
var config = require('../../components/TicketConversation/config');
var useTranslation = require('../../components/TicketConversation/hooks/useTranslation');
var ts = require('../../styles/TicketingSettings.module.scss');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var ts__default = /*#__PURE__*/_interopDefault(ts);

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
  { key: "core", label: "Fonctionnalit\xE9s de base", color: adminTokens.V.blue },
  { key: "communication", label: "Communication", color: adminTokens.V.green },
  { key: "productivity", label: "Productivit\xE9", color: adminTokens.V.amber },
  { key: "advanced", label: "Avanc\xE9", color: "#7c3aed" }
];
const Toggle = ({ checked, onChange, color = adminTokens.V.blue, size = "md" }) => {
  const w = size === "sm" ? 36 : 40;
  const h = size === "sm" ? 20 : 22;
  const knob = size === "sm" ? 16 : 18;
  return /* @__PURE__ */ jsxRuntime.jsx(
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
      children: /* @__PURE__ */ jsxRuntime.jsx("div", { style: {
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
  const [open, setOpen] = react.useState(defaultOpen);
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.sectionWrapper, children: [
    /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        className: ts__default.default.sectionHeader,
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
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.sectionIcon, style: { backgroundColor: color }, children: icon }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: ts__default.default.sectionTitle, children: title }),
          badge,
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: `${ts__default.default.sectionChevron} ${open ? ts__default.default.open : ""}`, children: "\u25BC" })
        ]
      }
    ),
    open && /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.sectionBody, children })
  ] });
};
const FieldRow = ({ label, description, children }) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.fieldRow, children: [
  /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.fieldLabel, children: [
    label,
    description && /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.fieldDescription, children: description })
  ] }),
  /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.fieldContent, children })
] });
const TicketingSettingsClient = () => {
  const { t } = useTranslation.useTranslation();
  const [features, setFeatures] = react.useState(() => config.getFeatures());
  const [settings, setSettings] = react.useState(DEFAULT_SETTINGS);
  const [signature, setSignature] = react.useState("");
  const [saved, setSaved] = react.useState(false);
  const [saving, setSaving] = react.useState(false);
  const [showApiKey, setShowApiKey] = react.useState(false);
  const [loadingSettings, setLoadingSettings] = react.useState(true);
  react.useEffect(() => {
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
    config.saveFeatures(features);
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
    setFeatures({ ...config.DEFAULT_FEATURES });
    setSettings({ ...DEFAULT_SETTINGS });
    setSignature("");
    setSaved(false);
  };
  const enabledCount = Object.entries(features).filter(([k, v]) => typeof v === "boolean" && v).length;
  const totalCount = Object.entries(features).filter(([k, v]) => typeof v === "boolean").length;
  const smtpHost = process.env.NEXT_PUBLIC_SMTP_HOST || "(non configure)";
  const smtpPort = process.env.NEXT_PUBLIC_SMTP_PORT || "\u2014";
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.page, children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      AdminViewHeader.AdminViewHeader,
      {
        icon: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Settings, { size: 24 }),
        title: t("settingsView.configTitle"),
        subtitle: t("settings.subtitle", { enabled: String(enabledCount), total: String(totalCount) }),
        actions: /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", gap: 8 }, children: [
          /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: handleReset, style: adminTokens.btnStyle("var(--theme-elevation-400)", { small: true }), children: t("settingsView.reset") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              onClick: handleSave,
              disabled: saving,
              style: adminTokens.btnStyle(saved ? adminTokens.V.green : adminTokens.V.blue, { small: true }),
              children: saving ? "..." : saved ? t("settingsView.saved") : t("common.save")
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx("p", { className: ts__default.default.intro, children: t("settingsView.intro") }),
    /* @__PURE__ */ jsxRuntime.jsxs(
      CollapsibleSection,
      {
        title: t("settingsView.features"),
        icon: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Settings, { size: 16 }),
        color: adminTokens.V.blue,
        badge: /* @__PURE__ */ jsxRuntime.jsxs("span", { className: ts__default.default.badge, style: { backgroundColor: "#dbeafe", color: "#1e40af" }, children: [
          enabledCount,
          "/",
          totalCount
        ] }),
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: ts__default.default.sectionDescription, children: t("settingsView.featuresDescription") }),
          CATEGORIES.map((cat) => {
            const categoryFeatures = FEATURE_LIST.filter((f) => f.category === cat.key);
            return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.categoryGroup, children: [
              /* @__PURE__ */ jsxRuntime.jsxs("h3", { className: ts__default.default.categoryHeading, style: { color: cat.color }, children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: ts__default.default.categoryDot, style: { backgroundColor: cat.color } }),
                cat.label
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.featureList, children: categoryFeatures.map((feat) => {
                const enabled = features[feat.key];
                return /* @__PURE__ */ jsxRuntime.jsxs(
                  "div",
                  {
                    onClick: () => handleToggle(feat.key),
                    className: `${ts__default.default.featureCard} ${enabled ? ts__default.default.enabled : ""}`,
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
                      /* @__PURE__ */ jsxRuntime.jsx(Toggle, { checked: !!enabled, onChange: () => handleToggle(feat.key), color: cat.color }),
                      /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { flex: 1 }, children: [
                        /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.featureLabel, children: feat.label }),
                        /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.featureDesc, children: feat.description })
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
    /* @__PURE__ */ jsxRuntime.jsxs(
      CollapsibleSection,
      {
        title: "Configuration Email",
        icon: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Mail, { size: 16 }),
        color: "#ea580c",
        defaultOpen: false,
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: ts__default.default.sectionDescription, children: "Parametres d'envoi des notifications email. L'adresse SMTP est configuree via les variables d'environnement du serveur." }),
          /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Adresse expediteur", description: "Adresse email affichee dans le champ From", children: /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "email",
              value: settings.email.fromAddress,
              onChange: (e) => updateEmail("fromAddress", e.target.value),
              placeholder: "support@example.com",
              className: ts__default.default.input
            }
          ) }),
          /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Nom expediteur", description: "Nom affiche a cote de l'adresse email", children: /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              value: settings.email.fromName,
              onChange: (e) => updateEmail("fromName", e.target.value),
              placeholder: "Support ConsilioWEB",
              className: ts__default.default.input
            }
          ) }),
          /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Adresse Reply-To", description: "Si differente de l'adresse expediteur", children: /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "email",
              value: settings.email.replyToAddress,
              onChange: (e) => updateEmail("replyToAddress", e.target.value),
              placeholder: "(identique a l'expediteur)",
              className: ts__default.default.input
            }
          ) }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.separator }),
          /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Serveur SMTP", description: "Configure via variables d'environnement", children: /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              value: smtpHost,
              readOnly: true,
              className: ts__default.default.inputReadonly
            }
          ) }),
          /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Port SMTP", children: /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              value: smtpPort,
              readOnly: true,
              className: ts__default.default.inputReadonly,
              style: { maxWidth: 100 }
            }
          ) })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsxs(
      CollapsibleSection,
      {
        title: "Intelligence Artificielle",
        icon: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Bot, { size: 16 }),
        color: "#7c3aed",
        defaultOpen: false,
        badge: features.ai ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: ts__default.default.badge, style: { backgroundColor: "#dcfce7", color: "#166534" }, children: "Active" }) : /* @__PURE__ */ jsxRuntime.jsx("span", { className: ts__default.default.badge, style: { backgroundColor: "#fee2e2", color: "#991b1b" }, children: "Inactive" }),
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: ts__default.default.sectionDescription, children: `Configurez le fournisseur d'IA et activez/d\xE9sactivez chaque fonctionnalit\xE9 ind\xE9pendamment. Les fonctionnalit\xE9s IA n\xE9cessitent que le flag "Intelligence Artificielle" soit actif dans la section pr\xE9c\xE9dente.` }),
          /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Fournisseur", description: "Service d'IA utilise pour l'analyse", children: /* @__PURE__ */ jsxRuntime.jsxs(
            "select",
            {
              value: settings.ai.provider,
              onChange: (e) => updateAI("provider", e.target.value),
              className: ts__default.default.select,
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "ollama", children: "Ollama (local / tunnel)" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "anthropic", children: "Anthropic (Claude)" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "openai", children: "OpenAI (GPT)" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "gemini", children: "Google (Gemini)" })
              ]
            }
          ) }),
          settings.ai.provider !== "ollama" && /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Cle API", description: "Cle secrete du fournisseur (non stockee en clair)", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.apiKeyRow, children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                type: showApiKey ? "text" : "password",
                value: settings.ai.apiKey,
                onChange: (e) => updateAI("apiKey", e.target.value),
                placeholder: "sk-...",
                className: ts__default.default.input,
                style: { flex: 1 }
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                onClick: () => setShowApiKey(!showApiKey),
                className: ts__default.default.apiKeyToggle,
                children: showApiKey ? "Masquer" : "Afficher"
              }
            )
          ] }) }),
          /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Modele", description: "Nom du modele a utiliser", children: /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              value: settings.ai.model,
              onChange: (e) => updateAI("model", e.target.value),
              placeholder: "qwen2.5:32b",
              className: ts__default.default.input
            }
          ) }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.separator }),
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: ts__default.default.aiSubFeaturesLabel, children: "Fonctionnalit\xE9s IA individuelles" }),
          [
            { key: "enableSentiment", label: "Analyse de sentiment", desc: "Detecte le niveau de frustration ou satisfaction du client" },
            { key: "enableSynthesis", label: "Synthese automatique", desc: "Resume les conversations longues en quelques phrases" },
            { key: "enableSuggestion", label: "Suggestion de reponse", desc: "Propose un brouillon de reponse base sur le contexte" },
            { key: "enableRewrite", label: "Reformulation", desc: "Reformule un message pour le rendre plus professionnel" }
          ].map((item) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.aiToggleRow, children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              Toggle,
              {
                checked: settings.ai[item.key],
                onChange: () => updateAI(item.key, !settings.ai[item.key]),
                color: "#7c3aed",
                size: "sm"
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { flex: 1 }, children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: ts__default.default.aiToggleLabel, children: item.label }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: ts__default.default.aiToggleDesc, children: item.desc })
            ] })
          ] }, item.key))
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsxs(
      CollapsibleSection,
      {
        title: "SLA (Accords de niveau de service)",
        icon: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Clock, { size: 16 }),
        color: "#0891b2",
        defaultOpen: false,
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: ts__default.default.sectionDescription, children: "Definissez les delais de reponse et de resolution attendus. Ces seuils sont utilises pour le suivi de performance et les alertes d'escalade." }),
          /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Premiere reponse", description: "D\xE9lai maximum en minutes (d\xE9faut : 120 = 2h)", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.slaInline, children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                type: "number",
                min: 1,
                value: settings.sla.firstResponseMinutes,
                onChange: (e) => updateSLA("firstResponseMinutes", parseInt(e.target.value) || 0),
                className: ts__default.default.numberInput
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsxs("span", { className: ts__default.default.slaHint, children: [
              "minutes (",
              Math.floor(settings.sla.firstResponseMinutes / 60),
              "h",
              String(settings.sla.firstResponseMinutes % 60).padStart(2, "0"),
              ")"
            ] })
          ] }) }),
          /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "R\xE9solution", description: "D\xE9lai maximum en minutes (d\xE9faut : 1440 = 24h)", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.slaInline, children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                type: "number",
                min: 1,
                value: settings.sla.resolutionMinutes,
                onChange: (e) => updateSLA("resolutionMinutes", parseInt(e.target.value) || 0),
                className: ts__default.default.numberInput
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsxs("span", { className: ts__default.default.slaHint, children: [
              "minutes (",
              Math.floor(settings.sla.resolutionMinutes / 60),
              "h",
              String(settings.sla.resolutionMinutes % 60).padStart(2, "0"),
              ")"
            ] })
          ] }) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.toggleRow, children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              Toggle,
              {
                checked: settings.sla.businessHoursOnly,
                onChange: () => updateSLA("businessHoursOnly", !settings.sla.businessHoursOnly),
                color: "#0891b2",
                size: "sm"
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: ts__default.default.inlineLabel, children: "Heures ouvrables uniquement" }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.inlineDesc, children: "Le decompte SLA est suspendu en dehors des heures de bureau (Lun-Ven, 9h-18h)" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.separator }),
          /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Email d'escalade", description: "Adresse notifiee en cas de depassement SLA", children: /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "email",
              value: settings.sla.escalationEmail,
              onChange: (e) => updateSLA("escalationEmail", e.target.value),
              placeholder: "admin@example.com",
              className: ts__default.default.input
            }
          ) })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsxs(
      CollapsibleSection,
      {
        title: "Fermeture automatique",
        icon: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Timer, { size: 16 }),
        color: "#d97706",
        defaultOpen: false,
        badge: settings.autoClose.enabled ? /* @__PURE__ */ jsxRuntime.jsxs("span", { className: ts__default.default.badge, style: { backgroundColor: "#dcfce7", color: "#166534" }, children: [
          settings.autoClose.daysBeforeClose,
          "j"
        ] }) : /* @__PURE__ */ jsxRuntime.jsx("span", { className: ts__default.default.badge, style: { backgroundColor: "#e5e7eb", color: "#374151" }, children: "Off" }),
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: ts__default.default.sectionDescription, children: "Les tickets en attente client sans reponse seront automatiquement resolus apres le delai configure. Un email de rappel est envoye avant la fermeture." }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.toggleRow, style: { paddingBottom: 14 }, children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              Toggle,
              {
                checked: settings.autoClose.enabled,
                onChange: () => updateAutoClose("enabled", !settings.autoClose.enabled),
                color: "#d97706"
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: ts__default.default.inlineLabel, children: "Activer la fermeture automatique" })
          ] }),
          settings.autoClose.enabled && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Delai avant fermeture", description: "Nombre de jours sans reponse du client", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.slaInline, children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                "input",
                {
                  type: "number",
                  min: 1,
                  max: 90,
                  value: settings.autoClose.daysBeforeClose,
                  onChange: (e) => updateAutoClose("daysBeforeClose", parseInt(e.target.value) || 7),
                  className: ts__default.default.numberInput
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: ts__default.default.slaHint, children: "jours" })
            ] }) }),
            /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Rappel avant fermeture", description: "Email de rappel envoye X jours avant", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.slaInline, children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                "input",
                {
                  type: "number",
                  min: 1,
                  max: settings.autoClose.daysBeforeClose - 1,
                  value: settings.autoClose.reminderDaysBefore,
                  onChange: (e) => updateAutoClose("reminderDaysBefore", parseInt(e.target.value) || 2),
                  className: ts__default.default.numberInput
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { className: ts__default.default.slaHint, children: [
                "jours avant (rappel a J-",
                settings.autoClose.reminderDaysBefore,
                ")"
              ] })
            ] }) })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { style: {
      marginTop: 32,
      marginBottom: 16,
      padding: "12px 16px",
      borderRadius: 8,
      background: "linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%)",
      border: "1px solid #c7d2fe"
    }, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { style: { fontWeight: 700, fontSize: 15, color: "#1e293b" }, children: "Mes preferences" }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { style: { fontSize: 13, color: "#64748b", marginTop: 2 }, children: "Ces reglages sont propres a votre compte et ne s'appliquent qu'a vous." })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs(
      CollapsibleSection,
      {
        title: "Langue et localisation",
        icon: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Globe, { size: 16 }),
        color: "#16a34a",
        defaultOpen: false,
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: ts__default.default.sectionDescription, children: "Langue de l'interface du module de support et des notifications email envoyees aux clients." }),
          /* @__PURE__ */ jsxRuntime.jsx(FieldRow, { label: "Langue", description: "Langue principale du module", children: /* @__PURE__ */ jsxRuntime.jsxs(
            "select",
            {
              value: settings.locale.language,
              onChange: (e) => updateLocale("language", e.target.value),
              className: ts__default.default.select,
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "fr", children: "Francais" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "en", children: "English" })
              ]
            }
          ) })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsxs(
      CollapsibleSection,
      {
        title: "Signature email",
        icon: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.FileSignature, { size: 16 }),
        color: "#6366f1",
        defaultOpen: false,
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: ts__default.default.sectionDescription, children: "Signature ajoutee automatiquement en bas de chaque reponse email envoyee au client. Supporte le texte brut et le HTML basique." }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "textarea",
            {
              value: signature,
              onChange: (e) => {
                setSignature(e.target.value);
                setSaved(false);
              },
              placeholder: "Cordialement,\nL'equipe ConsilioWEB",
              rows: 6,
              className: ts__default.default.signatureTextarea
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsxs(CollapsibleSection, { title: "Purge des logs", icon: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Settings, { size: 18 }), color: "#ef4444", defaultOpen: false, children: [
      /* @__PURE__ */ jsxRuntime.jsx("p", { className: ts__default.default.sectionDescription, children: "Supprimez les anciens logs pour lib\xE9rer de l'espace. Cette action est irr\xE9versible." }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.purgeGroup, children: ["email-logs", "auth-logs"].map((col) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.purgeCategory, children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: ts__default.default.purgeCategoryLabel, children: col === "email-logs" ? "Logs Email" : "Logs Auth" }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: ts__default.default.purgeButtons, children: [
          { label: "7 jours", days: 7 },
          { label: "30 jours", days: 30 },
          { label: "90 jours", days: 90 },
          { label: "Tout", days: 0 }
        ].map((opt) => /* @__PURE__ */ jsxRuntime.jsx(
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
            style: { ...adminTokens.btnStyle(opt.days === 0 ? "#ef4444" : "var(--theme-elevation-500)", { small: true }), fontSize: 11 },
            children: opt.label
          },
          opt.days
        )) })
      ] }, col)) })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ts__default.default.bottomBar, children: [
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: handleReset, style: adminTokens.btnStyle("var(--theme-elevation-400)", { small: true }), children: "R\xE9initialiser tout" }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          onClick: handleSave,
          disabled: saving,
          style: adminTokens.btnStyle(saved ? adminTokens.V.green : adminTokens.V.blue, { small: true }),
          children: saving ? "Sauvegarde..." : saved ? "\u2713 Sauvegard\xE9" : "Sauvegarder les modifications"
        }
      )
    ] })
  ] });
};

exports.TicketingSettingsClient = TicketingSettingsClient;
