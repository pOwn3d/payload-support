'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');
var useTranslation = require('../../components/TicketConversation/hooks/useTranslation');
var styles = require('../../styles/ImportConversation.module.scss');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var styles__default = /*#__PURE__*/_interopDefault(styles);

function ImportConversationClient() {
  const { t } = useTranslation.useTranslation();
  const [markdown, setMarkdown] = react.useState("");
  const [fileName, setFileName] = react.useState("");
  const [isDragOver, setIsDragOver] = react.useState(false);
  const [preview, setPreview] = react.useState(null);
  const [result, setResult] = react.useState(null);
  const [error, setError] = react.useState("");
  const [loading, setLoading] = react.useState(false);
  const fileRef = react.useRef(null);
  const handleFile = react.useCallback((file) => {
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
  const onDrop = react.useCallback(
    (e) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );
  const onFileChange = react.useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );
  const doPreview = react.useCallback(async () => {
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
  const doImport = react.useCallback(async () => {
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
  const reset = react.useCallback(() => {
    setMarkdown("");
    setFileName("");
    setPreview(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);
  const dropzoneClass = isDragOver ? styles__default.default.dropzoneDragOver : markdown ? styles__default.default.dropzoneHasFile : styles__default.default.dropzone;
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.page, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.header, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { children: /* @__PURE__ */ jsxRuntime.jsx("h1", { className: styles__default.default.title, children: t("import.title") }) }),
      result && /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: reset, className: styles__default.default.btnPrimary, children: t("import.newImport") })
    ] }),
    !result && /* @__PURE__ */ jsxRuntime.jsxs(
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
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.dropzoneIcon, children: "\u2191" }),
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: styles__default.default.dropzoneText, children: markdown ? t("import.dropzoneLoaded") : t("import.dropzoneText") }),
          !markdown && /* @__PURE__ */ jsxRuntime.jsx("p", { style: { fontSize: 12, color: "var(--theme-elevation-400)", marginTop: 8 }, children: t("import.acceptedFormats") }),
          fileName && /* @__PURE__ */ jsxRuntime.jsx("p", { className: styles__default.default.fileName, children: fileName }),
          /* @__PURE__ */ jsxRuntime.jsx(
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
    error && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.resultError, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.resultTitleError, children: "\u26A0 Erreur" }),
      /* @__PURE__ */ jsxRuntime.jsx("p", { className: styles__default.default.errorText, children: error })
    ] }),
    markdown && !preview && !result && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.btnRow, children: /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: doPreview, disabled: loading, className: styles__default.default.btnAmber, children: /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.btnContent, children: [
      "\u{1F441} ",
      loading ? t("import.analyzing") : t("import.preview")
    ] }) }) }),
    preview && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.section, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.sectionTitle, children: [
          "\u{1F464} ",
          t("import.client")
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.infoRow, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoLabel, children: t("import.name") }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoValue, children: preview.client.name })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.infoRow, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoLabel, children: t("import.email") }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoValue, children: preview.client.email })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.infoRow, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoLabel, children: t("import.company") }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoValue, children: preview.client.company })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.infoRow, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoLabel, children: t("import.parsing") }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoValue, children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.badgeInfo, children: preview.parseMethod === "structured" ? t("import.parsingRegex") : t("import.parsingAi") }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.section, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.sectionTitle, children: [
          "\u{1F4AC} ",
          preview.subject,
          /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.sectionTitleRight, children: [
            preview.messageCount,
            " ",
            t("import.messages")
          ] })
        ] }),
        preview.messages.map((msg, i) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: msg.from === "admin" ? styles__default.default.msgAdmin : styles__default.default.msgClient, children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.msgHeader, children: [
            /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.msgAuthor, children: [
              msg.from === "admin" ? ">> " : "<< ",
              msg.name
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.msgDate, children: msg.date })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.msgPreview, children: msg.preview })
        ] }, i))
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.btnRow, children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: () => setPreview(null), className: styles__default.default.btnMuted, children: t("common.cancel") }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: doImport, disabled: loading, className: styles__default.default.btnGreen, children: /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.btnContent, children: [
          "\u279C ",
          loading ? t("import.importing") : t("import.importButton", { count: String(preview.messageCount) })
        ] }) })
      ] })
    ] }),
    result && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.resultSuccess, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.resultTitleSuccess, children: [
        "\u2713 ",
        t("import.resultTitle")
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.infoRow, children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoLabel, children: t("import.resultTicket") }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoValue, children: /* @__PURE__ */ jsxRuntime.jsx("a", { href: `/admin/support/ticket?id=${result.ticketId}`, className: styles__default.default.link, children: result.ticketNumber }) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.infoRow, children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoLabel, children: t("import.resultClient") }),
        /* @__PURE__ */ jsxRuntime.jsxs("span", { className: styles__default.default.infoValue, children: [
          result.clientName,
          " (",
          result.clientEmail,
          ")",
          result.isNewClient && /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.badgeNew, style: { marginLeft: 8 }, children: t("import.resultNew") })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.infoRow, children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoLabel, children: t("import.resultCompany") }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoValue, children: result.clientCompany })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.infoRow, children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoLabel, children: t("import.resultMessages") }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.infoValue, children: t("import.resultImported", { count: String(result.messagesImported) }) })
      ] })
    ] })
  ] });
}

exports.ImportConversationClient = ImportConversationClient;
