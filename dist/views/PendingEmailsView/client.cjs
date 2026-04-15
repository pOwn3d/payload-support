'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');
var lucideReact = require('lucide-react');
var Skeleton = require('../shared/Skeleton');
var useTranslation = require('../../components/TicketConversation/hooks/useTranslation');
var styles = require('../../styles/PendingEmails.module.scss');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var styles__default = /*#__PURE__*/_interopDefault(styles);

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 6e4);
  if (mins < 1) return "\xE0 l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}
function TicketSearchModal({
  suggestions,
  onSelect,
  onClose
}) {
  const [search, setSearch] = react.useState("");
  const [results, setResults] = react.useState([]);
  const [searching, setSearching] = react.useState(false);
  const doSearch = react.useCallback(async (q) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/tickets?where[or][0][ticketNumber][contains]=${encodeURIComponent(q)}&where[or][1][subject][contains]=${encodeURIComponent(q)}&limit=10&sort=-updatedAt&depth=0`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.docs.map((d) => ({
          id: d.id,
          ticketNumber: d.ticketNumber,
          subject: d.subject
        })));
      }
    } catch {
    }
    setSearching(false);
  }, []);
  react.useEffect(() => {
    const timer = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search, doSearch]);
  const scoreClass = (score) => score >= 0.7 ? styles__default.default.scoreHigh : score >= 0.5 ? styles__default.default.scoreMedium : styles__default.default.scoreLow;
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.overlay, onClick: onClose, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.modal, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.modalHeader, children: [
      /* @__PURE__ */ jsxRuntime.jsx("h3", { className: styles__default.default.modalTitle, children: "Rattacher a un ticket" }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: onClose, className: styles__default.default.modalClose, children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { size: 20 }) })
    ] }),
    suggestions.length > 0 && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.sectionBlock, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.sectionLabel, children: "Suggestions" }),
      suggestions.map((s) => /* @__PURE__ */ jsxRuntime.jsxs("button", { onClick: () => onSelect(s.id), className: styles__default.default.resultRow, children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.resultTicketNum, children: s.ticketNumber }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.resultSubject, children: s.subject }),
        /* @__PURE__ */ jsxRuntime.jsxs("span", { className: `${styles__default.default.scoreBadge} ${scoreClass(s.score)}`, children: [
          Math.round(s.score * 100),
          "%"
        ] })
      ] }, s.id))
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.searchWrap, children: [
      /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Search, { size: 16, className: styles__default.default.searchIcon }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          type: "text",
          placeholder: "Rechercher un ticket (TK-0042, sujet...)...",
          value: search,
          onChange: (e) => setSearch(e.target.value),
          className: styles__default.default.searchInput
        }
      )
    ] }),
    searching && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.searchingHint, children: "Recherche..." }),
    results.map((r) => /* @__PURE__ */ jsxRuntime.jsxs("button", { onClick: () => onSelect(r.id), className: styles__default.default.resultRow, children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.resultTicketNum, children: r.ticketNumber }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.resultSubject, children: r.subject })
    ] }, r.id)),
    search.length >= 2 && !searching && results.length === 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.noResults, children: "Aucun ticket trouve" })
  ] }) });
}
function ClientPickerModal({
  defaultEmail,
  detectedClient,
  onSelect,
  onClose
}) {
  const [search, setSearch] = react.useState("");
  const [results, setResults] = react.useState([]);
  const [searching, setSearching] = react.useState(false);
  const [showCreate, setShowCreate] = react.useState(false);
  const [creating, setCreating] = react.useState(false);
  const [newClient, setNewClient] = react.useState({ firstName: "", lastName: "", email: defaultEmail, company: "" });
  const [createError, setCreateError] = react.useState("");
  const doSearch = react.useCallback(async (q) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/support-clients?where[or][0][email][contains]=${encodeURIComponent(q)}&where[or][1][firstName][contains]=${encodeURIComponent(q)}&where[or][2][lastName][contains]=${encodeURIComponent(q)}&where[or][3][company][contains]=${encodeURIComponent(q)}&limit=10&sort=-updatedAt&depth=0`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.docs.map((d) => ({
          id: d.id,
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email,
          company: d.company
        })));
      }
    } catch {
    }
    setSearching(false);
  }, []);
  react.useEffect(() => {
    const timer = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search, doSearch]);
  const handleCreate = async () => {
    setCreateError("");
    if (!newClient.email.trim() || !newClient.firstName.trim() || !newClient.company.trim()) {
      setCreateError("Email, prenom et entreprise sont obligatoires");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/support-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newClient.email.trim(),
          firstName: newClient.firstName.trim(),
          lastName: newClient.lastName.trim() || void 0,
          company: newClient.company.trim(),
          password: crypto.randomUUID()
        })
      });
      if (res.ok) {
        const data = await res.json();
        onSelect(data.doc.id);
      } else {
        const err = await res.json().catch(() => ({}));
        setCreateError(err.errors?.[0]?.message || "Erreur lors de la creation");
      }
    } catch {
      setCreateError("Erreur reseau");
    }
    setCreating(false);
  };
  const clientLabel = (c) => {
    const parts = [c.firstName, c.lastName].filter(Boolean).join(" ");
    return parts ? `${parts}${c.company ? ` \u2014 ${c.company}` : ""}` : c.email || "";
  };
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.overlay, onClick: onClose, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.modal, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.modalHeader, children: [
      /* @__PURE__ */ jsxRuntime.jsx("h3", { className: styles__default.default.modalTitle, children: "Choisir un client" }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: onClose, className: styles__default.default.modalClose, children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { size: 20 }) })
    ] }),
    detectedClient && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.sectionBlock, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.sectionLabel, children: "Client detecte" }),
      /* @__PURE__ */ jsxRuntime.jsxs("button", { onClick: () => onSelect(detectedClient.id), className: styles__default.default.detectedRow, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.detectedLabel, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.detectedName, children: clientLabel(detectedClient) }),
          detectedClient.email && /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.detectedEmail, children: detectedClient.email })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.useBtn, children: "Utiliser" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.searchWrap, children: [
      /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Search, { size: 16, className: styles__default.default.searchIcon }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          type: "text",
          placeholder: "Rechercher un client (nom, email, entreprise)...",
          value: search,
          onChange: (e) => setSearch(e.target.value),
          className: styles__default.default.searchInput
        }
      )
    ] }),
    searching && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.searchingHint, children: "Recherche..." }),
    results.map((r) => /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: () => onSelect(r.id), className: styles__default.default.resultRow, children: /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.clientResultLabel, children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.clientResultName, children: clientLabel(r) }),
      r.email && /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.clientResultEmail, children: r.email })
    ] }) }, r.id)),
    search.length >= 2 && !searching && results.length === 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.noResults, children: "Aucun client trouve" }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.separator, children: /* @__PURE__ */ jsxRuntime.jsxs("button", { onClick: () => setShowCreate(!showCreate), className: styles__default.default.createToggle, children: [
      /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Plus, { size: 14 }),
      showCreate ? "Annuler la creation" : "Creer un nouveau client"
    ] }) }),
    showCreate && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.createForm, children: [
      createError && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.formError, children: createError }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.createFormRow, children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          "input",
          {
            type: "text",
            placeholder: "Prenom *",
            value: newClient.firstName,
            onChange: (e) => setNewClient((p) => ({ ...p, firstName: e.target.value })),
            className: styles__default.default.formInputHalf
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "input",
          {
            type: "text",
            placeholder: "Nom",
            value: newClient.lastName,
            onChange: (e) => setNewClient((p) => ({ ...p, lastName: e.target.value })),
            className: styles__default.default.formInputHalf
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          type: "email",
          placeholder: "Email *",
          value: newClient.email,
          onChange: (e) => setNewClient((p) => ({ ...p, email: e.target.value })),
          className: styles__default.default.formInput
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          type: "text",
          placeholder: "Entreprise *",
          value: newClient.company,
          onChange: (e) => setNewClient((p) => ({ ...p, company: e.target.value })),
          className: styles__default.default.formInput
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: handleCreate, disabled: creating, className: styles__default.default.submitBtn, children: creating ? "Creation..." : "Creer et utiliser" })
    ] })
  ] }) });
}
function EmailCard({
  email,
  onProcess,
  processing
}) {
  const [expanded, setExpanded] = react.useState(false);
  const [showLinkModal, setShowLinkModal] = react.useState(false);
  const [showClientPicker, setShowClientPicker] = react.useState(false);
  const attachmentCount = email.attachments?.length || 0;
  const preview = email.body.slice(0, 200) + (email.body.length > 200 ? "..." : "");
  const suggestions = email.suggestedTickets || [];
  const isPending = email.status === "pending";
  const processedTicketNumber = typeof email.processedTicket === "object" ? email.processedTicket?.ticketNumber : null;
  const suggestionClass = (score) => score >= 0.7 ? styles__default.default.suggestionHigh : score >= 0.5 ? styles__default.default.suggestionMedium : styles__default.default.suggestionLow;
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `${styles__default.default.card} ${processing ? styles__default.default.cardProcessing : ""}`, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.cardHeader, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.cardInfo, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.senderRow, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.senderName, children: email.senderName || email.senderEmail }),
          email.senderName && /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.senderEmail, children: [
            "<",
            email.senderEmail,
            ">"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.cardSubject, children: email.subject }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.cardMeta, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { children: timeAgo(email.createdAt) }),
          attachmentCount > 0 && /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.attachment, children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Paperclip, { size: 12 }),
            " ",
            attachmentCount,
            " PJ"
          ] })
        ] })
      ] }),
      !isPending && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `${styles__default.default.statusBadge} ${email.status === "processed" ? styles__default.default.statusProcessed : styles__default.default.statusIgnored}`, children: [
        email.processedAction === "ticket_created" && `Ticket cree${processedTicketNumber ? ` (${processedTicketNumber})` : ""}`,
        email.processedAction === "message_added" && `Rattache${processedTicketNumber ? ` a ${processedTicketNumber}` : ""}`,
        email.processedAction === "ignored" && "Ignore"
      ] })
    ] }),
    suggestions.length > 0 && isPending && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.suggestions, children: suggestions.map((s) => /* @__PURE__ */ jsxRuntime.jsxs("span", { className: `${styles__default.default.suggestionChip} ${suggestionClass(s.score)}`, children: [
      "Similaire a ",
      s.ticketNumber,
      " (",
      Math.round(s.score * 100),
      "%)"
    ] }, s.id)) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.bodySection, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${styles__default.default.bodyText} ${expanded ? styles__default.default.bodyExpanded : ""}`, children: expanded ? email.body : preview }),
      email.body.length > 200 && /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: () => setExpanded(!expanded), className: styles__default.default.expandBtn, children: expanded ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ChevronUp, { size: 14 }),
        " Reduire"
      ] }) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ChevronDown, { size: 14 }),
        " Voir tout"
      ] }) })
    ] }),
    isPending && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.actions, children: [
      /* @__PURE__ */ jsxRuntime.jsxs(
        "button",
        {
          onClick: () => setShowClientPicker(true),
          disabled: processing,
          className: `${styles__default.default.actionBtn} ${styles__default.default.btnCreate}`,
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Plus, { size: 14 }),
            "Creer un ticket"
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsxs(
        "button",
        {
          onClick: () => setShowLinkModal(true),
          disabled: processing,
          className: `${styles__default.default.actionBtn} ${styles__default.default.btnLink}`,
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Link2, { size: 14 }),
            "Rattacher a un ticket"
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsxs(
        "button",
        {
          onClick: () => onProcess("ignore"),
          disabled: processing,
          className: `${styles__default.default.actionBtn} ${styles__default.default.btnIgnore}`,
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { size: 14 }),
            "Ignorer"
          ]
        }
      )
    ] }),
    showLinkModal && /* @__PURE__ */ jsxRuntime.jsx(
      TicketSearchModal,
      {
        suggestions,
        onSelect: (ticketId) => {
          setShowLinkModal(false);
          onProcess("add_to_ticket", ticketId);
        },
        onClose: () => setShowLinkModal(false)
      }
    ),
    showClientPicker && /* @__PURE__ */ jsxRuntime.jsx(
      ClientPickerModal,
      {
        defaultEmail: email.senderEmail,
        detectedClient: typeof email.client === "object" && email.client ? { id: email.client.id, firstName: email.client.firstName, lastName: email.client.lastName, email: email.client.email, company: email.client.company } : null,
        onSelect: (clientId) => {
          setShowClientPicker(false);
          onProcess("create_ticket", void 0, clientId);
        },
        onClose: () => setShowClientPicker(false)
      }
    )
  ] });
}
const PendingEmailsClient = () => {
  const { t } = useTranslation.useTranslation();
  const [emails, setEmails] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const [tab, setTab] = react.useState("pending");
  const [processing, setProcessing] = react.useState(null);
  const [sessionExpired, setSessionExpired] = react.useState(false);
  const fetchEmails = react.useCallback(async () => {
    try {
      const res = await fetch(`/api/pending-emails?where[status][equals]=${tab}&sort=-createdAt&limit=50&depth=1`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.docs);
      } else if (res.status === 401 || res.status === 403) {
        setSessionExpired(true);
      }
    } catch {
    }
    setLoading(false);
  }, [tab]);
  react.useEffect(() => {
    setLoading(true);
    fetchEmails();
  }, [fetchEmails]);
  react.useEffect(() => {
    if (sessionExpired || tab !== "pending") return;
    const interval = setInterval(fetchEmails, 3e4);
    return () => clearInterval(interval);
  }, [fetchEmails, sessionExpired, tab]);
  react.useEffect(() => {
    if (sessionExpired) return;
    const onFocus = () => fetchEmails();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchEmails, sessionExpired]);
  const handleProcess = async (emailId, action, ticketId, clientId) => {
    setProcessing(emailId);
    try {
      const res = await fetch(`/api/support/pending-emails/${emailId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ticketId, clientId })
      });
      if (res.ok) {
        setEmails((prev) => prev.filter((e) => e.id !== emailId));
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(`Erreur : ${err.error || res.statusText}`);
      }
    } catch {
      alert("Erreur reseau");
    }
    setProcessing(null);
  };
  if (loading) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.loadingWrap, children: /* @__PURE__ */ jsxRuntime.jsx(Skeleton.SkeletonDashboard, {}) });
  }
  const tabs = [
    { key: "pending", label: t("pendingEmails.tabs.pending") },
    { key: "processed", label: t("pendingEmails.tabs.processed") },
    { key: "ignored", label: t("pendingEmails.tabs.ignored") }
  ];
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.page, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.header, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.headerLeft, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("h1", { className: styles__default.default.title, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.titleIcon, children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Inbox, { size: 24 }) }),
          t("pendingEmails.title")
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { className: styles__default.default.subtitle, children: t("pendingEmails.subtitle") })
      ] }),
      tab === "pending" && emails.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.pendingBadge, children: t("pendingEmails.pendingCount", { count: String(emails.length) }) })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.tabs, children: tabs.map((tk) => /* @__PURE__ */ jsxRuntime.jsx(
      "button",
      {
        onClick: () => setTab(tk.key),
        className: `${styles__default.default.tab} ${tab === tk.key ? styles__default.default.tabActive : ""}`,
        children: tk.label
      },
      tk.key
    )) }),
    emails.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.empty, children: tab === "pending" ? t("pendingEmails.empty.pending") : tab === "processed" ? t("pendingEmails.empty.processed") : t("pendingEmails.empty.ignored") }) : emails.map((email) => /* @__PURE__ */ jsxRuntime.jsx(
      EmailCard,
      {
        email,
        onProcess: (action, ticketId, clientId) => handleProcess(email.id, action, ticketId, clientId),
        processing: processing === email.id
      },
      email.id
    ))
  ] });
};

exports.PendingEmailsClient = PendingEmailsClient;
