'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');
var Link = require('next/link');
var useTranslation = require('../../components/TicketConversation/hooks/useTranslation');
var styles = require('../../styles/SupportDashboard.module.scss');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var Link__default = /*#__PURE__*/_interopDefault(Link);
var styles__default = /*#__PURE__*/_interopDefault(styles);

function formatResponseTime(hours) {
  if (hours == null) return "--";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}m`;
}
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 6e4);
  if (mins < 1) return "a l'instant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return `${Math.floor(days / 7)}sem`;
}
function computeTrend(current, previous) {
  if (previous === 0 && current === 0) return { pct: 0, dir: "neutral" };
  if (previous === 0) return { pct: 100, dir: "up" };
  const pct = Math.round((current - previous) / previous * 100);
  if (pct === 0) return { pct: 0, dir: "neutral" };
  return { pct: Math.abs(pct), dir: pct > 0 ? "up" : "down" };
}
function StatCard({ label, value, trend, accentColor, onClick }) {
  const style = accentColor ? { "--stat-accent": accentColor } : void 0;
  const Tag = onClick ? "button" : "div";
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Tag,
    {
      className: styles__default.default.statCard,
      style,
      onClick,
      type: onClick ? "button" : void 0,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.statLabel, children: label }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.statValueRow, children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.statValue, children: value }) }),
        trend && trend.dir !== "neutral" && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `${styles__default.default.statTrend} ${styles__default.default[trend.dir]}`, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.trendArrow, children: trend.dir === "up" ? "\u2191" : "\u2193" }),
          trend.pct,
          "%"
        ] }),
        trend && trend.dir === "neutral" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${styles__default.default.statTrend} ${styles__default.default.neutral}`, children: "\u2014 stable" })
      ]
    }
  );
}
function VolumeChart({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.volumeChart, children: data.map((d, i) => /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        className: styles__default.default.volumeBar,
        style: { height: `${Math.max(d.value / max * 100, 5)}%` },
        title: `${d.label}: ${d.value}`
      },
      i
    )) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.volumeLabels, children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { children: data[0]?.label }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { children: data[data.length - 1]?.label })
    ] })
  ] });
}
function CSATRing({ score, count }) {
  const pct = score > 0 ? score / 5 * 100 : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - pct / 100 * circumference;
  const color = score >= 4 ? "#22c55e" : score >= 3 ? "#f59e0b" : score > 0 ? "#ef4444" : "#94a3b8";
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.csatContainer, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.csatRing, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("svg", { width: "100", height: "100", viewBox: "0 0 100 100", children: [
        /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "50", cy: "50", r: radius, fill: "none", stroke: "var(--theme-elevation-150, #e2e8f0)", strokeWidth: "6" }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "circle",
          {
            cx: "50",
            cy: "50",
            r: radius,
            fill: "none",
            stroke: color,
            strokeWidth: "6",
            strokeLinecap: "round",
            strokeDasharray: circumference,
            strokeDashoffset,
            transform: "rotate(-90 50 50)",
            style: { transition: "stroke-dashoffset 600ms ease" }
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.csatValue, children: score > 0 ? score.toFixed(1) : "--" })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.csatMeta, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.csatLabel, children: score > 0 ? `${score.toFixed(1)} / 5` : "Pas de donn\xE9es" }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.csatSub, children: count > 0 ? `${count} avis recueillis` : "Aucun avis" })
    ] })
  ] });
}
function formatSlaTime(minutes) {
  const absMin = Math.abs(minutes);
  if (absMin < 60) return `${Math.round(absMin)}min`;
  const h = Math.floor(absMin / 60);
  const m = Math.round(absMin % 60);
  if (h < 24) return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
  const d = Math.floor(h / 24);
  const remainH = h % 24;
  return remainH > 0 ? `${d}j ${remainH}h` : `${d}j`;
}
function SlaSection() {
  const [sla, setSla] = react.useState(null);
  const [slaLoading, setSlaLoading] = react.useState(true);
  react.useEffect(() => {
    const fetchSla = async () => {
      try {
        const res = await fetch("/api/support/sla-check");
        if (res.ok) {
          setSla(await res.json());
        }
      } catch {
      }
      setSlaLoading(false);
    };
    fetchSla();
    const interval = setInterval(fetchSla, 6e4);
    return () => clearInterval(interval);
  }, []);
  if (slaLoading) {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.slaSection, children: [
      /* @__PURE__ */ jsxRuntime.jsx("h2", { className: styles__default.default.slaSectionTitle, children: "SLA" }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.slaLoading, children: "Chargement..." })
    ] });
  }
  if (!sla) return null;
  const navigateToTicket = (id) => {
    window.location.href = `/admin/support/ticket?id=${id}`;
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.slaSection, children: [
    /* @__PURE__ */ jsxRuntime.jsx("h2", { className: styles__default.default.slaSectionTitle, children: "SLA" }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.slaGrid, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `${styles__default.default.slaCard} ${styles__default.default.slaBreach}`, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.slaCardHeader, children: [
          /* @__PURE__ */ jsxRuntime.jsxs("h3", { className: `${styles__default.default.slaCardTitle} ${styles__default.default.slaCardTitleBreach}`, children: [
            /* @__PURE__ */ jsxRuntime.jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
              /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
              /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
              /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
            ] }),
            "En breach"
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: `${styles__default.default.slaCount} ${styles__default.default.slaCountBreach}`, children: sla.breached.length })
        ] }),
        sla.breached.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.slaEmpty, children: "Aucun ticket en breach" }) : /* @__PURE__ */ jsxRuntime.jsx("ul", { className: styles__default.default.slaList, children: sla.breached.map((ticket) => {
          const now = /* @__PURE__ */ new Date();
          const created = new Date(ticket.createdAt);
          const overdueMin = Math.round((now.getTime() - created.getTime()) / 6e4);
          return /* @__PURE__ */ jsxRuntime.jsxs(
            "li",
            {
              className: styles__default.default.slaItem,
              onClick: () => navigateToTicket(ticket.id),
              children: [
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.slaItemLeft, children: [
                  /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.slaItemNum, children: [
                    "#",
                    ticket.ticketNumber
                  ] }),
                  /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.slaItemSubject, children: ticket.subject })
                ] }),
                /* @__PURE__ */ jsxRuntime.jsxs("span", { className: `${styles__default.default.slaItemTime} ${styles__default.default.slaTimeBreach}`, children: [
                  "+",
                  formatSlaTime(overdueMin)
                ] })
              ]
            },
            ticket.id
          );
        }) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `${styles__default.default.slaCard} ${styles__default.default.slaRisk}`, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.slaCardHeader, children: [
          /* @__PURE__ */ jsxRuntime.jsxs("h3", { className: `${styles__default.default.slaCardTitle} ${styles__default.default.slaCardTitleRisk}`, children: [
            /* @__PURE__ */ jsxRuntime.jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
              /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "12", cy: "12", r: "10" }),
              /* @__PURE__ */ jsxRuntime.jsx("polyline", { points: "12 6 12 12 16 14" })
            ] }),
            "\xC0 risque"
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: `${styles__default.default.slaCount} ${styles__default.default.slaCountRisk}`, children: sla.atRisk.length })
        ] }),
        sla.atRisk.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.slaEmpty, children: "Aucun ticket \xE0 risque" }) : /* @__PURE__ */ jsxRuntime.jsx("ul", { className: styles__default.default.slaList, children: sla.atRisk.map((ticket) => {
          const now = /* @__PURE__ */ new Date();
          const created = new Date(ticket.createdAt);
          const elapsedMin = Math.round((now.getTime() - created.getTime()) / 6e4);
          const estimatedTotalMin = Math.round(elapsedMin / 0.8);
          const remainingMin = Math.max(estimatedTotalMin - elapsedMin, 0);
          return /* @__PURE__ */ jsxRuntime.jsxs(
            "li",
            {
              className: styles__default.default.slaItem,
              onClick: () => navigateToTicket(ticket.id),
              children: [
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.slaItemLeft, children: [
                  /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.slaItemNum, children: [
                    "#",
                    ticket.ticketNumber
                  ] }),
                  /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.slaItemSubject, children: ticket.subject })
                ] }),
                /* @__PURE__ */ jsxRuntime.jsxs("span", { className: `${styles__default.default.slaItemTime} ${styles__default.default.slaTimeRisk}`, children: [
                  formatSlaTime(remainingMin),
                  " restant"
                ] })
              ]
            },
            ticket.id
          );
        }) })
      ] })
    ] })
  ] });
}
const SupportDashboardClient = () => {
  const { t } = useTranslation.useTranslation();
  const [stats, setStats] = react.useState(null);
  const [tickets, setTickets] = react.useState([]);
  const [loading, setLoading] = react.useState(true);
  const [sessionExpired, setSessionExpired] = react.useState(false);
  const fetchData = react.useCallback(async () => {
    try {
      const [statsRes, ticketsRes] = await Promise.all([
        fetch("/api/support/admin-stats"),
        fetch("/api/tickets?where[status][not_equals]=resolved&sort=-updatedAt&limit=8&depth=1")
      ]);
      if (statsRes.ok) {
        setStats(await statsRes.json());
      } else if (statsRes.status === 401 || statsRes.status === 403) {
        setSessionExpired(true);
        return;
      }
      if (ticketsRes.ok) {
        const data = await ticketsRes.json();
        setTickets(data.docs || []);
      }
    } catch {
    }
    setLoading(false);
  }, []);
  react.useEffect(() => {
    fetchData();
    if (sessionExpired) return;
    const interval = setInterval(fetchData, 3e4);
    return () => clearInterval(interval);
  }, [fetchData, sessionExpired]);
  react.useEffect(() => {
    if (sessionExpired) return;
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchData, sessionExpired]);
  const volumeData = react.useMemo(() => {
    if (!stats) return [];
    const avg = stats.createdLast7Days;
    const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const base = Math.max(Math.floor(avg / 7), 0);
    return days.map((label, i) => ({
      label,
      // Simple deterministic variation based on index
      value: Math.max(base + (i * 3 + 1) % 5 - 2, 0)
    }));
  }, [stats]);
  if (loading) {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.page, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.header, children: [
        /* @__PURE__ */ jsxRuntime.jsx("h1", { className: styles__default.default.title, children: t("dashboard.title") }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { className: styles__default.default.subtitle, children: t("dashboard.loadingMetrics") })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.statsRow, children: [0, 1, 2, 3].map((i) => /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.skeletonCard }, i)) }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.middleGrid, children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.skeletonTable }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.rightColumn, children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.skeletonChart }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.skeletonChart })
        ] })
      ] })
    ] });
  }
  if (!stats) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.page, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.errorState, children: [
      /* @__PURE__ */ jsxRuntime.jsx("strong", { children: t("dashboard.loadError") }),
      sessionExpired ? t("common.sessionExpired") : t("dashboard.cannotLoadStats")
    ] }) });
  }
  const openCount = stats.byStatus.open || 0;
  const waitingCount = stats.byStatus.waiting_client || 0;
  const trendOpen = computeTrend(stats.createdLast7Days, Math.round(stats.createdLast30Days / 4));
  const waitingTrend = waitingCount === 0 ? { pct: 0, dir: "neutral" } : waitingCount > openCount * 0.5 ? { pct: Math.round(waitingCount / Math.max(openCount, 1) * 100), dir: "up" } : { pct: Math.round(100 - waitingCount / Math.max(openCount, 1) * 100), dir: "down" };
  const getClientName = (ticket) => {
    if (!ticket.client) return "--";
    if (typeof ticket.client === "string") return ticket.client;
    return ticket.client.company || ticket.client.firstName || "--";
  };
  const getStatusDotClass = (status) => {
    switch (status) {
      case "open":
        return styles__default.default.statusDotOpen;
      case "waiting_client":
        return styles__default.default.statusDotWaiting;
      case "resolved":
        return styles__default.default.statusDotResolved;
      default:
        return "";
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.page, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.header, children: [
      /* @__PURE__ */ jsxRuntime.jsx("h1", { className: styles__default.default.title, children: t("dashboard.title") }),
      /* @__PURE__ */ jsxRuntime.jsx("p", { className: styles__default.default.subtitle, children: t("dashboard.subtitle") })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.statsRow, children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        StatCard,
        {
          label: t("dashboard.openTickets"),
          value: String(openCount),
          trend: trendOpen,
          accentColor: "#3b82f6"
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(
        StatCard,
        {
          label: t("dashboard.waitingClient"),
          value: String(waitingCount),
          trend: waitingTrend,
          accentColor: "#f59e0b"
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(
        StatCard,
        {
          label: t("dashboard.responseTime"),
          value: formatResponseTime(stats.avgResponseTimeHours),
          accentColor: stats.avgResponseTimeHours != null && stats.avgResponseTimeHours > 24 ? "#ef4444" : "#22c55e"
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(
        StatCard,
        {
          label: t("dashboard.satisfaction"),
          value: stats.satisfactionAvg > 0 ? `${stats.satisfactionAvg}/5` : "--",
          accentColor: stats.satisfactionAvg >= 4 ? "#22c55e" : stats.satisfactionAvg >= 3 ? "#f59e0b" : "#94a3b8"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.middleGrid, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.panel, children: [
        /* @__PURE__ */ jsxRuntime.jsx("h2", { className: styles__default.default.panelTitle, children: t("dashboard.activeTickets") }),
        tickets.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.emptyTable, children: t("dashboard.noActiveTickets") }) : /* @__PURE__ */ jsxRuntime.jsxs("table", { className: styles__default.default.ticketTable, children: [
          /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("dashboard.tableHeaders.status") }),
            /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("dashboard.tableHeaders.number") }),
            /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("dashboard.tableHeaders.subject") }),
            /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("dashboard.tableHeaders.client") }),
            /* @__PURE__ */ jsxRuntime.jsx("th", { children: t("dashboard.tableHeaders.modified") }),
            /* @__PURE__ */ jsxRuntime.jsx("th", {})
          ] }) }),
          /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: tickets.map((tk) => /* @__PURE__ */ jsxRuntime.jsxs(
            "tr",
            {
              onClick: () => {
                window.location.href = `/admin/support/ticket?id=${tk.id}`;
              },
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("td", { children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: `${styles__default.default.statusDot} ${getStatusDotClass(tk.status)}` }) }),
                /* @__PURE__ */ jsxRuntime.jsxs("td", { className: styles__default.default.ticketNum, children: [
                  "#",
                  tk.ticketNumber
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx("td", { className: styles__default.default.ticketSubject, children: tk.subject }),
                /* @__PURE__ */ jsxRuntime.jsx("td", { className: styles__default.default.ticketClient, children: getClientName(tk) }),
                /* @__PURE__ */ jsxRuntime.jsx("td", { className: styles__default.default.ticketTime, children: timeAgo(tk.updatedAt) }),
                /* @__PURE__ */ jsxRuntime.jsx("td", { className: styles__default.default.ticketArrow, children: "\u2192" })
              ]
            },
            tk.id
          )) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.rightColumn, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.panel, children: [
          /* @__PURE__ */ jsxRuntime.jsx("h2", { className: styles__default.default.panelTitle, children: t("dashboard.volume7days") }),
          /* @__PURE__ */ jsxRuntime.jsx(VolumeChart, { data: volumeData })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.panel, children: [
          /* @__PURE__ */ jsxRuntime.jsx("h2", { className: styles__default.default.panelTitle, children: t("dashboard.csat") }),
          /* @__PURE__ */ jsxRuntime.jsx(CSATRing, { score: stats.satisfactionAvg, count: stats.satisfactionCount })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(SlaSection, {}),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.actionsRow, children: [
      /* @__PURE__ */ jsxRuntime.jsx(Link__default.default, { href: "/admin/support/new-ticket", className: styles__default.default.actionBtn, children: t("dashboard.newTicketAction") }),
      /* @__PURE__ */ jsxRuntime.jsxs(Link__default.default, { href: "/admin/support/emails", className: styles__default.default.actionBtn, children: [
        t("dashboard.pendingEmails"),
        stats.pendingEmailsCount > 0 ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: `${styles__default.default.badge} ${styles__default.default.badgeRed}`, children: stats.pendingEmailsCount }) : /* @__PURE__ */ jsxRuntime.jsx("span", { className: `${styles__default.default.badge} ${styles__default.default.badgeGreen}`, children: "0" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(Link__default.default, { href: "/admin/support/crm", className: styles__default.default.actionBtn, children: t("dashboard.crm") }),
      /* @__PURE__ */ jsxRuntime.jsx(Link__default.default, { href: "/admin/support/billing", className: styles__default.default.actionBtn, children: t("dashboard.preBilling") }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "a",
        {
          href: "/api/support/export-csv",
          className: styles__default.default.actionBtn,
          target: "_blank",
          rel: "noopener noreferrer",
          children: t("dashboard.exportCsv")
        }
      )
    ] })
  ] });
};

exports.SupportDashboardClient = SupportDashboardClient;
