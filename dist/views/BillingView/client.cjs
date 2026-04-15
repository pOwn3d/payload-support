'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var useTranslation = require('../../components/TicketConversation/hooks/useTranslation');
var styles = require('../../styles/BillingView.module.scss');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);
var styles__default = /*#__PURE__*/_interopDefault(styles);

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
  const { t } = useTranslation.useTranslation();
  const [from, setFrom] = React.useState(() => getMonthRange(0).from);
  const [to, setTo] = React.useState(() => getMonthRange(0).to);
  const [projectId, setProjectId] = React.useState("");
  const [rate, setRate] = React.useState(60);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [projects, setProjects] = React.useState([]);
  const [projectsLoaded, setProjectsLoaded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [billedTickets, setBilledTickets] = React.useState(() => {
    if (typeof window === "undefined") return /* @__PURE__ */ new Set();
    try {
      const saved = localStorage.getItem("billing-checked-tickets");
      return saved ? new Set(JSON.parse(saved)) : /* @__PURE__ */ new Set();
    } catch {
      return /* @__PURE__ */ new Set();
    }
  });
  const toggleBilled = React.useCallback((ticketId) => {
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
  const toggleAll = React.useCallback(() => {
    setBilledTickets((prev) => {
      const ids = data?.groups.flatMap((g) => g.tickets.map((t2) => t2.id)) || [];
      const next = ids.every((id) => prev.has(id)) ? /* @__PURE__ */ new Set() : new Set(ids);
      localStorage.setItem("billing-checked-tickets", JSON.stringify([...next]));
      return next;
    });
  }, [data]);
  const loadProjects = React.useCallback(async () => {
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
  React__default.default.useEffect(() => {
    loadProjects();
  }, [loadProjects]);
  const fetchBilling = React.useCallback(async () => {
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
  const copyRecap = React.useCallback(() => {
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
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.page, children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.header, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntime.jsx("h1", { className: styles__default.default.title, children: t("billing.title") }),
      /* @__PURE__ */ jsxRuntime.jsx("p", { className: styles__default.default.subtitle, children: t("billing.subtitle") })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.filters, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.quickPeriod, children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: styles__default.default.btnPrimary, onClick: () => setPeriod(getMonthRange(0)), children: t("billing.filters.thisMonth") }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: styles__default.default.btnSecondary, onClick: () => setPeriod(getMonthRange(-1)), children: t("billing.filters.lastMonth") }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: styles__default.default.btnAmber, onClick: () => setPeriod(getQuarterRange(0)), children: t("billing.filters.thisQuarter") }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: styles__default.default.btnMuted, onClick: () => setPeriod(getQuarterRange(-1)), children: t("billing.filters.lastQuarter") })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.filterRow, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.fieldGroup, children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: styles__default.default.label, children: t("billing.filters.from") }),
          /* @__PURE__ */ jsxRuntime.jsx("input", { type: "date", value: from, onChange: (e) => setFrom(e.target.value), className: styles__default.default.input })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.fieldGroup, children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: styles__default.default.label, children: t("billing.filters.to") }),
          /* @__PURE__ */ jsxRuntime.jsx("input", { type: "date", value: to, onChange: (e) => setTo(e.target.value), className: styles__default.default.input })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.fieldGroup, children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: styles__default.default.label, children: t("billing.filters.project") }),
          /* @__PURE__ */ jsxRuntime.jsxs(
            "select",
            {
              value: projectId,
              onChange: (e) => setProjectId(e.target.value),
              className: styles__default.default.select,
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "", children: t("ticket.allProjects") }),
                projects.map((p) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: p.id, children: p.name }, p.id))
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.fieldGroup, children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: styles__default.default.label, children: t("billing.filters.hourlyRate") }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.rateRow, children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                type: "number",
                value: rate,
                onChange: (e) => setRate(Number(e.target.value)),
                className: styles__default.default.rateInput,
                min: 0
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.rateUnit, children: t("billing.filters.rateUnit") })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            className: styles__default.default.btnPrimary,
            onClick: fetchBilling,
            disabled: loading,
            children: loading ? t("billing.filters.loading") : t("billing.filters.load")
          }
        )
      ] })
    ] }),
    data && /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: data.groups.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.empty, children: t("billing.empty") }) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      data.groups.map((group, gi) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.groupCard, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.groupHeader, children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.groupName, children: group.project?.name || "Sans projet" }),
            group.client?.company && /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.groupClient, children: [
              "\u2014 ",
              group.client.company
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.groupTotals, children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.groupDuration, children: formatDuration(group.totalMinutes) }),
            group.totalBilledAmount > 0 ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.groupAmountBilled, children: [
                group.totalBilledAmount.toFixed(2),
                " EUR facture"
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.groupAmountStrike, children: [
                formatAmount(group.totalMinutes, rate),
                " EUR (temps)"
              ] })
            ] }) : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.groupAmount, children: [
              formatAmount(group.totalMinutes, rate),
              " EUR"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("table", { className: styles__default.default.table, children: [
          /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("th", { className: styles__default.default.thCheckbox, children: /* @__PURE__ */ jsxRuntime.jsx(
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
                className: styles__default.default.checkbox,
                title: "Tout cocher/decocher"
              }
            ) }),
            /* @__PURE__ */ jsxRuntime.jsx("th", { className: styles__default.default.th, children: "N\xB0 Ticket" }),
            /* @__PURE__ */ jsxRuntime.jsx("th", { className: styles__default.default.thLeft, children: "Sujet" }),
            /* @__PURE__ */ jsxRuntime.jsx("th", { className: styles__default.default.th, children: "Date" }),
            /* @__PURE__ */ jsxRuntime.jsx("th", { className: styles__default.default.th, children: "Duree" }),
            /* @__PURE__ */ jsxRuntime.jsx("th", { className: styles__default.default.thLeft, children: "Description" }),
            /* @__PURE__ */ jsxRuntime.jsx("th", { className: styles__default.default.th, children: "Montant" }),
            /* @__PURE__ */ jsxRuntime.jsx("th", { className: styles__default.default.th, children: "Facture" })
          ] }) }),
          /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: group.tickets.map((ticket) => {
            const isBilled = billedTickets.has(ticket.id);
            return ticket.entries.map((entry, ei) => /* @__PURE__ */ jsxRuntime.jsxs(
              "tr",
              {
                className: `${isBilled ? styles__default.default.tableRowBilled : styles__default.default.tableRow} ${!isBilled && ei % 2 === 0 ? styles__default.default.tableRowEven : ""} ${!isBilled && ei % 2 !== 0 ? styles__default.default.tableRowOdd : ""}`,
                children: [
                  ei === 0 ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntime.jsx("td", { className: styles__default.default.td, rowSpan: ticket.entries.length, style: { verticalAlign: "middle" }, children: /* @__PURE__ */ jsxRuntime.jsx(
                      "input",
                      {
                        type: "checkbox",
                        checked: isBilled,
                        onChange: () => toggleBilled(ticket.id),
                        className: styles__default.default.checkbox,
                        title: isBilled ? "Marquer comme non facture" : "Marquer comme facture"
                      }
                    ) }),
                    /* @__PURE__ */ jsxRuntime.jsx("td", { className: `${styles__default.default.td} ${styles__default.default.bold} ${isBilled ? styles__default.default.strikethrough : ""}`, rowSpan: ticket.entries.length, children: /* @__PURE__ */ jsxRuntime.jsx(
                      "a",
                      {
                        href: `/admin/support/ticket?id=${ticket.id}`,
                        className: styles__default.default.ticketLink,
                        children: ticket.ticketNumber
                      }
                    ) }),
                    /* @__PURE__ */ jsxRuntime.jsx("td", { className: `${styles__default.default.tdLeft} ${isBilled ? styles__default.default.strikethrough : ""}`, rowSpan: ticket.entries.length, children: ticket.subject })
                  ] }) : null,
                  /* @__PURE__ */ jsxRuntime.jsx("td", { className: styles__default.default.td, children: entry.date }),
                  /* @__PURE__ */ jsxRuntime.jsx("td", { className: styles__default.default.td, children: formatDuration(entry.duration) }),
                  /* @__PURE__ */ jsxRuntime.jsx("td", { className: `${styles__default.default.tdLeft} ${styles__default.default.secondary}`, children: entry.description || "-" }),
                  /* @__PURE__ */ jsxRuntime.jsxs("td", { className: `${styles__default.default.td} ${styles__default.default.bold}`, children: [
                    formatAmount(entry.duration, rate),
                    " EUR"
                  ] }),
                  ei === 0 ? /* @__PURE__ */ jsxRuntime.jsx(
                    "td",
                    {
                      className: `${styles__default.default.td} ${ticket.billedAmount ? styles__default.default.billedAmount : styles__default.default.secondary}`,
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
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.grandTotal, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.totalMeta, children: [
            totalTickets,
            " ticket",
            totalTickets > 1 ? "s" : "",
            " facturable",
            totalTickets > 1 ? "s" : "",
            billedTickets.size > 0 && /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.totalChecked, children: [
              "(",
              allTicketIds.filter((id) => billedTickets.has(id)).length,
              " coche",
              allTicketIds.filter((id) => billedTickets.has(id)).length > 1 ? "s" : "",
              ")"
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.totalAmount, children: [
            "Total : ",
            formatDuration(data.grandTotalMinutes),
            " =",
            " ",
            data.grandTotalBilledAmount > 0 ? `${data.grandTotalBilledAmount.toFixed(2)} EUR` : `${formatAmount(data.grandTotalMinutes, rate)} EUR`
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.totalActions, children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              className: allBilled ? styles__default.default.btnSecondary : styles__default.default.btnGreen,
              onClick: toggleAll,
              children: allBilled ? t("billing.totals.uncheckAll") : t("billing.totals.checkAll")
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              className: copied ? styles__default.default.btnSuccess : styles__default.default.btnAmber,
              onClick: copyRecap,
              children: copied ? t("billing.totals.copiedRecap") : t("billing.totals.copyRecap")
            }
          )
        ] })
      ] })
    ] }) })
  ] });
};

exports.BillingClient = BillingClient;
