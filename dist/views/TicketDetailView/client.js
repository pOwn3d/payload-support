"use client";
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RichTextEditor } from '../../components/RichTextEditor/index.js';
import { hasCodeBlocks, CodeBlockRendererHtml, MessageWithCodeBlocks } from '../../components/TicketConversation/components/CodeBlock.js';
import { CodeBlockInserter } from '../../components/TicketConversation/components/CodeBlockInserter.js';
import { getFeatures } from '../shared/config.js';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import s from '../../styles/TicketDetail.module.scss';

const STATUS_STYLE = {
  open: { bg: "#dbeafe", color: "#1e40af" },
  waiting_client: { bg: "#fef3c7", color: "#92400e" },
  resolved: { bg: "#dcfce7", color: "#166534" }
};
function timeAgo(d) {
  const date = new Date(d), now = /* @__PURE__ */ new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return `Hier, ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function dateLabel(d) {
  const date = new Date(d), now = /* @__PURE__ */ new Date();
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}
const REWRITE_STYLES = [
  { id: "auto", label: "\u270F\uFE0F Auto", desc: "Garde le ton actuel" },
  { id: "tutoyer", label: "\u{1F44B} Tutoyer", desc: "Passe en tu" },
  { id: "vouvoyer", label: "\u{1F3A9} Vouvoyer", desc: "Passe en vous" },
  { id: "formel", label: "\u{1F4BC} Formel", desc: "Ton professionnel" },
  { id: "amical", label: "\u{1F60A} Amical", desc: "Ton chaleureux" },
  { id: "court", label: "\u26A1 Court", desc: "Version concise" }
];
const RewriteDropdown = ({ disabled, loading, onSelect, toolbarBtnClass }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return /* @__PURE__ */ jsxs("div", { ref, style: { position: "relative", display: "inline-block" }, children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: toolbarBtnClass,
        onClick: () => setOpen(!open),
        disabled,
        style: { fontSize: 11, fontWeight: 700, padding: "4px 10px", width: "auto", display: "flex", alignItems: "center", gap: 4 },
        children: [
          loading ? "..." : "\u270F\uFE0F Reformuler",
          !loading && /* @__PURE__ */ jsx("span", { style: { fontSize: 9, opacity: 0.6 }, children: "\u25BC" })
        ]
      }
    ),
    open && !disabled && !loading && /* @__PURE__ */ jsx("div", { style: {
      position: "absolute",
      bottom: "100%",
      left: 0,
      marginBottom: 4,
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      zIndex: 100,
      minWidth: 180,
      overflow: "hidden"
    }, children: REWRITE_STYLES.map((style) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => {
          setOpen(false);
          onSelect(style.id);
        },
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          padding: "8px 12px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          borderBottom: "1px solid #f3f4f6"
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.background = "#f9fafb";
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.background = "transparent";
        },
        children: [
          /* @__PURE__ */ jsx("span", { style: { fontSize: 12, fontWeight: 600 }, children: style.label }),
          /* @__PURE__ */ jsx("span", { style: { fontSize: 10, color: "#9ca3af" }, children: style.desc })
        ]
      },
      style.id
    )) })
  ] });
};
const TicketDetailClient = () => {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("id");
  const features = getFeatures();
  const editorRef = useRef(null);
  const threadEndRef = useRef(null);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [client, setClient] = useState(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [cannedResponses, setCannedResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [replyHtml, setReplyHtml] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [notifyClient, setNotifyClient] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [clientTyping, setClientTyping] = useState(false);
  const [aiReplying, setAiReplying] = useState(false);
  const [aiRewriting, setAiRewriting] = useState(false);
  const [sentiment, setSentiment] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [clientSummary, setClientSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [timerRunning, setTimerRunning] = useState(() => {
    if (typeof window === "undefined" || !ticketId) return false;
    return localStorage.getItem(`timer-run-${ticketId}`) === "1";
  });
  const [timerSeconds, setTimerSeconds] = useState(() => {
    if (typeof window === "undefined" || !ticketId) return 0;
    const s2 = Number(localStorage.getItem(`timer-sec-${ticketId}`) || 0);
    const t2 = Number(localStorage.getItem(`timer-ts-${ticketId}`) || 0);
    const running = localStorage.getItem(`timer-run-${ticketId}`) === "1";
    return running && t2 ? s2 + Math.floor((Date.now() - t2) / 1e3) : s2;
  });
  const timerRef = useRef(null);
  const [otherViewers, setOtherViewers] = useState([]);
  const [macros, setMacros] = useState([]);
  const [applyingMacro, setApplyingMacro] = useState(false);
  const [undoToast, setUndoToast] = useState(null);
  const [splitModal, setSplitModal] = useState(null);
  const [splitSubject, setSplitSubject] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [composerDragOver, setComposerDragOver] = useState(false);
  const [tags, setTags] = useState([]);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const fetchAll = useCallback(async () => {
    if (!ticketId) return;
    try {
      const [mr, tr, ter, ar, cr] = await Promise.all([
        fetch(`/api/ticket-messages?where[ticket][equals]=${ticketId}&sort=createdAt&limit=200&depth=1`, { credentials: "include" }),
        fetch(`/api/tickets/${ticketId}?depth=1`, { credentials: "include" }),
        fetch(`/api/time-entries?where[ticket][equals]=${ticketId}&sort=-date&limit=50&depth=0`, { credentials: "include" }),
        fetch(`/api/ticket-activity-log?where[ticket][equals]=${ticketId}&sort=-createdAt&limit=30&depth=0`, { credentials: "include" }),
        fetch("/api/canned-responses?sort=sortOrder&limit=50&depth=0", { credentials: "include" })
      ]);
      if (mr.ok) {
        const d = await mr.json();
        setMessages(d.docs || []);
      }
      if (tr.ok) {
        const d = await tr.json();
        setTicket(d);
        if (d.client && typeof d.client === "object") setClient(d.client);
        if (Array.isArray(d.tags)) setTags(d.tags.map((t2) => typeof t2 === "object" ? t2.tag || "" : t2).filter(Boolean));
      }
      if (ter.ok) {
        const d = await ter.json();
        setTimeEntries(d.docs || []);
      }
      if (ar.ok) {
        const d = await ar.json();
        setActivityLog(d.docs || []);
      }
      if (cr.ok) {
        const d = await cr.json();
        setCannedResponses(d.docs || []);
      }
    } catch {
    }
    setLoading(false);
  }, [ticketId]);
  const failCountRef = useRef({ messages: 0, typing: 0, presence: 0 });
  const MAX_FAILS = 3;
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  useEffect(() => {
    if (!ticket) return;
    const clientId = typeof ticket.client === "object" ? ticket.client?.id : ticket.client;
    if (!clientId) return;
    setSummaryLoading(true);
    fetch(`/api/support/client-intelligence?clientId=${clientId}`, { credentials: "include" }).then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) setClientSummary(d);
    }).catch(() => {
    }).finally(() => setSummaryLoading(false));
  }, [ticket?.id]);
  useEffect(() => {
    if (!ticketId || loading) return;
    const iv = setInterval(async () => {
      if (failCountRef.current.messages >= MAX_FAILS) return;
      try {
        const [mr, tr] = await Promise.all([
          fetch(`/api/ticket-messages?where[ticket][equals]=${ticketId}&sort=createdAt&limit=200&depth=1`, { credentials: "include" }),
          fetch(`/api/tickets/${ticketId}?depth=0`, { credentials: "include" })
        ]);
        if (mr.ok && tr.ok) {
          failCountRef.current.messages = 0;
          const d = await mr.json();
          setMessages(d.docs || []);
          const td = await tr.json();
          setTicket((p) => p ? { ...p, ...td } : td);
        } else {
          failCountRef.current.messages++;
        }
      } catch {
        failCountRef.current.messages++;
      }
    }, 1e4);
    return () => clearInterval(iv);
  }, [ticketId, loading]);
  useEffect(() => {
    if (!ticketId) return;
    fetch(`/api/tickets/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ lastAdminReadAt: (/* @__PURE__ */ new Date()).toISOString() }) }).catch(() => {
    });
  }, [ticketId, messages.length]);
  useEffect(() => {
    if (!ticketId) return;
    const iv = setInterval(async () => {
      if (failCountRef.current.typing >= MAX_FAILS) return;
      try {
        const r = await fetch(`/api/support/typing?ticketId=${ticketId}`, { credentials: "include" });
        if (r.ok) {
          failCountRef.current.typing = 0;
          const d = await r.json();
          setClientTyping(d.typing);
        } else {
          failCountRef.current.typing++;
        }
      } catch {
        failCountRef.current.typing++;
      }
    }, 3e3);
    return () => clearInterval(iv);
  }, [ticketId]);
  useEffect(() => {
    if (!features.ai || messages.length === 0) return;
    const clientMsgs = messages.filter((m) => m.authorType === "client" || m.authorType === "email").slice(-3);
    if (clientMsgs.length === 0) return;
    const contextText = clientMsgs.map((m) => m.body).join("\n---\n").slice(0, 1e3);
    fetch("/api/support/ai", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: "sentiment", text: contextText }) }).then((r) => r.json()).then((d) => {
      const raw = (d.sentiment || "").toLowerCase().replace(/[^a-zéèêàùûîôëüöç]/g, "");
      const map = {
        "frustr\xE9": { emoji: "\u{1F624}", label: "Frustr\xE9", color: "#dc2626" },
        "frustre": { emoji: "\u{1F624}", label: "Frustr\xE9", color: "#dc2626" },
        "m\xE9content": { emoji: "\u{1F620}", label: "M\xE9content", color: "#ea580c" },
        "mecontent": { emoji: "\u{1F620}", label: "M\xE9content", color: "#ea580c" },
        "urgent": { emoji: "\u{1F525}", label: "Urgent", color: "#dc2626" },
        "neutre": { emoji: "\u{1F610}", label: "Neutre", color: "#6b7280" },
        "satisfait": { emoji: "\u{1F60A}", label: "Satisfait", color: "#16a34a" }
      };
      const m = Object.keys(map).find((k) => raw.includes(k));
      setSentiment(m ? map[m] : { emoji: "\u{1F610}", label: "Neutre", color: "#6b7280" });
    }).catch(() => {
    });
  }, [messages.length, features.ai]);
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);
  useEffect(() => {
    if (timerRunning) {
      localStorage.setItem(`timer-run-${ticketId}`, "1");
      localStorage.setItem(`timer-ts-${ticketId}`, String(Date.now()));
      localStorage.setItem(`timer-sec-${ticketId}`, String(timerSeconds));
      timerRef.current = setInterval(() => {
        setTimerSeconds((p) => {
          const next = p + 1;
          localStorage.setItem(`timer-sec-${ticketId}`, String(next));
          localStorage.setItem(`timer-ts-${ticketId}`, String(Date.now()));
          return next;
        });
      }, 1e3);
    } else {
      localStorage.setItem(`timer-run-${ticketId}`, "0");
      localStorage.setItem(`timer-sec-${ticketId}`, String(timerSeconds));
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, ticketId]);
  useEffect(() => {
    if (!ticketId) return;
    const join = () => fetch("/api/support/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ticketId: Number(ticketId), action: "join" })
    }).catch(() => {
    });
    join();
    const heartbeat = setInterval(join, 2e4);
    return () => {
      clearInterval(heartbeat);
      fetch("/api/support/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticketId: Number(ticketId), action: "leave" })
      }).catch(() => {
      });
    };
  }, [ticketId]);
  useEffect(() => {
    if (!ticketId) return;
    const poll = setInterval(async () => {
      if (failCountRef.current.presence >= MAX_FAILS) return;
      try {
        const r = await fetch(`/api/support/presence?ticketId=${ticketId}`, { credentials: "include" });
        if (r.ok) {
          failCountRef.current.presence = 0;
          const d = await r.json();
          setOtherViewers(d.viewers || []);
        } else {
          failCountRef.current.presence++;
        }
      } catch {
        failCountRef.current.presence++;
      }
    }, 5e3);
    return () => clearInterval(poll);
  }, [ticketId]);
  useEffect(() => {
    fetch("/api/macros?where[isActive][equals]=true&depth=0&limit=50", { credentials: "include" }).then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.docs) setMacros(d.docs.map((m) => ({ id: m.id, name: m.name })));
    }).catch(() => {
    });
  }, []);
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);
  useEffect(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        const sendBtn = document.querySelector('[data-action="send-reply"]');
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setIsInternal((prev) => !prev);
      }
      if (e.key === "Escape") {
        setShowMenu(false);
        setSplitModal(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const handleSend = async () => {
    if (!replyBody.trim() && !replyHtml.trim() || !ticketId) return;
    setSending(true);
    try {
      const uploadedLinks = [];
      for (const file of pendingFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("_payload", JSON.stringify({ alt: file.name }));
        try {
          const ur = await fetch("/api/media", { method: "POST", credentials: "include", body: formData });
          if (ur.ok) {
            const ud = await ur.json();
            if (ud.doc?.url) uploadedLinks.push(`[${ud.doc.filename || file.name}](${ud.doc.url})`);
          }
        } catch {
        }
      }
      const finalBody = uploadedLinks.length > 0 ? `${replyBody.trim()}

${uploadedLinks.join("\n")}` : replyBody.trim() || "[Contenu enrichi]";
      const finalHtml = uploadedLinks.length > 0 ? `${replyHtml || replyBody.trim()}<br/><br/>${uploadedLinks.map((l) => l.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')).join("<br/>")}` : replyHtml || void 0;
      const res = await fetch("/api/ticket-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticket: Number(ticketId), body: finalBody, ...finalHtml ? { bodyHtml: finalHtml } : {}, authorType: "admin", isInternal, skipNotification: isInternal || !notifyClient })
      });
      if (res.ok) {
        setReplyBody("");
        setReplyHtml("");
        setIsInternal(false);
        setPendingFiles([]);
        editorRef.current?.clear();
        fetchAll();
      }
    } catch {
    } finally {
      setSending(false);
    }
  };
  const handleStatusChange = async (v) => {
    if (!ticketId) return;
    setStatusUpdating(true);
    try {
      await fetch(`/api/tickets/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status: v }) });
      fetchAll();
    } catch {
    } finally {
      setStatusUpdating(false);
    }
  };
  const handleFieldPatch = async (field, value) => {
    if (!ticketId) return;
    try {
      await fetch(`/api/tickets/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ [field]: value }) });
      fetchAll();
    } catch {
    }
  };
  const handleDeleteMessage = (msgId) => {
    if (undoToast) clearTimeout(undoToast.timer);
    const timer = setTimeout(() => {
      fetch(`/api/ticket-messages/${msgId}`, { method: "DELETE", credentials: "include" }).then(() => fetchAll());
      setUndoToast(null);
    }, 5e3);
    setUndoToast({ msgId, timer });
  };
  const handleUndoDelete = () => {
    if (undoToast) {
      clearTimeout(undoToast.timer);
      setUndoToast(null);
    }
  };
  const handleSplitConfirm = async () => {
    if (!splitModal || !splitSubject.trim()) return;
    try {
      const r = await fetch("/api/support/split-ticket", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ messageId: splitModal.messageId, subject: splitSubject }) });
      const d = await r.json();
      if (d.ticketNumber) {
        fetchAll();
      }
    } catch {
    }
    setSplitModal(null);
    setSplitSubject("");
  };
  const handleAiSuggest = async () => {
    if (messages.length === 0) return;
    setAiReplying(true);
    try {
      const r = await fetch("/api/support/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "suggest_reply", messages: messages.slice(-10).map((m) => ({ authorType: m.authorType, body: m.body })), clientName: `${client?.firstName || ""} ${client?.lastName || ""}`.trim(), clientCompany: client?.company })
      });
      if (r.ok) {
        const d = await r.json();
        if (d.reply) {
          setReplyBody(d.reply);
          setReplyHtml(d.reply.replace(/\n/g, "<br/>"));
          editorRef.current?.setContent(d.reply.replace(/\n/g, "<br/>"));
        }
      }
    } catch {
    } finally {
      setAiReplying(false);
    }
  };
  const handleAiRewrite = async (style = "auto") => {
    if (!replyBody.trim()) return;
    setAiRewriting(true);
    try {
      const r = await fetch("/api/support/ai", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: "rewrite", text: replyBody, style }) });
      if (r.ok) {
        const d = await r.json();
        if (d.rewritten) {
          setReplyBody(d.rewritten);
          setReplyHtml(d.rewritten.replace(/\n/g, "<br/>"));
          editorRef.current?.setContent(d.rewritten.replace(/\n/g, "<br/>"));
        }
      }
    } catch {
    } finally {
      setAiRewriting(false);
    }
  };
  const handleTimerSave = async () => {
    if (!ticketId || timerSeconds < 60) return;
    try {
      await fetch("/api/time-entries", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ticket: Number(ticketId), duration: Math.round(timerSeconds / 60), date: (/* @__PURE__ */ new Date()).toISOString(), description: "Timer" }) });
      setTimerSeconds(0);
      setTimerRunning(false);
      fetchAll();
    } catch {
    }
  };
  const handleApplyMacro = async (macroId) => {
    if (!ticketId || applyingMacro) return;
    setApplyingMacro(true);
    try {
      const r = await fetch("/api/support/apply-macro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ macroId, ticketId: Number(ticketId) })
      });
      if (r.ok) {
        fetchAll();
      }
    } catch {
    } finally {
      setApplyingMacro(false);
    }
  };
  const handleFileSelect = (files) => {
    if (!files) return;
    setPendingFiles((prev) => [...prev, ...Array.from(files)]);
  };
  const handleFileDrop = (e) => {
    e.preventDefault();
    setComposerDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };
  const handleRemoveTag = async (tag) => {
    const newTags = tags.filter((t2) => t2 !== tag);
    setTags(newTags);
    if (ticketId) {
      await fetch(`/api/tickets/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ tags: newTags.map((t2) => ({ tag: t2 })) }) }).catch(() => {
      });
    }
  };
  const handleAddTag = async () => {
    if (!newTagValue.trim()) {
      setAddingTag(false);
      return;
    }
    const tag = newTagValue.trim();
    if (tags.includes(tag)) {
      setAddingTag(false);
      setNewTagValue("");
      return;
    }
    const newTags = [...tags, tag];
    setTags(newTags);
    setAddingTag(false);
    setNewTagValue("");
    if (ticketId) {
      await fetch(`/api/tickets/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ tags: newTags.map((t2) => ({ tag: t2 })) }) }).catch(() => {
      });
    }
  };
  if (!ticketId) return /* @__PURE__ */ jsx("div", { style: { padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 14 }, children: t("detail.selectTicket") });
  if (loading) return /* @__PURE__ */ jsx("div", { style: { padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 14 }, children: t("common.loading") });
  if (!ticket) return /* @__PURE__ */ jsx("div", { style: { padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 14 }, children: t("detail.notFound") });
  const st = STATUS_STYLE[ticket.status || "open"] || STATUS_STYLE.open;
  const totalMin = timeEntries.reduce((a, e) => a + (e.duration || 0), 0);
  const initials = client ? `${(client.firstName?.[0] || "").toUpperCase()}${(client.lastName?.[0] || "").toUpperCase()}` : "?";
  return /* @__PURE__ */ jsxs("div", { className: s.page, children: [
    /* @__PURE__ */ jsxs("div", { className: s.topBar, children: [
      /* @__PURE__ */ jsx(Link, { href: "/admin/support/inbox", className: s.backLink, "aria-label": "Retour \xE0 la bo\xEEte de r\xE9ception", children: "\u2190" }),
      /* @__PURE__ */ jsxs("div", { className: s.ticketMeta, children: [
        /* @__PURE__ */ jsx("span", { className: s.ticketNumber, children: ticket.ticketNumber }),
        /* @__PURE__ */ jsx("span", { className: s.ticketSubject, children: ticket.subject })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: s.topBarRight, children: [
        /* @__PURE__ */ jsxs("select", { className: s.statusChip, style: { background: st.bg, color: st.color }, value: ticket.status || "open", onChange: (e) => handleStatusChange(e.target.value), disabled: statusUpdating, "aria-label": t("ticket.status.label"), children: [
          /* @__PURE__ */ jsx("option", { value: "open", children: t("detail.statusOpen") }),
          /* @__PURE__ */ jsx("option", { value: "waiting_client", children: t("detail.statusWaiting") }),
          /* @__PURE__ */ jsx("option", { value: "resolved", children: t("detail.statusResolved") })
        ] }),
        sentiment && features.ai && /* @__PURE__ */ jsxs("span", { className: s.sentimentBadge, style: { background: `${sentiment.color}12`, color: sentiment.color }, children: [
          sentiment.emoji,
          " ",
          sentiment.label
        ] }),
        /* @__PURE__ */ jsxs("div", { className: s.dropdown, ref: dropdownRef, children: [
          /* @__PURE__ */ jsx("button", { className: s.moreBtn, onClick: () => setShowMenu(!showMenu), "aria-label": "Plus d'options", children: "\xB7\xB7\xB7" }),
          showMenu && /* @__PURE__ */ jsxs("div", { className: s.dropdownMenu, children: [
            /* @__PURE__ */ jsx("button", { className: s.dropdownItem, onClick: () => {
              navigator.clipboard.writeText(window.location.href);
              setShowMenu(false);
            }, children: t("detail.copyLink") }),
            /* @__PURE__ */ jsx(Link, { href: `/admin/collections/tickets/${ticketId}`, className: s.dropdownItem, onClick: () => setShowMenu(false), children: t("detail.payloadView") }),
            /* @__PURE__ */ jsx("a", { href: `/support/tickets/${ticketId}`, target: "_blank", rel: "noopener noreferrer", className: s.dropdownItem, onClick: () => setShowMenu(false), children: t("detail.clientView") })
          ] })
        ] })
      ] })
    ] }),
    otherViewers.length > 0 && /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px",
      marginBottom: 12,
      borderRadius: 8,
      background: "#fef3c7",
      border: "1px solid #fde68a",
      fontSize: 13,
      fontWeight: 500,
      color: "#92400e"
    }, children: [
      /* @__PURE__ */ jsx("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", style: { flexShrink: 0 }, children: /* @__PURE__ */ jsx("path", { d: "M9 1L3 9h4l-1 6 6-8H8l1-6z", fill: "#92400e" }) }),
      otherViewers.length === 1 ? t("detail.viewingAlso", { names: otherViewers.map((v) => v.name).join(", ") }) : t("detail.viewingAlsoPlural", { names: otherViewers.map((v) => v.name).join(", ") })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: s.layout, children: [
      /* @__PURE__ */ jsxs("div", { className: s.conversationCol, children: [
        /* @__PURE__ */ jsxs("div", { className: s.thread, children: [
          messages.map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null;
            const showDate = msg.createdAt && (!prev?.createdAt || new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString());
            const isAdmin = msg.authorType === "admin";
            const isPendingDelete = undoToast?.msgId === msg.id;
            return /* @__PURE__ */ jsxs(React.Fragment, { children: [
              showDate && /* @__PURE__ */ jsx("div", { className: s.dateSeparator, children: /* @__PURE__ */ jsx("span", { className: s.dateSeparatorText, children: dateLabel(msg.createdAt) }) }),
              /* @__PURE__ */ jsxs("div", { className: `${s.message} ${msg.isInternal ? s.messageInternal : ""}`, style: isPendingDelete ? { opacity: 0.3, pointerEvents: "none" } : void 0, children: [
                /* @__PURE__ */ jsx("div", { className: s.avatar, style: { backgroundColor: isAdmin ? "#2563eb" : msg.authorType === "email" ? "#ea580c" : "#7c3aed" }, children: isAdmin ? "CW" : initials }),
                /* @__PURE__ */ jsxs("div", { className: s.messageContent, children: [
                  /* @__PURE__ */ jsxs("div", { className: s.messageHeader, children: [
                    /* @__PURE__ */ jsx("span", { className: s.messageAuthor, children: isAdmin ? "Support" : msg.authorType === "email" ? "Email" : client?.firstName || "Client" }),
                    /* @__PURE__ */ jsx("span", { className: s.messageTime, children: timeAgo(msg.createdAt) }),
                    msg.isInternal && /* @__PURE__ */ jsx("span", { className: s.badge, style: { background: "#fef3c7", color: "#92400e" }, children: "Interne" }),
                    msg.isSolution && /* @__PURE__ */ jsx("span", { className: s.badge, style: { background: "#dcfce7", color: "#166534" }, children: "Solution" }),
                    /* @__PURE__ */ jsx("span", { className: s.messageMeta, children: isAdmin && !msg.isInternal && (() => {
                      const ext = msg;
                      if (ext.emailOpenedAt) {
                        const d = new Date(ext.emailOpenedAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                        return /* @__PURE__ */ jsxs("span", { style: { color: "#16a34a", cursor: "help" }, title: `Ouvert le ${d}`, children: [
                          "\u2713\u2713 Lu ",
                          d
                        ] });
                      }
                      if (ext.emailSentAt) {
                        const d = new Date(ext.emailSentAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                        return /* @__PURE__ */ jsxs("span", { style: { color: "#2563eb", cursor: "help" }, title: `Envoy\xE9 le ${d}`, children: [
                          "\u2713 Envoy\xE9 ",
                          d
                        ] });
                      }
                      return /* @__PURE__ */ jsx("span", { style: { color: "#94a3b8" }, children: "\u2713" });
                    })() })
                  ] }),
                  msg.deletedAt ? /* @__PURE__ */ jsx("div", { className: s.messageBody, style: { color: "#94a3b8", fontStyle: "italic" }, children: t("detail.messageDeleted") }) : msg.bodyHtml && hasCodeBlocks(msg.bodyHtml.replace(/<[^>]+>/g, "")) ? /* @__PURE__ */ jsx(CodeBlockRendererHtml, { html: msg.bodyHtml }) : msg.bodyHtml ? /* @__PURE__ */ jsx("div", { className: `${s.messageBody} ${s.rteDisplay}`, dangerouslySetInnerHTML: { __html: msg.bodyHtml } }) : hasCodeBlocks(msg.body) ? /* @__PURE__ */ jsx(MessageWithCodeBlocks, { text: msg.body, style: { fontSize: "13px", lineHeight: 1.5 } }) : /* @__PURE__ */ jsx("div", { className: s.messageBody, children: msg.body }),
                  Array.isArray(msg.attachments) && msg.attachments.length > 0 && /* @__PURE__ */ jsx("div", { className: s.attachments, children: msg.attachments.map((att, i) => {
                    const file = typeof att.file === "object" ? att.file : null;
                    if (!file) return null;
                    return (file.mimeType || "").startsWith("image/") ? /* @__PURE__ */ jsx("a", { href: file.url || "#", target: "_blank", rel: "noopener noreferrer", children: /* @__PURE__ */ jsx("img", { src: file.url || "", alt: "", className: s.attachmentImg }) }, i) : /* @__PURE__ */ jsxs("a", { href: file.url || "#", target: "_blank", rel: "noopener noreferrer", className: s.attachmentFile, children: [
                      "PJ ",
                      file.filename || "Fichier"
                    ] }, i);
                  }) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: s.messageActions, children: [
                  /* @__PURE__ */ jsx("button", { className: `${s.actionIcon} ${s.danger}`, title: t("actions.deleteMessage"), "aria-label": t("actions.deleteMessage"), onClick: () => handleDeleteMessage(msg.id), style: { fontSize: 11, width: "auto", padding: "4px 8px" }, children: t("actions.deleteMessage") }),
                  features.splitTicket && !msg.isInternal && /* @__PURE__ */ jsx("button", { className: s.actionIcon, title: t("actions.extractMessage"), "aria-label": t("actions.extractToNewTicket"), onClick: () => {
                    setSplitModal({ messageId: msg.id, preview: msg.body.slice(0, 200) });
                    setSplitSubject(`Split: ${ticket.subject}`);
                  }, style: { fontSize: 11, width: "auto", padding: "4px 8px" }, children: t("actions.extractMessage") }),
                  isAdmin && !msg.isInternal && /* @__PURE__ */ jsx("button", { className: s.actionIcon, title: t("actions.resendEmail"), "aria-label": t("actions.resendEmail"), onClick: () => fetch("/api/support/resend-notification", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ messageId: msg.id }) }), style: { fontSize: 11, width: "auto", padding: "4px 8px" }, children: t("actions.resendEmail") })
                ] })
              ] })
            ] }, msg.id);
          }),
          /* @__PURE__ */ jsx("div", { ref: threadEndRef })
        ] }),
        clientTyping && /* @__PURE__ */ jsxs("div", { className: s.typing, children: [
          /* @__PURE__ */ jsxs("span", { className: s.typingDots, children: [
            /* @__PURE__ */ jsx("span", {}),
            /* @__PURE__ */ jsx("span", {}),
            /* @__PURE__ */ jsx("span", {})
          ] }),
          t("detail.typing", { name: client?.firstName || "Client" })
        ] }),
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: `${s.composer} ${isInternal ? s.composerInternal : ""} ${composerDragOver ? s.composerDragOver : ""}`,
            onDragOver: (e) => {
              e.preventDefault();
              setComposerDragOver(true);
            },
            onDragLeave: () => setComposerDragOver(false),
            onDrop: handleFileDrop,
            children: [
              /* @__PURE__ */ jsxs("div", { className: s.composerToolbar, children: [
                features.ai && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("button", { className: s.toolbarBtn, "data-tooltip": t("detail.iaSuggestion"), "aria-label": t("detail.iaSuggestion"), onClick: handleAiSuggest, disabled: aiReplying || messages.length === 0, style: { fontSize: 11, fontWeight: 700, padding: "4px 10px", width: "auto" }, children: aiReplying ? "..." : `\u2728 ${t("detail.iaSuggestion")}` }),
                  /* @__PURE__ */ jsx(RewriteDropdown, { disabled: aiRewriting || !replyBody.trim(), loading: aiRewriting, onSelect: (style) => handleAiRewrite(style), toolbarBtnClass: s.toolbarBtn })
                ] }),
                /* @__PURE__ */ jsx(
                  CodeBlockInserter,
                  {
                    className: s.toolbarBtn,
                    onInsert: (block) => {
                      const nb = replyBody ? replyBody + block : block;
                      setReplyBody(nb);
                      setReplyHtml(nb.replace(/\n/g, "<br/>"));
                      editorRef.current?.setContent(nb.replace(/\n/g, "<br/>"));
                    }
                  }
                ),
                /* @__PURE__ */ jsxs("button", { className: s.toolbarBtn, "data-tooltip": t("detail.file"), "aria-label": t("detail.file"), onClick: () => fileInputRef.current?.click(), style: { fontSize: 11, fontWeight: 700, padding: "4px 10px", width: "auto" }, children: [
                  "\u{1F4CE} ",
                  t("detail.file")
                ] }),
                /* @__PURE__ */ jsx("input", { ref: fileInputRef, type: "file", multiple: true, className: s.hiddenFileInput, onChange: (e) => handleFileSelect(e.target.files) }),
                macros.length > 0 && /* @__PURE__ */ jsxs(
                  "select",
                  {
                    className: s.cannedSelect,
                    onChange: (e) => {
                      const id = Number(e.target.value);
                      if (id) handleApplyMacro(id);
                      e.target.value = "";
                    },
                    disabled: applyingMacro,
                    style: { marginLeft: 0 },
                    "aria-label": "Appliquer une macro",
                    children: [
                      /* @__PURE__ */ jsx("option", { value: "", children: applyingMacro ? t("detail.applyingMacro") : t("detail.macros") }),
                      macros.map((m) => /* @__PURE__ */ jsx("option", { value: m.id, children: m.name }, m.id))
                    ]
                  }
                ),
                /* @__PURE__ */ jsx("span", { className: s.toolbarDivider }),
                features.canned && cannedResponses.length > 0 && /* @__PURE__ */ jsxs("select", { className: s.cannedSelect, "aria-label": "R\xE9ponses types", onChange: (e) => {
                  const cr = cannedResponses.find((c) => String(c.id) === e.target.value);
                  if (cr) {
                    let b = cr.body;
                    if (client) {
                      b = b.replace(/\{\{client\.firstName\}\}/g, client.firstName).replace(/\{\{client\.company\}\}/g, client.company);
                    }
                    setReplyBody(b);
                    setReplyHtml(b.replace(/\n/g, "<br/>"));
                    editorRef.current?.setContent(b.replace(/\n/g, "<br/>"));
                  }
                  e.target.value = "";
                }, children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: t("detail.cannedResponses") }),
                  cannedResponses.map((cr) => /* @__PURE__ */ jsx("option", { value: String(cr.id), children: cr.title }, cr.id))
                ] })
              ] }),
              /* @__PURE__ */ jsx(RichTextEditor, { ref: editorRef, onChange: (html, text) => {
                setReplyHtml(html);
                setReplyBody(text);
              }, placeholder: isInternal ? t("composer.placeholderInternal") : t("composer.placeholderReplyTo", { name: client?.firstName || "client" }), minHeight: 100, borderColor: "transparent" }),
              pendingFiles.length > 0 && /* @__PURE__ */ jsx("div", { className: s.uploadPreview, children: pendingFiles.map((f, i) => /* @__PURE__ */ jsxs("div", { className: s.uploadPreviewItem, children: [
                /* @__PURE__ */ jsxs("span", { children: [
                  "PJ ",
                  f.name
                ] }),
                /* @__PURE__ */ jsx("button", { className: s.uploadRemoveBtn, "aria-label": `Retirer ${f.name}`, onClick: () => setPendingFiles((prev) => prev.filter((_, j) => j !== i)), children: "\xD7" })
              ] }, i)) }),
              /* @__PURE__ */ jsxs("div", { className: s.composerFooter, children: [
                /* @__PURE__ */ jsxs("div", { className: s.composerOptions, children: [
                  /* @__PURE__ */ jsxs("label", { children: [
                    /* @__PURE__ */ jsx("input", { type: "checkbox", checked: isInternal, onChange: (e) => setIsInternal(e.target.checked) }),
                    " ",
                    t("detail.internalNote")
                  ] }),
                  /* @__PURE__ */ jsxs("label", { children: [
                    /* @__PURE__ */ jsx("input", { type: "checkbox", checked: notifyClient, onChange: (e) => setNotifyClient(e.target.checked), disabled: isInternal }),
                    " ",
                    t("detail.notify")
                  ] })
                ] }),
                /* @__PURE__ */ jsx("button", { className: `${s.sendBtn} ${isInternal ? s.sendBtnInternal : ""}`, onClick: handleSend, disabled: sending || !replyBody.trim(), "data-action": "send-reply", children: sending ? t("detail.sending") : isInternal ? t("detail.sendNote") : t("detail.sendReply") })
              ] })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: s.sidebar, children: [
        client && /* @__PURE__ */ jsxs("div", { className: s.sideSection, children: [
          /* @__PURE__ */ jsxs("div", { className: s.clientCard, children: [
            /* @__PURE__ */ jsx("div", { className: s.clientAvatar, children: initials }),
            /* @__PURE__ */ jsxs("div", { className: s.clientInfo, children: [
              /* @__PURE__ */ jsxs("div", { className: s.clientName, children: [
                client.firstName,
                " ",
                client.lastName
              ] }),
              /* @__PURE__ */ jsx("div", { className: s.clientCompany, children: client.company }),
              /* @__PURE__ */ jsx("a", { href: `mailto:${client.email}`, className: s.clientEmail, children: client.email })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: s.clientActions, children: [
            /* @__PURE__ */ jsx(Link, { href: `/admin/collections/support-clients/${client.id}`, className: s.smallBtn, children: t("client.clientSheet") }),
            /* @__PURE__ */ jsx("button", { className: s.smallBtn, onClick: () => window.open(`/api/admin/impersonate?clientId=${client.id}`, "_blank"), children: t("client.clientPortal") })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: s.sideSection, children: [
          /* @__PURE__ */ jsx("div", { className: s.sideSectionTitle, children: t("detail.details") }),
          /* @__PURE__ */ jsxs("div", { className: s.sideField, children: [
            /* @__PURE__ */ jsx("span", { className: s.sideLabel, children: t("detail.priority") }),
            /* @__PURE__ */ jsxs("select", { className: s.sideSelect, value: ticket.priority || "normal", onChange: (e) => handleFieldPatch("priority", e.target.value), "aria-label": t("detail.priority"), children: [
              /* @__PURE__ */ jsx("option", { value: "low", children: t("ticket.priority.low") }),
              /* @__PURE__ */ jsx("option", { value: "normal", children: t("ticket.priority.normal") }),
              /* @__PURE__ */ jsx("option", { value: "high", children: t("ticket.priority.high") }),
              /* @__PURE__ */ jsx("option", { value: "urgent", children: t("ticket.priority.urgent") })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: s.sideField, children: [
            /* @__PURE__ */ jsx("span", { className: s.sideLabel, children: t("detail.category") }),
            /* @__PURE__ */ jsxs("select", { className: s.sideSelect, value: ticket.category || "", onChange: (e) => handleFieldPatch("category", e.target.value), "aria-label": t("detail.category"), children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "\u2014" }),
              /* @__PURE__ */ jsx("option", { value: "bug", children: t("ticket.category.bug") }),
              /* @__PURE__ */ jsx("option", { value: "content", children: t("ticket.category.content") }),
              /* @__PURE__ */ jsx("option", { value: "feature", children: t("ticket.category.feature") }),
              /* @__PURE__ */ jsx("option", { value: "question", children: t("ticket.category.question") }),
              /* @__PURE__ */ jsx("option", { value: "hosting", children: t("ticket.category.hosting") })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: s.sideField, children: [
            /* @__PURE__ */ jsx("span", { className: s.sideLabel, children: t("detail.source") }),
            /* @__PURE__ */ jsx("span", { className: s.sideValue, children: ticket.source || t("ticket.source.portal") })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: s.sideField, children: [
            /* @__PURE__ */ jsx("span", { className: s.sideLabel, children: t("detail.assigned") }),
            /* @__PURE__ */ jsx("span", { className: s.sideValue, children: typeof ticket.assignedTo === "object" && ticket.assignedTo ? ticket.assignedTo.firstName || "Admin" : "\u2014" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: s.sideSection, children: [
          /* @__PURE__ */ jsx("div", { className: s.sideSectionTitle, children: t("detail.tags") }),
          /* @__PURE__ */ jsxs("div", { className: s.tagsWrap, children: [
            tags.map((tag) => /* @__PURE__ */ jsxs("span", { className: s.tagChip, children: [
              tag,
              /* @__PURE__ */ jsx("button", { className: s.tagRemove, "aria-label": `Retirer le tag ${tag}`, onClick: () => handleRemoveTag(tag), children: "\xD7" })
            ] }, tag)),
            addingTag ? /* @__PURE__ */ jsx(
              "input",
              {
                className: s.tagInput,
                value: newTagValue,
                onChange: (e) => setNewTagValue(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Enter") handleAddTag();
                  if (e.key === "Escape") {
                    setAddingTag(false);
                    setNewTagValue("");
                  }
                },
                onBlur: handleAddTag,
                placeholder: "Tag...",
                autoFocus: true
              }
            ) : /* @__PURE__ */ jsx("button", { className: s.tagAddBtn, onClick: () => setAddingTag(true), "aria-label": "Ajouter un tag", children: "+ Tag" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: s.sideSection, children: [
          /* @__PURE__ */ jsx("div", { className: s.sideSectionTitle, children: "Facturation" }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsx("span", { style: { fontSize: 12 }, children: "Type" }),
              /* @__PURE__ */ jsxs(
                "select",
                {
                  value: ticket?.billingType || "hourly",
                  onChange: async (e) => {
                    try {
                      await fetch(`/api/tickets/${ticketId}`, {
                        method: "PATCH",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ billingType: e.target.value })
                      });
                      fetchAll();
                    } catch {
                    }
                  },
                  style: { fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff" },
                  children: [
                    /* @__PURE__ */ jsx("option", { value: "hourly", children: "Au temps" }),
                    /* @__PURE__ */ jsx("option", { value: "flat", children: "Forfait" })
                  ]
                }
              )
            ] }),
            ticket?.billingType === "flat" && /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsx("span", { style: { fontSize: 12 }, children: "Montant forfait" }),
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "number",
                    defaultValue: ticket?.flatRateAmount ?? "",
                    placeholder: "0",
                    onBlur: async (e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      try {
                        await fetch(`/api/tickets/${ticketId}`, {
                          method: "PATCH",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ flatRateAmount: val })
                        });
                        fetchAll();
                      } catch {
                      }
                    },
                    style: { fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", width: 80, textAlign: "right" }
                  }
                ),
                /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: "#9ca3af" }, children: "\u20AC" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsx("span", { style: { fontSize: 12 }, children: "Montant factur\xE9" }),
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "number",
                    defaultValue: ticket?.billedAmount ?? "",
                    placeholder: "0",
                    onBlur: async (e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      try {
                        await fetch(`/api/tickets/${ticketId}`, {
                          method: "PATCH",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ billedAmount: val })
                        });
                        fetchAll();
                      } catch {
                      }
                    },
                    style: { fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", width: 80, textAlign: "right" }
                  }
                ),
                /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: "#9ca3af" }, children: "\u20AC" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsx("span", { style: { fontSize: 12 }, children: "Paiement" }),
              /* @__PURE__ */ jsxs(
                "select",
                {
                  value: ticket?.paymentStatus || "unpaid",
                  onChange: async (e) => {
                    try {
                      await fetch(`/api/tickets/${ticketId}`, {
                        method: "PATCH",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ paymentStatus: e.target.value })
                      });
                      fetchAll();
                    } catch {
                    }
                  },
                  style: { fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff" },
                  children: [
                    /* @__PURE__ */ jsx("option", { value: "unpaid", children: "Non pay\xE9" }),
                    /* @__PURE__ */ jsx("option", { value: "partial", children: "Partiel" }),
                    /* @__PURE__ */ jsx("option", { value: "paid", children: "Pay\xE9" })
                  ]
                }
              )
            ] })
          ] })
        ] }),
        features.timeTracking && /* @__PURE__ */ jsxs("div", { className: s.sideSection, children: [
          /* @__PURE__ */ jsxs("div", { className: s.sideSectionTitle, children: [
            t("detail.time"),
            " ",
            /* @__PURE__ */ jsx("span", { style: { fontWeight: 700, fontSize: 13, color: "#d97706" }, children: totalMin > 0 ? `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, "0")} ${t("detail.total")}` : "0min" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: s.timer, children: [
            /* @__PURE__ */ jsxs("span", { className: `${s.timerDisplay} ${timerRunning ? s.timerActive : ""}`, children: [
              String(Math.floor(timerSeconds / 60)).padStart(2, "0"),
              ":",
              String(timerSeconds % 60).padStart(2, "0")
            ] }),
            !timerRunning ? /* @__PURE__ */ jsx("button", { className: s.timerBtn, onClick: () => setTimerRunning(true), style: { color: "#dc2626", borderColor: "#dc2626" }, "aria-label": "D\xE9marrer le timer", children: timerSeconds > 0 ? "\u25B6" : "\u25B6 Go" }) : /* @__PURE__ */ jsx("button", { className: s.timerBtn, onClick: () => setTimerRunning(false), "aria-label": "Mettre en pause le timer", children: "\u23F8" }),
            timerSeconds >= 60 && !timerRunning && /* @__PURE__ */ jsxs("button", { className: s.timerBtn, onClick: () => {
              handleTimerSave();
              localStorage.removeItem(`timer-sec-${ticketId}`);
              localStorage.removeItem(`timer-run-${ticketId}`);
            }, style: { color: "#16a34a", borderColor: "#16a34a" }, "aria-label": "Sauvegarder le temps", children: [
              "\u{1F4BE} ",
              Math.round(timerSeconds / 60),
              "m"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 6, marginTop: 8, alignItems: "center" }, children: [
            /* @__PURE__ */ jsx("input", { type: "number", min: "1", placeholder: "min", style: { width: 60, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--theme-elevation-200)", fontSize: 12, color: "var(--theme-text)", background: "var(--theme-elevation-0)" }, id: "manual-time-input" }),
            /* @__PURE__ */ jsx("button", { className: s.timerBtn, onClick: async () => {
              const input = document.getElementById("manual-time-input");
              const mins = Number(input?.value);
              if (!mins || mins < 1 || !ticketId) return;
              try {
                await fetch("/api/time-entries", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ticket: Number(ticketId), duration: mins, date: (/* @__PURE__ */ new Date()).toISOString(), description: "Saisie manuelle" }) });
                if (input) input.value = "";
                fetchAll();
              } catch {
              }
            }, style: { fontSize: 11 }, children: "+ Ajouter" })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { marginTop: 8, fontSize: 11, color: "var(--theme-elevation-500)" }, children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", padding: "2px 0", alignItems: "center" }, children: [
              /* @__PURE__ */ jsx("span", { children: "Facturable" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: async () => {
                    const newVal = ticket.billable === false ? true : false;
                    try {
                      await fetch(`/api/tickets/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ billable: newVal }) });
                      fetchAll();
                    } catch {
                    }
                  },
                  style: { fontWeight: 600, color: ticket.billable !== false ? "#16a34a" : "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 11, textDecoration: "underline" },
                  children: ticket.billable !== false ? "Oui" : "Non"
                }
              )
            ] }),
            totalMin > 0 && /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", padding: "2px 0" }, children: [
              /* @__PURE__ */ jsx("span", { children: "Montant estim\xE9" }),
              /* @__PURE__ */ jsxs("span", { style: { fontWeight: 700, color: "var(--theme-text)" }, children: [
                (totalMin / 60 * 60).toFixed(0),
                "\u20AC"
              ] })
            ] })
          ] }),
          timeEntries.length > 0 && /* @__PURE__ */ jsx("div", { style: { marginTop: 8, fontSize: 11 }, children: timeEntries.slice(0, 6).map((e) => /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--theme-elevation-500)" }, children: [
            /* @__PURE__ */ jsx("span", { children: new Date(e.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) }),
            /* @__PURE__ */ jsxs("span", { title: e.description, style: { fontWeight: 600, cursor: e.description ? "help" : "default" }, children: [
              e.duration,
              "min"
            ] })
          ] }, e.id)) })
        ] }),
        features.activityLog && /* @__PURE__ */ jsxs("div", { className: s.sideSection, children: [
          /* @__PURE__ */ jsx("div", { className: s.sideSectionTitle, children: /* @__PURE__ */ jsxs("button", { className: s.collapseBtn, onClick: () => setShowActivity(!showActivity), "aria-label": showActivity ? "Masquer le journal" : "Afficher le journal", children: [
            "Activit\xE9 ",
            showActivity ? "\u25BE" : "\u25B8"
          ] }) }),
          showActivity && activityLog.slice(0, 8).map((a) => /* @__PURE__ */ jsxs("div", { className: s.activityItem, children: [
            /* @__PURE__ */ jsx("div", { className: s.activityDot, style: { backgroundColor: a.actorType === "admin" ? "#2563eb" : a.actorType === "system" ? "#6b7280" : "#16a34a" } }),
            /* @__PURE__ */ jsxs("div", { className: s.activityContent, children: [
              /* @__PURE__ */ jsx("div", { className: s.activityText, children: (a.detail || a.action).slice(0, 60) }),
              /* @__PURE__ */ jsx("div", { className: s.activityTime, children: timeAgo(a.createdAt) })
            ] })
          ] }, a.id))
        ] }),
        clientSummary && clientSummary.summary && /* @__PURE__ */ jsxs("div", { className: s.sideSection, style: { background: "linear-gradient(135deg, rgba(37,99,235,0.03) 0%, rgba(139,92,246,0.03) 100%)" }, children: [
          /* @__PURE__ */ jsxs("div", { className: s.sideSectionTitle, style: { display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ jsx("span", { style: { fontSize: 13 }, children: "\u{1F9E0}" }),
            " R\xE9sum\xE9 client"
          ] }),
          /* @__PURE__ */ jsx("p", { style: { margin: "0 0 8px", fontSize: 11, lineHeight: 1.6, color: "#374151" }, children: clientSummary.summary }),
          clientSummary.recurringTopics && clientSummary.recurringTopics.length > 0 && /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }, children: clientSummary.recurringTopics.slice(0, 3).map((tp, i) => /* @__PURE__ */ jsx("span", { style: { padding: "2px 8px", borderRadius: 10, background: "rgba(37,99,235,0.08)", color: "#2563eb", fontSize: 10, fontWeight: 600 }, children: tp.topic }, i)) }),
          clientSummary.keyFacts && clientSummary.keyFacts.length > 0 && /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 }, children: clientSummary.keyFacts.slice(0, 3).map((f, i) => /* @__PURE__ */ jsx("span", { style: { padding: "2px 8px", borderRadius: 10, background: "rgba(22,163,74,0.08)", color: "#16a34a", fontSize: 10, fontWeight: 600 }, children: f }, i)) })
        ] }),
        summaryLoading && /* @__PURE__ */ jsx("div", { className: s.sideSection, children: /* @__PURE__ */ jsx("div", { style: { fontSize: 11, color: "#94a3b8", textAlign: "center", padding: 8 }, children: "\u{1F9E0} Chargement r\xE9sum\xE9..." }) })
      ] })
    ] }),
    undoToast && /* @__PURE__ */ jsxs("div", { className: s.undoToast, role: "alert", children: [
      /* @__PURE__ */ jsx("span", { children: "Message supprim\xE9" }),
      /* @__PURE__ */ jsx("button", { className: s.undoBtn, onClick: handleUndoDelete, children: "Annuler" })
    ] }),
    splitModal && /* @__PURE__ */ jsx("div", { className: s.splitOverlay, onClick: (e) => {
      if (e.target === e.currentTarget) {
        setSplitModal(null);
        setSplitSubject("");
      }
    }, children: /* @__PURE__ */ jsxs("div", { className: s.splitModal, role: "dialog", "aria-label": "Extraire dans un nouveau ticket", children: [
      /* @__PURE__ */ jsx("h3", { className: s.splitTitle, children: "Extraire dans un nouveau ticket" }),
      /* @__PURE__ */ jsx("div", { className: s.splitPreview, children: splitModal.preview }),
      /* @__PURE__ */ jsx(
        "input",
        {
          className: s.splitInput,
          value: splitSubject,
          onChange: (e) => setSplitSubject(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") handleSplitConfirm();
          },
          placeholder: "Sujet du nouveau ticket...",
          autoFocus: true
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: s.splitActions, children: [
        /* @__PURE__ */ jsx("button", { className: s.splitCancelBtn, onClick: () => {
          setSplitModal(null);
          setSplitSubject("");
        }, children: "Annuler" }),
        /* @__PURE__ */ jsx("button", { className: s.splitConfirmBtn, onClick: handleSplitConfirm, disabled: !splitSubject.trim(), children: "Cr\xE9er le ticket" })
      ] })
    ] }) })
  ] });
};

export { TicketDetailClient };
