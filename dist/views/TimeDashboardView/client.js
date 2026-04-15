"use client";
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import React, { useState, useCallback, useEffect } from 'react';
import { SkeletonDashboard } from '../shared/Skeleton.js';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import styles from '../../styles/TimeDashboard.module.scss';

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}
function getWeekNumber(d) {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 864e5 + oneJan.getDay() + 1) / 7);
}
function getMonthRange(offset) {
  const now = /* @__PURE__ */ new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: start.toISOString().split("T")[0], to: end.toISOString().split("T")[0] };
}
const MONTHS_FR = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
const TimeDashboardClient = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => getMonthRange(0).from);
  const [to, setTo] = useState(() => getMonthRange(0).to);
  const [groupBy, setGroupBy] = useState("day");
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "500",
        depth: "2",
        sort: "-date"
      });
      if (from) params.set("where[date][greater_than_equal]", from);
      if (to) params.set("where[date][less_than_equal]", to);
      const res = await fetch(`/api/time-entries?${params}`);
      if (res.ok) {
        const json = await res.json();
        setEntries(json.docs || []);
      }
    } catch {
    }
    setLoading(false);
  }, [from, to]);
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);
  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const totalEntries = entries.length;
  const grouped = React.useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      let key;
      if (groupBy === "day") {
        key = entry.date ? entry.date.split("T")[0] : "Sans date";
      } else if (groupBy === "week") {
        const d = new Date(entry.date);
        key = `Semaine ${getWeekNumber(d)} (${MONTHS_FR[d.getMonth()]} ${d.getFullYear()})`;
      } else {
        const ticket = typeof entry.ticket === "object" ? entry.ticket : null;
        const project = ticket && typeof ticket.project === "object" ? ticket.project : null;
        key = project?.name || "Sans projet";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }
    return Array.from(map.entries()).map(([label, items]) => ({
      label,
      entries: items,
      totalMinutes: items.reduce((sum, e) => sum + (e.duration || 0), 0)
    }));
  }, [entries, groupBy]);
  const dailyChart = React.useMemo(() => {
    const dayMap = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const day = entry.date ? entry.date.split("T")[0] : null;
      if (day) {
        dayMap.set(day, (dayMap.get(day) || 0) + (entry.duration || 0));
      }
    }
    return Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([day, mins]) => ({ day, minutes: mins }));
  }, [entries]);
  const maxDailyMinutes = Math.max(...dailyChart.map((d) => d.minutes), 1);
  const setPeriod = (range) => {
    setFrom(range.from);
    setTo(range.to);
  };
  return /* @__PURE__ */ jsxs("div", { className: styles.page, children: [
    /* @__PURE__ */ jsxs("div", { className: styles.header, children: [
      /* @__PURE__ */ jsxs("div", { className: styles.headerLeft, children: [
        /* @__PURE__ */ jsx("h1", { className: styles.title, children: t("timeDashboard.title") }),
        /* @__PURE__ */ jsx("p", { className: styles.subtitle, children: t("timeDashboard.subtitle") })
      ] }),
      /* @__PURE__ */ jsx("a", { href: "/admin/collections/time-entries/create", className: styles.newEntryBtn, children: t("timeDashboard.newEntry") })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: styles.filters, children: [
      /* @__PURE__ */ jsxs("div", { className: styles.quickPeriod, children: [
        /* @__PURE__ */ jsx("button", { className: styles.btnPrimary, onClick: () => setPeriod(getMonthRange(0)), children: t("timeDashboard.filters.thisMonth") }),
        /* @__PURE__ */ jsx("button", { className: styles.btnSecondary, onClick: () => setPeriod(getMonthRange(-1)), children: t("timeDashboard.filters.lastMonth") }),
        /* @__PURE__ */ jsx("button", { className: styles.btnAmber, onClick: () => setPeriod(getMonthRange(-2)), children: t("timeDashboard.filters.twoMonthsAgo") })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: styles.filterRow, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.fieldGroup, children: [
          /* @__PURE__ */ jsx("label", { className: styles.label, children: t("timeDashboard.filters.from") }),
          /* @__PURE__ */ jsx("input", { type: "date", value: from, onChange: (e) => setFrom(e.target.value), className: styles.input })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.fieldGroup, children: [
          /* @__PURE__ */ jsx("label", { className: styles.label, children: t("timeDashboard.filters.to") }),
          /* @__PURE__ */ jsx("input", { type: "date", value: to, onChange: (e) => setTo(e.target.value), className: styles.input })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.fieldGroup, children: [
          /* @__PURE__ */ jsx("label", { className: styles.label, children: t("timeDashboard.filters.groupBy") }),
          /* @__PURE__ */ jsxs("select", { value: groupBy, onChange: (e) => setGroupBy(e.target.value), className: styles.select, children: [
            /* @__PURE__ */ jsx("option", { value: "day", children: t("timeDashboard.filters.day") }),
            /* @__PURE__ */ jsx("option", { value: "week", children: t("timeDashboard.filters.week") }),
            /* @__PURE__ */ jsx("option", { value: "project", children: t("timeDashboard.filters.project") })
          ] })
        ] })
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: styles.loading, children: /* @__PURE__ */ jsx(SkeletonDashboard, {}) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: styles.kpis, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.kpiCardPrimary, children: [
          /* @__PURE__ */ jsx("div", { className: styles.kpiLabel, children: t("timeDashboard.kpis.totalTime") }),
          /* @__PURE__ */ jsx("div", { className: styles.kpiPrimary, children: formatDuration(totalMinutes) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.kpiCardAmber, children: [
          /* @__PURE__ */ jsx("div", { className: styles.kpiLabel, children: t("timeDashboard.kpis.entries") }),
          /* @__PURE__ */ jsx("div", { className: styles.kpiAmber, children: totalEntries })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.kpiCardOrange, children: [
          /* @__PURE__ */ jsx("div", { className: styles.kpiLabel, children: t("timeDashboard.kpis.dailyAverage") }),
          /* @__PURE__ */ jsx("div", { className: styles.kpiOrange, children: dailyChart.length > 0 ? formatDuration(Math.round(totalMinutes / dailyChart.length)) : "-" })
        ] })
      ] }),
      dailyChart.length > 0 && /* @__PURE__ */ jsxs("div", { className: styles.chartWrap, children: [
        /* @__PURE__ */ jsx("div", { className: styles.chartHeader, children: t("timeDashboard.chart.title") }),
        /* @__PURE__ */ jsx("div", { className: styles.chartBars, children: dailyChart.map((d) => /* @__PURE__ */ jsx(
          "div",
          {
            className: styles.chartBar,
            style: { height: `${Math.max(d.minutes / maxDailyMinutes * 100, 4)}%` },
            title: `${d.day}: ${formatDuration(d.minutes)}`
          },
          d.day
        )) })
      ] }),
      grouped.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.empty, children: t("timeDashboard.empty") }) : grouped.map((group) => /* @__PURE__ */ jsxs("div", { className: styles.groupCard, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.groupHeader, children: [
          /* @__PURE__ */ jsx("span", { className: styles.groupLabel, children: group.label }),
          /* @__PURE__ */ jsx("span", { className: styles.groupTotal, children: formatDuration(group.totalMinutes) })
        ] }),
        /* @__PURE__ */ jsx("table", { className: styles.table, children: /* @__PURE__ */ jsx("tbody", { children: group.entries.map((entry) => {
          const ticket = typeof entry.ticket === "object" ? entry.ticket : null;
          return /* @__PURE__ */ jsxs("tr", { className: styles.entryRow, children: [
            /* @__PURE__ */ jsx("td", { className: styles.tdTicket, children: ticket ? /* @__PURE__ */ jsx("a", { href: `/admin/collections/tickets/${ticket.id}`, className: styles.ticketLink, children: ticket.ticketNumber || `#${ticket.id}` }) : "-" }),
            /* @__PURE__ */ jsx("td", { className: styles.tdSubject, children: ticket?.subject || "" }),
            /* @__PURE__ */ jsx("td", { className: styles.tdDescription, children: entry.description || "-" }),
            /* @__PURE__ */ jsx("td", { className: styles.tdDuration, children: formatDuration(entry.duration) })
          ] }, entry.id);
        }) }) })
      ] }, group.label))
    ] })
  ] });
};

export { TimeDashboardClient };
