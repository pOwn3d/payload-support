'use strict';

const statusLabels = {
  open: { label: "Ouvert", bg: "#dbeafe", color: "#1e40af" },
  waiting_client: { label: "Attente", bg: "#fef3c7", color: "#92400e" },
  resolved: { label: "R\xE9solu", bg: "#dcfce7", color: "#166534" }
};
const projectStatusLabels = {
  active: { label: "Actif", bg: "#dcfce7", color: "#166534" },
  paused: { label: "En pause", bg: "#fef3c7", color: "#92400e" },
  completed: { label: "Termin\xE9", bg: "#e5e7eb", color: "#374151" }
};
const C = {
  blue: "#2563eb",
  amber: "#d97706",
  orange: "#ea580c",
  black: "var(--theme-text)",
  white: "#fff",
  bg: "#fafafa",
  textPrimary: "var(--theme-text)",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e2e8f0",
  statusOpen: "#2563eb",
  statusProgress: "#ea580c",
  statusWaiting: "#d97706",
  statusResolved: "#16a34a",
  statusClosed: "#6b7280",
  adminBg: "#f8fafc",
  adminBorder: "#2563eb",
  clientBg: "#fafafa",
  clientBorder: "#e2e8f0",
  emailBg: "#fffbeb",
  emailBorder: "#ea580c",
  internalBg: "#fefce8",
  internalBorder: "#d97706"
};
const s = {
  section: { borderTop: `1px solid ${C.border}`, paddingTop: "18px", marginTop: "20px" },
  sectionTitle: { fontSize: "14px", fontWeight: 600, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" },
  btn: (bg, disabled) => {
    const hex = bg.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const textColor = luminance > 0.6 ? "#374151" : C.white;
    return {
      padding: "7px 14px",
      borderRadius: "6px",
      border: `1px solid ${C.border}`,
      backgroundColor: bg,
      color: textColor,
      fontWeight: 600,
      fontSize: "13px",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      whiteSpace: "nowrap"
    };
  },
  ghostBtn: (color, disabled) => ({
    padding: "7px 14px",
    borderRadius: "6px",
    border: `1px solid ${C.border}`,
    backgroundColor: "transparent",
    color,
    fontWeight: 600,
    fontSize: "13px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap"
  }),
  outlineBtn: (color, disabled) => ({
    padding: "7px 14px",
    borderRadius: "6px",
    border: `1px solid ${color}`,
    backgroundColor: "transparent",
    color,
    fontWeight: 600,
    fontSize: "13px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap"
  }),
  input: { padding: "8px 12px", borderRadius: "6px", border: `1px solid ${C.border}`, fontSize: "14px", color: "#374151", backgroundColor: C.white },
  badge: (bg, color) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    backgroundColor: bg,
    color
  })
};

exports.C = C;
exports.projectStatusLabels = projectStatusLabels;
exports.s = s;
exports.statusLabels = statusLabels;
