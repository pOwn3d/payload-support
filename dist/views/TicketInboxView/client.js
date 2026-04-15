"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import s from '../../styles/TicketInbox.module.scss';

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
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && ["all", "open", "waiting_client", "resolved"].includes(urlTab)) return urlTab;
    return "all";
  });
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && ["all", "open", "waiting_client", "resolved"].includes(urlTab)) {
      setTab(urlTab);
    } else if (!urlTab) {
      setTab("all");
    }
  }, [searchParams]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("-updatedAt");
  const [counts, setCounts] = useState({ all: 0, open: 0, waiting: 0, resolved: 0 });
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [checkedIds, setCheckedIds] = useState(/* @__PURE__ */ new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);
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
  const fetchTickets = useCallback(async () => {
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
  useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [fetchTickets]);
  useEffect(() => {
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
  useEffect(() => {
    const iv = setInterval(fetchTickets, 6e4);
    return () => clearInterval(iv);
  }, [fetchTickets]);
  useEffect(() => {
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
  return /* @__PURE__ */ jsxs("div", { className: s.page, children: [
    /* @__PURE__ */ jsxs("div", { className: s.header, children: [
      /* @__PURE__ */ jsx("h1", { className: s.title, children: t("inbox.title") }),
      /* @__PURE__ */ jsxs("div", { className: s.headerRight, children: [
        /* @__PURE__ */ jsxs("div", { className: s.searchWrap, children: [
          /* @__PURE__ */ jsxs("svg", { className: s.searchIcon, width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", children: [
            /* @__PURE__ */ jsx("circle", { cx: "7", cy: "7", r: "5", stroke: "currentColor", strokeWidth: "1.5" }),
            /* @__PURE__ */ jsx("path", { d: "M11 11l3.5 3.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              className: s.searchInput,
              placeholder: t("inbox.searchPlaceholder"),
              value: search,
              onChange: (e) => setSearch(e.target.value)
            }
          ),
          /* @__PURE__ */ jsx("span", { className: s.searchHint, children: "\u2318K" })
        ] }),
        /* @__PURE__ */ jsx(Link, { href: "/admin/support/new-ticket", className: s.newTicketBtn, children: t("inbox.newTicketBtn") })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: s.tabs, children: tabs.map((tk) => /* @__PURE__ */ jsxs(
      "button",
      {
        className: `${s.tab} ${tab === tk.key ? s.tabActive : ""}`,
        onClick: () => {
          setTab(tk.key);
          setSelectedIdx(-1);
        },
        children: [
          tk.label,
          /* @__PURE__ */ jsxs("span", { className: s.tabCount, children: [
            "(",
            tk.count,
            ")"
          ] })
        ]
      },
      tk.key
    )) }),
    /* @__PURE__ */ jsx("div", { className: s.sortRow, children: checkedIds.size > 0 ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", flex: 1 }, children: [
      /* @__PURE__ */ jsx("span", { style: { fontSize: 13, fontWeight: 600, color: "var(--theme-text)" }, children: checkedIds.size > 1 ? t("inbox.selectedPlural", { count: String(checkedIds.size) }) : t("inbox.selected", { count: String(checkedIds.size) }) }),
      /* @__PURE__ */ jsx("button", { className: s.sortSelect, onClick: () => handleBulkAction("close"), disabled: bulkProcessing, children: t("inbox.closeAction") }),
      /* @__PURE__ */ jsx("button", { className: s.sortSelect, onClick: () => handleBulkAction("reopen"), disabled: bulkProcessing, children: t("inbox.reopenAction") }),
      /* @__PURE__ */ jsxs("select", { className: s.sortSelect, value: bulkAction, onChange: (e) => {
        if (e.target.value) handleBulkAction(e.target.value);
        setBulkAction("");
      }, children: [
        /* @__PURE__ */ jsx("option", { value: "", children: t("inbox.moreActions") }),
        /* @__PURE__ */ jsx("option", { value: "set_priority", children: t("inbox.changePriority") }),
        /* @__PURE__ */ jsx("option", { value: "delete", children: t("inbox.deleteAction") })
      ] }),
      /* @__PURE__ */ jsx("button", { className: s.sortSelect, onClick: () => setCheckedIds(/* @__PURE__ */ new Set()), style: { marginLeft: "auto" }, children: t("inbox.deselect") })
    ] }) : /* @__PURE__ */ jsxs("select", { className: s.sortSelect, value: sort, onChange: (e) => setSort(e.target.value), children: [
      /* @__PURE__ */ jsx("option", { value: "-updatedAt", children: t("inbox.sort.newest") }),
      /* @__PURE__ */ jsx("option", { value: "updatedAt", children: t("inbox.sort.oldest") }),
      /* @__PURE__ */ jsx("option", { value: "-createdAt", children: t("inbox.sort.created") }),
      /* @__PURE__ */ jsx("option", { value: "priority", children: t("inbox.sort.priority") })
    ] }) }),
    loading ? /* @__PURE__ */ jsx("div", { className: s.loading, children: t("common.loading") }) : tickets.length === 0 ? /* @__PURE__ */ jsxs("div", { className: s.empty, children: [
      /* @__PURE__ */ jsx("div", { className: s.emptyIcon, children: "--" }),
      /* @__PURE__ */ jsx("div", { className: s.emptyText, children: t("inbox.empty") })
    ] }) : /* @__PURE__ */ jsx("div", { className: s.list, children: tickets.map((tk, idx) => {
      const clientObj = typeof tk.client === "object" ? tk.client : null;
      const clientName = clientObj ? `${clientObj.firstName || ""} ${clientObj.lastName || ""}`.trim() : "";
      const clientCompany = clientObj?.company || "";
      const displayClient = clientName ? `${clientName}${clientCompany ? `, ${clientCompany}` : ""}` : "\u2014";
      const isUnread = tk.lastClientMessageAt && (!tk.lastAdminReadAt || new Date(tk.lastClientMessageAt) > new Date(tk.lastAdminReadAt));
      const priorityColor = PRIORITY_COLORS[tk.priority] || "transparent";
      return /* @__PURE__ */ jsxs(
        "a",
        {
          href: `/admin/support/ticket?id=${tk.id}`,
          className: `${s.row} ${idx === selectedIdx ? s.rowSelected : ""}`,
          onClick: (e) => {
            e.preventDefault();
            window.location.href = `/admin/support/ticket?id=${tk.id}`;
          },
          children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                checked: checkedIds.has(tk.id),
                onClick: (e) => e.stopPropagation(),
                onChange: () => toggleCheck(tk.id),
                style: { width: 14, height: 14, cursor: "pointer", accentColor: "#2563eb" }
              }
            ),
            /* @__PURE__ */ jsx("div", { className: s.statusDot, style: { backgroundColor: STATUS_DOTS[tk.status] || "#94a3b8" } }),
            /* @__PURE__ */ jsx("span", { className: s.statusText, children: t(STATUS_LABEL_KEYS[tk.status] || "ticket.status.open") }),
            /* @__PURE__ */ jsx("span", { className: s.ticketNum, children: tk.ticketNumber }),
            /* @__PURE__ */ jsx("span", { className: s.subject, children: tk.subject }),
            /* @__PURE__ */ jsx("span", { className: s.client, children: displayClient }),
            tk.category ? /* @__PURE__ */ jsxs("span", { className: s.categoryChip, children: [
              "[",
              t(CATEGORY_LABEL_KEYS[tk.category] || "ticket.category.bug"),
              "]"
            ] }) : /* @__PURE__ */ jsx("span", {}),
            /* @__PURE__ */ jsx("div", { className: s.priorityBar, style: { backgroundColor: priorityColor } }),
            /* @__PURE__ */ jsx("span", { className: s.timeAgo, children: relativeTime(tk.updatedAt) }),
            isUnread ? /* @__PURE__ */ jsx("div", { className: s.unreadDot }) : /* @__PURE__ */ jsx("span", {})
          ]
        },
        tk.id
      );
    }) }),
    /* @__PURE__ */ jsxs("div", { className: s.keyboardHints, children: [
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("kbd", { children: "\u2191" }),
        /* @__PURE__ */ jsx("kbd", { children: "\u2193" }),
        " ",
        t("inbox.keyboardNavigate")
      ] }),
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("kbd", { children: "\u21B5" }),
        " ",
        t("inbox.keyboardOpen")
      ] })
    ] })
  ] });
};

export { TicketInboxClient };
