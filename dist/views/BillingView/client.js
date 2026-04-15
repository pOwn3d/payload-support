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
  const allTicketIds = data?.groups.flatMap((g) => g.tickets.map((t2) => t2.id)) || [];
  const allBilled = allTicketIds.length > 0 && allTicketIds.every((id) => billedTickets.has(id));
  const toggleAll = useCallback(() => {
    setBilledTickets((prev) => {
      const ids = data?.groups.flatMap((g) => g.tickets.map((t2) => t2.id)) || [];
      const next = ids.every((id) => prev.has(id)) ? /* @__PURE__ */ new Set() : new Set(ids);
      localStorage.setItem("billing-checked-tickets", JSON.stringify([...next]));
      return next;
    });
  }, [data]);
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
  const copyRecap = useCallback(() => {
    if (!data) return;
    const lines = [];
    lines.push(`PRE-FACTURATION \u2014 Du ${from} au ${to}`);
    lines.push(`Taux horaire : ${rate} EUR/h`);
    lines.push("=".repeat(50));
    for (const group of data.groups) {
      lines.push("");
      lines.push(`PROJET : ${group.project?.name || "Sans projet"}`);
      if (group.client?.company) lines.push(`Client : ${group.client.company}`);
      lines.push("-".repeat(40));
      for (const ticket of group.tickets) {
        lines.push(`  ${ticket.ticketNumber} \u2014 ${ticket.subject}`);
        for (const entry of ticket.entries) {
          lines.push(`    ${entry.date} | ${formatDuration(entry.duration)} | ${entry.description || "-"}`);
        }
        const ticketAmount = ticket.billedAmount || Number(formatAmount(ticket.totalMinutes, rate));
        lines.push(`    Sous-total : ${formatDuration(ticket.totalMinutes)} = ${ticketAmount.toFixed(2)} EUR${ticket.billedAmount ? " (forfait)" : ""}`);
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
  }, [data, from, to, rate]);
  const totalTickets = data?.groups.reduce((sum, g) => sum + g.tickets.length, 0) || 0;
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
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: projectId,
              onChange: (e) => setProjectId(e.target.value),
              className: styles.select,
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: t("ticket.allProjects") }),
                projects.map((p) => /* @__PURE__ */ jsx("option", { value: p.id, children: p.name }, p.id))
              ]
            }
          )
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
        /* @__PURE__ */ jsx(
          "button",
          {
            className: styles.btnPrimary,
            onClick: fetchBilling,
            disabled: loading,
            children: loading ? t("billing.filters.loading") : t("billing.filters.load")
          }
        )
      ] })
    ] }),
    data && /* @__PURE__ */ jsx(Fragment, { children: data.groups.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.empty, children: t("billing.empty") }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      data.groups.map((group, gi) => /* @__PURE__ */ jsxs("div", { className: styles.groupCard, children: [
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
            return ticket.entries.map((entry, ei) => /* @__PURE__ */ jsxs(
              "tr",
              {
                className: `${isBilled ? styles.tableRowBilled : styles.tableRow} ${!isBilled && ei % 2 === 0 ? styles.tableRowEven : ""} ${!isBilled && ei % 2 !== 0 ? styles.tableRowOdd : ""}`,
                children: [
                  ei === 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx("td", { className: styles.td, rowSpan: ticket.entries.length, style: { verticalAlign: "middle" }, children: /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "checkbox",
                        checked: isBilled,
                        onChange: () => toggleBilled(ticket.id),
                        className: styles.checkbox,
                        title: isBilled ? "Marquer comme non facture" : "Marquer comme facture"
                      }
                    ) }),
                    /* @__PURE__ */ jsx("td", { className: `${styles.td} ${styles.bold} ${isBilled ? styles.strikethrough : ""}`, rowSpan: ticket.entries.length, children: /* @__PURE__ */ jsx(
                      "a",
                      {
                        href: `/admin/support/ticket?id=${ticket.id}`,
                        className: styles.ticketLink,
                        children: ticket.ticketNumber
                      }
                    ) }),
                    /* @__PURE__ */ jsx("td", { className: `${styles.tdLeft} ${isBilled ? styles.strikethrough : ""}`, rowSpan: ticket.entries.length, children: ticket.subject })
                  ] }) : null,
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
            ));
          }) })
        ] })
      ] }, gi)),
      /* @__PURE__ */ jsxs("div", { className: styles.grandTotal, children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("div", { className: styles.totalMeta, children: [
            totalTickets,
            " ticket",
            totalTickets > 1 ? "s" : "",
            " facturable",
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
          /* @__PURE__ */ jsx(
            "button",
            {
              className: allBilled ? styles.btnSecondary : styles.btnGreen,
              onClick: toggleAll,
              children: allBilled ? t("billing.totals.uncheckAll") : t("billing.totals.checkAll")
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              className: copied ? styles.btnSuccess : styles.btnAmber,
              onClick: copyRecap,
              children: copied ? t("billing.totals.copiedRecap") : t("billing.totals.copyRecap")
            }
          )
        ] })
      ] })
    ] }) })
  ] });
};

export { BillingClient };
