"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { C, s } from '../constants.js';

function ClientBar({ client }) {
  return /* @__PURE__ */ jsxs("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 16px",
    borderRadius: "8px",
    backgroundColor: "var(--theme-elevation-100)",
    marginBottom: "16px",
    flexWrap: "wrap"
  }, children: [
    /* @__PURE__ */ jsx("span", { style: { fontSize: "16px" }, children: "\u{1F464}" }),
    /* @__PURE__ */ jsx("span", { style: { fontWeight: 700, fontSize: "13px", color: C.textPrimary }, children: client.company }),
    /* @__PURE__ */ jsxs("span", { style: { color: C.textSecondary, fontSize: "13px" }, children: [
      client.firstName,
      " ",
      client.lastName
    ] }),
    /* @__PURE__ */ jsx("span", { style: { color: C.textMuted, fontSize: "12px" }, children: "|" }),
    /* @__PURE__ */ jsx("a", { href: `mailto:${client.email}`, style: { color: "#2563eb", fontSize: "12px", fontWeight: 600, textDecoration: "none" }, children: client.email }),
    client.phone && /* @__PURE__ */ jsx("span", { style: { color: C.textSecondary, fontSize: "12px" }, children: client.phone }),
    /* @__PURE__ */ jsxs("span", { style: { marginLeft: "auto", display: "inline-flex", gap: "8px", alignItems: "center" }, children: [
      /* @__PURE__ */ jsx("a", { href: `/admin/collections/support-clients/${client.id}`, style: { ...s.ghostBtn("#475569"), fontSize: "11px", padding: "4px 10px", textDecoration: "none" }, children: "Fiche client" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => window.open(`/api/admin/impersonate?clientId=${client.id}`, "_blank"),
          style: { ...s.ghostBtn("#7c3aed"), fontSize: "11px", padding: "4px 10px" },
          title: "Se connecter au portail support en tant que ce client",
          children: "Voir en tant que client"
        }
      )
    ] })
  ] });
}

export { ClientBar };
