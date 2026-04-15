'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');
var Link = require('next/link');
var navigation = require('next/navigation');
var useTranslation = require('../../components/TicketConversation/hooks/useTranslation');
var s = require('../../styles/NewTicket.module.scss');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var Link__default = /*#__PURE__*/_interopDefault(Link);
var s__default = /*#__PURE__*/_interopDefault(s);

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
  const { t } = useTranslation.useTranslation();
  const router = navigation.useRouter();
  const [subject, setSubject] = react.useState("");
  const [description, setDescription] = react.useState("");
  const [category, setCategory] = react.useState("");
  const [priority, setPriority] = react.useState("normal");
  const [clientSearch, setClientSearch] = react.useState("");
  const [clientId, setClientId] = react.useState(null);
  const [clientResults, setClientResults] = react.useState([]);
  const [selectedClient, setSelectedClient] = react.useState(null);
  const [projectId, setProjectId] = react.useState(null);
  const [projects, setProjects] = react.useState([]);
  const [submitting, setSubmitting] = react.useState(false);
  const [error, setError] = react.useState("");
  react.useEffect(() => {
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
  react.useEffect(() => {
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
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.page, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.header, children: [
      /* @__PURE__ */ jsxRuntime.jsxs(Link__default.default, { href: "/admin/support/inbox", className: s__default.default.backLink, children: [
        "\u2190 ",
        t("newTicket.backToInbox")
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("h1", { className: s__default.default.title, children: t("newTicket.title") }),
      /* @__PURE__ */ jsxRuntime.jsx("p", { className: s__default.default.subtitle, children: t("newTicket.subtitle") })
    ] }),
    error && /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.error, children: error }),
    /* @__PURE__ */ jsxRuntime.jsxs("form", { className: s__default.default.form, onSubmit: handleSubmit, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.fieldGroup, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("label", { className: s__default.default.label, children: [
          t("newTicket.clientLabel"),
          " ",
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.required, children: "*" })
        ] }),
        selectedClient ? /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 10, border: "1px solid var(--theme-elevation-200)", background: "var(--theme-elevation-50)" }, children: [
          /* @__PURE__ */ jsxRuntime.jsxs("span", { style: { fontWeight: 600, fontSize: 13, color: "var(--theme-text)" }, children: [
            selectedClient.firstName,
            " ",
            selectedClient.lastName,
            " \u2014 ",
            selectedClient.company
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: 12, color: "var(--theme-elevation-500)" }, children: selectedClient.email }),
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => {
            setSelectedClient(null);
            setClientId(null);
            setClientSearch("");
          }, style: { marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--theme-elevation-400)", fontSize: 16 }, children: "\xD7" })
        ] }) : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.searchWrap, children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              className: s__default.default.input,
              placeholder: t("newTicket.clientSearchPlaceholder"),
              value: clientSearch,
              onChange: (e) => setClientSearch(e.target.value),
              style: { width: "100%" }
            }
          ),
          clientResults.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.searchResults, children: clientResults.map((c) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.searchItem, onClick: () => {
            setSelectedClient(c);
            setClientId(c.id);
            setClientSearch("");
            setClientResults([]);
          }, children: [
            /* @__PURE__ */ jsxRuntime.jsxs("strong", { children: [
              c.firstName,
              " ",
              c.lastName
            ] }),
            " \u2014 ",
            c.company,
            " ",
            /* @__PURE__ */ jsxRuntime.jsx("span", { style: { color: "var(--theme-elevation-400)", fontSize: 12 }, children: c.email })
          ] }, c.id)) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.fieldGroup, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("label", { className: s__default.default.label, children: [
          t("newTicket.subjectLabel"),
          " ",
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.required, children: "*" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("input", { type: "text", className: s__default.default.input, placeholder: t("newTicket.subjectPlaceholder"), value: subject, onChange: (e) => setSubject(e.target.value) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.row3, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.fieldGroup, children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: s__default.default.label, children: t("newTicket.categoryLabel") }),
          /* @__PURE__ */ jsxRuntime.jsx("select", { className: s__default.default.select, value: category, onChange: (e) => setCategory(e.target.value), children: CATEGORY_KEYS.map((c) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: c.value, children: t(c.key) }, c.value)) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.fieldGroup, children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: s__default.default.label, children: t("newTicket.priorityLabel") }),
          /* @__PURE__ */ jsxRuntime.jsx("select", { className: s__default.default.select, value: priority, onChange: (e) => setPriority(e.target.value), children: PRIORITY_KEYS.map((p) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: p.value, children: t(p.key) }, p.value)) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.fieldGroup, children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: s__default.default.label, children: t("newTicket.projectLabel") }),
          /* @__PURE__ */ jsxRuntime.jsxs("select", { className: s__default.default.select, value: projectId || "", onChange: (e) => setProjectId(e.target.value ? Number(e.target.value) : null), children: [
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "", children: "\u2014 Aucun \u2014" }),
            projects.map((p) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: p.id, children: p.name }, p.id))
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.fieldGroup, children: [
        /* @__PURE__ */ jsxRuntime.jsx("label", { className: s__default.default.label, children: t("newTicket.descriptionLabel") }),
        /* @__PURE__ */ jsxRuntime.jsx("textarea", { className: s__default.default.textarea, placeholder: t("newTicket.descriptionPlaceholder"), value: description, onChange: (e) => setDescription(e.target.value) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "submit", className: s__default.default.submitBtn, disabled: submitting, children: submitting ? t("newTicket.submitting") : t("newTicket.submitButton") })
    ] })
  ] });
};

exports.NewTicketClient = NewTicketClient;
