"use client";
import { jsx, jsxs } from 'react/jsx-runtime';
import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import s from '../../styles/EmailTracking.module.scss';

const STATUS_CFG = {
  success: { label: "Succ\xE8s", bg: "#dcfce7", color: "#16a34a" },
  error: { label: "Erreur", bg: "#fef2f2", color: "#dc2626" },
  ignored: { label: "Ignor\xE9", bg: "#f3f4f6", color: "#6b7280" }
};
function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const EmailTrackingClient = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [dateRange, setDateRange] = useState(7);
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalDocs, setTotalDocs] = useState(0);
  const LIMIT = 30;
  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`/api/support/email-stats?days=${dateRange}`);
      if (r.ok) setStats(await r.json());
    } catch {
    }
  }, [dateRange]);
  const fetchLogs = useCallback(async () => {
    const cutoff = new Date(Date.now() - dateRange * 864e5).toISOString();
    const where = [`where[createdAt][greater_than]=${cutoff}`];
    if (tab !== "all") where.push(`where[status][equals]=${tab}`);
    if (search.trim()) {
      where.push(`where[or][0][recipientEmail][contains]=${encodeURIComponent(search)}`, `where[or][1][subject][contains]=${encodeURIComponent(search)}`);
    }
    try {
      const r = await fetch(`/api/email-logs?${where.join("&")}&sort=-createdAt&limit=${LIMIT}&page=${page}&depth=0`);
      if (r.ok) {
        const d = await r.json();
        setLogs(d.docs);
        setHasMore(d.hasNextPage);
        setTotalDocs(d.totalDocs);
      }
    } catch {
    }
    setLoading(false);
  }, [dateRange, tab, search, page]);
  useEffect(() => {
    setLoading(true);
    setPage(1);
  }, [dateRange, tab, search]);
  useEffect(() => {
    fetchStats();
    fetchLogs();
  }, [fetchStats, fetchLogs]);
  const tabsList = [
    { key: "all", label: t("emailTracking.tabs.all"), count: stats?.total },
    { key: "success", label: t("emailTracking.tabs.success"), count: stats?.success },
    { key: "error", label: t("emailTracking.tabs.errors"), count: stats?.errors },
    { key: "ignored", label: t("emailTracking.tabs.ignored"), count: stats?.ignored }
  ];
  if (loading && !stats) return /* @__PURE__ */ jsx("div", { className: s.loading, children: t("common.loading") });
  return /* @__PURE__ */ jsxs("div", { className: s.page, children: [
    /* @__PURE__ */ jsx("div", { className: s.header, children: /* @__PURE__ */ jsx("h1", { className: s.title, children: t("emailTracking.title") }) }),
    /* @__PURE__ */ jsxs("div", { className: s.statGrid, children: [
      /* @__PURE__ */ jsxs("div", { className: s.statCard, children: [
        /* @__PURE__ */ jsx("div", { className: s.statLabel, children: t("emailTracking.stats.emailsSent") }),
        /* @__PURE__ */ jsx("div", { className: s.statValue, children: stats?.total ?? "\u2014" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: s.statCard, children: [
        /* @__PURE__ */ jsx("div", { className: s.statLabel, children: t("emailTracking.stats.successRate") }),
        /* @__PURE__ */ jsxs("div", { className: s.statValue, children: [
          stats ? `${stats.successRate}` : "\u2014",
          /* @__PURE__ */ jsx("span", { className: s.statUnit, children: "%" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: s.statCard, children: [
        /* @__PURE__ */ jsx("div", { className: s.statLabel, children: t("emailTracking.stats.errors") }),
        /* @__PURE__ */ jsx("div", { className: s.statValue, children: stats?.errors ?? "\u2014" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: s.statCard, children: [
        /* @__PURE__ */ jsx("div", { className: s.statLabel, children: t("emailTracking.stats.avgTime") }),
        /* @__PURE__ */ jsxs("div", { className: s.statValue, children: [
          stats ? stats.avgProcessingTime : "\u2014",
          /* @__PURE__ */ jsx("span", { className: s.statUnit, children: "ms" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: s.filters, children: [
      /* @__PURE__ */ jsx("div", { className: s.tabs, children: tabsList.map((t2) => /* @__PURE__ */ jsxs("button", { className: `${s.tab} ${tab === t2.key ? s.tabActive : ""}`, onClick: () => setTab(t2.key), children: [
        t2.label,
        " ",
        typeof t2.count === "number" && /* @__PURE__ */ jsxs("span", { style: { marginLeft: 4, opacity: 0.6 }, children: [
          "(",
          t2.count,
          ")"
        ] })
      ] }, t2.key)) }),
      /* @__PURE__ */ jsx("div", { className: s.dateRangeGroup, children: [7, 30, 90].map((v) => /* @__PURE__ */ jsxs("button", { className: `${s.dateRangeBtn} ${dateRange === v ? s.dateRangeActive : ""}`, onClick: () => setDateRange(v), children: [
        v,
        "j"
      ] }, v)) }),
      /* @__PURE__ */ jsx("input", { type: "text", className: s.searchInput, placeholder: t("emailTracking.searchPlaceholder"), value: search, onChange: (e) => setSearch(e.target.value) })
    ] }),
    logs.length === 0 ? /* @__PURE__ */ jsx("div", { className: s.empty, children: t("emailTracking.noLogs") }) : /* @__PURE__ */ jsxs("table", { className: s.table, children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { children: t("emailTracking.tableHeaders.date") }),
        /* @__PURE__ */ jsx("th", { children: t("emailTracking.tableHeaders.recipient") }),
        /* @__PURE__ */ jsx("th", { children: t("emailTracking.tableHeaders.subject") }),
        /* @__PURE__ */ jsx("th", { children: t("emailTracking.tableHeaders.ticket") }),
        /* @__PURE__ */ jsx("th", { children: t("emailTracking.tableHeaders.status") }),
        /* @__PURE__ */ jsx("th", { children: t("emailTracking.tableHeaders.action") }),
        /* @__PURE__ */ jsx("th", { style: { textAlign: "right" }, children: t("emailTracking.tableHeaders.time") })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: logs.map((log) => /* @__PURE__ */ jsxs(React.Fragment, { children: [
        /* @__PURE__ */ jsxs("tr", { onClick: () => log.status === "error" && log.errorMessage ? setExpandedRow(expandedRow === log.id ? null : log.id) : null, style: { cursor: log.status === "error" && log.errorMessage ? "pointer" : "default" }, children: [
          /* @__PURE__ */ jsx("td", { style: { fontSize: 12, whiteSpace: "nowrap" }, children: fmtDate(log.createdAt) }),
          /* @__PURE__ */ jsx("td", { style: { maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: log.recipientEmail, children: log.recipientEmail || "\u2014" }),
          /* @__PURE__ */ jsx("td", { style: { maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: log.subject, children: log.subject || "\u2014" }),
          /* @__PURE__ */ jsx("td", { children: log.ticketNumber ? /* @__PURE__ */ jsx("span", { className: s.ticketLink, children: log.ticketNumber }) : "\u2014" }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: s.statusBadge, style: { background: STATUS_CFG[log.status]?.bg, color: STATUS_CFG[log.status]?.color }, children: STATUS_CFG[log.status]?.label || log.status }) }),
          /* @__PURE__ */ jsx("td", { style: { fontSize: 12 }, children: log.action || "\u2014" }),
          /* @__PURE__ */ jsxs("td", { style: { textAlign: "right" }, children: [
            log.processingTimeMs != null ? /* @__PURE__ */ jsxs("span", { className: `${s.processingTime} ${log.processingTimeMs > 2e3 ? s.timeSlow : log.processingTimeMs > 500 ? s.timeMedium : s.timeFast}`, children: [
              log.processingTimeMs,
              "ms"
            ] }) : "\u2014",
            log.status === "error" && log.errorMessage && /* @__PURE__ */ jsx("button", { className: s.expandBtn, onClick: (e) => {
              e.stopPropagation();
              setExpandedRow(expandedRow === log.id ? null : log.id);
            }, children: expandedRow === log.id ? "\u25B4" : "\u25BE" })
          ] })
        ] }),
        expandedRow === log.id && log.errorMessage && /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 7, children: /* @__PURE__ */ jsxs("div", { className: s.errorDetail, children: [
          "Erreur",
          log.httpStatus ? ` (HTTP ${log.httpStatus})` : "",
          ": ",
          log.errorMessage
        ] }) }) })
      ] }, log.id)) })
    ] }),
    totalDocs > 0 && /* @__PURE__ */ jsxs("div", { className: s.pagination, children: [
      /* @__PURE__ */ jsx("button", { className: s.pageBtn, onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page <= 1, children: t("common.previous") }),
      /* @__PURE__ */ jsxs("span", { style: { fontSize: 12, color: "var(--theme-elevation-500)", alignSelf: "center" }, children: [
        t("common.page"),
        " ",
        page,
        " \u2014 ",
        totalDocs,
        " ",
        t("common.results")
      ] }),
      /* @__PURE__ */ jsx("button", { className: s.pageBtn, onClick: () => setPage((p) => p + 1), disabled: !hasMore, children: t("common.next") })
    ] })
  ] });
};

export { EmailTrackingClient };
