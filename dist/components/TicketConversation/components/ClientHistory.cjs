'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');
var constants = require('../constants');

function ClientHistory({
  client: _client,
  clientTickets,
  clientProjects,
  clientNotes,
  onNotesChange,
  onNotesSave,
  savingNotes,
  notesSaved
}) {
  const [showClientHistory, setShowClientHistory] = react.useState(false);
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: constants.s.section, children: [
    /* @__PURE__ */ jsxRuntime.jsxs(
      "button",
      {
        type: "button",
        onClick: () => setShowClientHistory(!showClientHistory),
        style: {
          background: "none",
          border: `1px dashed ${constants.C.border}`,
          borderRadius: "6px",
          padding: "8px 14px",
          cursor: "pointer",
          color: constants.C.textSecondary,
          fontSize: "13px",
          fontWeight: 600,
          width: "100%",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        },
        children: [
          /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
            "Historique client (",
            clientTickets.length,
            " ticket",
            clientTickets.length !== 1 ? "s" : "",
            ", ",
            clientProjects.length,
            " projet",
            clientProjects.length !== 1 ? "s" : "",
            ")"
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: "12px", transition: "transform 0.2s", display: "inline-block", transform: showClientHistory ? "rotate(90deg)" : "none" }, children: "\u25B6" })
        ]
      }
    ),
    showClientHistory && /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { marginTop: "10px", padding: "14px 18px", borderRadius: "8px", backgroundColor: constants.C.white, border: `1px solid ${constants.C.border}` }, children: [
      /* @__PURE__ */ jsxRuntime.jsx("h5", { style: { fontSize: "12px", fontWeight: 600, color: constants.C.textSecondary, marginBottom: "8px" }, children: "Derniers tickets" }),
      clientTickets.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { style: { fontSize: "12px", color: constants.C.textMuted, fontStyle: "italic", marginBottom: "14px" }, children: "Aucun autre ticket" }) : /* @__PURE__ */ jsxRuntime.jsx("div", { style: { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "14px" }, children: clientTickets.map((t) => {
        const st = constants.statusLabels[t.status] || constants.statusLabels.open;
        return /* @__PURE__ */ jsxRuntime.jsxs(
          "a",
          {
            href: `/admin/support/ticket?id=${t.id}`,
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: `1px solid ${constants.C.border}`,
              textDecoration: "none",
              fontSize: "12px",
              color: "#374151",
              backgroundColor: "#fafafa"
            },
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace", fontWeight: 600, color: constants.C.textMuted, fontSize: "11px", whiteSpace: "nowrap" }, children: t.ticketNumber }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }, children: t.subject }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { style: constants.s.badge(st.bg, st.color), children: st.label }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: "10px", color: constants.C.textMuted, whiteSpace: "nowrap" }, children: new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) })
            ]
          },
          t.id
        );
      }) }),
      /* @__PURE__ */ jsxRuntime.jsx("h5", { style: { fontSize: "12px", fontWeight: 600, color: constants.C.textSecondary, marginBottom: "8px" }, children: "Projets" }),
      clientProjects.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { style: { fontSize: "12px", color: constants.C.textMuted, fontStyle: "italic", marginBottom: "14px" }, children: "Aucun projet" }) : /* @__PURE__ */ jsxRuntime.jsx("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }, children: clientProjects.map((p) => {
        const ps = constants.projectStatusLabels[p.status] || constants.projectStatusLabels.active;
        return /* @__PURE__ */ jsxRuntime.jsxs(
          "a",
          {
            href: `/admin/collections/projects/${p.id}`,
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              borderRadius: "6px",
              border: `1px solid ${constants.C.border}`,
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 600,
              color: "#374151",
              backgroundColor: "#fafafa"
            },
            children: [
              p.name,
              /* @__PURE__ */ jsxRuntime.jsx("span", { style: constants.s.badge(ps.bg, ps.color), children: ps.label })
            ]
          },
          p.id
        );
      }) }),
      /* @__PURE__ */ jsxRuntime.jsx("h5", { style: { fontSize: "12px", fontWeight: 600, color: constants.C.textSecondary, marginBottom: "8px" }, children: "Notes internes" }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "textarea",
        {
          value: clientNotes,
          onChange: (e) => onNotesChange(e.target.value),
          rows: 3,
          style: { ...constants.s.input, width: "100%", resize: "vertical", fontSize: "12px", marginBottom: "8px" },
          placeholder: "Notes sur ce client..."
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          type: "button",
          onClick: onNotesSave,
          disabled: savingNotes,
          style: { ...constants.s.btn(notesSaved ? "#16a34a" : constants.C.blue, savingNotes), fontSize: "11px", padding: "5px 12px" },
          children: notesSaved ? "Sauvegarde OK" : savingNotes ? "Sauvegarde..." : "Sauvegarder les notes"
        }
      )
    ] })
  ] });
}

exports.ClientHistory = ClientHistory;
