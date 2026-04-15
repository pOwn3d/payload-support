"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import styles from '../../styles/CrmView.module.scss';

const statusBadgeClass = {
  open: "badgeAccent",
  waiting_client: "badgeOrange",
  resolved: "badgeGreen"
};
const statusLabelKeys = {
  open: "ticket.status.open",
  waiting_client: "ticket.status.waiting_client",
  resolved: "ticket.status.resolved"
};
const projectStatusLabelKeys = {
  active: "crm.projectStatus.active",
  paused: "crm.projectStatus.paused",
  completed: "crm.projectStatus.completed"
};
const projectStatusBadgeClass = {
  active: "badgeGreen",
  paused: "badgeOrange",
  completed: "badgeMuted"
};
function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 864e5);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 30) return `Il y a ${days}j`;
  const months = Math.floor(days / 30);
  return `Il y a ${months} mois`;
}
function getStatColorClass(key, detail) {
  switch (key) {
    case "total":
      return styles.statAccent;
    case "open":
      return detail.openTickets > 0 ? styles.statOrange : styles.statGreen;
    case "resolved":
      return styles.statGreen;
    case "time":
      return styles.statAmber;
    case "activity":
      return styles.statAccent;
    default:
      return styles.statAccent;
  }
}
const CrmClient = () => {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeResults, setMergeResults] = useState([]);
  const [merging, setMerging] = useState(false);
  const [intelligence, setIntelligence] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelRefreshing, setIntelRefreshing] = useState(false);
  const [mergeSuccess, setMergeSuccess] = useState("");
  const fetchClients = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "100", sort: "company", depth: "0" });
      if (search) params.set("where[company][like]", search);
      const res = await fetch(`/api/support-clients?${params}`);
      if (res.ok) {
        const json = await res.json();
        setClients(json.docs || []);
      }
    } catch {
    }
    setLoading(false);
  }, [search]);
  useEffect(() => {
    const timeout = setTimeout(fetchClients, 300);
    return () => clearTimeout(timeout);
  }, [fetchClients]);
  const fetchDetail = useCallback(async (clientId) => {
    setDetailLoading(true);
    try {
      const [clientRes, ticketsRes, projectsRes, timeRes] = await Promise.all([
        fetch(`/api/support-clients/${clientId}?depth=0`),
        fetch(`/api/tickets?where[client][equals]=${clientId}&sort=-createdAt&limit=20&depth=0`),
        fetch(`/api/projects?where[client][equals]=${clientId}&depth=0`),
        fetch(`/api/time-entries?limit=0&depth=0`)
      ]);
      const client = clientRes.ok ? await clientRes.json() : null;
      const tickets = ticketsRes.ok ? (await ticketsRes.json()).docs || [] : [];
      const projects = projectsRes.ok ? (await projectsRes.json()).docs || [] : [];
      const ticketIds = tickets.map((t2) => t2.id);
      let totalTimeMinutes = 0;
      if (timeRes.ok) {
        const timeData = await timeRes.json();
        totalTimeMinutes = timeData.docs.filter((e) => ticketIds.includes(e.ticket)).reduce((sum, e) => sum + (e.duration || 0), 0);
      }
      const openTickets = tickets.filter(
        (t2) => ["open", "waiting_client"].includes(t2.status)
      ).length;
      const resolvedTickets = tickets.filter(
        (t2) => t2.status === "resolved"
      ).length;
      const lastActivity = tickets.length > 0 ? tickets[0].createdAt : null;
      setDetail({
        client,
        tickets,
        projects,
        stats: {
          totalTickets: tickets.length,
          openTickets,
          resolvedTickets,
          totalTimeMinutes,
          lastActivity
        }
      });
    } catch {
      setDetail(null);
    }
    setDetailLoading(false);
  }, []);
  const fetchIntelligence = useCallback(async (clientId, force = false) => {
    if (force) setIntelRefreshing(true);
    else setIntelLoading(true);
    try {
      const method = force ? "POST" : "GET";
      const url = force ? "/api/support/client-intelligence" : `/api/support/client-intelligence?clientId=${clientId}`;
      const opts = { method, credentials: "include", headers: { "Content-Type": "application/json" } };
      if (force) opts.body = JSON.stringify({ clientId });
      const res = await fetch(url, opts);
      if (res.ok) setIntelligence(await res.json());
    } catch {
    }
    setIntelLoading(false);
    setIntelRefreshing(false);
  }, []);
  const selectClient = (id) => {
    setSelectedId(id);
    fetchDetail(id);
    fetchIntelligence(id);
    setIntelligence(null);
    setShowMerge(false);
    setMergeSuccess("");
  };
  useEffect(() => {
    if (!mergeSearch || mergeSearch.length < 2) {
      setMergeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/support-clients?where[or][0][company][like]=${encodeURIComponent(mergeSearch)}&where[or][1][email][like]=${encodeURIComponent(mergeSearch)}&where[or][2][firstName][like]=${encodeURIComponent(mergeSearch)}&limit=10&depth=0`);
        if (res.ok) {
          const json = await res.json();
          setMergeResults((json.docs || []).filter((c) => c.id !== selectedId));
        }
      } catch {
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mergeSearch, selectedId]);
  const handleMerge = async (targetId) => {
    if (!selectedId || !detail) return;
    const targetClient = mergeResults.find((c) => c.id === targetId) || clients.find((c) => c.id === targetId);
    if (!confirm(`Fusionner "${detail.client.company} (${detail.client.email})" dans "${targetClient?.company || targetId}" ?

Tous les tickets, messages et projets seront transf\xE9r\xE9s.
Le client "${detail.client.company}" sera supprim\xE9.

Cette action est irr\xE9versible.`)) return;
    setMerging(true);
    try {
      const res = await fetch("/api/support/merge-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: selectedId, targetId })
      });
      if (res.ok) {
        const data = await res.json();
        setMergeSuccess(data.message);
        setShowMerge(false);
        setSelectedId(targetId);
        fetchDetail(targetId);
        fetchClients();
      } else {
        const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        alert(`Erreur : ${err.error}`);
      }
    } catch {
      alert("Erreur r\xE9seau");
    }
    setMerging(false);
  };
  return /* @__PURE__ */ jsxs("div", { className: styles.page, children: [
    /* @__PURE__ */ jsx("div", { className: styles.header, children: /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h1", { className: styles.title, children: t("crm.title") }),
      /* @__PURE__ */ jsx("div", { className: styles.subtitle, children: t("crm.subtitle") })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: styles.grid, children: [
      /* @__PURE__ */ jsxs("div", { className: styles.sidebar, children: [
        /* @__PURE__ */ jsx("div", { className: styles.sidebarSearch, children: /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            placeholder: t("crm.searchPlaceholder"),
            value: search,
            onChange: (e) => setSearch(e.target.value),
            className: styles.searchInput
          }
        ) }),
        /* @__PURE__ */ jsx("div", { className: styles.clientList, children: loading ? /* @__PURE__ */ jsxs("div", { className: styles.emptyState, children: [
          /* @__PURE__ */ jsx("div", { className: styles.skeleton }),
          /* @__PURE__ */ jsx("div", { className: styles.skeleton }),
          /* @__PURE__ */ jsx("div", { className: styles.skeleton }),
          /* @__PURE__ */ jsx("div", { className: styles.skeleton })
        ] }) : clients.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.emptyState, children: t("crm.noClientFound") }) : clients.map((c) => /* @__PURE__ */ jsxs(
          "div",
          {
            onClick: () => selectClient(c.id),
            className: `${styles.clientItem} ${selectedId === c.id ? styles.clientItemActive : ""}`,
            children: [
              /* @__PURE__ */ jsx("div", { className: styles.clientCompany, children: c.company }),
              /* @__PURE__ */ jsxs("div", { className: styles.clientName, children: [
                c.firstName,
                " ",
                c.lastName
              ] }),
              /* @__PURE__ */ jsx("div", { className: styles.clientEmail, children: c.email })
            ]
          },
          c.id
        )) })
      ] }),
      /* @__PURE__ */ jsx("div", { children: !selectedId ? /* @__PURE__ */ jsx("div", { className: styles.placeholder, children: t("crm.selectClient") }) : detailLoading ? /* @__PURE__ */ jsxs("div", { className: styles.loadingCard, children: [
        /* @__PURE__ */ jsx("div", { className: styles.skeleton }),
        /* @__PURE__ */ jsx("div", { className: styles.skeleton }),
        /* @__PURE__ */ jsx("div", { className: styles.skeleton }),
        /* @__PURE__ */ jsx("div", { className: styles.skeleton })
      ] }) : detail ? /* @__PURE__ */ jsxs("div", { className: styles.detailStack, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.clientHeader, children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { className: styles.clientHeaderName, children: detail.client.company }),
            /* @__PURE__ */ jsxs("div", { className: styles.clientHeaderContact, children: [
              detail.client.firstName,
              " ",
              detail.client.lastName
            ] }),
            /* @__PURE__ */ jsxs("div", { className: styles.clientContactRow, children: [
              /* @__PURE__ */ jsx("span", { children: detail.client.email }),
              detail.client.phone && /* @__PURE__ */ jsx("span", { children: detail.client.phone })
            ] }),
            detail.client.notes && /* @__PURE__ */ jsx("div", { className: styles.clientNotes, children: detail.client.notes })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: styles.headerActions, children: [
            /* @__PURE__ */ jsx(
              "a",
              {
                href: `/admin/collections/support-clients/${detail.client.id}`,
                className: styles.btnPrimary,
                children: t("crm.editButton")
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => {
                  setShowMerge(!showMerge);
                  setMergeSearch("");
                  setMergeResults([]);
                },
                className: styles.btnWarning,
                children: t("crm.mergeButton")
              }
            )
          ] })
        ] }),
        mergeSuccess && /* @__PURE__ */ jsx("div", { className: styles.successBanner, children: mergeSuccess }),
        showMerge && /* @__PURE__ */ jsxs("div", { className: styles.mergePanel, children: [
          /* @__PURE__ */ jsx("h4", { className: styles.mergePanelTitle, children: t("crm.mergeTitle") }),
          /* @__PURE__ */ jsxs("p", { className: styles.mergePanelDesc, children: [
            "Tous les tickets, messages, projets et enquetes de ",
            /* @__PURE__ */ jsx("strong", { children: detail.client.company }),
            " seront transferes vers le client cible. Le client actuel sera supprime."
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: mergeSearch,
              onChange: (e) => setMergeSearch(e.target.value),
              placeholder: t("crm.mergeSearchPlaceholder"),
              className: styles.mergeInput
            }
          ),
          mergeResults.length > 0 && /* @__PURE__ */ jsx("div", { className: styles.mergeResultList, children: mergeResults.map((c) => /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => handleMerge(c.id),
              disabled: merging,
              className: styles.mergeResultItem,
              children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("strong", { children: c.company }),
                  /* @__PURE__ */ jsxs("span", { className: styles.mergeResultName, children: [
                    c.firstName,
                    " ",
                    c.lastName
                  ] })
                ] }),
                /* @__PURE__ */ jsx("span", { className: styles.mergeResultEmail, children: c.email })
              ]
            },
            c.id
          )) }),
          mergeSearch.length >= 2 && mergeResults.length === 0 && /* @__PURE__ */ jsx("p", { className: styles.mergeEmpty, children: t("crm.mergeNoClient") })
        ] }),
        /* @__PURE__ */ jsx("div", { className: styles.statsGrid, children: [
          { key: "total", label: t("crm.stats.totalTickets"), value: String(detail.stats.totalTickets) },
          { key: "open", label: t("crm.stats.openTickets"), value: String(detail.stats.openTickets) },
          { key: "resolved", label: t("crm.stats.resolvedTickets"), value: String(detail.stats.resolvedTickets) },
          { key: "time", label: t("crm.stats.timeSpent"), value: formatDuration(detail.stats.totalTimeMinutes) },
          { key: "activity", label: t("crm.stats.lastActivity"), value: detail.stats.lastActivity ? timeAgo(detail.stats.lastActivity) : "-" }
        ].map((stat) => /* @__PURE__ */ jsxs("div", { className: styles.statCard, children: [
          /* @__PURE__ */ jsx("div", { className: styles.statLabel, children: stat.label }),
          /* @__PURE__ */ jsx("div", { className: `${styles.statValue} ${getStatColorClass(stat.key, detail.stats)}`, children: stat.value })
        ] }, stat.key)) }),
        detail.projects.length > 0 && /* @__PURE__ */ jsxs("div", { className: styles.sectionCard, children: [
          /* @__PURE__ */ jsxs("h3", { className: styles.sectionTitle, children: [
            t("crm.sections.projects"),
            " (",
            detail.projects.length,
            ")"
          ] }),
          /* @__PURE__ */ jsx("div", { className: styles.projectList, children: detail.projects.map((p) => /* @__PURE__ */ jsxs(
            "a",
            {
              href: `/admin/collections/projects/${p.id}`,
              className: styles.projectChip,
              children: [
                p.name,
                /* @__PURE__ */ jsx("span", { className: `${styles.badge} ${styles[projectStatusBadgeClass[p.status] || "badgeAccent"]}`, children: t(projectStatusLabelKeys[p.status] || "crm.projectStatus.active") })
              ]
            },
            p.id
          )) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.sectionCard, style: { background: "linear-gradient(135deg, rgba(37,99,235,0.03) 0%, rgba(139,92,246,0.03) 100%)" }, children: [
          /* @__PURE__ */ jsxs("div", { className: styles.sectionHeader, children: [
            /* @__PURE__ */ jsxs("h3", { className: styles.sectionTitle, style: { display: "flex", alignItems: "center", gap: 6 }, children: [
              /* @__PURE__ */ jsx("span", { style: { fontSize: 16 }, children: "\u{1F9E0}" }),
              " R\xE9sum\xE9 IA"
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => selectedId && fetchIntelligence(selectedId, true),
                disabled: intelRefreshing,
                className: styles.viewAllLink,
                style: { cursor: "pointer", background: "none", border: "none", fontWeight: 600 },
                children: intelRefreshing ? "\u23F3 G\xE9n\xE9ration..." : "\u{1F504} Actualiser"
              }
            )
          ] }),
          intelLoading ? /* @__PURE__ */ jsx("div", { style: { padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }, children: "Chargement du r\xE9sum\xE9..." }) : intelligence ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
            /* @__PURE__ */ jsx("p", { style: { margin: 0, fontSize: 13, lineHeight: 1.6 }, children: intelligence.summary }),
            intelligence.recurringTopics?.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }, children: "Sujets r\xE9currents" }),
              /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, children: intelligence.recurringTopics.map((tp, i) => /* @__PURE__ */ jsxs("span", { style: { padding: "3px 10px", borderRadius: 12, background: "rgba(37,99,235,0.08)", color: "#2563eb", fontSize: 11, fontWeight: 600 }, children: [
                tp.topic,
                " (",
                tp.count,
                "x)"
              ] }, i)) })
            ] }),
            intelligence.patterns?.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }, children: "Patterns" }),
              /* @__PURE__ */ jsx("ul", { style: { margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.8 }, children: intelligence.patterns.map((p, i) => /* @__PURE__ */ jsx("li", { children: p }, i)) })
            ] }),
            intelligence.keyFacts?.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }, children: "Faits cl\xE9s" }),
              /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, children: intelligence.keyFacts.map((f, i) => /* @__PURE__ */ jsx("span", { style: { padding: "3px 10px", borderRadius: 12, background: "rgba(22,163,74,0.08)", color: "#16a34a", fontSize: 11, fontWeight: 600 }, children: f }, i)) })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { fontSize: 10, color: "#9ca3af", display: "flex", gap: 12 }, children: [
              /* @__PURE__ */ jsxs("span", { children: [
                intelligence.ticketCount,
                " tickets"
              ] }),
              /* @__PURE__ */ jsxs("span", { children: [
                intelligence.messageCount,
                " messages"
              ] }),
              intelligence.averageSatisfaction && /* @__PURE__ */ jsxs("span", { children: [
                "Satisfaction: ",
                intelligence.averageSatisfaction,
                "/5"
              ] }),
              intelligence.fromCache && /* @__PURE__ */ jsx("span", { children: "\u2022 Cache" })
            ] })
          ] }) : /* @__PURE__ */ jsx("div", { style: { padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 13 }, children: "Cliquez sur \xAB Actualiser \xBB pour g\xE9n\xE9rer le r\xE9sum\xE9 IA." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.sectionCard, children: [
          /* @__PURE__ */ jsxs("div", { className: styles.sectionHeader, children: [
            /* @__PURE__ */ jsxs("h3", { className: styles.sectionTitle, children: [
              t("crm.sections.tickets"),
              " (",
              detail.tickets.length,
              ")"
            ] }),
            /* @__PURE__ */ jsxs(
              "a",
              {
                href: `/admin/collections/tickets?where[client][equals]=${detail.client.id}`,
                className: styles.sectionLink,
                children: [
                  t("crm.sections.viewAll"),
                  " \u2192"
                ]
              }
            )
          ] }),
          detail.tickets.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.ticketEmpty, children: t("crm.noTickets") }) : /* @__PURE__ */ jsxs("table", { className: styles.table, children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { children: t("crm.tableHeaders.number") }),
              /* @__PURE__ */ jsx("th", { children: t("crm.tableHeaders.subject") }),
              /* @__PURE__ */ jsx("th", { children: t("crm.tableHeaders.status") }),
              /* @__PURE__ */ jsx("th", { children: t("crm.tableHeaders.date") })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: detail.tickets.map((tk) => /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("a", { href: `/admin/collections/tickets/${tk.id}`, className: styles.ticketLink, children: tk.ticketNumber }) }),
              /* @__PURE__ */ jsx("td", { className: styles.ticketSubject, children: tk.subject }),
              /* @__PURE__ */ jsx("td", { className: styles.ticketStatusCell, children: /* @__PURE__ */ jsx("span", { className: `${styles.badge} ${styles[statusBadgeClass[tk.status] || "badgeAccent"]}`, children: t(statusLabelKeys[tk.status] || "ticket.status.open") }) }),
              /* @__PURE__ */ jsx("td", { className: styles.ticketDate, children: timeAgo(tk.createdAt) })
            ] }, tk.id)) })
          ] })
        ] })
      ] }) : null })
    ] })
  ] });
};

export { CrmClient };
