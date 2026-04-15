"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useRef, useEffect } from 'react';

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "php", label: "PHP" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "yaml", label: "YAML" },
  { value: "xml", label: "XML" },
  { value: "markdown", label: "Markdown" },
  { value: "diff", label: "Diff" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "java", label: "Java" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "docker", label: "Dockerfile" },
  { value: "nginx", label: "Nginx" },
  { value: "env", label: ".env" }
];
function CodeBlockInserter({ onInsert, className, style }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setFilter("");
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);
  const filtered = filter ? LANGUAGES.filter((l) => l.label.toLowerCase().includes(filter.toLowerCase()) || l.value.includes(filter.toLowerCase())) : LANGUAGES;
  const handleSelect = (lang) => {
    onInsert(`
\`\`\`${lang}

\`\`\`
`);
    setOpen(false);
    setFilter("");
  };
  return /* @__PURE__ */ jsxs("div", { ref: dropdownRef, style: { position: "relative", display: "inline-block" }, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => setOpen(!open),
        className,
        style: {
          fontSize: 11,
          fontWeight: 700,
          padding: "4px 10px",
          width: "auto",
          cursor: "pointer",
          ...style
        },
        type: "button",
        "aria-label": "Ins\xE9rer un bloc de code",
        "data-tooltip": "Bloc de code",
        children: "</> Code"
      }
    ),
    open && /* @__PURE__ */ jsxs("div", { style: {
      position: "absolute",
      bottom: "100%",
      left: 0,
      marginBottom: 4,
      width: 200,
      maxHeight: 280,
      backgroundColor: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 8,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      zIndex: 1e3,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column"
    }, children: [
      /* @__PURE__ */ jsx("div", { style: { padding: "8px 8px 4px" }, children: /* @__PURE__ */ jsx(
        "input",
        {
          ref: inputRef,
          type: "text",
          value: filter,
          onChange: (e) => setFilter(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setFilter("");
            }
            if (e.key === "Enter" && filtered.length > 0) handleSelect(filtered[0].value);
          },
          placeholder: "Rechercher...",
          style: {
            width: "100%",
            padding: "6px 10px",
            fontSize: 12,
            backgroundColor: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 6,
            color: "#e2e8f0",
            outline: "none",
            boxSizing: "border-box"
          }
        }
      ) }),
      /* @__PURE__ */ jsxs("div", { style: { overflowY: "auto", maxHeight: 230, padding: "4px 0" }, children: [
        filtered.map((lang) => /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => handleSelect(lang.value),
            style: {
              display: "block",
              width: "100%",
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 500,
              color: "#e2e8f0",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left"
            },
            onMouseEnter: (e) => {
              e.target.style.backgroundColor = "#334155";
            },
            onMouseLeave: (e) => {
              e.target.style.backgroundColor = "transparent";
            },
            type: "button",
            children: lang.label
          },
          lang.value
        )),
        filtered.length === 0 && /* @__PURE__ */ jsx("div", { style: { padding: "12px", fontSize: 12, color: "#64748b", textAlign: "center" }, children: "Aucun langage trouv\xE9" })
      ] })
    ] })
  ] });
}

export { CodeBlockInserter };
