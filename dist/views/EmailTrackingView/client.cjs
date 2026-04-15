'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var useTranslation = require('../../components/TicketConversation/hooks/useTranslation');
var s = require('../../styles/EmailTracking.module.scss');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);
var s__default = /*#__PURE__*/_interopDefault(s);

const STATUS_CFG = {
  success: { label: "Succ\xE8s", bg: "#dcfce7", color: "#16a34a" },
  error: { label: "Erreur", bg: "#fef2f2", color: "#dc2626" },
  ignored: { label: "Ignor\xE9", bg: "#f3f4f6", color: "#6b7280" }
};
function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const EmailTrackingClient = () => {
  const { t } = useTranslation.useTranslation();
  const [logs, setLogs] = React.useState([]);
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState("all");
  const [dateRange, setDateRange] = React.useState(7);
  const [search, setSearch] = React.useState("");
  const [expandedRow, setExpandedRow] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [totalDocs, setTotalDocs] = React.useState(0);
  const LIMIT = 30;
  const fetchStats = React.useCallback(async () => {
    try {
      const r = await fetch(`/api/support/email-stats?days=${dateRange}`);
      if (r.ok) setStats(await r.json());
    } catch {
    }
  }, [dateRange]);
  const fetchLogs = React.useCallback(async () => {
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
  React.useEffect(() => {
    setLoading(true);
    setPage(1);
  }, [dateRange, tab, search]);
  React.useEffect(() => {
    fetchStats();
    fetchLogs();
  }, [fetchStats, fetchLogs]);
  const tabsList = [
    { key: "all", label: t("emailTracking.tabs.all"), count: stats?.total },
    { key: "success", label: t("emailTracking.tabs.success"), count: stats?.success },
    { key: "error", label: t("emailTracking.tabs.errors"), count: stats?.errors },
    { key: "ignored", label: t("emailTracking.tabs.ignored"), count: stats?.ignored }
  ];
  if (loading && !stats) return /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.loading, children: t("common.loading") });
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.page, children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.header, children: /* @__PURE__ */ jsxRuntime.jsx("h1", { className: s__default.default.title, children: t("emailTracking.title") }) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.statGrid, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.statCard, children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.statLabel, children: t("emailTracking.stats.emailsSent") }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.statValue, children: stats?.total ?? "\u2014" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.statCard, children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.statLabel, children: t("emailTracking.stats.successRate") }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.statValue, children: [
          stats ? `${stats.successRate}` : "\u2014",
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.statUnit, children: "%" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.statCard, children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.statLabel, children: t("emailTracking.stats.errors") }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.statValue, children: stats?.errors ?? "\u2014" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.statCard, children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.statLabel, children: t("emailTracking.stats.avgTime") }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.statValue, children: [
          stats ? stats.avgProcessingTime : "\u2014",
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.statUnit, children: "ms" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.filters, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.tabs, children: tabsList.map((t2) => /* @__PURE__ */ jsxRuntime.jsxs("button", { className: `${s__default.default.tab} ${tab === t2.key ? s__default.default.tabActive : ""}`, onClick: () => setTab(t2.key), children: [
        t2.label,
        " ",
        typeof t2.count === "number" && /* @__PURE__ */ jsxRuntime.jsxs("span", { style: { marginLeft: 4, opacity: 0.6 }, children: [
          "(",
          t2.count,
          ")"
        ] })
      ] }, t2.key)) }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.dateRangeGroup, children: [7, 30, 90].map((v) => /* @__PURE__ */ jsxRuntime.jsxs("button", { className: `${s__default.default.dateRangeBtn} ${dateRange === v ? s__default.default.dateRangeActive : ""}`, onClick: () => setDateRange(v), children: [
        v,
        "j"
      ] }, v)) }),
      /* @__PURE__ */ jsxRuntime.jsx("input", { type: "text", className: s__default.default.searchInput, placeholder: t("emailTracking.searchPlaceholder"), value: search, onChange: (e) => setSearch(e.target.value) })
    ] }),
    logs.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.empty, children: t("emailTracking.noLogs") }) : /* @__PURE__ */ jsxRuntime.jsxs("table", { className: s__default.default.table, children: [
      /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("emailTracking.tableHeaders.date") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("emailTracking.tableHeaders.recipient") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("emailTracking.tableHeaders.subject") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("emailTracking.tableHeaders.ticket") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("emailTracking.tableHeaders.status") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("emailTracking.tableHeaders.action") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { style: { textAlign: "right" }, children: t("emailTracking.tableHeaders.time") })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: logs.map((log) => /* @__PURE__ */ jsxRuntime.jsxs(React__default.default.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsxs("tr", { onClick: () => log.status === "error" && log.errorMessage ? setExpandedRow(expandedRow === log.id ? null : log.id) : null, style: { cursor: log.status === "error" && log.errorMessage ? "pointer" : "default" }, children: [
          /* @__PURE__ */ jsxRuntime.jsx("td", { style: { fontSize: 12, whiteSpace: "nowrap" }, children: fmtDate(log.createdAt) }),
          /* @__PURE__ */ jsxRuntime.jsx("td", { style: { maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: log.recipientEmail, children: log.recipientEmail || "\u2014" }),
          /* @__PURE__ */ jsxRuntime.jsx("td", { style: { maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: log.subject, children: log.subject || "\u2014" }),
          /* @__PURE__ */ jsxRuntime.jsx("td", { children: log.ticketNumber ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.ticketLink, children: log.ticketNumber }) : "\u2014" }),
          /* @__PURE__ */ jsxRuntime.jsx("td", { children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.statusBadge, style: { background: STATUS_CFG[log.status]?.bg, color: STATUS_CFG[log.status]?.color }, children: STATUS_CFG[log.status]?.label || log.status }) }),
          /* @__PURE__ */ jsxRuntime.jsx("td", { style: { fontSize: 12 }, children: log.action || "\u2014" }),
          /* @__PURE__ */ jsxRuntime.jsxs("td", { style: { textAlign: "right" }, children: [
            log.processingTimeMs != null ? /* @__PURE__ */ jsxRuntime.jsxs("span", { className: `${s__default.default.processingTime} ${log.processingTimeMs > 2e3 ? s__default.default.timeSlow : log.processingTimeMs > 500 ? s__default.default.timeMedium : s__default.default.timeFast}`, children: [
              log.processingTimeMs,
              "ms"
            ] }) : "\u2014",
            log.status === "error" && log.errorMessage && /* @__PURE__ */ jsxRuntime.jsx("button", { className: s__default.default.expandBtn, onClick: (e) => {
              e.stopPropagation();
              setExpandedRow(expandedRow === log.id ? null : log.id);
            }, children: expandedRow === log.id ? "\u25B4" : "\u25BE" })
          ] })
        ] }),
        expandedRow === log.id && log.errorMessage && /* @__PURE__ */ jsxRuntime.jsx("tr", { children: /* @__PURE__ */ jsxRuntime.jsx("td", { colSpan: 7, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.errorDetail, children: [
          "Erreur",
          log.httpStatus ? ` (HTTP ${log.httpStatus})` : "",
          ": ",
          log.errorMessage
        ] }) }) })
      ] }, log.id)) })
    ] }),
    totalDocs > 0 && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.pagination, children: [
      /* @__PURE__ */ jsxRuntime.jsx("button", { className: s__default.default.pageBtn, onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page <= 1, children: t("common.previous") }),
      /* @__PURE__ */ jsxRuntime.jsxs("span", { style: { fontSize: 12, color: "var(--theme-elevation-500)", alignSelf: "center" }, children: [
        t("common.page"),
        " ",
        page,
        " \u2014 ",
        totalDocs,
        " ",
        t("common.results")
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { className: s__default.default.pageBtn, onClick: () => setPage((p) => p + 1), disabled: !hasMore, children: t("common.next") })
    ] })
  ] });
};

exports.EmailTrackingClient = EmailTrackingClient;
