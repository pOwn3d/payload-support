"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import s from '../../styles/NewTicket.module.scss';

const CATEGORY_KEYS = [
  { value: "", key: "ticket.category.select" },
  { value: "bug", key: "ticket.category.bugFull" },
  { value: "content", key: "ticket.category.contentFull" },
  { value: "feature", key: "ticket.category.featureFull" },
  { value: "question", key: "ticket.category.questionFull" },
  { value: "hosting", key: "ticket.category.hostingFull" }
];
const PRIORITY_KEYS = [
  { value: "low", key: "ticket.priority.low" },
  { value: "normal", key: "ticket.priority.normal" },
  { value: "high", key: "ticket.priority.high" },
  { value: "urgent", key: "ticket.priority.urgent" }
];
const NewTicketClient = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("normal");
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState(null);
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/support-clients?where[or][0][email][contains]=${encodeURIComponent(clientSearch)}&where[or][1][firstName][contains]=${encodeURIComponent(clientSearch)}&where[or][2][company][contains]=${encodeURIComponent(clientSearch)}&limit=8&depth=0`, { credentials: "include" });
        if (res.ok) {
          const d = await res.json();
          setClientResults(d.docs || []);
        }
      } catch {
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);
  useEffect(() => {
    fetch("/api/projects?where[status][equals]=active&limit=50&depth=0", { credentials: "include" }).then((r) => r.json()).then((d) => setProjects(d.docs || [])).catch(() => {
    });
  }, []);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!subject.trim()) {
      setError(t("newTicket.errors.subjectRequired"));
      return;
    }
    if (!clientId) {
      setError(t("newTicket.errors.clientRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: subject.trim(),
          client: clientId,
          category: category || void 0,
          priority,
          project: projectId || void 0,
          source: "admin",
          status: "open"
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.errors?.[0]?.message || t("newTicket.errors.creationError"));
        return;
      }
      const ticket = await res.json();
      if (description.trim()) {
        await fetch("/api/ticket-messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ticket: ticket.doc.id,
            body: description.trim(),
            authorType: "admin",
            isInternal: false
          })
        });
      }
      router.push(`/admin/support/ticket?id=${ticket.doc.id}`);
    } catch {
      setError(t("newTicket.errors.networkError"));
    } finally {
      setSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: s.page, children: [
    /* @__PURE__ */ jsxs("div", { className: s.header, children: [
      /* @__PURE__ */ jsxs(Link, { href: "/admin/support/inbox", className: s.backLink, children: [
        "\u2190 ",
        t("newTicket.backToInbox")
      ] }),
      /* @__PURE__ */ jsx("h1", { className: s.title, children: t("newTicket.title") }),
      /* @__PURE__ */ jsx("p", { className: s.subtitle, children: t("newTicket.subtitle") })
    ] }),
    error && /* @__PURE__ */ jsx("div", { className: s.error, children: error }),
    /* @__PURE__ */ jsxs("form", { className: s.form, onSubmit: handleSubmit, children: [
      /* @__PURE__ */ jsxs("div", { className: s.fieldGroup, children: [
        /* @__PURE__ */ jsxs("label", { className: s.label, children: [
          t("newTicket.clientLabel"),
          " ",
          /* @__PURE__ */ jsx("span", { className: s.required, children: "*" })
        ] }),
        selectedClient ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 10, border: "1px solid var(--theme-elevation-200)", background: "var(--theme-elevation-50)" }, children: [
          /* @__PURE__ */ jsxs("span", { style: { fontWeight: 600, fontSize: 13, color: "var(--theme-text)" }, children: [
            selectedClient.firstName,
            " ",
            selectedClient.lastName,
            " \u2014 ",
            selectedClient.company
          ] }),
          /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: "var(--theme-elevation-500)" }, children: selectedClient.email }),
          /* @__PURE__ */ jsx("button", { type: "button", onClick: () => {
            setSelectedClient(null);
            setClientId(null);
            setClientSearch("");
          }, style: { marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--theme-elevation-400)", fontSize: 16 }, children: "\xD7" })
        ] }) : /* @__PURE__ */ jsxs("div", { className: s.searchWrap, children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              className: s.input,
              placeholder: t("newTicket.clientSearchPlaceholder"),
              value: clientSearch,
              onChange: (e) => setClientSearch(e.target.value),
              style: { width: "100%" }
            }
          ),
          clientResults.length > 0 && /* @__PURE__ */ jsx("div", { className: s.searchResults, children: clientResults.map((c) => /* @__PURE__ */ jsxs("div", { className: s.searchItem, onClick: () => {
            setSelectedClient(c);
            setClientId(c.id);
            setClientSearch("");
            setClientResults([]);
          }, children: [
            /* @__PURE__ */ jsxs("strong", { children: [
              c.firstName,
              " ",
              c.lastName
            ] }),
            " \u2014 ",
            c.company,
            " ",
            /* @__PURE__ */ jsx("span", { style: { color: "var(--theme-elevation-400)", fontSize: 12 }, children: c.email })
          ] }, c.id)) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: s.fieldGroup, children: [
        /* @__PURE__ */ jsxs("label", { className: s.label, children: [
          t("newTicket.subjectLabel"),
          " ",
          /* @__PURE__ */ jsx("span", { className: s.required, children: "*" })
        ] }),
        /* @__PURE__ */ jsx("input", { type: "text", className: s.input, placeholder: t("newTicket.subjectPlaceholder"), value: subject, onChange: (e) => setSubject(e.target.value) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: s.row3, children: [
        /* @__PURE__ */ jsxs("div", { className: s.fieldGroup, children: [
          /* @__PURE__ */ jsx("label", { className: s.label, children: t("newTicket.categoryLabel") }),
          /* @__PURE__ */ jsx("select", { className: s.select, value: category, onChange: (e) => setCategory(e.target.value), children: CATEGORY_KEYS.map((c) => /* @__PURE__ */ jsx("option", { value: c.value, children: t(c.key) }, c.value)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: s.fieldGroup, children: [
          /* @__PURE__ */ jsx("label", { className: s.label, children: t("newTicket.priorityLabel") }),
          /* @__PURE__ */ jsx("select", { className: s.select, value: priority, onChange: (e) => setPriority(e.target.value), children: PRIORITY_KEYS.map((p) => /* @__PURE__ */ jsx("option", { value: p.value, children: t(p.key) }, p.value)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: s.fieldGroup, children: [
          /* @__PURE__ */ jsx("label", { className: s.label, children: t("newTicket.projectLabel") }),
          /* @__PURE__ */ jsxs("select", { className: s.select, value: projectId || "", onChange: (e) => setProjectId(e.target.value ? Number(e.target.value) : null), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 Aucun \u2014" }),
            projects.map((p) => /* @__PURE__ */ jsx("option", { value: p.id, children: p.name }, p.id))
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: s.fieldGroup, children: [
        /* @__PURE__ */ jsx("label", { className: s.label, children: t("newTicket.descriptionLabel") }),
        /* @__PURE__ */ jsx("textarea", { className: s.textarea, placeholder: t("newTicket.descriptionPlaceholder"), value: description, onChange: (e) => setDescription(e.target.value) })
      ] }),
      /* @__PURE__ */ jsx("button", { type: "submit", className: s.submitBtn, disabled: submitting, children: submitting ? t("newTicket.submitting") : t("newTicket.submitButton") })
    ] })
  ] });
};

export { NewTicketClient };
