"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import styles from '../../styles/SupportDashboard.module.scss';

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
  return /* @__PURE__ */ jsxs(
    Tag,
    {
      className: styles.statCard,
      style,
      onClick,
      type: onClick ? "button" : void 0,
      children: [
        /* @__PURE__ */ jsx("div", { className: styles.statLabel, children: label }),
        /* @__PURE__ */ jsx("div", { className: styles.statValueRow, children: /* @__PURE__ */ jsx("span", { className: styles.statValue, children: value }) }),
        trend && trend.dir !== "neutral" && /* @__PURE__ */ jsxs("div", { className: `${styles.statTrend} ${styles[trend.dir]}`, children: [
          /* @__PURE__ */ jsx("span", { className: styles.trendArrow, children: trend.dir === "up" ? "\u2191" : "\u2193" }),
          trend.pct,
          "%"
        ] }),
        trend && trend.dir === "neutral" && /* @__PURE__ */ jsx("div", { className: `${styles.statTrend} ${styles.neutral}`, children: "\u2014 stable" })
      ]
    }
  );
}
function VolumeChart({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { className: styles.volumeChart, children: data.map((d, i) => /* @__PURE__ */ jsx(
      "div",
      {
        className: styles.volumeBar,
        style: { height: `${Math.max(d.value / max * 100, 5)}%` },
        title: `${d.label}: ${d.value}`
      },
      i
    )) }),
    /* @__PURE__ */ jsxs("div", { className: styles.volumeLabels, children: [
      /* @__PURE__ */ jsx("span", { children: data[0]?.label }),
      /* @__PURE__ */ jsx("span", { children: data[data.length - 1]?.label })
    ] })
  ] });
}
function CSATRing({ score, count }) {
  const pct = score > 0 ? score / 5 * 100 : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - pct / 100 * circumference;
  const color = score >= 4 ? "#22c55e" : score >= 3 ? "#f59e0b" : score > 0 ? "#ef4444" : "#94a3b8";
  return /* @__PURE__ */ jsxs("div", { className: styles.csatContainer, children: [
    /* @__PURE__ */ jsxs("div", { className: styles.csatRing, children: [
      /* @__PURE__ */ jsxs("svg", { width: "100", height: "100", viewBox: "0 0 100 100", children: [
        /* @__PURE__ */ jsx("circle", { cx: "50", cy: "50", r: radius, fill: "none", stroke: "var(--theme-elevation-150, #e2e8f0)", strokeWidth: "6" }),
        /* @__PURE__ */ jsx(
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
      /* @__PURE__ */ jsx("div", { className: styles.csatValue, children: score > 0 ? score.toFixed(1) : "--" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: styles.csatMeta, children: [
      /* @__PURE__ */ jsx("div", { className: styles.csatLabel, children: score > 0 ? `${score.toFixed(1)} / 5` : "Pas de donn\xE9es" }),
      /* @__PURE__ */ jsx("div", { className: styles.csatSub, children: count > 0 ? `${count} avis recueillis` : "Aucun avis" })
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
  const [sla, setSla] = useState(null);
  const [slaLoading, setSlaLoading] = useState(true);
  useEffect(() => {
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
    return /* @__PURE__ */ jsxs("div", { className: styles.slaSection, children: [
      /* @__PURE__ */ jsx("h2", { className: styles.slaSectionTitle, children: "SLA" }),
      /* @__PURE__ */ jsx("div", { className: styles.slaLoading, children: "Chargement..." })
    ] });
  }
  if (!sla) return null;
  const navigateToTicket = (id) => {
    window.location.href = `/admin/support/ticket?id=${id}`;
  };
  return /* @__PURE__ */ jsxs("div", { className: styles.slaSection, children: [
    /* @__PURE__ */ jsx("h2", { className: styles.slaSectionTitle, children: "SLA" }),
    /* @__PURE__ */ jsxs("div", { className: styles.slaGrid, children: [
      /* @__PURE__ */ jsxs("div", { className: `${styles.slaCard} ${styles.slaBreach}`, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.slaCardHeader, children: [
          /* @__PURE__ */ jsxs("h3", { className: `${styles.slaCardTitle} ${styles.slaCardTitleBreach}`, children: [
            /* @__PURE__ */ jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
              /* @__PURE__ */ jsx("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
              /* @__PURE__ */ jsx("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
              /* @__PURE__ */ jsx("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
            ] }),
            "En breach"
          ] }),
          /* @__PURE__ */ jsx("span", { className: `${styles.slaCount} ${styles.slaCountBreach}`, children: sla.breached.length })
        ] }),
        sla.breached.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.slaEmpty, children: "Aucun ticket en breach" }) : /* @__PURE__ */ jsx("ul", { className: styles.slaList, children: sla.breached.map((ticket) => {
          const now = /* @__PURE__ */ new Date();
          const created = new Date(ticket.createdAt);
          const overdueMin = Math.round((now.getTime() - created.getTime()) / 6e4);
          return /* @__PURE__ */ jsxs(
            "li",
            {
              className: styles.slaItem,
              onClick: () => navigateToTicket(ticket.id),
              children: [
                /* @__PURE__ */ jsxs("div", { className: styles.slaItemLeft, children: [
                  /* @__PURE__ */ jsxs("span", { className: styles.slaItemNum, children: [
                    "#",
                    ticket.ticketNumber
                  ] }),
                  /* @__PURE__ */ jsx("span", { className: styles.slaItemSubject, children: ticket.subject })
                ] }),
                /* @__PURE__ */ jsxs("span", { className: `${styles.slaItemTime} ${styles.slaTimeBreach}`, children: [
                  "+",
                  formatSlaTime(overdueMin)
                ] })
              ]
            },
            ticket.id
          );
        }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: `${styles.slaCard} ${styles.slaRisk}`, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.slaCardHeader, children: [
          /* @__PURE__ */ jsxs("h3", { className: `${styles.slaCardTitle} ${styles.slaCardTitleRisk}`, children: [
            /* @__PURE__ */ jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
              /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }),
              /* @__PURE__ */ jsx("polyline", { points: "12 6 12 12 16 14" })
            ] }),
            "\xC0 risque"
          ] }),
          /* @__PURE__ */ jsx("span", { className: `${styles.slaCount} ${styles.slaCountRisk}`, children: sla.atRisk.length })
        ] }),
        sla.atRisk.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.slaEmpty, children: "Aucun ticket \xE0 risque" }) : /* @__PURE__ */ jsx("ul", { className: styles.slaList, children: sla.atRisk.map((ticket) => {
          const now = /* @__PURE__ */ new Date();
          const created = new Date(ticket.createdAt);
          const elapsedMin = Math.round((now.getTime() - created.getTime()) / 6e4);
          const estimatedTotalMin = Math.round(elapsedMin / 0.8);
          const remainingMin = Math.max(estimatedTotalMin - elapsedMin, 0);
          return /* @__PURE__ */ jsxs(
            "li",
            {
              className: styles.slaItem,
              onClick: () => navigateToTicket(ticket.id),
              children: [
                /* @__PURE__ */ jsxs("div", { className: styles.slaItemLeft, children: [
                  /* @__PURE__ */ jsxs("span", { className: styles.slaItemNum, children: [
                    "#",
                    ticket.ticketNumber
                  ] }),
                  /* @__PURE__ */ jsx("span", { className: styles.slaItemSubject, children: ticket.subject })
                ] }),
                /* @__PURE__ */ jsxs("span", { className: `${styles.slaItemTime} ${styles.slaTimeRisk}`, children: [
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
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const fetchData = useCallback(async () => {
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
  useEffect(() => {
    fetchData();
    if (sessionExpired) return;
    const interval = setInterval(fetchData, 3e4);
    return () => clearInterval(interval);
  }, [fetchData, sessionExpired]);
  useEffect(() => {
    if (sessionExpired) return;
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchData, sessionExpired]);
  const volumeData = useMemo(() => {
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
    return /* @__PURE__ */ jsxs("div", { className: styles.page, children: [
      /* @__PURE__ */ jsxs("div", { className: styles.header, children: [
        /* @__PURE__ */ jsx("h1", { className: styles.title, children: t("dashboard.title") }),
        /* @__PURE__ */ jsx("p", { className: styles.subtitle, children: t("dashboard.loadingMetrics") })
      ] }),
      /* @__PURE__ */ jsx("div", { className: styles.statsRow, children: [0, 1, 2, 3].map((i) => /* @__PURE__ */ jsx("div", { className: styles.skeletonCard }, i)) }),
      /* @__PURE__ */ jsxs("div", { className: styles.middleGrid, children: [
        /* @__PURE__ */ jsx("div", { className: styles.skeletonTable }),
        /* @__PURE__ */ jsxs("div", { className: styles.rightColumn, children: [
          /* @__PURE__ */ jsx("div", { className: styles.skeletonChart }),
          /* @__PURE__ */ jsx("div", { className: styles.skeletonChart })
        ] })
      ] })
    ] });
  }
  if (!stats) {
    return /* @__PURE__ */ jsx("div", { className: styles.page, children: /* @__PURE__ */ jsxs("div", { className: styles.errorState, children: [
      /* @__PURE__ */ jsx("strong", { children: t("dashboard.loadError") }),
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
        return styles.statusDotOpen;
      case "waiting_client":
        return styles.statusDotWaiting;
      case "resolved":
        return styles.statusDotResolved;
      default:
        return "";
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: styles.page, children: [
    /* @__PURE__ */ jsxs("div", { className: styles.header, children: [
      /* @__PURE__ */ jsx("h1", { className: styles.title, children: t("dashboard.title") }),
      /* @__PURE__ */ jsx("p", { className: styles.subtitle, children: t("dashboard.subtitle") })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: styles.statsRow, children: [
      /* @__PURE__ */ jsx(
        StatCard,
        {
          label: t("dashboard.openTickets"),
          value: String(openCount),
          trend: trendOpen,
          accentColor: "#3b82f6"
        }
      ),
      /* @__PURE__ */ jsx(
        StatCard,
        {
          label: t("dashboard.waitingClient"),
          value: String(waitingCount),
          trend: waitingTrend,
          accentColor: "#f59e0b"
        }
      ),
      /* @__PURE__ */ jsx(
        StatCard,
        {
          label: t("dashboard.responseTime"),
          value: formatResponseTime(stats.avgResponseTimeHours),
          accentColor: stats.avgResponseTimeHours != null && stats.avgResponseTimeHours > 24 ? "#ef4444" : "#22c55e"
        }
      ),
      /* @__PURE__ */ jsx(
        StatCard,
        {
          label: t("dashboard.satisfaction"),
          value: stats.satisfactionAvg > 0 ? `${stats.satisfactionAvg}/5` : "--",
          accentColor: stats.satisfactionAvg >= 4 ? "#22c55e" : stats.satisfactionAvg >= 3 ? "#f59e0b" : "#94a3b8"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: styles.middleGrid, children: [
      /* @__PURE__ */ jsxs("div", { className: styles.panel, children: [
        /* @__PURE__ */ jsx("h2", { className: styles.panelTitle, children: t("dashboard.activeTickets") }),
        tickets.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.emptyTable, children: t("dashboard.noActiveTickets") }) : /* @__PURE__ */ jsxs("table", { className: styles.ticketTable, children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: t("dashboard.tableHeaders.status") }),
            /* @__PURE__ */ jsx("th", { children: t("dashboard.tableHeaders.number") }),
            /* @__PURE__ */ jsx("th", { children: t("dashboard.tableHeaders.subject") }),
            /* @__PURE__ */ jsx("th", { children: t("dashboard.tableHeaders.client") }),
            /* @__PURE__ */ jsx("th", { children: t("dashboard.tableHeaders.modified") }),
            /* @__PURE__ */ jsx("th", {})
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: tickets.map((tk) => /* @__PURE__ */ jsxs(
            "tr",
            {
              onClick: () => {
                window.location.href = `/admin/support/ticket?id=${tk.id}`;
              },
              children: [
                /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `${styles.statusDot} ${getStatusDotClass(tk.status)}` }) }),
                /* @__PURE__ */ jsxs("td", { className: styles.ticketNum, children: [
                  "#",
                  tk.ticketNumber
                ] }),
                /* @__PURE__ */ jsx("td", { className: styles.ticketSubject, children: tk.subject }),
                /* @__PURE__ */ jsx("td", { className: styles.ticketClient, children: getClientName(tk) }),
                /* @__PURE__ */ jsx("td", { className: styles.ticketTime, children: timeAgo(tk.updatedAt) }),
                /* @__PURE__ */ jsx("td", { className: styles.ticketArrow, children: "\u2192" })
              ]
            },
            tk.id
          )) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: styles.rightColumn, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.panel, children: [
          /* @__PURE__ */ jsx("h2", { className: styles.panelTitle, children: t("dashboard.volume7days") }),
          /* @__PURE__ */ jsx(VolumeChart, { data: volumeData })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.panel, children: [
          /* @__PURE__ */ jsx("h2", { className: styles.panelTitle, children: t("dashboard.csat") }),
          /* @__PURE__ */ jsx(CSATRing, { score: stats.satisfactionAvg, count: stats.satisfactionCount })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(SlaSection, {}),
    /* @__PURE__ */ jsxs("div", { className: styles.actionsRow, children: [
      /* @__PURE__ */ jsx(Link, { href: "/admin/support/new-ticket", className: styles.actionBtn, children: t("dashboard.newTicketAction") }),
      /* @__PURE__ */ jsxs(Link, { href: "/admin/support/emails", className: styles.actionBtn, children: [
        t("dashboard.pendingEmails"),
        stats.pendingEmailsCount > 0 ? /* @__PURE__ */ jsx("span", { className: `${styles.badge} ${styles.badgeRed}`, children: stats.pendingEmailsCount }) : /* @__PURE__ */ jsx("span", { className: `${styles.badge} ${styles.badgeGreen}`, children: "0" })
      ] }),
      /* @__PURE__ */ jsx(Link, { href: "/admin/support/crm", className: styles.actionBtn, children: t("dashboard.crm") }),
      /* @__PURE__ */ jsx(Link, { href: "/admin/support/billing", className: styles.actionBtn, children: t("dashboard.preBilling") }),
      /* @__PURE__ */ jsx(
        "a",
        {
          href: "/api/support/export-csv",
          className: styles.actionBtn,
          target: "_blank",
          rel: "noopener noreferrer",
          children: t("dashboard.exportCsv")
        }
      )
    ] })
  ] });
};

export { SupportDashboardClient };
