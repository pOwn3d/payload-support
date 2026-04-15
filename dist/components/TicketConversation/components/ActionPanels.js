"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { useRef } from 'react';
import { s } from '../constants.js';

function MergePanel({
  mergeTarget,
  setMergeTarget,
  mergeTargetInfo,
  setMergeTargetInfo,
  mergeError,
  setMergeError,
  merging,
  handleMergeLookup,
  handleMerge
}) {
  return /* @__PURE__ */ jsxs("div", { style: { padding: "14px 18px", borderRadius: "8px", backgroundColor: "#fdf2f8", border: "1px solid #fbcfe8", marginBottom: "14px" }, children: [
    /* @__PURE__ */ jsx("h4", { style: { fontSize: "13px", fontWeight: 600, marginBottom: "10px", color: "#831843" }, children: "Fusionner ce ticket dans un autre" }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }, children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: mergeTarget,
          onChange: (e) => {
            setMergeTarget(e.target.value);
            setMergeTargetInfo(null);
            setMergeError("");
          },
          placeholder: "TK-0001",
          style: { ...s.input, width: "130px" }
        }
      ),
      /* @__PURE__ */ jsx("button", { onClick: handleMergeLookup, style: { ...s.outlineBtn("#ec4899"), fontSize: "12px", padding: "6px 14px" }, children: "Rechercher" }),
      mergeError && /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", color: "#be185d", fontWeight: 600 }, children: mergeError })
    ] }),
    mergeTargetInfo && /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px", alignItems: "center" }, children: [
      /* @__PURE__ */ jsxs("span", { style: { fontSize: "13px", fontWeight: 600 }, children: [
        mergeTargetInfo.ticketNumber,
        " \u2014 ",
        mergeTargetInfo.subject
      ] }),
      /* @__PURE__ */ jsx("button", { onClick: handleMerge, disabled: merging, style: { ...s.btn("#ec4899", merging), color: "#fff", fontSize: "12px", padding: "6px 14px" }, children: merging ? "Fusion..." : "Confirmer la fusion" })
    ] })
  ] });
}
function ExtMessagePanel({
  extMsgBody,
  setExtMsgBody,
  extMsgAuthor,
  setExtMsgAuthor,
  extMsgDate,
  setExtMsgDate,
  extMsgFiles,
  setExtMsgFiles,
  sendingExtMsg,
  handleSendExtMsg,
  handleExtFileChange
}) {
  const extFileInputRef = useRef(null);
  return /* @__PURE__ */ jsxs("div", { style: { padding: "14px 18px", borderRadius: "8px", backgroundColor: "#eef2ff", border: "1px solid #c7d2fe", marginBottom: "14px" }, children: [
    /* @__PURE__ */ jsx("h4", { style: { fontSize: "13px", fontWeight: 600, marginBottom: "10px", color: "#312e81" }, children: "Ajouter un message re\xE7u (email, SMS, WhatsApp...)" }),
    /* @__PURE__ */ jsx(
      "textarea",
      {
        value: extMsgBody,
        onChange: (e) => setExtMsgBody(e.target.value),
        placeholder: "Coller le contenu du message re\xE7u...",
        rows: 3,
        style: { ...s.input, width: "100%", resize: "vertical", marginBottom: "10px" }
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }, children: [
      /* @__PURE__ */ jsxs("select", { value: extMsgAuthor, onChange: (e) => setExtMsgAuthor(e.target.value), style: { ...s.input, fontSize: "12px" }, children: [
        /* @__PURE__ */ jsx("option", { value: "client", children: "Envoy\xE9 par le client" }),
        /* @__PURE__ */ jsx("option", { value: "admin", children: "Envoy\xE9 par le support" })
      ] }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "datetime-local",
          value: extMsgDate,
          onChange: (e) => setExtMsgDate(e.target.value),
          style: { ...s.input, fontSize: "12px" }
        }
      ),
      /* @__PURE__ */ jsx("input", { ref: extFileInputRef, type: "file", multiple: true, onChange: handleExtFileChange, style: { display: "none" }, accept: "image/*,.pdf,.doc,.docx,.txt,.zip" }),
      /* @__PURE__ */ jsx("button", { type: "button", onClick: () => extFileInputRef.current?.click(), style: { ...s.ghostBtn("#6b7280"), fontSize: "12px", padding: "6px 12px" }, children: "+ PJ" })
    ] }),
    extMsgFiles.length > 0 && /* @__PURE__ */ jsx("div", { style: { marginBottom: "10px", display: "flex", gap: "6px", flexWrap: "wrap" }, children: extMsgFiles.map((file, i) => /* @__PURE__ */ jsxs("span", { style: { ...s.badge("#f1f5f9", "#374151"), display: "inline-flex", alignItems: "center", gap: "4px" }, children: [
      file.name,
      /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setExtMsgFiles((prev) => prev.filter((_, idx) => idx !== i)), style: { border: "none", background: "none", color: "#ef4444", fontWeight: 700, cursor: "pointer", fontSize: "14px", lineHeight: 1 }, children: "\xD7" })
    ] }, i)) }),
    /* @__PURE__ */ jsx("button", { onClick: handleSendExtMsg, disabled: sendingExtMsg || !extMsgBody.trim(), style: s.btn("#818cf8", sendingExtMsg || !extMsgBody.trim()), children: sendingExtMsg ? "Ajout..." : "Ajouter (sans notification)" })
  ] });
}
function SnoozePanel({ snoozeSaving, handleSnooze }) {
  return /* @__PURE__ */ jsxs("div", { style: { padding: "14px 18px", borderRadius: "8px", backgroundColor: "#faf5ff", border: "1px solid #e9d5ff", marginBottom: "14px" }, children: [
    /* @__PURE__ */ jsx("h4", { style: { fontSize: "13px", fontWeight: 600, marginBottom: "10px", color: "#5b21b6" }, children: "Snooze \u2014 masquer temporairement" }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }, children: [
      /* @__PURE__ */ jsx("button", { onClick: () => handleSnooze(1), disabled: snoozeSaving, style: { ...s.outlineBtn("#8b5cf6", snoozeSaving), fontSize: "12px" }, children: "1 jour" }),
      /* @__PURE__ */ jsx("button", { onClick: () => handleSnooze(3), disabled: snoozeSaving, style: { ...s.outlineBtn("#8b5cf6", snoozeSaving), fontSize: "12px" }, children: "3 jours" }),
      /* @__PURE__ */ jsx("button", { onClick: () => handleSnooze(7), disabled: snoozeSaving, style: { ...s.outlineBtn("#8b5cf6", snoozeSaving), fontSize: "12px" }, children: "1 semaine" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "datetime-local",
          onChange: (e) => {
            if (e.target.value) handleSnooze(null, e.target.value);
          },
          style: { ...s.input, fontSize: "12px" }
        }
      )
    ] })
  ] });
}

export { ExtMessagePanel, MergePanel, SnoozePanel };
