"use client";
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import styles from '../../styles/ImportConversation.module.scss';

function ImportConversationClient() {
  const { t } = useTranslation();
  const [markdown, setMarkdown] = useState("");
  const [fileName, setFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const handleFile = useCallback((file) => {
    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      setError(t("import.formatError"));
      return;
    }
    if (file.size > 512e3) {
      setError(t("import.sizeError"));
      return;
    }
    setError("");
    setFileName(file.name);
    setResult(null);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      setMarkdown(content);
    };
    reader.readAsText(file);
  }, []);
  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );
  const onFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );
  const doPreview = useCallback(async () => {
    if (!markdown) return;
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch("/api/support/import-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, previewOnly: true })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'analyse");
        return;
      }
      setPreview(data);
    } catch {
      setError("Erreur reseau");
    } finally {
      setLoading(false);
    }
  }, [markdown]);
  const doImport = useCallback(async () => {
    if (!markdown) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/support/import-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'import");
        return;
      }
      setResult(data);
      setPreview(null);
    } catch {
      setError("Erreur reseau");
    } finally {
      setLoading(false);
    }
  }, [markdown]);
  const reset = useCallback(() => {
    setMarkdown("");
    setFileName("");
    setPreview(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);
  const dropzoneClass = isDragOver ? styles.dropzoneDragOver : markdown ? styles.dropzoneHasFile : styles.dropzone;
  return /* @__PURE__ */ jsxs("div", { className: styles.page, children: [
    /* @__PURE__ */ jsxs("div", { className: styles.header, children: [
      /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("h1", { className: styles.title, children: t("import.title") }) }),
      result && /* @__PURE__ */ jsx("button", { onClick: reset, className: styles.btnPrimary, children: t("import.newImport") })
    ] }),
    !result && /* @__PURE__ */ jsxs(
      "div",
      {
        className: dropzoneClass,
        onDragOver: (e) => {
          e.preventDefault();
          setIsDragOver(true);
        },
        onDragLeave: () => setIsDragOver(false),
        onDrop,
        onClick: () => fileRef.current?.click(),
        children: [
          /* @__PURE__ */ jsx("div", { className: styles.dropzoneIcon, children: "\u2191" }),
          /* @__PURE__ */ jsx("p", { className: styles.dropzoneText, children: markdown ? t("import.dropzoneLoaded") : t("import.dropzoneText") }),
          !markdown && /* @__PURE__ */ jsx("p", { style: { fontSize: 12, color: "var(--theme-elevation-400)", marginTop: 8 }, children: t("import.acceptedFormats") }),
          fileName && /* @__PURE__ */ jsx("p", { className: styles.fileName, children: fileName }),
          /* @__PURE__ */ jsx(
            "input",
            {
              ref: fileRef,
              type: "file",
              accept: ".md,.txt",
              onChange: onFileChange,
              style: { display: "none" }
            }
          )
        ]
      }
    ),
    error && /* @__PURE__ */ jsxs("div", { className: styles.resultError, children: [
      /* @__PURE__ */ jsx("div", { className: styles.resultTitleError, children: "\u26A0 Erreur" }),
      /* @__PURE__ */ jsx("p", { className: styles.errorText, children: error })
    ] }),
    markdown && !preview && !result && /* @__PURE__ */ jsx("div", { className: styles.btnRow, children: /* @__PURE__ */ jsx("button", { onClick: doPreview, disabled: loading, className: styles.btnAmber, children: /* @__PURE__ */ jsxs("span", { className: styles.btnContent, children: [
      "\u{1F441} ",
      loading ? t("import.analyzing") : t("import.preview")
    ] }) }) }),
    preview && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: styles.section, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.sectionTitle, children: [
          "\u{1F464} ",
          t("import.client")
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.infoRow, children: [
          /* @__PURE__ */ jsx("span", { className: styles.infoLabel, children: t("import.name") }),
          /* @__PURE__ */ jsx("span", { className: styles.infoValue, children: preview.client.name })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.infoRow, children: [
          /* @__PURE__ */ jsx("span", { className: styles.infoLabel, children: t("import.email") }),
          /* @__PURE__ */ jsx("span", { className: styles.infoValue, children: preview.client.email })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.infoRow, children: [
          /* @__PURE__ */ jsx("span", { className: styles.infoLabel, children: t("import.company") }),
          /* @__PURE__ */ jsx("span", { className: styles.infoValue, children: preview.client.company })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.infoRow, children: [
          /* @__PURE__ */ jsx("span", { className: styles.infoLabel, children: t("import.parsing") }),
          /* @__PURE__ */ jsx("span", { className: styles.infoValue, children: /* @__PURE__ */ jsx("span", { className: styles.badgeInfo, children: preview.parseMethod === "structured" ? t("import.parsingRegex") : t("import.parsingAi") }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: styles.section, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.sectionTitle, children: [
          "\u{1F4AC} ",
          preview.subject,
          /* @__PURE__ */ jsxs("span", { className: styles.sectionTitleRight, children: [
            preview.messageCount,
            " ",
            t("import.messages")
          ] })
        ] }),
        preview.messages.map((msg, i) => /* @__PURE__ */ jsxs("div", { className: msg.from === "admin" ? styles.msgAdmin : styles.msgClient, children: [
          /* @__PURE__ */ jsxs("div", { className: styles.msgHeader, children: [
            /* @__PURE__ */ jsxs("span", { className: styles.msgAuthor, children: [
              msg.from === "admin" ? ">> " : "<< ",
              msg.name
            ] }),
            /* @__PURE__ */ jsx("span", { className: styles.msgDate, children: msg.date })
          ] }),
          /* @__PURE__ */ jsx("div", { className: styles.msgPreview, children: msg.preview })
        ] }, i))
      ] }),
      /* @__PURE__ */ jsxs("div", { className: styles.btnRow, children: [
        /* @__PURE__ */ jsx("button", { onClick: () => setPreview(null), className: styles.btnMuted, children: t("common.cancel") }),
        /* @__PURE__ */ jsx("button", { onClick: doImport, disabled: loading, className: styles.btnGreen, children: /* @__PURE__ */ jsxs("span", { className: styles.btnContent, children: [
          "\u279C ",
          loading ? t("import.importing") : t("import.importButton", { count: String(preview.messageCount) })
        ] }) })
      ] })
    ] }),
    result && /* @__PURE__ */ jsxs("div", { className: styles.resultSuccess, children: [
      /* @__PURE__ */ jsxs("div", { className: styles.resultTitleSuccess, children: [
        "\u2713 ",
        t("import.resultTitle")
      ] }),
      /* @__PURE__ */ jsxs("div", { className: styles.infoRow, children: [
        /* @__PURE__ */ jsx("span", { className: styles.infoLabel, children: t("import.resultTicket") }),
        /* @__PURE__ */ jsx("span", { className: styles.infoValue, children: /* @__PURE__ */ jsx("a", { href: `/admin/support/ticket?id=${result.ticketId}`, className: styles.link, children: result.ticketNumber }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: styles.infoRow, children: [
        /* @__PURE__ */ jsx("span", { className: styles.infoLabel, children: t("import.resultClient") }),
        /* @__PURE__ */ jsxs("span", { className: styles.infoValue, children: [
          result.clientName,
          " (",
          result.clientEmail,
          ")",
          result.isNewClient && /* @__PURE__ */ jsx("span", { className: styles.badgeNew, style: { marginLeft: 8 }, children: t("import.resultNew") })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: styles.infoRow, children: [
        /* @__PURE__ */ jsx("span", { className: styles.infoLabel, children: t("import.resultCompany") }),
        /* @__PURE__ */ jsx("span", { className: styles.infoValue, children: result.clientCompany })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: styles.infoRow, children: [
        /* @__PURE__ */ jsx("span", { className: styles.infoLabel, children: t("import.resultMessages") }),
        /* @__PURE__ */ jsx("span", { className: styles.infoValue, children: t("import.resultImported", { count: String(result.messagesImported) }) })
      ] })
    ] })
  ] });
}

export { ImportConversationClient };
