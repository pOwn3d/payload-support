"use client";
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useState, useCallback, useEffect } from 'react';
import { Inbox, Paperclip, ChevronUp, ChevronDown, Plus, Link2, X, Search } from 'lucide-react';
import { SkeletonDashboard } from '../shared/Skeleton.js';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import styles from '../../styles/PendingEmails.module.scss';

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
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const doSearch = useCallback(async (q) => {
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
  useEffect(() => {
    const timer = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search, doSearch]);
  const scoreClass = (score) => score >= 0.7 ? styles.scoreHigh : score >= 0.5 ? styles.scoreMedium : styles.scoreLow;
  return /* @__PURE__ */ jsx("div", { className: styles.overlay, onClick: onClose, children: /* @__PURE__ */ jsxs("div", { className: styles.modal, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxs("div", { className: styles.modalHeader, children: [
      /* @__PURE__ */ jsx("h3", { className: styles.modalTitle, children: "Rattacher a un ticket" }),
      /* @__PURE__ */ jsx("button", { onClick: onClose, className: styles.modalClose, children: /* @__PURE__ */ jsx(X, { size: 20 }) })
    ] }),
    suggestions.length > 0 && /* @__PURE__ */ jsxs("div", { className: styles.sectionBlock, children: [
      /* @__PURE__ */ jsx("div", { className: styles.sectionLabel, children: "Suggestions" }),
      suggestions.map((s) => /* @__PURE__ */ jsxs("button", { onClick: () => onSelect(s.id), className: styles.resultRow, children: [
        /* @__PURE__ */ jsx("span", { className: styles.resultTicketNum, children: s.ticketNumber }),
        /* @__PURE__ */ jsx("span", { className: styles.resultSubject, children: s.subject }),
        /* @__PURE__ */ jsxs("span", { className: `${styles.scoreBadge} ${scoreClass(s.score)}`, children: [
          Math.round(s.score * 100),
          "%"
        ] })
      ] }, s.id))
    ] }),
    /* @__PURE__ */ jsxs("div", { className: styles.searchWrap, children: [
      /* @__PURE__ */ jsx(Search, { size: 16, className: styles.searchIcon }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          placeholder: "Rechercher un ticket (TK-0042, sujet...)...",
          value: search,
          onChange: (e) => setSearch(e.target.value),
          className: styles.searchInput
        }
      )
    ] }),
    searching && /* @__PURE__ */ jsx("div", { className: styles.searchingHint, children: "Recherche..." }),
    results.map((r) => /* @__PURE__ */ jsxs("button", { onClick: () => onSelect(r.id), className: styles.resultRow, children: [
      /* @__PURE__ */ jsx("span", { className: styles.resultTicketNum, children: r.ticketNumber }),
      /* @__PURE__ */ jsx("span", { className: styles.resultSubject, children: r.subject })
    ] }, r.id)),
    search.length >= 2 && !searching && results.length === 0 && /* @__PURE__ */ jsx("div", { className: styles.noResults, children: "Aucun ticket trouve" })
  ] }) });
}
function ClientPickerModal({
  defaultEmail,
  detectedClient,
  onSelect,
  onClose
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState({ firstName: "", lastName: "", email: defaultEmail, company: "" });
  const [createError, setCreateError] = useState("");
  const doSearch = useCallback(async (q) => {
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
  useEffect(() => {
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
  return /* @__PURE__ */ jsx("div", { className: styles.overlay, onClick: onClose, children: /* @__PURE__ */ jsxs("div", { className: styles.modal, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxs("div", { className: styles.modalHeader, children: [
      /* @__PURE__ */ jsx("h3", { className: styles.modalTitle, children: "Choisir un client" }),
      /* @__PURE__ */ jsx("button", { onClick: onClose, className: styles.modalClose, children: /* @__PURE__ */ jsx(X, { size: 20 }) })
    ] }),
    detectedClient && /* @__PURE__ */ jsxs("div", { className: styles.sectionBlock, children: [
      /* @__PURE__ */ jsx("div", { className: styles.sectionLabel, children: "Client detecte" }),
      /* @__PURE__ */ jsxs("button", { onClick: () => onSelect(detectedClient.id), className: styles.detectedRow, children: [
        /* @__PURE__ */ jsxs("span", { className: styles.detectedLabel, children: [
          /* @__PURE__ */ jsx("span", { className: styles.detectedName, children: clientLabel(detectedClient) }),
          detectedClient.email && /* @__PURE__ */ jsx("span", { className: styles.detectedEmail, children: detectedClient.email })
        ] }),
        /* @__PURE__ */ jsx("span", { className: styles.useBtn, children: "Utiliser" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: styles.searchWrap, children: [
      /* @__PURE__ */ jsx(Search, { size: 16, className: styles.searchIcon }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          placeholder: "Rechercher un client (nom, email, entreprise)...",
          value: search,
          onChange: (e) => setSearch(e.target.value),
          className: styles.searchInput
        }
      )
    ] }),
    searching && /* @__PURE__ */ jsx("div", { className: styles.searchingHint, children: "Recherche..." }),
    results.map((r) => /* @__PURE__ */ jsx("button", { onClick: () => onSelect(r.id), className: styles.resultRow, children: /* @__PURE__ */ jsxs("span", { className: styles.clientResultLabel, children: [
      /* @__PURE__ */ jsx("span", { className: styles.clientResultName, children: clientLabel(r) }),
      r.email && /* @__PURE__ */ jsx("span", { className: styles.clientResultEmail, children: r.email })
    ] }) }, r.id)),
    search.length >= 2 && !searching && results.length === 0 && /* @__PURE__ */ jsx("div", { className: styles.noResults, children: "Aucun client trouve" }),
    /* @__PURE__ */ jsx("div", { className: styles.separator, children: /* @__PURE__ */ jsxs("button", { onClick: () => setShowCreate(!showCreate), className: styles.createToggle, children: [
      /* @__PURE__ */ jsx(Plus, { size: 14 }),
      showCreate ? "Annuler la creation" : "Creer un nouveau client"
    ] }) }),
    showCreate && /* @__PURE__ */ jsxs("div", { className: styles.createForm, children: [
      createError && /* @__PURE__ */ jsx("div", { className: styles.formError, children: createError }),
      /* @__PURE__ */ jsxs("div", { className: styles.createFormRow, children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            placeholder: "Prenom *",
            value: newClient.firstName,
            onChange: (e) => setNewClient((p) => ({ ...p, firstName: e.target.value })),
            className: styles.formInputHalf
          }
        ),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            placeholder: "Nom",
            value: newClient.lastName,
            onChange: (e) => setNewClient((p) => ({ ...p, lastName: e.target.value })),
            className: styles.formInputHalf
          }
        )
      ] }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "email",
          placeholder: "Email *",
          value: newClient.email,
          onChange: (e) => setNewClient((p) => ({ ...p, email: e.target.value })),
          className: styles.formInput
        }
      ),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          placeholder: "Entreprise *",
          value: newClient.company,
          onChange: (e) => setNewClient((p) => ({ ...p, company: e.target.value })),
          className: styles.formInput
        }
      ),
      /* @__PURE__ */ jsx("button", { onClick: handleCreate, disabled: creating, className: styles.submitBtn, children: creating ? "Creation..." : "Creer et utiliser" })
    ] })
  ] }) });
}
function EmailCard({
  email,
  onProcess,
  processing
}) {
  const [expanded, setExpanded] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const attachmentCount = email.attachments?.length || 0;
  const preview = email.body.slice(0, 200) + (email.body.length > 200 ? "..." : "");
  const suggestions = email.suggestedTickets || [];
  const isPending = email.status === "pending";
  const processedTicketNumber = typeof email.processedTicket === "object" ? email.processedTicket?.ticketNumber : null;
  const suggestionClass = (score) => score >= 0.7 ? styles.suggestionHigh : score >= 0.5 ? styles.suggestionMedium : styles.suggestionLow;
  return /* @__PURE__ */ jsxs("div", { className: `${styles.card} ${processing ? styles.cardProcessing : ""}`, children: [
    /* @__PURE__ */ jsxs("div", { className: styles.cardHeader, children: [
      /* @__PURE__ */ jsxs("div", { className: styles.cardInfo, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.senderRow, children: [
          /* @__PURE__ */ jsx("span", { className: styles.senderName, children: email.senderName || email.senderEmail }),
          email.senderName && /* @__PURE__ */ jsxs("span", { className: styles.senderEmail, children: [
            "<",
            email.senderEmail,
            ">"
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: styles.cardSubject, children: email.subject }),
        /* @__PURE__ */ jsxs("div", { className: styles.cardMeta, children: [
          /* @__PURE__ */ jsx("span", { children: timeAgo(email.createdAt) }),
          attachmentCount > 0 && /* @__PURE__ */ jsxs("span", { className: styles.attachment, children: [
            /* @__PURE__ */ jsx(Paperclip, { size: 12 }),
            " ",
            attachmentCount,
            " PJ"
          ] })
        ] })
      ] }),
      !isPending && /* @__PURE__ */ jsxs("div", { className: `${styles.statusBadge} ${email.status === "processed" ? styles.statusProcessed : styles.statusIgnored}`, children: [
        email.processedAction === "ticket_created" && `Ticket cree${processedTicketNumber ? ` (${processedTicketNumber})` : ""}`,
        email.processedAction === "message_added" && `Rattache${processedTicketNumber ? ` a ${processedTicketNumber}` : ""}`,
        email.processedAction === "ignored" && "Ignore"
      ] })
    ] }),
    suggestions.length > 0 && isPending && /* @__PURE__ */ jsx("div", { className: styles.suggestions, children: suggestions.map((s) => /* @__PURE__ */ jsxs("span", { className: `${styles.suggestionChip} ${suggestionClass(s.score)}`, children: [
      "Similaire a ",
      s.ticketNumber,
      " (",
      Math.round(s.score * 100),
      "%)"
    ] }, s.id)) }),
    /* @__PURE__ */ jsxs("div", { className: styles.bodySection, children: [
      /* @__PURE__ */ jsx("div", { className: `${styles.bodyText} ${expanded ? styles.bodyExpanded : ""}`, children: expanded ? email.body : preview }),
      email.body.length > 200 && /* @__PURE__ */ jsx("button", { onClick: () => setExpanded(!expanded), className: styles.expandBtn, children: expanded ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(ChevronUp, { size: 14 }),
        " Reduire"
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(ChevronDown, { size: 14 }),
        " Voir tout"
      ] }) })
    ] }),
    isPending && /* @__PURE__ */ jsxs("div", { className: styles.actions, children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setShowClientPicker(true),
          disabled: processing,
          className: `${styles.actionBtn} ${styles.btnCreate}`,
          children: [
            /* @__PURE__ */ jsx(Plus, { size: 14 }),
            "Creer un ticket"
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setShowLinkModal(true),
          disabled: processing,
          className: `${styles.actionBtn} ${styles.btnLink}`,
          children: [
            /* @__PURE__ */ jsx(Link2, { size: 14 }),
            "Rattacher a un ticket"
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => onProcess("ignore"),
          disabled: processing,
          className: `${styles.actionBtn} ${styles.btnIgnore}`,
          children: [
            /* @__PURE__ */ jsx(X, { size: 14 }),
            "Ignorer"
          ]
        }
      )
    ] }),
    showLinkModal && /* @__PURE__ */ jsx(
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
    showClientPicker && /* @__PURE__ */ jsx(
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
  const { t } = useTranslation();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [processing, setProcessing] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const fetchEmails = useCallback(async () => {
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
  useEffect(() => {
    setLoading(true);
    fetchEmails();
  }, [fetchEmails]);
  useEffect(() => {
    if (sessionExpired || tab !== "pending") return;
    const interval = setInterval(fetchEmails, 3e4);
    return () => clearInterval(interval);
  }, [fetchEmails, sessionExpired, tab]);
  useEffect(() => {
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
    return /* @__PURE__ */ jsx("div", { className: styles.loadingWrap, children: /* @__PURE__ */ jsx(SkeletonDashboard, {}) });
  }
  const tabs = [
    { key: "pending", label: t("pendingEmails.tabs.pending") },
    { key: "processed", label: t("pendingEmails.tabs.processed") },
    { key: "ignored", label: t("pendingEmails.tabs.ignored") }
  ];
  return /* @__PURE__ */ jsxs("div", { className: styles.page, children: [
    /* @__PURE__ */ jsxs("div", { className: styles.header, children: [
      /* @__PURE__ */ jsxs("div", { className: styles.headerLeft, children: [
        /* @__PURE__ */ jsxs("h1", { className: styles.title, children: [
          /* @__PURE__ */ jsx("span", { className: styles.titleIcon, children: /* @__PURE__ */ jsx(Inbox, { size: 24 }) }),
          t("pendingEmails.title")
        ] }),
        /* @__PURE__ */ jsx("p", { className: styles.subtitle, children: t("pendingEmails.subtitle") })
      ] }),
      tab === "pending" && emails.length > 0 && /* @__PURE__ */ jsx("span", { className: styles.pendingBadge, children: t("pendingEmails.pendingCount", { count: String(emails.length) }) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: styles.tabs, children: tabs.map((tk) => /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => setTab(tk.key),
        className: `${styles.tab} ${tab === tk.key ? styles.tabActive : ""}`,
        children: tk.label
      },
      tk.key
    )) }),
    emails.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.empty, children: tab === "pending" ? t("pendingEmails.empty.pending") : tab === "processed" ? t("pendingEmails.empty.processed") : t("pendingEmails.empty.ignored") }) : emails.map((email) => /* @__PURE__ */ jsx(
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

export { PendingEmailsClient };
