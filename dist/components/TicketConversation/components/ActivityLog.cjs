'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');
var constants = require('../constants');

function ActivityLog({ activityLog }) {
  const [showActivity, setShowActivity] = react.useState(false);
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: constants.s.section, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("h4", { style: { ...constants.s.sectionTitle, cursor: "pointer" }, onClick: () => setShowActivity(!showActivity), children: [
      "Historique ",
      /* @__PURE__ */ jsxRuntime.jsx("span", { style: constants.s.badge("#f1f5f9", "#475569"), children: activityLog.length }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: "12px", color: constants.C.textMuted, transition: "transform 0.2s", display: "inline-block", transform: showActivity ? "rotate(90deg)" : "none" }, children: "\u25B6" })
    ] }),
    showActivity && (activityLog.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { style: { fontSize: "12px", color: constants.C.textMuted, fontStyle: "italic" }, children: "Aucune activit\xE9 enregistr\xE9e." }) : /* @__PURE__ */ jsxRuntime.jsx("div", { style: { fontSize: "12px", display: "flex", flexDirection: "column", gap: "2px", borderLeft: "2px solid #bfdbfe", paddingLeft: "14px", marginLeft: "4px" }, children: activityLog.map((entry) => /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", gap: "10px", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f8fafc" }, children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { style: { color: constants.C.textMuted, fontSize: "11px", whiteSpace: "nowrap", fontWeight: 500 }, children: new Date(entry.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { style: constants.s.badge(entry.actorType === "admin" ? "#eff6ff" : "#dcfce7", entry.actorType === "admin" ? "#1e40af" : "#166534"), children: entry.actorType || "system" }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { style: { color: "#374151", fontWeight: 500 }, children: (entry.detail || entry.action).replace(/\[object Object\]/g, "(utilisateur)") }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { style: { color: constants.C.textMuted, fontSize: "11px" }, children: entry.actorEmail })
    ] }, entry.id)) }))
  ] });
}

exports.ActivityLog = ActivityLog;
