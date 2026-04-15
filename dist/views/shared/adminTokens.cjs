'use strict';

const V = {
  text: "var(--theme-text)",
  textSecondary: "var(--theme-elevation-500)",
  bg: "var(--theme-elevation-50)",
  bgCard: "var(--theme-elevation-100)",
  border: "var(--theme-elevation-300)",
  // Professional palette
  blue: "#2563eb",
  amber: "#d97706",
  orange: "#ea580c",
  green: "#16a34a",
  red: "#dc2626",
  // Legacy aliases (backward compat for views not yet updated)
  cyan: "#2563eb",
  yellow: "#d97706"
};
const btnStyle = (bg, opts) => ({
  padding: opts?.small ? "6px 12px" : "8px 14px",
  borderRadius: 6,
  border: `1px solid var(--theme-elevation-300)`,
  backgroundColor: bg,
  color: "#fff",
  fontWeight: 600,
  fontSize: opts?.small ? 12 : 13,
  cursor: opts?.disabled ? "not-allowed" : "pointer",
  opacity: opts?.disabled ? 0.5 : 1,
  textDecoration: "none",
  whiteSpace: "nowrap"
});

exports.V = V;
exports.btnStyle = btnStyle;
