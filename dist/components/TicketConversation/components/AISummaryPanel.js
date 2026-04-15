"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { s } from '../constants.js';

function AISummaryPanel({
  showAiSummary,
  setShowAiSummary,
  aiSummary,
  aiGenerating,
  aiSaving,
  aiSaved,
  handleAiGenerate,
  handleAiSave
}) {
  return /* @__PURE__ */ jsxs("div", { style: { marginBottom: "14px" }, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => {
          setShowAiSummary(!showAiSummary);
          if (!showAiSummary && !aiSummary) handleAiGenerate();
        },
        style: {
          ...s.ghostBtn("#7c3aed", false),
          fontSize: "12px",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px"
        },
        children: showAiSummary ? "Masquer la synth\xE8se IA" : "Synth\xE8se IA"
      }
    ),
    showAiSummary && /* @__PURE__ */ jsxs("div", { style: {
      marginTop: "10px",
      padding: "14px 18px",
      borderRadius: "8px",
      backgroundColor: "#faf5ff",
      border: "1px solid #e9d5ff"
    }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }, children: [
        /* @__PURE__ */ jsx("h4", { style: { fontSize: "13px", fontWeight: 600, color: "#7c3aed", margin: 0 }, children: "Synth\xE8se IA" }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "6px" }, children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleAiGenerate,
              disabled: aiGenerating,
              style: { ...s.outlineBtn("#7c3aed", aiGenerating), fontSize: "11px", padding: "4px 10px" },
              children: aiGenerating ? "G\xE9n\xE9ration..." : "R\xE9g\xE9n\xE9rer"
            }
          ),
          aiSummary && !aiGenerating && /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleAiSave,
              disabled: aiSaving || aiSaved,
              style: { ...s.btn(aiSaved ? "#16a34a" : "#2563eb", aiSaving), fontSize: "11px", padding: "4px 10px" },
              children: aiSaved ? "Sauvegard\xE9" : aiSaving ? "Sauvegarde..." : "Sauvegarder (note interne)"
            }
          )
        ] })
      ] }),
      aiGenerating ? /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "center", gap: "10px", color: "#7c3aed", fontSize: "13px" }, children: "Analyse de la conversation en cours..." }) : aiSummary ? /* @__PURE__ */ jsx(
        "div",
        {
          style: { fontSize: "13px", lineHeight: "1.7", color: "#1e1b4b", whiteSpace: "pre-wrap" },
          dangerouslySetInnerHTML: {
            __html: aiSummary.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>")
          }
        }
      ) : /* @__PURE__ */ jsx("p", { style: { color: "#999", fontStyle: "italic", fontSize: "13px", margin: 0 }, children: `Cliquez sur "R\xE9g\xE9n\xE9rer" pour lancer l'analyse` })
    ] })
  ] });
}

export { AISummaryPanel };
