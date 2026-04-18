'use strict';

var react = require('react');

function useAI(messages, client, ticketSubject, replyBody, setReplyBody, setReplyHtml, replyEditorRef) {
  const [clientSentiment, setClientSentiment] = react.useState(null);
  const [aiReplying, setAiReplying] = react.useState(false);
  const [aiRewriting, setAiRewriting] = react.useState(false);
  const [showAiSummary, setShowAiSummary] = react.useState(false);
  const [aiSummary, setAiSummary] = react.useState("");
  const [aiGenerating, setAiGenerating] = react.useState(false);
  const [aiSaving, setAiSaving] = react.useState(false);
  const [aiSaved, setAiSaved] = react.useState(false);
  react.useEffect(() => {
    if (messages.length === 0) return;
    const lastClientMsg = [...messages].reverse().find((m) => m.authorType === "client" || m.authorType === "email");
    if (!lastClientMsg) return;
    const analyze = async () => {
      try {
        const res = await fetch("/api/support/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "sentiment", text: lastClientMsg.body.slice(0, 500) })
        });
        if (res.ok) {
          const data = await res.json();
          const raw = (data.sentiment || "").toLowerCase().trim();
          const sentimentMap = {
            "frustr\xE9": { emoji: "\u{1F624}", label: "Frustr\xE9", color: "#dc2626" },
            "frustre": { emoji: "\u{1F624}", label: "Frustr\xE9", color: "#dc2626" },
            "m\xE9content": { emoji: "\u{1F620}", label: "M\xE9content", color: "#ea580c" },
            "mecontent": { emoji: "\u{1F620}", label: "M\xE9content", color: "#ea580c" },
            "urgent": { emoji: "\u{1F525}", label: "Urgent", color: "#dc2626" },
            "neutre": { emoji: "\u{1F610}", label: "Neutre", color: "#6b7280" },
            "satisfait": { emoji: "\u{1F60A}", label: "Satisfait", color: "#16a34a" }
          };
          const match = Object.keys(sentimentMap).find((k) => raw.includes(k));
          if (match) setClientSentiment(sentimentMap[match]);
          else setClientSentiment({ emoji: "\u{1F610}", label: "Neutre", color: "#6b7280" });
        }
      } catch {
      }
    };
    analyze();
  }, [messages.length]);
  const handleAiSuggestReply = async () => {
    if (messages.length === 0) return;
    setAiReplying(true);
    try {
      const res = await fetch("/api/support/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "suggest_reply",
          messages: messages.slice(-10).map((m) => ({ authorType: m.authorType, body: m.body })),
          clientName: `${client?.firstName || ""} ${client?.lastName || ""}`.trim(),
          clientCompany: client?.company
        })
      });
      if (res.ok) {
        const data = await res.json();
        const suggestion = data.reply || "";
        if (suggestion) {
          setReplyBody(suggestion);
          setReplyHtml(suggestion.replace(/\n/g, "<br/>"));
          if (replyEditorRef.current?.setContent) {
            replyEditorRef.current.setContent(suggestion.replace(/\n/g, "<br/>"));
          }
        }
      }
    } catch (err) {
      console.error("AI suggest error:", err);
    }
    setAiReplying(false);
  };
  const handleAiRewrite = async (style = "auto") => {
    if (!replyBody.trim()) return;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const selectedText = sel?.toString().trim() || "";
    const hasSelection = selectedText.length > 3;
    const textToRewrite = hasSelection ? selectedText : replyBody;
    setAiRewriting(true);
    try {
      const res = await fetch("/api/support/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "rewrite", text: textToRewrite, style })
      });
      if (res.ok) {
        const data = await res.json();
        const rewritten = data.rewritten || "";
        if (rewritten) {
          if (hasSelection && sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(rewritten));
            const editorEl = replyEditorRef.current;
            editorEl?.focus?.();
            const rootEl = range.commonAncestorContainer.closest?.("[contenteditable]");
            if (rootEl) {
              const newHtml = rootEl.innerHTML;
              const newText = rootEl.innerText?.trim() || "";
              setReplyBody(newText);
              setReplyHtml(newHtml);
            }
          } else {
            setReplyBody(rewritten);
            setReplyHtml(rewritten.replace(/\n/g, "<br/>"));
            if (replyEditorRef.current?.setContent) {
              replyEditorRef.current.setContent(rewritten.replace(/\n/g, "<br/>"));
            }
          }
        }
      }
    } catch (err) {
      console.error("AI rewrite error:", err);
    }
    setAiRewriting(false);
  };
  const handleAiGenerate = async () => {
    if (messages.length === 0) return;
    setAiGenerating(true);
    setAiSummary("");
    setAiSaved(false);
    try {
      const res = await fetch("/api/support/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "synthesis",
          messages: messages.map((m) => ({ authorType: m.authorType, body: m.body, createdAt: m.createdAt })),
          ticketSubject,
          clientName: `${client?.firstName || ""} ${client?.lastName || ""}`.trim(),
          clientCompany: client?.company
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.synthesis || "Aucune r\xE9ponse g\xE9n\xE9r\xE9e");
      } else {
        setAiSummary("Erreur lors de la g\xE9n\xE9ration de la synth\xE8se.");
      }
    } catch (err) {
      setAiSummary(`Erreur de connexion : ${err instanceof Error ? err.message : "erreur inconnue"}`);
    } finally {
      setAiGenerating(false);
    }
  };
  const handleAiSave = async (id, fetchAll) => {
    if (!id || !aiSummary) return;
    setAiSaving(true);
    try {
      const res = await fetch("/api/ticket-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ticket: id,
          body: `\u{1F4CB} **Synth\xE8se IA (${(/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR")})**

${aiSummary}`,
          authorType: "admin",
          isInternal: true
        })
      });
      if (res.ok) {
        setAiSaved(true);
        fetchAll();
      }
    } catch {
    } finally {
      setAiSaving(false);
    }
  };
  return {
    clientSentiment,
    aiReplying,
    handleAiSuggestReply,
    aiRewriting,
    handleAiRewrite,
    showAiSummary,
    setShowAiSummary,
    aiSummary,
    aiGenerating,
    handleAiGenerate,
    aiSaving,
    aiSaved,
    handleAiSave
  };
}

exports.useAI = useAI;
