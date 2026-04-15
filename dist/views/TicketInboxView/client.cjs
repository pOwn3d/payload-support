'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');
var navigation = require('next/navigation');
var Link = require('next/link');
var useTranslation = require('../../components/TicketConversation/hooks/useTranslation');
var s = require('../../styles/TicketInbox.module.scss');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var Link__default = /*#__PURE__*/_interopDefault(Link);
var s__default = /*#__PURE__*/_interopDefault(s);

const STATUS_DOTS = {
  open: "#22c55e",
  waiting_client: "#eab308",
  resolved: "#94a3b8"
};
const STATUS_LABEL_KEYS = {
  open: "inbox.tabs.open",
  waiting_client: "inbox.tabs.waiting",
  resolved: "inbox.tabs.resolved"
};
const PRIORITY_COLORS = {
  urgent: "#ef4444",
  high: "#f97316",
  normal: "transparent",
  low: "transparent"
};
const CATEGORY_LABEL_KEYS = {
  bug: "ticket.category.bug",
  content: "ticket.category.content",
  feature: "ticket.category.feature",
  question: "ticket.category.question",
  hosting: "ticket.category.hosting"
};
function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 6e4);
  if (mins < 1) return "maintenant";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
const TicketInboxClient = () => {
  const { t } = useTranslation.useTranslation();
  const searchParams = navigation.useSearchParams();
  const [tickets, setTickets] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const [tab, setTab] = react.useState(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && ["all", "open", "waiting_client", "resolved"].includes(urlTab)) return urlTab;
    return "all";
  });
  react.useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && ["all", "open", "waiting_client", "resolved"].includes(urlTab)) {
      setTab(urlTab);
    } else if (!urlTab) {
      setTab("all");
    }
  }, [searchParams]);
  const [search, setSearch] = react.useState("");
  const [sort, setSort] = react.useState("-updatedAt");
  const [counts, setCounts] = react.useState({ all: 0, open: 0, waiting: 0, resolved: 0 });
  const [selectedIdx, setSelectedIdx] = react.useState(-1);
  const [checkedIds, setCheckedIds] = react.useState(/* @__PURE__ */ new Set());
  const [bulkAction, setBulkAction] = react.useState("");
  const [bulkProcessing, setBulkProcessing] = react.useState(false);
  const toggleCheck = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const handleBulkAction = async (action) => {
    if (checkedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const res = await fetch("/api/support/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticketIds: Array.from(checkedIds), action })
      });
      if (res.ok) {
        setCheckedIds(/* @__PURE__ */ new Set());
        setBulkAction("");
        fetchTickets();
      }
    } catch {
    }
    setBulkProcessing(false);
  };
  const fetchTickets = react.useCallback(async () => {
    const params = [`limit=30`, `sort=${sort}`, `depth=1`, `select[id]=true`, `select[ticketNumber]=true`, `select[subject]=true`, `select[status]=true`, `select[priority]=true`, `select[category]=true`, `select[client]=true`, `select[updatedAt]=true`, `select[lastClientMessageAt]=true`, `select[lastAdminReadAt]=true`];
    if (tab !== "all") params.push(`where[status][equals]=${tab}`);
    if (search.trim()) {
      params.push(`where[or][0][subject][contains]=${encodeURIComponent(search)}`);
      params.push(`where[or][1][ticketNumber][contains]=${encodeURIComponent(search)}`);
    }
    try {
      const url = `/api/tickets?${params.join("&")}`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setTickets(d.docs || []);
      } else {
        console.error("[inbox] Fetch failed:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[inbox] Fetch error:", err);
    }
    setLoading(false);
  }, [tab, sort, search]);
  react.useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [fetchTickets]);
  react.useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [all, openRes, waiting, resolved] = await Promise.all([
          fetch("/api/tickets?limit=0&depth=0", { credentials: "include" }),
          fetch("/api/tickets?limit=0&depth=0&where[status][equals]=open", { credentials: "include" }),
          fetch("/api/tickets?limit=0&depth=0&where[status][equals]=waiting_client", { credentials: "include" }),
          fetch("/api/tickets?limit=0&depth=0&where[status][equals]=resolved", { credentials: "include" })
        ]);
        const [a, o, w, r] = await Promise.all([all.json(), openRes.json(), waiting.json(), resolved.json()]);
        setCounts({ all: a.totalDocs || 0, open: o.totalDocs || 0, waiting: w.totalDocs || 0, resolved: r.totalDocs || 0 });
      } catch {
      }
    };
    fetchCounts();
  }, []);
  react.useEffect(() => {
    const iv = setInterval(fetchTickets, 6e4);
    return () => clearInterval(iv);
  }, [fetchTickets]);
  react.useEffect(() => {
    const handleKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((p) => Math.min(p + 1, tickets.length - 1));
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((p) => Math.max(p - 1, 0));
      }
      if (e.key === "Enter" && selectedIdx >= 0 && tickets[selectedIdx]) {
        window.location.href = `/admin/support/ticket?id=${tickets[selectedIdx].id}`;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [tickets, selectedIdx]);
  const tabs = [
    { key: "all", label: t("inbox.tabs.all"), count: counts.all },
    { key: "open", label: t("inbox.tabs.open"), count: counts.open },
    { key: "waiting_client", label: t("inbox.tabs.waiting"), count: counts.waiting },
    { key: "resolved", label: t("inbox.tabs.resolved"), count: counts.resolved }
  ];
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.page, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.header, children: [
      /* @__PURE__ */ jsxRuntime.jsx("h1", { className: s__default.default.title, children: t("inbox.title") }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.headerRight, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.searchWrap, children: [
          /* @__PURE__ */ jsxRuntime.jsxs("svg", { className: s__default.default.searchIcon, width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", children: [
            /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "7", cy: "7", r: "5", stroke: "currentColor", strokeWidth: "1.5" }),
            /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M11 11l3.5 3.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              className: s__default.default.searchInput,
              placeholder: t("inbox.searchPlaceholder"),
              value: search,
              onChange: (e) => setSearch(e.target.value)
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.searchHint, children: "\u2318K" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(Link__default.default, { href: "/admin/support/new-ticket", className: s__default.default.newTicketBtn, children: t("inbox.newTicketBtn") })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.tabs, children: tabs.map((tk) => /* @__PURE__ */ jsxRuntime.jsxs(
      "button",
      {
        className: `${s__default.default.tab} ${tab === tk.key ? s__default.default.tabActive : ""}`,
        onClick: () => {
          setTab(tk.key);
          setSelectedIdx(-1);
        },
        children: [
          tk.label,
          /* @__PURE__ */ jsxRuntime.jsxs("span", { className: s__default.default.tabCount, children: [
            "(",
            tk.count,
            ")"
          ] })
        ]
      },
      tk.key
    )) }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.sortRow, children: checkedIds.size > 0 ? /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", flex: 1 }, children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: 13, fontWeight: 600, color: "var(--theme-text)" }, children: checkedIds.size > 1 ? t("inbox.selectedPlural", { count: String(checkedIds.size) }) : t("inbox.selected", { count: String(checkedIds.size) }) }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { className: s__default.default.sortSelect, onClick: () => handleBulkAction("close"), disabled: bulkProcessing, children: t("inbox.closeAction") }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { className: s__default.default.sortSelect, onClick: () => handleBulkAction("reopen"), disabled: bulkProcessing, children: t("inbox.reopenAction") }),
      /* @__PURE__ */ jsxRuntime.jsxs("select", { className: s__default.default.sortSelect, value: bulkAction, onChange: (e) => {
        if (e.target.value) handleBulkAction(e.target.value);
        setBulkAction("");
      }, children: [
        /* @__PURE__ */ jsxRuntime.jsx("option", { value: "", children: t("inbox.moreActions") }),
        /* @__PURE__ */ jsxRuntime.jsx("option", { value: "set_priority", children: t("inbox.changePriority") }),
        /* @__PURE__ */ jsxRuntime.jsx("option", { value: "delete", children: t("inbox.deleteAction") })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { className: s__default.default.sortSelect, onClick: () => setCheckedIds(/* @__PURE__ */ new Set()), style: { marginLeft: "auto" }, children: t("inbox.deselect") })
    ] }) : /* @__PURE__ */ jsxRuntime.jsxs("select", { className: s__default.default.sortSelect, value: sort, onChange: (e) => setSort(e.target.value), children: [
      /* @__PURE__ */ jsxRuntime.jsx("option", { value: "-updatedAt", children: t("inbox.sort.newest") }),
      /* @__PURE__ */ jsxRuntime.jsx("option", { value: "updatedAt", children: t("inbox.sort.oldest") }),
      /* @__PURE__ */ jsxRuntime.jsx("option", { value: "-createdAt", children: t("inbox.sort.created") }),
      /* @__PURE__ */ jsxRuntime.jsx("option", { value: "priority", children: t("inbox.sort.priority") })
    ] }) }),
    loading ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.loading, children: t("common.loading") }) : tickets.length === 0 ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.empty, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.emptyIcon, children: "--" }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.emptyText, children: t("inbox.empty") })
    ] }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.list, children: tickets.map((tk, idx) => {
      const clientObj = typeof tk.client === "object" ? tk.client : null;
      const clientName = clientObj ? `${clientObj.firstName || ""} ${clientObj.lastName || ""}`.trim() : "";
      const clientCompany = clientObj?.company || "";
      const displayClient = clientName ? `${clientName}${clientCompany ? `, ${clientCompany}` : ""}` : "\u2014";
      const isUnread = tk.lastClientMessageAt && (!tk.lastAdminReadAt || new Date(tk.lastClientMessageAt) > new Date(tk.lastAdminReadAt));
      const priorityColor = PRIORITY_COLORS[tk.priority] || "transparent";
      return /* @__PURE__ */ jsxRuntime.jsxs(
        "a",
        {
          href: `/admin/support/ticket?id=${tk.id}`,
          className: `${s__default.default.row} ${idx === selectedIdx ? s__default.default.rowSelected : ""}`,
          onClick: (e) => {
            e.preventDefault();
            window.location.href = `/admin/support/ticket?id=${tk.id}`;
          },
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                type: "checkbox",
                checked: checkedIds.has(tk.id),
                onClick: (e) => e.stopPropagation(),
                onChange: () => toggleCheck(tk.id),
                style: { width: 14, height: 14, cursor: "pointer", accentColor: "#2563eb" }
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.statusDot, style: { backgroundColor: STATUS_DOTS[tk.status] || "#94a3b8" } }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.statusText, children: t(STATUS_LABEL_KEYS[tk.status] || "ticket.status.open") }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.ticketNum, children: tk.ticketNumber }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.subject, children: tk.subject }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.client, children: displayClient }),
            tk.category ? /* @__PURE__ */ jsxRuntime.jsxs("span", { className: s__default.default.categoryChip, children: [
              "[",
              t(CATEGORY_LABEL_KEYS[tk.category] || "ticket.category.bug"),
              "]"
            ] }) : /* @__PURE__ */ jsxRuntime.jsx("span", {}),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.priorityBar, style: { backgroundColor: priorityColor } }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.timeAgo, children: relativeTime(tk.updatedAt) }),
            isUnread ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.unreadDot }) : /* @__PURE__ */ jsxRuntime.jsx("span", {})
          ]
        },
        tk.id
      );
    }) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.keyboardHints, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("kbd", { children: "\u2191" }),
        /* @__PURE__ */ jsxRuntime.jsx("kbd", { children: "\u2193" }),
        " ",
        t("inbox.keyboardNavigate")
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("kbd", { children: "\u21B5" }),
        " ",
        t("inbox.keyboardOpen")
      ] })
    ] })
  ] });
};

exports.TicketInboxClient = TicketInboxClient;
