'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var Skeleton = require('../shared/Skeleton');
var useTranslation = require('../../components/TicketConversation/hooks/useTranslation');
var styles = require('../../styles/TimeDashboard.module.scss');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);
var styles__default = /*#__PURE__*/_interopDefault(styles);

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
  const { t } = useTranslation.useTranslation();
  const [entries, setEntries] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [from, setFrom] = React.useState(() => getMonthRange(0).from);
  const [to, setTo] = React.useState(() => getMonthRange(0).to);
  const [groupBy, setGroupBy] = React.useState("day");
  const fetchEntries = React.useCallback(async () => {
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
  React.useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);
  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const totalEntries = entries.length;
  const grouped = React__default.default.useMemo(() => {
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
  const dailyChart = React__default.default.useMemo(() => {
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
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.page, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.header, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.headerLeft, children: [
        /* @__PURE__ */ jsxRuntime.jsx("h1", { className: styles__default.default.title, children: t("timeDashboard.title") }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { className: styles__default.default.subtitle, children: t("timeDashboard.subtitle") })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("a", { href: "/admin/collections/time-entries/create", className: styles__default.default.newEntryBtn, children: t("timeDashboard.newEntry") })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.filters, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.quickPeriod, children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: styles__default.default.btnPrimary, onClick: () => setPeriod(getMonthRange(0)), children: t("timeDashboard.filters.thisMonth") }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: styles__default.default.btnSecondary, onClick: () => setPeriod(getMonthRange(-1)), children: t("timeDashboard.filters.lastMonth") }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: styles__default.default.btnAmber, onClick: () => setPeriod(getMonthRange(-2)), children: t("timeDashboard.filters.twoMonthsAgo") })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.filterRow, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.fieldGroup, children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: styles__default.default.label, children: t("timeDashboard.filters.from") }),
          /* @__PURE__ */ jsxRuntime.jsx("input", { type: "date", value: from, onChange: (e) => setFrom(e.target.value), className: styles__default.default.input })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.fieldGroup, children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: styles__default.default.label, children: t("timeDashboard.filters.to") }),
          /* @__PURE__ */ jsxRuntime.jsx("input", { type: "date", value: to, onChange: (e) => setTo(e.target.value), className: styles__default.default.input })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.fieldGroup, children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: styles__default.default.label, children: t("timeDashboard.filters.groupBy") }),
          /* @__PURE__ */ jsxRuntime.jsxs("select", { value: groupBy, onChange: (e) => setGroupBy(e.target.value), className: styles__default.default.select, children: [
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "day", children: t("timeDashboard.filters.day") }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "week", children: t("timeDashboard.filters.week") }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "project", children: t("timeDashboard.filters.project") })
          ] })
        ] })
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.loading, children: /* @__PURE__ */ jsxRuntime.jsx(Skeleton.SkeletonDashboard, {}) }) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.kpis, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.kpiCardPrimary, children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.kpiLabel, children: t("timeDashboard.kpis.totalTime") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.kpiPrimary, children: formatDuration(totalMinutes) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.kpiCardAmber, children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.kpiLabel, children: t("timeDashboard.kpis.entries") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.kpiAmber, children: totalEntries })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.kpiCardOrange, children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.kpiLabel, children: t("timeDashboard.kpis.dailyAverage") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.kpiOrange, children: dailyChart.length > 0 ? formatDuration(Math.round(totalMinutes / dailyChart.length)) : "-" })
        ] })
      ] }),
      dailyChart.length > 0 && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.chartWrap, children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.chartHeader, children: t("timeDashboard.chart.title") }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.chartBars, children: dailyChart.map((d) => /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: styles__default.default.chartBar,
            style: { height: `${Math.max(d.minutes / maxDailyMinutes * 100, 4)}%` },
            title: `${d.day}: ${formatDuration(d.minutes)}`
          },
          d.day
        )) })
      ] }),
      grouped.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.empty, children: t("timeDashboard.empty") }) : grouped.map((group) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.groupCard, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.groupHeader, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.groupLabel, children: group.label }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.groupTotal, children: formatDuration(group.totalMinutes) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("table", { className: styles__default.default.table, children: /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: group.entries.map((entry) => {
          const ticket = typeof entry.ticket === "object" ? entry.ticket : null;
          return /* @__PURE__ */ jsxRuntime.jsxs("tr", { className: styles__default.default.entryRow, children: [
            /* @__PURE__ */ jsxRuntime.jsx("td", { className: styles__default.default.tdTicket, children: ticket ? /* @__PURE__ */ jsxRuntime.jsx("a", { href: `/admin/collections/tickets/${ticket.id}`, className: styles__default.default.ticketLink, children: ticket.ticketNumber || `#${ticket.id}` }) : "-" }),
            /* @__PURE__ */ jsxRuntime.jsx("td", { className: styles__default.default.tdSubject, children: ticket?.subject || "" }),
            /* @__PURE__ */ jsxRuntime.jsx("td", { className: styles__default.default.tdDescription, children: entry.description || "-" }),
            /* @__PURE__ */ jsxRuntime.jsx("td", { className: styles__default.default.tdDuration, children: formatDuration(entry.duration) })
          ] }, entry.id);
        }) }) })
      ] }, group.label))
    ] })
  ] });
};

exports.TimeDashboardClient = TimeDashboardClient;
