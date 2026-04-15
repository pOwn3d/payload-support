"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState } from 'react';
import { s, C, statusLabels, projectStatusLabels } from '../constants.js';

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
  const [showClientHistory, setShowClientHistory] = useState(false);
  return /* @__PURE__ */ jsxs("div", { style: s.section, children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => setShowClientHistory(!showClientHistory),
        style: {
          background: "none",
          border: `1px dashed ${C.border}`,
          borderRadius: "6px",
          padding: "8px 14px",
          cursor: "pointer",
          color: C.textSecondary,
          fontSize: "13px",
          fontWeight: 600,
          width: "100%",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        },
        children: [
          /* @__PURE__ */ jsxs("span", { children: [
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
          /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", transition: "transform 0.2s", display: "inline-block", transform: showClientHistory ? "rotate(90deg)" : "none" }, children: "\u25B6" })
        ]
      }
    ),
    showClientHistory && /* @__PURE__ */ jsxs("div", { style: { marginTop: "10px", padding: "14px 18px", borderRadius: "8px", backgroundColor: C.white, border: `1px solid ${C.border}` }, children: [
      /* @__PURE__ */ jsx("h5", { style: { fontSize: "12px", fontWeight: 600, color: C.textSecondary, marginBottom: "8px" }, children: "Derniers tickets" }),
      clientTickets.length === 0 ? /* @__PURE__ */ jsx("p", { style: { fontSize: "12px", color: C.textMuted, fontStyle: "italic", marginBottom: "14px" }, children: "Aucun autre ticket" }) : /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "14px" }, children: clientTickets.map((t) => {
        const st = statusLabels[t.status] || statusLabels.open;
        return /* @__PURE__ */ jsxs(
          "a",
          {
            href: `/admin/support/ticket?id=${t.id}`,
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: `1px solid ${C.border}`,
              textDecoration: "none",
              fontSize: "12px",
              color: "#374151",
              backgroundColor: "#fafafa"
            },
            children: [
              /* @__PURE__ */ jsx("span", { style: { fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace", fontWeight: 600, color: C.textMuted, fontSize: "11px", whiteSpace: "nowrap" }, children: t.ticketNumber }),
              /* @__PURE__ */ jsx("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }, children: t.subject }),
              /* @__PURE__ */ jsx("span", { style: s.badge(st.bg, st.color), children: st.label }),
              /* @__PURE__ */ jsx("span", { style: { fontSize: "10px", color: C.textMuted, whiteSpace: "nowrap" }, children: new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) })
            ]
          },
          t.id
        );
      }) }),
      /* @__PURE__ */ jsx("h5", { style: { fontSize: "12px", fontWeight: 600, color: C.textSecondary, marginBottom: "8px" }, children: "Projets" }),
      clientProjects.length === 0 ? /* @__PURE__ */ jsx("p", { style: { fontSize: "12px", color: C.textMuted, fontStyle: "italic", marginBottom: "14px" }, children: "Aucun projet" }) : /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }, children: clientProjects.map((p) => {
        const ps = projectStatusLabels[p.status] || projectStatusLabels.active;
        return /* @__PURE__ */ jsxs(
          "a",
          {
            href: `/admin/collections/projects/${p.id}`,
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              borderRadius: "6px",
              border: `1px solid ${C.border}`,
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 600,
              color: "#374151",
              backgroundColor: "#fafafa"
            },
            children: [
              p.name,
              /* @__PURE__ */ jsx("span", { style: s.badge(ps.bg, ps.color), children: ps.label })
            ]
          },
          p.id
        );
      }) }),
      /* @__PURE__ */ jsx("h5", { style: { fontSize: "12px", fontWeight: 600, color: C.textSecondary, marginBottom: "8px" }, children: "Notes internes" }),
      /* @__PURE__ */ jsx(
        "textarea",
        {
          value: clientNotes,
          onChange: (e) => onNotesChange(e.target.value),
          rows: 3,
          style: { ...s.input, width: "100%", resize: "vertical", fontSize: "12px", marginBottom: "8px" },
          placeholder: "Notes sur ce client..."
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: onNotesSave,
          disabled: savingNotes,
          style: { ...s.btn(notesSaved ? "#16a34a" : C.blue, savingNotes), fontSize: "11px", padding: "5px 12px" },
          children: notesSaved ? "Sauvegarde OK" : savingNotes ? "Sauvegarde..." : "Sauvegarder les notes"
        }
      )
    ] })
  ] });
}

export { ClientHistory };
