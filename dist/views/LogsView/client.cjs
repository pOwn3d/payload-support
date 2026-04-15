'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');
var navigation = require('next/navigation');
var useTranslation = require('../../components/TicketConversation/hooks/useTranslation');
var s = require('../../styles/Logs.module.scss');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var s__default = /*#__PURE__*/_interopDefault(s);

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const LogsClient = () => {
  const { t } = useTranslation.useTranslation();
  const searchParams = navigation.useSearchParams();
  const [logType, setLogType] = react.useState(() => {
    const t2 = searchParams.get("type");
    return t2 === "auth" ? "auth" : "email";
  });
  const [logs, setLogs] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const [page, setPage] = react.useState(1);
  const [hasMore, setHasMore] = react.useState(false);
  const [totalDocs, setTotalDocs] = react.useState(0);
  const [purgeResult, setPurgeResult] = react.useState(null);
  const collection = logType === "email" ? "email-logs" : "auth-logs";
  const fetchLogs = react.useCallback(async () => {
    try {
      const res = await fetch(`/api/${collection}?sort=-createdAt&limit=30&page=${page}&depth=0`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setLogs(d.docs || []);
        setHasMore(d.hasNextPage);
        setTotalDocs(d.totalDocs);
      }
    } catch {
    }
    setLoading(false);
  }, [collection, page]);
  react.useEffect(() => {
    setLoading(true);
    setPage(1);
  }, [logType]);
  react.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);
  const handlePurge = async (days) => {
    const label = days === 0 ? t("logs.purgeAllLabel") : t("logs.purgeDaysLabel", { days: String(days) });
    if (!window.confirm(t("logs.purgeConfirm", { label, collection }))) return;
    try {
      const res = await fetch(`/api/support/purge-logs?collection=${collection}&days=${days}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setPurgeResult(t("logs.purgeResult", { count: String(d.purged) }));
        setTimeout(() => setPurgeResult(null), 5e3);
        fetchLogs();
      }
    } catch {
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.page, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.header, children: [
      /* @__PURE__ */ jsxRuntime.jsx("h1", { className: s__default.default.title, children: logType === "email" ? t("logs.title") : t("logs.titleAuth") }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.headerActions, children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: s__default.default.purgeBtn, onClick: () => handlePurge(7), children: t("logs.purge7") }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: s__default.default.purgeBtn, onClick: () => handlePurge(30), children: t("logs.purge30") }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: s__default.default.purgeBtn, onClick: () => handlePurge(90), children: "Purger +90j" }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: `${s__default.default.purgeBtn} ${s__default.default.purgeBtnDanger}`, onClick: () => handlePurge(0), children: t("logs.purgeAll") })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.tabs, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("button", { className: `${s__default.default.tab} ${logType === "email" ? s__default.default.tabActive : ""}`, onClick: () => setLogType("email"), children: [
        t("logs.tabs.email"),
        " (",
        logType === "email" ? totalDocs : "...",
        ")"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("button", { className: `${s__default.default.tab} ${logType === "auth" ? s__default.default.tabActive : ""}`, onClick: () => setLogType("auth"), children: [
        t("logs.tabs.auth"),
        " (",
        logType === "auth" ? totalDocs : "...",
        ")"
      ] })
    ] }),
    purgeResult && /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.purgeResult, children: purgeResult }),
    loading ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.loading, children: t("common.loading") }) : logs.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: s__default.default.empty, children: t("logs.noLogs") }) : logType === "email" ? /* @__PURE__ */ jsxRuntime.jsxs("table", { className: s__default.default.table, children: [
      /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("logs.tableHeaders.date") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("logs.tableHeaders.status") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("logs.tableHeaders.recipient") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("logs.tableHeaders.subject") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("logs.tableHeaders.action") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { style: { textAlign: "right" }, children: t("logs.tableHeaders.time") })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: logs.map((log) => /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("td", { className: s__default.default.mono, children: fmtDate(log.createdAt) }),
        /* @__PURE__ */ jsxRuntime.jsx("td", { children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.badge, style: {
          background: log.status === "success" ? "#dcfce7" : log.status === "error" ? "#fef2f2" : "#f3f4f6",
          color: log.status === "success" ? "#16a34a" : log.status === "error" ? "#dc2626" : "#6b7280"
        }, children: log.status === "success" ? t("logs.statusSuccess") : log.status === "error" ? t("logs.statusError") : t("logs.statusIgnored") }) }),
        /* @__PURE__ */ jsxRuntime.jsx("td", { className: s__default.default.truncate, title: log.recipientEmail, children: log.recipientEmail || "\u2014" }),
        /* @__PURE__ */ jsxRuntime.jsx("td", { className: s__default.default.truncate, title: log.subject, children: log.subject || "\u2014" }),
        /* @__PURE__ */ jsxRuntime.jsx("td", { style: { fontSize: 12, color: "var(--theme-elevation-500)" }, children: log.action || "\u2014" }),
        /* @__PURE__ */ jsxRuntime.jsx("td", { style: { textAlign: "right" }, children: log.processingTimeMs != null ? /* @__PURE__ */ jsxRuntime.jsxs("span", { className: s__default.default.mono, style: { color: log.processingTimeMs > 2e3 ? "#dc2626" : log.processingTimeMs > 500 ? "#d97706" : "#16a34a" }, children: [
          log.processingTimeMs,
          "ms"
        ] }) : "\u2014" })
      ] }, log.id)) })
    ] }) : /* @__PURE__ */ jsxRuntime.jsxs("table", { className: s__default.default.table, children: [
      /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("logs.tableHeaders.date") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("logs.tableHeaders.status") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("logs.tableHeaders.email") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("logs.tableHeaders.ip") }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("logs.tableHeaders.userAgent") })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: logs.map((log) => /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("td", { className: s__default.default.mono, children: fmtDate(log.createdAt) }),
        /* @__PURE__ */ jsxRuntime.jsx("td", { children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: s__default.default.badge, style: {
          background: log.success ? "#dcfce7" : "#fef2f2",
          color: log.success ? "#16a34a" : "#dc2626"
        }, children: log.success ? t("logs.statusSuccess") : t("logs.statusFailed") }) }),
        /* @__PURE__ */ jsxRuntime.jsx("td", { className: s__default.default.mono, children: log.email || "\u2014" }),
        /* @__PURE__ */ jsxRuntime.jsx("td", { className: s__default.default.mono, children: log.ip || "\u2014" }),
        /* @__PURE__ */ jsxRuntime.jsx("td", { className: s__default.default.truncate, style: { fontSize: 11 }, children: log.userAgent || "\u2014" })
      ] }, log.id)) })
    ] }),
    totalDocs > 0 && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: s__default.default.pagination, children: [
      /* @__PURE__ */ jsxRuntime.jsx("button", { className: s__default.default.pageBtn, onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page <= 1, children: t("common.previous") }),
      /* @__PURE__ */ jsxRuntime.jsxs("span", { className: s__default.default.pageInfo, children: [
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

exports.LogsClient = LogsClient;
