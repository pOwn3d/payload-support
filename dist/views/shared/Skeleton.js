"use client";
import { jsx, jsxs } from 'react/jsx-runtime';
import { useEffect } from 'react';

const styleId = "skeleton-shimmer-style";
function injectSkeletonStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @keyframes skeleton-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}
function Skeleton({ width = "100%", height = "20px", borderRadius = "4px", style }) {
  useEffect(() => {
    injectSkeletonStyles();
  }, []);
  return /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.5s infinite",
        ...style
      }
    }
  );
}
function SkeletonText({ lines = 3, width = "100%" }) {
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: "8px", width }, children: Array.from({ length: lines }).map((_, i) => /* @__PURE__ */ jsx(Skeleton, { height: "16px", width: i === lines - 1 ? "60%" : "100%" }, i)) });
}
function SkeletonCard({ height = "200px" }) {
  return /* @__PURE__ */ jsxs("div", { style: {
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minHeight: height
  }, children: [
    /* @__PURE__ */ jsx(Skeleton, { height: "24px", width: "40%" }),
    /* @__PURE__ */ jsx(SkeletonText, { lines: 3 }),
    /* @__PURE__ */ jsx(Skeleton, { height: "32px", width: "120px", borderRadius: "6px" })
  ] });
}
function SkeletonTable({ rows = 5, columns = 4 }) {
  return /* @__PURE__ */ jsxs("div", { style: { width: "100%" }, children: [
    /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: "16px", padding: "12px 0", borderBottom: "2px solid #e5e7eb" }, children: Array.from({ length: columns }).map((_, i) => /* @__PURE__ */ jsx(Skeleton, { height: "16px", width: `${100 / columns}%` }, i)) }),
    Array.from({ length: rows }).map((_, rowIdx) => /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: "16px", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }, children: Array.from({ length: columns }).map((_2, colIdx) => /* @__PURE__ */ jsx(Skeleton, { height: "14px", width: `${100 / columns}%` }, colIdx)) }, rowIdx))
  ] });
}
function SkeletonDashboard() {
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "24px", padding: "20px 0" }, children: [
    /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }, children: Array.from({ length: 4 }).map((_, i) => /* @__PURE__ */ jsxs("div", { style: { padding: "20px", border: "1px solid #e5e7eb", borderRadius: "8px" }, children: [
      /* @__PURE__ */ jsx(Skeleton, { height: "14px", width: "60%", style: { marginBottom: "8px" } }),
      /* @__PURE__ */ jsx(Skeleton, { height: "32px", width: "40%" })
    ] }, i)) }),
    /* @__PURE__ */ jsx(SkeletonTable, { rows: 5, columns: 4 })
  ] });
}

export { Skeleton, SkeletonCard, SkeletonDashboard, SkeletonTable, SkeletonText };
