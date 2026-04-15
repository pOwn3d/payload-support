'use strict';

var jsxRuntime = require('react/jsx-runtime');
var constants = require('../constants');

function TimeTrackingPanel({
  timeEntries,
  totalMinutes,
  timerRunning,
  timerSeconds,
  setTimerSeconds,
  timerDescription,
  setTimerDescription,
  handleTimerStart,
  handleTimerStop,
  handleTimerSave,
  handleTimerDiscard,
  duration,
  setDuration,
  timeDescription,
  setTimeDescription,
  handleAddTime,
  addingTime,
  timeSuccess
}) {
  const totalH = Math.floor(totalMinutes / 60);
  const totalM = totalMinutes % 60;
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: constants.s.section, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("h4", { style: constants.s.sectionTitle, children: [
      "Temps",
      totalMinutes > 0 && /* @__PURE__ */ jsxRuntime.jsxs("span", { style: constants.s.badge("#fef3c7", "#92400e"), children: [
        totalH,
        "h",
        String(totalM).padStart(2, "0"),
        " total"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      flexWrap: "wrap",
      padding: "12px 16px",
      borderRadius: "10px",
      marginBottom: "14px",
      backgroundColor: timerRunning ? "#fef2f2" : "var(--theme-elevation-100)",
      border: timerRunning ? "1px solid #fca5a5" : "1px solid var(--theme-elevation-300)"
    }, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { style: {
        fontFamily: "monospace",
        fontSize: "24px",
        fontWeight: 700,
        color: timerRunning ? "#dc2626" : "var(--theme-text)",
        minWidth: "90px"
      }, children: [
        String(Math.floor(timerSeconds / 3600)).padStart(2, "0"),
        ":",
        String(Math.floor(timerSeconds % 3600 / 60)).padStart(2, "0"),
        ":",
        String(timerSeconds % 60).padStart(2, "0")
      ] }),
      !timerRunning && timerSeconds > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { display: "flex", alignItems: "center", gap: "4px" }, children: [-5, -1, 1, 5, 15, 30].map((m) => /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          onClick: () => setTimerSeconds((p) => Math.max(0, p + m * 60)),
          style: { width: Math.abs(m) >= 15 ? "32px" : "28px", height: "28px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontSize: Math.abs(m) >= 15 ? "12px" : "14px", fontWeight: 700, color: "#64748b" },
          title: `${m > 0 ? "+" : ""}${m} min`,
          children: m > 0 ? `+${m}` : String(m)
        },
        m
      )) }),
      !timerRunning && timerSeconds === 0 && /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: () => handleTimerStart(true), style: { ...constants.s.btn("#dc2626", false), fontSize: "12px", padding: "6px 16px", display: "flex", alignItems: "center", gap: "6px" }, children: "\u25B6 D\xE9marrer" }),
      timerRunning && /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: handleTimerStop, style: { ...constants.s.btn("#374151", false), fontSize: "12px", padding: "6px 16px", display: "flex", alignItems: "center", gap: "6px" }, children: "\u23F8 Pause" }),
      !timerRunning && timerSeconds > 0 && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: () => handleTimerStart(false), style: { ...constants.s.btn("#dc2626", false), fontSize: "12px", padding: "6px 14px" }, children: "\u25B6 Reprendre" }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "input",
          {
            type: "text",
            value: timerDescription,
            onChange: (e) => setTimerDescription(e.target.value),
            placeholder: "Description...",
            style: { ...constants.s.input, fontSize: "12px", flex: 1, minWidth: "120px" }
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsxs(
          "button",
          {
            onClick: handleTimerSave,
            disabled: addingTime || timerSeconds < 60,
            style: { ...constants.s.btn("#16a34a", addingTime || timerSeconds < 60), fontSize: "12px", padding: "6px 14px" },
            title: timerSeconds < 60 ? "Minimum 1 minute" : `Sauvegarder ${Math.round(timerSeconds / 60)} min`,
            children: [
              "\u{1F4BE} ",
              Math.round(timerSeconds / 60),
              " min"
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: handleTimerDiscard, style: { background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#94a3b8", padding: "4px" }, title: "Annuler", children: "\u2715" })
      ] }),
      timerRunning && /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: "11px", color: "#dc2626", fontWeight: 600 }, children: "\u25CF Enregistrement en cours \u2014 session maintenue active" })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "14px" }, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("label", { style: { display: "block", fontSize: "11px", color: constants.C.textSecondary, marginBottom: "3px", fontWeight: 600 }, children: "Min" }),
        /* @__PURE__ */ jsxRuntime.jsx("input", { type: "number", min: "1", value: duration, onChange: (e) => setDuration(e.target.value), placeholder: "30", style: { ...constants.s.input, width: "80px" } })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsxRuntime.jsx("label", { style: { display: "block", fontSize: "11px", color: constants.C.textSecondary, marginBottom: "3px", fontWeight: 600 }, children: "Description" }),
        /* @__PURE__ */ jsxRuntime.jsx("input", { type: "text", value: timeDescription, onChange: (e) => setTimeDescription(e.target.value), placeholder: "Travail effectu\xE9...", style: { ...constants.s.input, width: "100%" } })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: handleAddTime, disabled: addingTime || !duration, style: constants.s.btn(constants.C.amber, addingTime || !duration), children: addingTime ? "..." : "+ Temps" }),
      timeSuccess && /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: "12px", color: "#16a34a", fontWeight: 600 }, children: timeSuccess })
    ] }),
    timeEntries.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { fontSize: "12px" }, children: /* @__PURE__ */ jsxRuntime.jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [
      /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsxs("tr", { style: { borderBottom: `1px solid ${constants.C.border}` }, children: [
        /* @__PURE__ */ jsxRuntime.jsx("th", { style: { textAlign: "left", padding: "6px 8px", fontWeight: 600, fontSize: "11px", color: constants.C.textSecondary }, children: "Date" }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { style: { textAlign: "left", padding: "6px 8px", fontWeight: 600, fontSize: "11px", color: constants.C.textSecondary }, children: "Dur\xE9e" }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { style: { textAlign: "left", padding: "6px 8px", fontWeight: 600, fontSize: "11px", color: constants.C.textSecondary }, children: "Description" })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: timeEntries.map((entry) => /* @__PURE__ */ jsxRuntime.jsxs("tr", { style: { borderBottom: "1px solid #f1f5f9" }, children: [
        /* @__PURE__ */ jsxRuntime.jsx("td", { style: { padding: "6px 8px", color: "#374151" }, children: new Date(entry.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("td", { style: { padding: "6px 8px", fontWeight: 600, color: "#374151" }, children: [
          entry.duration,
          " min"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("td", { style: { padding: "6px 8px", color: constants.C.textSecondary }, children: entry.description || "\u2014" })
      ] }, entry.id)) })
    ] }) })
  ] });
}

exports.TimeTrackingPanel = TimeTrackingPanel;
