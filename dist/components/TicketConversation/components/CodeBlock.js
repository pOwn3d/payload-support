"use client";
import { jsx, Fragment, jsxs } from 'react/jsx-runtime';
import { useState } from 'react';

const LANG_CONFIG = {
  javascript: { label: "JavaScript", accent: "#f7df1e" },
  js: { label: "JavaScript", accent: "#f7df1e" },
  typescript: { label: "TypeScript", accent: "#3178c6" },
  ts: { label: "TypeScript", accent: "#3178c6" },
  tsx: { label: "TSX", accent: "#3178c6" },
  jsx: { label: "JSX", accent: "#f7df1e" },
  php: { label: "PHP", accent: "#777bb4" },
  python: { label: "Python", accent: "#3776ab" },
  py: { label: "Python", accent: "#3776ab" },
  html: { label: "HTML", accent: "#e34f26" },
  css: { label: "CSS", accent: "#1572b6" },
  scss: { label: "SCSS", accent: "#cc6699" },
  json: { label: "JSON", accent: "#292929" },
  sql: { label: "SQL", accent: "#e48e00" },
  bash: { label: "Bash", accent: "#4eaa25" },
  sh: { label: "Shell", accent: "#4eaa25" },
  yaml: { label: "YAML", accent: "#cb171e" },
  yml: { label: "YAML", accent: "#cb171e" },
  xml: { label: "XML", accent: "#f16529" },
  markdown: { label: "Markdown", accent: "#083fa1" },
  md: { label: "Markdown", accent: "#083fa1" },
  diff: { label: "Diff", accent: "#41b883" },
  go: { label: "Go", accent: "#00add8" },
  rust: { label: "Rust", accent: "#dea584" },
  java: { label: "Java", accent: "#ed8b00" },
  c: { label: "C", accent: "#555555" },
  cpp: { label: "C++", accent: "#00599c" },
  ruby: { label: "Ruby", accent: "#cc342d" },
  swift: { label: "Swift", accent: "#f05138" },
  nginx: { label: "Nginx", accent: "#009639" },
  docker: { label: "Docker", accent: "#2496ed" },
  dockerfile: { label: "Dockerfile", accent: "#2496ed" },
  env: { label: ".env", accent: "#ecd53f" }
};
const DEFAULT_CONFIG = { label: "Code", accent: "#6b7280" };
function SingleCodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false);
  const config = LANG_CONFIG[lang.toLowerCase()] || (lang ? { label: lang.toUpperCase(), accent: "#6b7280" } : DEFAULT_CONFIG);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const lines = code.split("\n");
  return /* @__PURE__ */ jsxs("div", { style: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    fontSize: 13
  }, children: [
    /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 12px",
      backgroundColor: "#1e293b",
      borderBottom: "1px solid #334155"
    }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsx("span", { style: {
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: config.accent,
          flexShrink: 0
        } }),
        /* @__PURE__ */ jsx("span", { style: {
          fontSize: 11,
          fontWeight: 700,
          color: "#e2e8f0",
          letterSpacing: "0.02em"
        }, children: config.label })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleCopy,
          style: {
            background: "none",
            border: "1px solid #475569",
            borderRadius: 4,
            padding: "2px 10px",
            fontSize: 11,
            color: copied ? "#4ade80" : "#94a3b8",
            cursor: "pointer",
            fontWeight: 600,
            transition: "color 150ms"
          },
          children: copied ? "Copi\xE9 !" : "Copier"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", overflowX: "auto" }, children: [
      /* @__PURE__ */ jsx("div", { style: {
        padding: "12px 0",
        borderRight: "1px solid #334155",
        userSelect: "none",
        flexShrink: 0
      }, children: lines.map((_, i) => /* @__PURE__ */ jsx("div", { style: {
        padding: "0 12px",
        fontSize: 12,
        lineHeight: "20px",
        color: "#475569",
        textAlign: "right",
        fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", monospace'
      }, children: i + 1 }, i)) }),
      /* @__PURE__ */ jsx("pre", { style: {
        margin: 0,
        padding: 12,
        overflow: "auto",
        flex: 1
      }, children: /* @__PURE__ */ jsx("code", { style: {
        fontSize: 12,
        lineHeight: "20px",
        fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", monospace',
        color: "#e2e8f0",
        whiteSpace: "pre"
      }, children: code }) })
    ] })
  ] });
}
function CodeBlockRenderer({ text }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  const hasCodeBlock = parts.some((p) => p.startsWith("```"));
  if (!hasCodeBlock) return null;
  return /* @__PURE__ */ jsx(Fragment, { children: parts.map((part, i) => {
    if (part.startsWith("```")) {
      const match = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      if (match) {
        const lang = match[1] || "";
        const code = match[2].replace(/\n$/, "");
        return /* @__PURE__ */ jsx(SingleCodeBlock, { lang, code }, i);
      }
    }
    return null;
  }) });
}
function CodeBlockRendererHtml({ html }) {
  const stripped = html.replace(/<[^>]+>/g, "");
  return /* @__PURE__ */ jsx(CodeBlockRenderer, { text: stripped });
}

export { CodeBlockRenderer, CodeBlockRendererHtml };
