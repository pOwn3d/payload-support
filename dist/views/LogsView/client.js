"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import s from '../../styles/Logs.module.scss';

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const LogsClient = () => {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [logType, setLogType] = useState(() => {
    const t2 = searchParams.get("type");
    return t2 === "auth" ? "auth" : "email";
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalDocs, setTotalDocs] = useState(0);
  const [purgeResult, setPurgeResult] = useState(null);
  const collection = logType === "email" ? "email-logs" : "auth-logs";
  const fetchLogs = useCallback(async () => {
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
  useEffect(() => {
    setLoading(true);
    setPage(1);
  }, [logType]);
  useEffect(() => {
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
  return /* @__PURE__ */ jsxs("div", { className: s.page, children: [
    /* @__PURE__ */ jsxs("div", { className: s.header, children: [
      /* @__PURE__ */ jsx("h1", { className: s.title, children: logType === "email" ? t("logs.title") : t("logs.titleAuth") }),
      /* @__PURE__ */ jsxs("div", { className: s.headerActions, children: [
        /* @__PURE__ */ jsx("button", { className: s.purgeBtn, onClick: () => handlePurge(7), children: t("logs.purge7") }),
        /* @__PURE__ */ jsx("button", { className: s.purgeBtn, onClick: () => handlePurge(30), children: t("logs.purge30") }),
        /* @__PURE__ */ jsx("button", { className: s.purgeBtn, onClick: () => handlePurge(90), children: "Purger +90j" }),
        /* @__PURE__ */ jsx("button", { className: `${s.purgeBtn} ${s.purgeBtnDanger}`, onClick: () => handlePurge(0), children: t("logs.purgeAll") })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: s.tabs, children: [
      /* @__PURE__ */ jsxs("button", { className: `${s.tab} ${logType === "email" ? s.tabActive : ""}`, onClick: () => setLogType("email"), children: [
        t("logs.tabs.email"),
        " (",
        logType === "email" ? totalDocs : "...",
        ")"
      ] }),
      /* @__PURE__ */ jsxs("button", { className: `${s.tab} ${logType === "auth" ? s.tabActive : ""}`, onClick: () => setLogType("auth"), children: [
        t("logs.tabs.auth"),
        " (",
        logType === "auth" ? totalDocs : "...",
        ")"
      ] })
    ] }),
    purgeResult && /* @__PURE__ */ jsx("div", { className: s.purgeResult, children: purgeResult }),
    loading ? /* @__PURE__ */ jsx("div", { className: s.loading, children: t("common.loading") }) : logs.length === 0 ? /* @__PURE__ */ jsx("div", { className: s.empty, children: t("logs.noLogs") }) : logType === "email" ? /* @__PURE__ */ jsxs("table", { className: s.table, children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { children: t("logs.tableHeaders.date") }),
        /* @__PURE__ */ jsx("th", { children: t("logs.tableHeaders.status") }),
        /* @__PURE__ */ jsx("th", { children: t("logs.tableHeaders.recipient") }),
        /* @__PURE__ */ jsx("th", { children: t("logs.tableHeaders.subject") }),
        /* @__PURE__ */ jsx("th", { children: t("logs.tableHeaders.action") }),
        /* @__PURE__ */ jsx("th", { style: { textAlign: "right" }, children: t("logs.tableHeaders.time") })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: logs.map((log) => /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("td", { className: s.mono, children: fmtDate(log.createdAt) }),
        /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: s.badge, style: {
          background: log.status === "success" ? "#dcfce7" : log.status === "error" ? "#fef2f2" : "#f3f4f6",
          color: log.status === "success" ? "#16a34a" : log.status === "error" ? "#dc2626" : "#6b7280"
        }, children: log.status === "success" ? t("logs.statusSuccess") : log.status === "error" ? t("logs.statusError") : t("logs.statusIgnored") }) }),
        /* @__PURE__ */ jsx("td", { className: s.truncate, title: log.recipientEmail, children: log.recipientEmail || "\u2014" }),
        /* @__PURE__ */ jsx("td", { className: s.truncate, title: log.subject, children: log.subject || "\u2014" }),
        /* @__PURE__ */ jsx("td", { style: { fontSize: 12, color: "var(--theme-elevation-500)" }, children: log.action || "\u2014" }),
        /* @__PURE__ */ jsx("td", { style: { textAlign: "right" }, children: log.processingTimeMs != null ? /* @__PURE__ */ jsxs("span", { className: s.mono, style: { color: log.processingTimeMs > 2e3 ? "#dc2626" : log.processingTimeMs > 500 ? "#d97706" : "#16a34a" }, children: [
          log.processingTimeMs,
          "ms"
        ] }) : "\u2014" })
      ] }, log.id)) })
    ] }) : /* @__PURE__ */ jsxs("table", { className: s.table, children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { children: t("logs.tableHeaders.date") }),
        /* @__PURE__ */ jsx("th", { children: t("logs.tableHeaders.status") }),
        /* @__PURE__ */ jsx("th", { children: t("logs.tableHeaders.email") }),
        /* @__PURE__ */ jsx("th", { children: t("logs.tableHeaders.ip") }),
        /* @__PURE__ */ jsx("th", { children: t("logs.tableHeaders.userAgent") })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: logs.map((log) => /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("td", { className: s.mono, children: fmtDate(log.createdAt) }),
        /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: s.badge, style: {
          background: log.success ? "#dcfce7" : "#fef2f2",
          color: log.success ? "#16a34a" : "#dc2626"
        }, children: log.success ? t("logs.statusSuccess") : t("logs.statusFailed") }) }),
        /* @__PURE__ */ jsx("td", { className: s.mono, children: log.email || "\u2014" }),
        /* @__PURE__ */ jsx("td", { className: s.mono, children: log.ip || "\u2014" }),
        /* @__PURE__ */ jsx("td", { className: s.truncate, style: { fontSize: 11 }, children: log.userAgent || "\u2014" })
      ] }, log.id)) })
    ] }),
    totalDocs > 0 && /* @__PURE__ */ jsxs("div", { className: s.pagination, children: [
      /* @__PURE__ */ jsx("button", { className: s.pageBtn, onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page <= 1, children: t("common.previous") }),
      /* @__PURE__ */ jsxs("span", { className: s.pageInfo, children: [
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

export { LogsClient };
