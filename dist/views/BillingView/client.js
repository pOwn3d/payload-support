"use client";
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import React, { useState, useCallback } from 'react';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import styles from '../../styles/BillingView.module.scss';

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
function formatAmount(minutes, rate) {
  const hours = minutes / 60;
  return (hours * rate).toFixed(2);
}
function getMonthRange(offset) {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    from: start.toISOString().split("T")[0],
    to: end.toISOString().split("T")[0]
  };
}
function getQuarterRange(offset) {
  const now = /* @__PURE__ */ new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const quarter = currentQuarter + offset;
  const year = now.getFullYear();
  const startMonth = quarter * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return {
    from: start.toISOString().split("T")[0],
    to: end.toISOString().split("T")[0]
  };
}
const BillingClient = () => {
  const { t } = useTranslation();
  const [from, setFrom] = useState(() => getMonthRange(0).from);
  const [to, setTo] = useState(() => getMonthRange(0).to);
  const [projectId, setProjectId] = useState("");
  const [rate, setRate] = useState(60);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [expandedSummaries, setExpandedSummaries] = useState(/* @__PURE__ */ new Set());
  const [regeneratingIds, setRegeneratingIds] = useState(/* @__PURE__ */ new Set());
  const [billedTickets, setBilledTickets] = useState(() => {
    if (typeof window === "undefined") return /* @__PURE__ */ new Set();
    try {
      const saved = localStorage.getItem("billing-checked-tickets");
      return saved ? new Set(JSON.parse(saved)) : /* @__PURE__ */ new Set();
    } catch {
      return /* @__PURE__ */ new Set();
    }
  });
  const toggleBilled = useCallback((ticketId) => {
    setBilledTickets((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      localStorage.setItem("billing-checked-tickets", JSON.stringify([...next]));
      return next;
    });
  }, []);
  const toggleSummary = useCallback((ticketId) => {
    setExpandedSummaries((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      return next;
    });
  }, []);
  const visibleGroups = React.useMemo(() => {
    if (!data) return [];
    if (!hideEmpty) return data.groups;
    return data.groups.map((g) => ({ ...g, tickets: g.tickets.filter((t2) => !t2.hasNoTimeEntries) })).filter((g) => g.tickets.length > 0);
  }, [data, hideEmpty]);
  const allTicketIds = visibleGroups.flatMap((g) => g.tickets.map((t2) => t2.id));
  const allBilled = allTicketIds.length > 0 && allTicketIds.every((id) => billedTickets.has(id));
  const toggleAll = useCallback(() => {
    setBilledTickets((prev) => {
      const ids = visibleGroups.flatMap((g) => g.tickets.map((t2) => t2.id));
      const next = ids.every((id) => prev.has(id)) ? /* @__PURE__ */ new Set() : new Set(ids);
      localStorage.setItem("billing-checked-tickets", JSON.stringify([...next]));
      return next;
    });
  }, [visibleGroups]);
  const loadProjects = useCallback(async () => {
    if (projectsLoaded) return;
    try {
      const res = await fetch("/api/projects?limit=100&depth=0&sort=name");
      if (res.ok) {
        const json = await res.json();
        setProjects(json.docs?.map((p) => ({ id: p.id, name: p.name })) || []);
      }
    } catch {
    }
    setProjectsLoaded(true);
  }, [projectsLoaded]);
  React.useEffect(() => {
    loadProjects();
  }, [loadProjects]);
  const fetchBilling = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (projectId) params.set("projectId", projectId);
      const res = await fetch(`/api/support/billing?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("[billing] Fetch error:", err);
    }
    setLoading(false);
  }, [from, to, projectId]);
  const setPeriod = (range) => {
    setFrom(range.from);
    setTo(range.to);
  };
  const requestSynthesis = useCallback(async (ticketId, force) => {
    setRegeneratingIds((prev) => new Set(prev).add(ticketId));
    try {
      const params = new URLSearchParams({ ticketId: String(ticketId) });
      if (force) params.set("force", "true");
      const res = await fetch(`/api/support/ticket-synthesis?${params}`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            groups: prev.groups.map((g) => ({
              ...g,
              tickets: g.tickets.map(
                (t2) => t2.id === ticketId ? { ...t2, aiSummary: json.summary, aiSummaryGeneratedAt: json.generatedAt, aiSummaryStatus: "done" } : t2
              )
            }))
          };
        });
        setExpandedSummaries((prev) => new Set(prev).add(ticketId));
      }
    } catch (err) {
      console.error("[billing] Synthesis error:", err);
    } finally {
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
    }
  }, []);
  const copyRecap = useCallback(() => {
    if (!data) return;
    const lines = [];
    lines.push(`PRE-FACTURATION \u2014 Du ${from} au ${to}`);
    lines.push(`Taux horaire : ${rate} EUR/h`);
    lines.push("=".repeat(50));
    for (const group of visibleGroups) {
      lines.push("");
      lines.push(`PROJET : ${group.project?.name || "Sans projet"}`);
      if (group.client?.company) lines.push(`Client : ${group.client.company}`);
      lines.push("-".repeat(40));
      for (const ticket of group.tickets) {
        const flag = ticket.hasNoTimeEntries ? " [AUCUN TEMPS SAISI]" : "";
        lines.push(`  ${ticket.ticketNumber} \u2014 ${ticket.subject}${flag}`);
        for (const entry of ticket.entries) {
          lines.push(`    ${entry.date} | ${formatDuration(entry.duration)} | ${entry.description || "-"}`);
        }
        if (ticket.entries.length > 0) {
          const ticketAmount = ticket.billedAmount || Number(formatAmount(ticket.totalMinutes, rate));
          lines.push(`    Sous-total : ${formatDuration(ticket.totalMinutes)} = ${ticketAmount.toFixed(2)} EUR${ticket.billedAmount ? " (forfait)" : ""}`);
        }
        if (ticket.aiSummary) {
          lines.push("    Detail des actions :");
          for (const detailLine of ticket.aiSummary.split("\n")) {
            lines.push(`    ${detailLine}`);
          }
        }
      }
      const groupAmount = group.totalBilledAmount > 0 ? group.totalBilledAmount : Number(formatAmount(group.totalMinutes, rate));
      lines.push(`  Total projet : ${formatDuration(group.totalMinutes)} = ${groupAmount.toFixed(2)} EUR`);
    }
    lines.push("");
    lines.push("=".repeat(50));
    lines.push(`TOTAL GENERAL : ${formatDuration(data.grandTotalMinutes)} = ${formatAmount(data.grandTotalMinutes, rate)} EUR`);
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  }, [data, visibleGroups, from, to, rate]);
  const copyTicketSummary = useCallback((ticket) => {
    const lines = [`${ticket.ticketNumber} \u2014 ${ticket.subject}`];
    if (ticket.aiSummary) lines.push("", ticket.aiSummary);
    navigator.clipboard.writeText(lines.join("\n"));
  }, []);
  const totalTickets = visibleGroups.reduce((sum, g) => sum + g.tickets.length, 0);
  return /* @__PURE__ */ jsxs("div", { className: styles.page, children: [
    /* @__PURE__ */ jsx("div", { className: styles.header, children: /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h1", { className: styles.title, children: t("billing.title") }),
      /* @__PURE__ */ jsx("p", { className: styles.subtitle, children: t("billing.subtitle") })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: styles.filters, children: [
      /* @__PURE__ */ jsxs("div", { className: styles.quickPeriod, children: [
        /* @__PURE__ */ jsx("button", { className: styles.btnPrimary, onClick: () => setPeriod(getMonthRange(0)), children: t("billing.filters.thisMonth") }),
        /* @__PURE__ */ jsx("button", { className: styles.btnSecondary, onClick: () => setPeriod(getMonthRange(-1)), children: t("billing.filters.lastMonth") }),
        /* @__PURE__ */ jsx("button", { className: styles.btnAmber, onClick: () => setPeriod(getQuarterRange(0)), children: t("billing.filters.thisQuarter") }),
        /* @__PURE__ */ jsx("button", { className: styles.btnMuted, onClick: () => setPeriod(getQuarterRange(-1)), children: t("billing.filters.lastQuarter") })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: styles.filterRow, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.fieldGroup, children: [
          /* @__PURE__ */ jsx("label", { className: styles.label, children: t("billing.filters.from") }),
          /* @__PURE__ */ jsx("input", { type: "date", value: from, onChange: (e) => setFrom(e.target.value), className: styles.input })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.fieldGroup, children: [
          /* @__PURE__ */ jsx("label", { className: styles.label, children: t("billing.filters.to") }),
          /* @__PURE__ */ jsx("input", { type: "date", value: to, onChange: (e) => setTo(e.target.value), className: styles.input })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.fieldGroup, children: [
          /* @__PURE__ */ jsx("label", { className: styles.label, children: t("billing.filters.project") }),
          /* @__PURE__ */ jsxs("select", { value: projectId, onChange: (e) => setProjectId(e.target.value), className: styles.select, children: [
            /* @__PURE__ */ jsx("option", { value: "", children: t("ticket.allProjects") }),
            projects.map((p) => /* @__PURE__ */ jsx("option", { value: p.id, children: p.name }, p.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.fieldGroup, children: [
          /* @__PURE__ */ jsx("label", { className: styles.label, children: t("billing.filters.hourlyRate") }),
          /* @__PURE__ */ jsxs("div", { className: styles.rateRow, children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                value: rate,
                onChange: (e) => setRate(Number(e.target.value)),
                className: styles.rateInput,
                min: 0
              }
            ),
            /* @__PURE__ */ jsx("span", { className: styles.rateUnit, children: t("billing.filters.rateUnit") })
          ] })
        ] }),
        /* @__PURE__ */ jsx("button", { className: styles.btnPrimary, onClick: fetchBilling, disabled: loading, children: loading ? t("billing.filters.loading") : t("billing.filters.load") })
      ] })
    ] }),
    data && /* @__PURE__ */ jsxs(Fragment, { children: [
      data.ticketsWithoutTime > 0 && /* @__PURE__ */ jsxs("div", { className: styles.warningBanner, children: [
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("strong", { children: data.ticketsWithoutTime }),
          " ticket",
          data.ticketsWithoutTime > 1 ? "s" : "",
          " actif",
          data.ticketsWithoutTime > 1 ? "s" : "",
          " sans temps saisi sur la periode."
        ] }),
        /* @__PURE__ */ jsxs("label", { className: styles.toggleLabel, children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: hideEmpty, onChange: (e) => setHideEmpty(e.target.checked) }),
          /* @__PURE__ */ jsx("span", { children: "Masquer ces tickets" })
        ] })
      ] }),
      visibleGroups.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.empty, children: t("billing.empty") }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        visibleGroups.map((group, gi) => /* @__PURE__ */ jsxs("div", { className: styles.groupCard, children: [
          /* @__PURE__ */ jsxs("div", { className: styles.groupHeader, children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("span", { className: styles.groupName, children: group.project?.name || "Sans projet" }),
              group.client?.company && /* @__PURE__ */ jsxs("span", { className: styles.groupClient, children: [
                "\u2014 ",
                group.client.company
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: styles.groupTotals, children: [
              /* @__PURE__ */ jsx("div", { className: styles.groupDuration, children: formatDuration(group.totalMinutes) }),
              group.totalBilledAmount > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsxs("div", { className: styles.groupAmountBilled, children: [
                  group.totalBilledAmount.toFixed(2),
                  " EUR facture"
                ] }),
                /* @__PURE__ */ jsxs("div", { className: styles.groupAmountStrike, children: [
                  formatAmount(group.totalMinutes, rate),
                  " EUR (temps)"
                ] })
              ] }) : /* @__PURE__ */ jsxs("div", { className: styles.groupAmount, children: [
                formatAmount(group.totalMinutes, rate),
                " EUR"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("table", { className: styles.table, children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { className: styles.thCheckbox, children: /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  checked: group.tickets.every((t2) => billedTickets.has(t2.id)),
                  onChange: () => {
                    const ids = group.tickets.map((t2) => t2.id);
                    const allChecked = ids.every((id) => billedTickets.has(id));
                    setBilledTickets((prev) => {
                      const next = new Set(prev);
                      ids.forEach((id) => allChecked ? next.delete(id) : next.add(id));
                      localStorage.setItem("billing-checked-tickets", JSON.stringify([...next]));
                      return next;
                    });
                  },
                  className: styles.checkbox,
                  title: "Tout cocher/decocher"
                }
              ) }),
              /* @__PURE__ */ jsx("th", { className: styles.th, children: "N\xB0 Ticket" }),
              /* @__PURE__ */ jsx("th", { className: styles.thLeft, children: "Sujet" }),
              /* @__PURE__ */ jsx("th", { className: styles.th, children: "Date" }),
              /* @__PURE__ */ jsx("th", { className: styles.th, children: "Duree" }),
              /* @__PURE__ */ jsx("th", { className: styles.thLeft, children: "Description" }),
              /* @__PURE__ */ jsx("th", { className: styles.th, children: "Montant" }),
              /* @__PURE__ */ jsx("th", { className: styles.th, children: "Facture" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: group.tickets.map((ticket) => {
              const isBilled = billedTickets.has(ticket.id);
              const isExpanded = expandedSummaries.has(ticket.id);
              const isRegenerating = regeneratingIds.has(ticket.id);
              const rowSpan = Math.max(ticket.entries.length, 1);
              const renderTicketHeaderCells = () => /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx("td", { className: styles.td, rowSpan, style: { verticalAlign: "middle" }, children: /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: isBilled,
                    onChange: () => toggleBilled(ticket.id),
                    className: styles.checkbox,
                    title: isBilled ? "Marquer comme non facture" : "Marquer comme facture"
                  }
                ) }),
                /* @__PURE__ */ jsxs("td", { className: `${styles.td} ${styles.bold} ${isBilled ? styles.strikethrough : ""}`, rowSpan, children: [
                  /* @__PURE__ */ jsx("a", { href: `/admin/support/ticket?id=${ticket.id}`, className: styles.ticketLink, children: ticket.ticketNumber }),
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      className: styles.summaryBtn,
                      onClick: () => toggleSummary(ticket.id),
                      title: isExpanded ? "Masquer le detail" : "Afficher le detail IA",
                      children: [
                        isExpanded ? "\u25BC" : "\u25B6",
                        " IA"
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("td", { className: `${styles.tdLeft} ${isBilled ? styles.strikethrough : ""}`, rowSpan, children: [
                  ticket.subject,
                  ticket.hasNoTimeEntries && /* @__PURE__ */ jsx("span", { className: styles.noTimeBadge, title: "Aucun temps saisi sur la periode", children: "\u26A0 Aucun temps saisi" })
                ] })
              ] });
              const rows = [];
              if (ticket.entries.length === 0) {
                rows.push(
                  /* @__PURE__ */ jsxs(
                    "tr",
                    {
                      className: `${isBilled ? styles.tableRowBilled : styles.tableRowNoTime}`,
                      children: [
                        renderTicketHeaderCells(),
                        /* @__PURE__ */ jsx("td", { className: `${styles.td} ${styles.secondary}`, colSpan: 5, children: /* @__PURE__ */ jsx("em", { children: "Pas de saisie de temps. Verifier si du temps a ete oublie." }) })
                      ]
                    },
                    `${ticket.id}-empty`
                  )
                );
              } else {
                ticket.entries.forEach((entry, ei) => {
                  rows.push(
                    /* @__PURE__ */ jsxs(
                      "tr",
                      {
                        className: `${isBilled ? styles.tableRowBilled : styles.tableRow} ${!isBilled && ei % 2 === 0 ? styles.tableRowEven : ""} ${!isBilled && ei % 2 !== 0 ? styles.tableRowOdd : ""}`,
                        children: [
                          ei === 0 ? renderTicketHeaderCells() : null,
                          /* @__PURE__ */ jsx("td", { className: styles.td, children: entry.date }),
                          /* @__PURE__ */ jsx("td", { className: styles.td, children: formatDuration(entry.duration) }),
                          /* @__PURE__ */ jsx("td", { className: `${styles.tdLeft} ${styles.secondary}`, children: entry.description || "-" }),
                          /* @__PURE__ */ jsxs("td", { className: `${styles.td} ${styles.bold}`, children: [
                            formatAmount(entry.duration, rate),
                            " EUR"
                          ] }),
                          ei === 0 ? /* @__PURE__ */ jsx(
                            "td",
                            {
                              className: `${styles.td} ${ticket.billedAmount ? styles.billedAmount : styles.secondary}`,
                              rowSpan: ticket.entries.length,
                              children: ticket.billedAmount ? `${ticket.billedAmount.toFixed(2)} EUR` : "-"
                            }
                          ) : null
                        ]
                      },
                      `${ticket.id}-${ei}`
                    )
                  );
                });
              }
              if (isExpanded) {
                rows.push(
                  /* @__PURE__ */ jsx("tr", { className: styles.summaryRow, children: /* @__PURE__ */ jsxs("td", { colSpan: 8, className: styles.summaryCell, children: [
                    /* @__PURE__ */ jsxs("div", { className: styles.summaryHeader, children: [
                      /* @__PURE__ */ jsx("strong", { children: "Synthese IA des actions" }),
                      /* @__PURE__ */ jsxs("div", { className: styles.summaryActions, children: [
                        ticket.aiSummaryGeneratedAt && /* @__PURE__ */ jsxs("span", { className: styles.summaryMeta, children: [
                          "Genere le ",
                          new Date(ticket.aiSummaryGeneratedAt).toLocaleString("fr-FR")
                        ] }),
                        ticket.aiSummary && /* @__PURE__ */ jsx(
                          "button",
                          {
                            className: styles.summaryAction,
                            onClick: () => copyTicketSummary(ticket),
                            children: "Copier"
                          }
                        ),
                        /* @__PURE__ */ jsx(
                          "button",
                          {
                            className: styles.summaryAction,
                            onClick: () => requestSynthesis(ticket.id, !!ticket.aiSummary),
                            disabled: isRegenerating,
                            children: isRegenerating ? "Generation..." : ticket.aiSummary ? "Regenerer" : "Generer"
                          }
                        )
                      ] })
                    ] }),
                    ticket.aiSummaryStatus === "pending" && !ticket.aiSummary ? /* @__PURE__ */ jsx("div", { className: styles.summaryEmpty, children: 'Generation en cours en arriere-plan. Cliquer sur "Generer" pour forcer.' }) : ticket.aiSummary ? /* @__PURE__ */ jsx("pre", { className: styles.summaryText, children: ticket.aiSummary }) : /* @__PURE__ */ jsx("div", { className: styles.summaryEmpty, children: 'Pas de synthese disponible. La synthese est generee automatiquement quand le ticket passe en "resolu", ou manuellement via le bouton "Generer".' })
                  ] }) }, `${ticket.id}-summary`)
                );
              }
              return rows;
            }) })
          ] })
        ] }, gi)),
        /* @__PURE__ */ jsxs("div", { className: styles.grandTotal, children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("div", { className: styles.totalMeta, children: [
              totalTickets,
              " ticket",
              totalTickets > 1 ? "s" : "",
              " affiche",
              totalTickets > 1 ? "s" : "",
              billedTickets.size > 0 && /* @__PURE__ */ jsxs("span", { className: styles.totalChecked, children: [
                "(",
                allTicketIds.filter((id) => billedTickets.has(id)).length,
                " coche",
                allTicketIds.filter((id) => billedTickets.has(id)).length > 1 ? "s" : "",
                ")"
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: styles.totalAmount, children: [
              "Total : ",
              formatDuration(data.grandTotalMinutes),
              " =",
              " ",
              data.grandTotalBilledAmount > 0 ? `${data.grandTotalBilledAmount.toFixed(2)} EUR` : `${formatAmount(data.grandTotalMinutes, rate)} EUR`
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: styles.totalActions, children: [
            /* @__PURE__ */ jsx("button", { className: allBilled ? styles.btnSecondary : styles.btnGreen, onClick: toggleAll, children: allBilled ? t("billing.totals.uncheckAll") : t("billing.totals.checkAll") }),
            /* @__PURE__ */ jsx("button", { className: copied ? styles.btnSuccess : styles.btnAmber, onClick: copyRecap, children: copied ? t("billing.totals.copiedRecap") : t("billing.totals.copyRecap") })
          ] })
        ] })
      ] })
    ] })
  ] });
};

export { BillingClient };
