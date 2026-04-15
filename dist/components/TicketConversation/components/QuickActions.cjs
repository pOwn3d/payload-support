'use strict';

var jsxRuntime = require('react/jsx-runtime');
var constants = require('../constants');

function QuickActions({
  statusTransitions,
  statusUpdating,
  onStatusChange,
  snoozeUntil,
  snoozeSaving,
  onCancelSnooze,
  showMerge: _showMerge,
  showExtMsg: _showExtMsg,
  showSnooze: _showSnooze,
  onToggleMerge,
  onToggleExtMsg,
  onToggleSnooze,
  onNextTicket,
  showNextTicket,
  nextTicketId,
  nextTicketInfo,
  onCloseNextTicket
}) {
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px", alignItems: "center" }, children: [
      statusTransitions.map((a) => /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          onClick: () => onStatusChange(a.status),
          disabled: statusUpdating,
          style: constants.s.outlineBtn(a.color, statusUpdating),
          children: a.label
        },
        a.status
      )),
      snoozeUntil && new Date(snoozeUntil) > /* @__PURE__ */ new Date() && /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: onCancelSnooze, disabled: snoozeSaving, style: { ...constants.s.ghostBtn("#7c3aed", snoozeSaving), fontSize: "12px", padding: "5px 10px" }, children: "Annuler snooze" }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { style: { borderLeft: `1px solid ${constants.C.border}`, height: "20px", margin: "0 4px" } }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: onToggleMerge, style: constants.s.ghostBtn("#be185d"), children: "Fusionner" }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: onToggleExtMsg, style: constants.s.ghostBtn("#4f46e5"), children: "+ Message re\xE7u" }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: onToggleSnooze, style: constants.s.ghostBtn("#7c3aed"), children: "Snooze" }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: onNextTicket, style: constants.s.ghostBtn("#16a34a"), children: "Ticket suivant" })
    ] }),
    showNextTicket && /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { padding: "10px 14px", borderRadius: "8px", backgroundColor: "#f0fdf4", border: `1px solid ${constants.C.border}`, marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
      nextTicketId ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsxs("span", { style: { fontSize: "13px", color: "#166534", fontWeight: 600 }, children: [
          "Ticket suivant : ",
          /* @__PURE__ */ jsxRuntime.jsx("strong", { children: nextTicketInfo })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            onClick: () => {
              window.location.href = `/admin/support/ticket?id=${nextTicketId}`;
            },
            style: { ...constants.s.btn(constants.C.statusResolved), color: constants.C.white, fontSize: "12px", padding: "5px 14px" },
            children: "Ouvrir"
          }
        )
      ] }) : /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: "13px", color: "#166534", fontWeight: 700 }, children: nextTicketInfo }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: onCloseNextTicket, style: { border: "none", background: "none", color: constants.C.textMuted, cursor: "pointer", fontSize: "16px", fontWeight: 700, marginLeft: "8px" }, children: "\xD7" })
    ] })
  ] });
}

exports.QuickActions = QuickActions;
