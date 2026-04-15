'use strict';

var jsxRuntime = require('react/jsx-runtime');
var constants = require('../constants');

const sourceLabels = {
  email: "Email",
  "live-chat": "Live Chat",
  portal: "Portail",
  admin: "Admin"
};
function TicketHeader({
  ticketNumber,
  currentStatus,
  clientSentiment,
  ticketSource,
  chatSession,
  snoozeUntil,
  satisfaction,
  copiedLink,
  onCopyLink
}) {
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    borderRadius: "8px",
    backgroundColor: "var(--theme-elevation-100)",
    marginBottom: "12px",
    flexWrap: "wrap"
  }, children: [
    ticketNumber && /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace", fontWeight: 700, fontSize: "14px", color: constants.C.textPrimary }, children: ticketNumber }),
    currentStatus && (() => {
      const st = constants.statusLabels[currentStatus] || constants.statusLabels.open;
      return /* @__PURE__ */ jsxRuntime.jsx("span", { style: constants.s.badge(st.bg, st.color), children: st.label });
    })(),
    clientSentiment && /* @__PURE__ */ jsxRuntime.jsxs(
      "span",
      {
        style: { ...constants.s.badge(`${clientSentiment.color}15`, clientSentiment.color), fontSize: "11px" },
        title: `Sentiment : ${clientSentiment.label}`,
        children: [
          clientSentiment.emoji,
          " ",
          clientSentiment.label
        ]
      }
    ),
    ticketSource && ticketSource !== "portal" && /* @__PURE__ */ jsxRuntime.jsx("span", { style: constants.s.badge("#f1f5f9", "#475569"), children: sourceLabels[ticketSource] || ticketSource }),
    chatSession && ticketSource === "live-chat" && /* @__PURE__ */ jsxRuntime.jsxs("span", { style: { fontSize: "11px", color: constants.C.textMuted }, children: [
      "Session : ",
      chatSession.slice(0, 16),
      "..."
    ] }),
    snoozeUntil && new Date(snoozeUntil) > /* @__PURE__ */ new Date() && /* @__PURE__ */ jsxRuntime.jsxs("span", { style: constants.s.badge("#f5f3ff", "#7c3aed"), children: [
      "Snooz\xE9 ",
      new Date(snoozeUntil).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    ] }),
    satisfaction && /* @__PURE__ */ jsxRuntime.jsxs("span", { style: constants.s.badge(
      satisfaction.rating >= 4 ? "#dcfce7" : satisfaction.rating >= 3 ? "#fef9c3" : "#fee2e2",
      satisfaction.rating >= 4 ? "#166534" : satisfaction.rating >= 3 ? "#854d0e" : "#991b1b"
    ), children: [
      Array.from({ length: 5 }, (_, i) => i < satisfaction.rating ? "\u2605" : "\u2606").join(""),
      " ",
      satisfaction.rating,
      "/5"
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("span", { style: { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "4px" }, children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          onClick: () => onCopyLink("admin"),
          title: "Copier le lien admin",
          style: { background: "none", border: "none", cursor: "pointer", fontSize: "13px", opacity: copiedLink === "admin" ? 1 : 0.5, padding: "2px 4px" },
          children: copiedLink === "admin" ? "\u2705" : "\u{1F4CB}"
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          onClick: () => onCopyLink("client"),
          title: "Copier le lien client",
          style: { background: "none", border: "none", cursor: "pointer", fontSize: "13px", opacity: copiedLink === "client" ? 1 : 0.5, padding: "2px 4px" },
          children: copiedLink === "client" ? "\u2705" : "\u{1F517}"
        }
      ),
      copiedLink && /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: "11px", color: "#16a34a", fontWeight: 600 }, children: "Copi\xE9" })
    ] })
  ] });
}

exports.TicketHeader = TicketHeader;
