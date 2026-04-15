"use client";
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { C, s } from './constants.js';
import { getDateLabel, formatMessageDate } from './utils.js';
import { CodeBlockRendererHtml, CodeBlockRenderer } from './components/CodeBlock.js';
import { CodeBlockInserter } from './components/CodeBlockInserter.js';
import { TicketHeader } from './components/TicketHeader.js';
import { ClientBar } from './components/ClientBar.js';
import { QuickActions } from './components/QuickActions.js';
import { AISummaryPanel } from './components/AISummaryPanel.js';
import { MergePanel, ExtMessagePanel, SnoozePanel } from './components/ActionPanels.js';
import { ActivityLog } from './components/ActivityLog.js';
import { ClientHistory } from './components/ClientHistory.js';
import { TimeTrackingPanel } from './components/TimeTrackingPanel.js';
import { useTimeTracking } from './hooks/useTimeTracking.js';
import { useMessageActions } from './hooks/useMessageActions.js';
import { useTicketActions } from './hooks/useTicketActions.js';
import { useReply } from './hooks/useReply.js';
import { useAI } from './hooks/useAI.js';
import { getFeatures } from './config.js';
import '../../styles/theme.css';

function useDocumentIdFromUrl() {
  const [id, setId] = useState(void 0);
  useEffect(() => {
    const match = window.location.pathname.match(
      /\/admin\/collections\/[^/]+\/([^/?#]+)/
    );
    if (match && match[1] !== "create") {
      const raw = match[1];
      const num = Number(raw);
      setId(Number.isFinite(num) && String(num) === raw ? num : raw);
    }
  }, []);
  return { id };
}
function SkeletonText({ lines = 3 }) {
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: "8px", padding: "12px 0" }, children: Array.from({ length: lines }).map((_, i) => /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        height: "14px",
        borderRadius: "4px",
        backgroundColor: "#e2e8f0",
        width: i === lines - 1 ? "60%" : "100%",
        animation: "pulse 1.5s ease-in-out infinite"
      }
    },
    i
  )) });
}
const layoutStyles = {
  root: { padding: "12px 0" },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "1fr 320px",
    gap: "16px",
    alignItems: "start"
  },
  mainColumn: { minWidth: 0 },
  sideColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    position: "sticky",
    top: "80px"
  }
};
const REWRITE_STYLES = [
  { id: "auto", label: "\u270F\uFE0F Auto", desc: "Garde le ton actuel" },
  { id: "tutoyer", label: "\u{1F44B} Tutoyer", desc: "Passe en tu" },
  { id: "vouvoyer", label: "\u{1F3A9} Vouvoyer", desc: "Passe en vous" },
  { id: "formel", label: "\u{1F4BC} Formel", desc: "Ton professionnel" },
  { id: "amical", label: "\u{1F60A} Amical", desc: "Ton chaleureux" },
  { id: "court", label: "\u26A1 Court", desc: "Version concise" }
];
const RewriteDropdown = ({ disabled, loading, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
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
        onClick: () => setOpen(!open),
        disabled,
        style: {
          ...s.outlineBtn("#0891b2", disabled),
          fontSize: "11px",
          padding: "3px 10px",
          borderRadius: "14px",
          display: "flex",
          alignItems: "center",
          gap: "4px"
        },
        children: [
          loading ? "Reformulation..." : "\u270F\uFE0F Reformuler",
          !loading && /* @__PURE__ */ jsx("span", { style: { fontSize: 9, opacity: 0.7 }, children: "\u25BC" })
        ]
      }
    ),
    open && !disabled && !loading && /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "100%",
          left: 0,
          marginBottom: 4,
          background: "var(--theme-elevation-0, #fff)",
          border: "1px solid var(--theme-elevation-200, #e5e7eb)",
          borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          zIndex: 100,
          minWidth: 180,
          overflow: "hidden"
        },
        children: REWRITE_STYLES.map((style) => /* @__PURE__ */ jsxs(
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
              borderBottom: "1px solid var(--theme-elevation-100, #f3f4f6)",
              transition: "background 120ms"
            },
            onMouseEnter: (e) => {
              e.target.style.background = "var(--theme-elevation-50, #f9fafb)";
            },
            onMouseLeave: (e) => {
              e.target.style.background = "transparent";
            },
            children: [
              /* @__PURE__ */ jsx("span", { style: { fontSize: 12, fontWeight: 600, color: "var(--theme-text, #111)" }, children: style.label }),
              /* @__PURE__ */ jsx("span", { style: { fontSize: 10, color: "var(--theme-elevation-500, #6b7280)" }, children: style.desc })
            ]
          },
          style.id
        ))
      }
    )
  ] });
};
const TicketConversation = () => {
  const { id } = useDocumentIdFromUrl();
  const [features] = useState(() => getFeatures());
  const [messages, setMessages] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [client, setClient] = useState(null);
  const [cannedResponses, setCannedResponses] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [satisfaction, setSatisfaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messagesCollapsed, setMessagesCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedLink, setCopiedLink] = useState(null);
  const prevMessageCountRef = useRef(0);
  const [clientTyping, setClientTyping] = useState(false);
  const [clientTypingName, setClientTypingName] = useState("");
  const typingLastSent = useRef(0);
  const [currentStatus, setCurrentStatus] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketSource, setTicketSource] = useState("");
  const [chatSession, setChatSession] = useState("");
  const [clientTickets, setClientTickets] = useState([]);
  const [clientProjects, setClientProjects] = useState([]);
  const [clientNotes, setClientNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [lastClientReadAt, setLastClientReadAt] = useState(null);
  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      const [msgRes, timeRes, ticketRes, cannedRes, activityRes, csatRes] = await Promise.all([
        fetch(`/api/ticket-messages?where[ticket][equals]=${id}&sort=createdAt&limit=200&depth=1`, { credentials: "include" }),
        fetch(`/api/time-entries?where[ticket][equals]=${id}&sort=-date&limit=50&depth=0`, { credentials: "include" }),
        fetch(`/api/tickets/${id}?depth=1`, { credentials: "include" }),
        fetch(`/api/canned-responses?sort=sortOrder&limit=50&depth=0`, { credentials: "include" }),
        fetch(`/api/ticket-activity-log?where[ticket][equals]=${id}&sort=-createdAt&limit=50&depth=0`, { credentials: "include" }),
        fetch(`/api/satisfaction-surveys?where[ticket][equals]=${id}&limit=1&depth=0`, { credentials: "include" })
      ]);
      if (msgRes.ok) {
        const d = await msgRes.json();
        setMessages(d.docs || []);
      }
      if (timeRes.ok) {
        const d = await timeRes.json();
        setTimeEntries(d.docs || []);
      }
      let resolvedChatSession = "";
      if (ticketRes.ok) {
        const d = await ticketRes.json();
        if (d.client && typeof d.client === "object") {
          setClient(d.client);
        }
        setSnoozeUntil(d.snoozeUntil || null);
        setLastClientReadAt(d.lastClientReadAt || null);
        setCurrentStatus(d.status || "");
        setTicketNumber(d.ticketNumber || "");
        setTicketSubject(d.subject || "");
        setTicketSource(d.source || "");
        setChatSession(d.chatSession || "");
        resolvedChatSession = d.chatSession || "";
        const clientId = typeof d.client === "object" ? d.client?.id : d.client;
        if (clientId) {
          const [clientTicketsRes, projectsRes, clientDetailRes] = await Promise.all([
            fetch(`/api/tickets?where[client][equals]=${clientId}&where[id][not_equals]=${id}&sort=-createdAt&limit=5&depth=0`, { credentials: "include" }),
            fetch(`/api/projects?where[client][contains]=${clientId}&depth=0`, { credentials: "include" }),
            fetch(`/api/support-clients/${clientId}?depth=0`, { credentials: "include" })
          ]);
          if (clientTicketsRes.ok) {
            const ctData = await clientTicketsRes.json();
            setClientTickets((ctData.docs || []).map((t) => ({
              id: t.id,
              ticketNumber: t.ticketNumber,
              subject: t.subject,
              status: t.status,
              createdAt: t.createdAt
            })));
          }
          if (projectsRes.ok) {
            const pData = await projectsRes.json();
            setClientProjects((pData.docs || []).map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status
            })));
          }
          if (clientDetailRes.ok) {
            const cdData = await clientDetailRes.json();
            setClientNotes(cdData.notes || "");
          }
        }
      }
      if (cannedRes.ok) {
        const d = await cannedRes.json();
        setCannedResponses(d.docs || []);
      }
      if (activityRes.ok) {
        const d = await activityRes.json();
        setActivityLog(d.docs || []);
      }
      if (csatRes.ok) {
        const d = await csatRes.json();
        setSatisfaction(d.docs?.[0] || null);
      }
      if (resolvedChatSession) {
        try {
          const chatRes = await fetch(`/api/support/admin-chat?session=${encodeURIComponent(resolvedChatSession)}`, { credentials: "include" });
          if (chatRes.ok) {
            const chatData = await chatRes.json();
            const chatMsgs = (chatData.messages || []).filter((cm) => cm.senderType !== "system").map((cm) => ({
              id: `chat-${cm.id}`,
              body: cm.message,
              authorType: cm.senderType === "agent" ? "admin" : "client",
              isInternal: false,
              createdAt: cm.createdAt,
              fromChat: true
            }));
            setMessages((prev) => {
              const ticketMsgs = prev;
              const merged = [...ticketMsgs];
              for (const chatMsg of chatMsgs) {
                const isDuplicate = ticketMsgs.some((tm) => {
                  if (tm.body !== chatMsg.body) return false;
                  const timeDiff = Math.abs(new Date(tm.createdAt).getTime() - new Date(chatMsg.createdAt).getTime());
                  return timeDiff < 5e3;
                });
                if (!isDuplicate) {
                  merged.push(chatMsg);
                }
              }
              return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
          }
        } catch (err) {
          console.warn("[TicketConversation] Chat fetch error:", err);
        }
      }
    } catch (err) {
      console.warn("[TicketConversation] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  useEffect(() => {
    if (!id) return;
    fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ lastAdminReadAt: (/* @__PURE__ */ new Date()).toISOString() })
    }).catch(() => {
    });
  }, [id, messages.length]);
  const typingFailCount = useRef(0);
  useEffect(() => {
    if (!id) return;
    typingFailCount.current = 0;
    const poll = async () => {
      if (typingFailCount.current >= 3) return;
      try {
        const res = await fetch(`/api/support/typing?ticketId=${id}`, { credentials: "include" });
        if (res.ok) {
          typingFailCount.current = 0;
          const data = await res.json();
          setClientTyping(data.typing);
          setClientTypingName(data.name || "");
        } else {
          typingFailCount.current++;
        }
      } catch {
        typingFailCount.current++;
      }
    };
    poll();
    const interval = setInterval(poll, 3e3);
    return () => clearInterval(interval);
  }, [id]);
  const sendAdminTyping = useCallback(() => {
    if (!id) return;
    const now = Date.now();
    if (now - typingLastSent.current < 3e3) return;
    typingLastSent.current = now;
    fetch("/api/support/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ticketId: id })
    }).catch(() => {
    });
  }, [id]);
  const tt = useTimeTracking(id, fetchAll);
  const { duration, setDuration, timeDescription, setTimeDescription, addingTime, timeSuccess, timerRunning, timerSeconds, setTimerSeconds, timerDescription, setTimerDescription, handleAddTime, handleTimerStart, handleTimerStop, handleTimerSave, handleTimerDiscard } = tt;
  const ma = useMessageActions(id, client, fetchAll);
  const { togglingAuthor, editingMsg, editBody, editHtml, setEditHtml, savingEdit, handleEditStart, handleEditSave, handleEditCancel, deletingMsg, handleDelete, resendingMsg, resendSuccess, handleResend, handleToggleAuthor, handleSplitMessage, setEditBody } = ma;
  const ta = useTicketActions(id, fetchAll);
  const { statusUpdating, handleStatusChange, showMerge, setShowMerge, mergeTarget, setMergeTarget, mergeTargetInfo, setMergeTargetInfo, mergeError, setMergeError, merging, handleMergeLookup, handleMerge, showExtMsg, setShowExtMsg, extMsgBody, setExtMsgBody, extMsgAuthor, setExtMsgAuthor, extMsgDate, setExtMsgDate, extMsgFiles, setExtMsgFiles, sendingExtMsg, handleExtFileChange, handleSendExtMsg, showSnooze, setShowSnooze, snoozeUntil, setSnoozeUntil, snoozeSaving, handleSnooze, showNextTicket, setShowNextTicket, nextTicketId, nextTicketInfo, handleNextTicket } = ta;
  const replyEditorRef = useRef(null);
  const rp = useReply(id, client, cannedResponses, ticketNumber, ticketSubject, fetchAll, handleNextTicket, replyEditorRef);
  const { fileInputRef, replyBody, setReplyBody, replyHtml, setReplyHtml, replyFiles, setReplyFiles, isInternal, setIsInternal, notifyClient, setNotifyClient, sendAsClient, setSendAsClient, sending, showSchedule, setShowSchedule, scheduleDate, setScheduleDate, handleEditorFileUpload, handleCannedSelect, handleReplyFileChange, handleSendReply, handleScheduleReply } = rp;
  const ai = useAI(messages, client, ticketSubject, replyBody, setReplyBody, setReplyHtml, replyEditorRef);
  const { clientSentiment, aiReplying, handleAiSuggestReply, aiRewriting, handleAiRewrite, showAiSummary, setShowAiSummary, aiSummary, aiGenerating, handleAiGenerate, aiSaving, aiSaved, handleAiSave: aiSaveRaw } = ai;
  const handleAiSave = () => aiSaveRaw(id, fetchAll);
  const [pollExpired, setPollExpired] = useState(false);
  useEffect(() => {
    if (!id || loading || pollExpired) return;
    const poll = async () => {
      try {
        const [msgRes, ticketRes, activityRes] = await Promise.all([
          fetch(`/api/ticket-messages?where[ticket][equals]=${id}&sort=createdAt&limit=200&depth=1`, { credentials: "include" }),
          fetch(`/api/tickets/${id}?depth=0`, { credentials: "include" }),
          fetch(`/api/ticket-activity-log?where[ticket][equals]=${id}&sort=-createdAt&limit=50&depth=0`, { credentials: "include" })
        ]);
        if (msgRes.status === 401 || msgRes.status === 403) {
          setPollExpired(true);
          return;
        }
        if (msgRes.ok) {
          const d = await msgRes.json();
          setMessages(d.docs || []);
        }
        if (ticketRes.ok) {
          const d = await ticketRes.json();
          setCurrentStatus(d.status || "");
          setSnoozeUntil(d.snoozeUntil || null);
          setLastClientReadAt(d.lastClientReadAt || null);
        }
        if (activityRes.ok) {
          const d = await activityRes.json();
          setActivityLog(d.docs || []);
        }
      } catch {
      }
    };
    const interval = setInterval(poll, 15e3);
    return () => clearInterval(interval);
  }, [id, loading, pollExpired]);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const sendBtn = document.querySelector('[data-action="send-reply"]');
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "N" || e.key === "n")) {
        e.preventDefault();
        setIsInternal((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = "sine";
      gain.gain.value = 0.1;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    } catch {
    }
  }, []);
  useEffect(() => {
    const currentCount = messages.length;
    if (prevMessageCountRef.current > 0 && currentCount > prevMessageCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.authorType !== "admin") {
        playNotificationSound();
      }
    }
    prevMessageCountRef.current = currentCount;
  }, [messages, playNotificationSound]);
  const handleCopyLink = (type) => {
    const url = type === "admin" ? `${window.location.origin}/admin/collections/tickets/${id}` : `${window.location.origin}/support/tickets/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2e3);
  };
  if (!id) {
    return /* @__PURE__ */ jsx("div", { style: { padding: "16px", color: "#666", fontStyle: "italic" }, children: "Enregistrez le ticket pour voir le tableau de bord." });
  }
  const totalMinutes = timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const statusTransitions = (() => {
    switch (currentStatus) {
      case "open":
        return [
          { status: "waiting_client", label: "Attente client", color: C.statusWaiting },
          { status: "resolved", label: "R\xE9solu", color: C.statusResolved }
        ];
      case "waiting_client":
        return [
          { status: "open", label: "Ouvrir", color: C.statusOpen },
          { status: "resolved", label: "R\xE9solu", color: C.statusResolved }
        ];
      case "resolved":
        return [
          { status: "open", label: "Rouvrir", color: C.statusOpen }
        ];
      default:
        return [
          { status: "open", label: "Ouvrir", color: C.statusOpen },
          { status: "waiting_client", label: "Attente client", color: C.statusWaiting },
          { status: "resolved", label: "R\xE9solu", color: C.statusResolved }
        ];
    }
  })();
  return /* @__PURE__ */ jsxs("div", { style: layoutStyles.root, children: [
    /* @__PURE__ */ jsx(
      TicketHeader,
      {
        ticketNumber,
        currentStatus,
        clientSentiment,
        ticketSource,
        chatSession,
        snoozeUntil,
        satisfaction,
        copiedLink,
        onCopyLink: handleCopyLink
      }
    ),
    client && /* @__PURE__ */ jsx(ClientBar, { client }),
    /* @__PURE__ */ jsxs("div", { style: layoutStyles.twoColumns, children: [
      /* @__PURE__ */ jsxs("div", { style: layoutStyles.mainColumn, children: [
        /* @__PURE__ */ jsxs("div", { style: { marginBottom: "4px", display: "flex", alignItems: "center", gap: "10px" }, children: [
          /* @__PURE__ */ jsxs("h3", { style: { fontSize: "14px", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "8px" }, children: [
            "Conversation ",
            /* @__PURE__ */ jsx("span", { style: s.badge("#f1f5f9", "#475569"), children: messages.length })
          ] }),
          /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: searchQuery,
              onChange: (e) => setSearchQuery(e.target.value),
              placeholder: "Rechercher...",
              style: { ...s.input, width: "100%", fontSize: "12px", padding: "6px 10px" }
            }
          ) })
        ] }),
        loading ? /* @__PURE__ */ jsx(SkeletonText, { lines: 4 }) : messages.length === 0 ? /* @__PURE__ */ jsx("p", { style: { color: "#999", fontStyle: "italic", padding: "12px 0" }, children: "Aucun message." }) : /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px", paddingRight: "4px" }, children: (() => {
          const filtered = messages.filter((msg) => !searchQuery.trim() || msg.body.toLowerCase().includes(searchQuery.toLowerCase()));
          const isSearching = searchQuery.trim().length > 0;
          const VISIBLE_COUNT = 3;
          const showCollapse = !isSearching && messagesCollapsed && filtered.length > VISIBLE_COUNT;
          const visibleMessages = showCollapse ? filtered.slice(-VISIBLE_COUNT) : filtered;
          const hiddenCount = filtered.length - VISIBLE_COUNT;
          return /* @__PURE__ */ jsxs(Fragment, { children: [
            showCollapse && hiddenCount > 0 && /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setMessagesCollapsed(false),
                style: {
                  background: "none",
                  border: `1px dashed ${C.border}`,
                  borderRadius: "6px",
                  padding: "8px",
                  cursor: "pointer",
                  color: C.textMuted,
                  fontSize: "12px",
                  fontWeight: 600,
                  textAlign: "center"
                },
                children: [
                  "Voir les ",
                  hiddenCount,
                  " message",
                  hiddenCount > 1 ? "s" : "",
                  " pr\xE9c\xE9dent",
                  hiddenCount > 1 ? "s" : ""
                ]
              }
            ),
            !messagesCollapsed && filtered.length > 1 && !isSearching && /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setMessagesCollapsed(true),
                style: {
                  background: "none",
                  border: `1px dashed ${C.border}`,
                  borderRadius: "6px",
                  padding: "8px",
                  cursor: "pointer",
                  color: C.textMuted,
                  fontSize: "12px",
                  fontWeight: 600,
                  textAlign: "center"
                },
                children: "Masquer les anciens messages"
              }
            ),
            visibleMessages.map((msg, msgIdx) => {
              const borderColor = msg.isInternal ? C.internalBorder : msg.fromChat ? "#bae6fd" : msg.authorType === "admin" ? "#bfdbfe" : msg.authorType === "email" ? "#fed7aa" : C.clientBorder;
              const bgColor = msg.isInternal ? C.internalBg : msg.fromChat ? "#f0f9ff" : msg.authorType === "admin" ? C.adminBg : msg.authorType === "email" ? C.emailBg : C.clientBg;
              const prevVisMsg = msgIdx > 0 ? visibleMessages[msgIdx - 1] : null;
              const showDateSep = msg.createdAt && (!prevVisMsg?.createdAt || new Date(msg.createdAt).toDateString() !== new Date(prevVisMsg.createdAt).toDateString());
              return /* @__PURE__ */ jsxs(React.Fragment, { children: [
                showDateSep && /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px", padding: "4px 0" }, children: [
                  /* @__PURE__ */ jsx("div", { style: { flex: 1, borderTop: `1px solid ${C.border}` } }),
                  /* @__PURE__ */ jsx("span", { style: { fontSize: "11px", fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap" }, children: getDateLabel(msg.createdAt) }),
                  /* @__PURE__ */ jsx("div", { style: { flex: 1, borderTop: `1px solid ${C.border}` } })
                ] }),
                /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px", alignItems: "flex-start" }, children: [
                  /* @__PURE__ */ jsx("div", { style: {
                    flexShrink: 0,
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#fff",
                    marginTop: "2px",
                    backgroundColor: msg.authorType === "admin" ? C.blue : msg.authorType === "email" ? C.orange : "#94a3b8"
                  }, children: msg.authorType === "admin" ? "CW" : client ? `${(client.firstName?.[0] || "").toUpperCase()}${(client.lastName?.[0] || "").toUpperCase()}` || "?" : "?" }),
                  /* @__PURE__ */ jsxs(
                    "div",
                    {
                      style: {
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: msg.isInternal ? `1px dashed ${C.internalBorder}` : `1px solid ${borderColor}`,
                        backgroundColor: bgColor
                      },
                      children: [
                        /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12px", alignItems: "center" }, children: [
                          /* @__PURE__ */ jsxs("span", { style: { fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }, children: [
                            msg.authorType === "email" ? /* @__PURE__ */ jsx("span", { style: s.badge(C.emailBg, C.orange), children: "Email" }) : /* @__PURE__ */ jsxs(
                              "select",
                              {
                                value: msg.authorType,
                                onChange: (e) => handleToggleAuthor(msg.id, e.target.value === "admin" ? "client" : "admin"),
                                disabled: togglingAuthor === msg.id,
                                style: {
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  border: `1px solid ${C.border}`,
                                  cursor: "pointer",
                                  backgroundColor: msg.authorType === "admin" ? "#eff6ff" : "#f9fafb",
                                  color: "#374151",
                                  opacity: togglingAuthor === msg.id ? 0.5 : 1
                                },
                                children: [
                                  /* @__PURE__ */ jsx("option", { value: "admin", children: "Support" }),
                                  /* @__PURE__ */ jsx("option", { value: "client", children: "Client" })
                                ]
                              }
                            ),
                            msg.fromChat && /* @__PURE__ */ jsx("span", { style: s.badge("#e0f2fe", "#0284c7"), children: "Chat" }),
                            msg.isInternal && /* @__PURE__ */ jsx("span", { style: s.badge("#fef3c7", "#92400e"), children: "Interne" }),
                            msg.scheduledAt && (() => {
                              const sched = msg;
                              const scheduledDate = new Date(sched.scheduledAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                              const createdDate = new Date(msg.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                              return sched.scheduledSent ? /* @__PURE__ */ jsxs("span", { style: s.badge("#f0fdf4", "#16a34a"), children: [
                                "\u2713",
                                " Programm\xE9 le ",
                                createdDate,
                                " \u2014 r\xE9dig\xE9 le ",
                                scheduledDate !== createdDate ? scheduledDate : createdDate
                              ] }) : /* @__PURE__ */ jsxs("span", { style: s.badge("#f3e8ff", "#7c3aed"), children: [
                                "\u23F0",
                                " R\xE9dig\xE9 le ",
                                createdDate,
                                " \u2014 envoi programm\xE9 le ",
                                scheduledDate
                              ] });
                            })()
                          ] }),
                          /* @__PURE__ */ jsxs("span", { style: { color: C.textMuted, fontWeight: 500, fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px" }, children: [
                            formatMessageDate(msg.createdAt),
                            msg.editedAt && /* @__PURE__ */ jsx("span", { style: { fontSize: "10px", color: "#6b7280", fontStyle: "italic" }, children: "(modifi\xE9)" }),
                            !msg.isInternal && !msg.deletedAt && /* @__PURE__ */ jsxs(
                              "button",
                              {
                                onClick: () => handleSplitMessage(msg.id, ticketSubject),
                                style: { background: "none", border: "none", cursor: "pointer", fontSize: "10px", color: "#6b7280", padding: 0 },
                                title: "Extraire en nouveau ticket",
                                children: [
                                  "\u2197",
                                  " Extraire"
                                ]
                              }
                            ),
                            msg.authorType === "admin" && !msg.isInternal && (() => {
                              const msgExt = msg;
                              const isRead = lastClientReadAt && msg.createdAt && new Date(msg.createdAt) < new Date(lastClientReadAt);
                              const sentAt = msgExt.emailSentAt;
                              const openedAt = msgExt.emailOpenedAt;
                              const sentTo = msgExt.emailSentTo;
                              if (openedAt) {
                                const openDate = new Date(openedAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
                                return /* @__PURE__ */ jsxs("span", { title: `Envoy\xE9 \xE0 ${sentTo || "?"} \u2014 Ouvert le ${openDate}`, style: { fontSize: "10px", color: "#16a34a", fontWeight: 600, cursor: "help" }, children: [
                                  "\u2709 Ouvert ",
                                  openDate
                                ] });
                              }
                              if (sentAt) {
                                const sentDate = new Date(sentAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
                                return /* @__PURE__ */ jsxs("span", { title: `Envoy\xE9 \xE0 ${sentTo || "?"} le ${sentDate}`, style: { fontSize: "10px", color: "#2563eb", fontWeight: 600, cursor: "help" }, children: [
                                  "\u2709 Envoy\xE9 \xE0 ",
                                  sentTo,
                                  " \u2014 ",
                                  sentDate
                                ] });
                              }
                              return /* @__PURE__ */ jsx("span", { style: { fontSize: "10px", color: isRead ? "#16a34a" : "#94a3b8", fontWeight: 600 }, children: isRead ? "\u2713\u2713 Lu" : "\u2713 Envoy\xE9" });
                            })()
                          ] })
                        ] }),
                        editingMsg === msg.id ? /* @__PURE__ */ jsxs("div", { style: { marginTop: "6px" }, children: [
                          /* @__PURE__ */ jsx(
                            "textarea",
                            {
                              value: editBody,
                              onChange: (e) => {
                                setEditBody(e.target.value);
                                setEditHtml(e.target.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />"));
                              },
                              rows: 4,
                              style: { ...s.input, width: "100%", resize: "vertical", fontSize: "13px" }
                            }
                          ),
                          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px", marginTop: "8px" }, children: [
                            /* @__PURE__ */ jsx("button", { onClick: () => handleEditSave(msg.id), disabled: savingEdit || !editBody.trim() && !editHtml, style: { ...s.btn(C.blue, savingEdit), fontSize: "11px", padding: "5px 12px" }, children: savingEdit ? "..." : "Enregistrer" }),
                            /* @__PURE__ */ jsx("button", { onClick: handleEditCancel, style: { ...s.ghostBtn("#6b7280"), fontSize: "11px", padding: "5px 12px" }, children: "Annuler" })
                          ] })
                        ] }) : msg.deletedAt ? /* @__PURE__ */ jsx("div", { style: { fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }, children: "Ce message a \xE9t\xE9 supprim\xE9." }) : msg.bodyHtml ? /* @__PURE__ */ jsxs(Fragment, { children: [
                          /* @__PURE__ */ jsx(
                            "div",
                            {
                              className: "rte-display",
                              style: { fontSize: "13px", color: "#374151", lineHeight: 1.5 },
                              dangerouslySetInnerHTML: { __html: msg.bodyHtml }
                            }
                          ),
                          /* @__PURE__ */ jsx(CodeBlockRendererHtml, { html: msg.bodyHtml })
                        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                          /* @__PURE__ */ jsx("div", { style: { whiteSpace: "pre-wrap", fontSize: "13px", color: "#374151", lineHeight: 1.5 }, children: searchQuery.trim() ? msg.body.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")).map(
                            (part, i) => part.toLowerCase() === searchQuery.toLowerCase() ? /* @__PURE__ */ jsx("mark", { style: { backgroundColor: "#fde68a", borderRadius: "2px", padding: "0 2px", fontWeight: 600 }, children: part }, i) : part
                          ) : msg.body }),
                          /* @__PURE__ */ jsx(CodeBlockRenderer, { text: msg.body })
                        ] }),
                        Array.isArray(msg.attachments) && msg.attachments.length > 0 && /* @__PURE__ */ jsx("div", { style: { marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }, children: msg.attachments.map((att, i) => {
                          const file = typeof att.file === "object" ? att.file : null;
                          if (!file) return null;
                          const mime = (file.mimeType || file.filename || "").toLowerCase();
                          const isImage = mime.includes("image/") || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(file.filename || "");
                          const isGif = mime.includes("image/gif") || /\.gif$/i.test(file.filename || "");
                          const isVideo = mime.includes("video/") || /\.(mp4|webm|mov|avi)$/i.test(file.filename || "");
                          if (isImage) {
                            return /* @__PURE__ */ jsx("a", { href: file.url || "#", target: "_blank", rel: "noopener noreferrer", style: { display: "block" }, children: /* @__PURE__ */ jsx(
                              "img",
                              {
                                src: file.url || "",
                                alt: file.filename || "Image",
                                style: {
                                  maxWidth: isGif ? 300 : 240,
                                  maxHeight: 200,
                                  borderRadius: "6px",
                                  border: `1px solid ${C.border}`,
                                  objectFit: "cover",
                                  cursor: "pointer"
                                }
                              }
                            ) }, i);
                          }
                          if (isVideo) {
                            return /* @__PURE__ */ jsx(
                              "video",
                              {
                                src: file.url || "",
                                controls: true,
                                preload: "metadata",
                                style: {
                                  maxWidth: 360,
                                  maxHeight: 240,
                                  borderRadius: "6px",
                                  border: `1px solid ${C.border}`,
                                  backgroundColor: "#000"
                                }
                              },
                              i
                            );
                          }
                          return /* @__PURE__ */ jsxs(
                            "a",
                            {
                              href: file.url || "#",
                              target: "_blank",
                              rel: "noopener noreferrer",
                              style: {
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 10px",
                                borderRadius: "4px",
                                border: `1px solid ${C.border}`,
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "#374151",
                                textDecoration: "none",
                                backgroundColor: C.white
                              },
                              children: [
                                "\u{1F4CE}",
                                " ",
                                file.filename || "Fichier"
                              ]
                            },
                            i
                          );
                        }) }),
                        editingMsg !== msg.id && !msg.fromChat && /* @__PURE__ */ jsxs("div", { style: { marginTop: "6px", display: "flex", gap: "12px", alignItems: "center" }, children: [
                          /* @__PURE__ */ jsx(
                            "button",
                            {
                              type: "button",
                              onClick: () => handleEditStart(msg),
                              style: { border: "none", background: "none", cursor: "pointer", fontSize: "11px", color: C.textSecondary, padding: 0, fontWeight: 600, textDecoration: "underline" },
                              children: "Modifier"
                            }
                          ),
                          /* @__PURE__ */ jsx(
                            "button",
                            {
                              type: "button",
                              onClick: () => handleDelete(msg.id),
                              disabled: deletingMsg === msg.id,
                              style: { border: "none", background: "none", cursor: "pointer", fontSize: "11px", color: "#ef4444", padding: 0, fontWeight: 600, textDecoration: "underline", opacity: deletingMsg === msg.id ? 0.3 : 1 },
                              children: "Supprimer"
                            }
                          ),
                          msg.authorType === "admin" && !msg.isInternal && /* @__PURE__ */ jsx(
                            "button",
                            {
                              type: "button",
                              onClick: () => handleResend(msg.id),
                              disabled: resendingMsg === msg.id,
                              style: { border: "none", background: "none", cursor: "pointer", fontSize: "11px", color: "#2563eb", padding: 0, fontWeight: 600, textDecoration: "underline", opacity: resendingMsg === msg.id ? 0.3 : 1 },
                              children: resendingMsg === msg.id ? "Envoi..." : resendSuccess === msg.id ? "Envoy\xE9 !" : "Renvoyer email"
                            }
                          )
                        ] })
                      ]
                    }
                  )
                ] })
              ] }, msg.id);
            })
          ] });
        })() }),
        clientTyping && /* @__PURE__ */ jsxs("div", { style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          fontSize: 12,
          color: "#7c3aed",
          fontWeight: 500
        }, children: [
          /* @__PURE__ */ jsxs("span", { style: { display: "flex", gap: 2 }, children: [
            /* @__PURE__ */ jsx("span", { style: { width: 5, height: 5, borderRadius: "50%", backgroundColor: "#7c3aed", animation: "bounce 1s infinite", animationDelay: "0ms" } }),
            /* @__PURE__ */ jsx("span", { style: { width: 5, height: 5, borderRadius: "50%", backgroundColor: "#7c3aed", animation: "bounce 1s infinite", animationDelay: "150ms" } }),
            /* @__PURE__ */ jsx("span", { style: { width: 5, height: 5, borderRadius: "50%", backgroundColor: "#7c3aed", animation: "bounce 1s infinite", animationDelay: "300ms" } })
          ] }),
          clientTypingName || "Client",
          " est en train d'\xE9crire..."
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { marginBottom: "16px" }, children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "6px", alignItems: "center", overflowX: "auto", paddingBottom: "8px", marginBottom: "6px", flexWrap: "wrap" }, children: [
            [
              "Bien re\xE7u, je regarde \xE7a !",
              "C'est corrig\xE9 !",
              "Pouvez-vous pr\xE9ciser ?",
              "Je reviens vers vous rapidement",
              "Pouvez-vous m'envoyer une capture d'\xE9cran ?"
            ].map((text) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => {
                  setReplyBody(text);
                  const html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                  setReplyHtml(html);
                  if (replyEditorRef.current?.setContent) {
                    replyEditorRef.current.setContent(html);
                  }
                },
                onMouseEnter: (e) => {
                  e.currentTarget.style.backgroundColor = "#f1f5f9";
                },
                onMouseLeave: (e) => {
                  e.currentTarget.style.backgroundColor = "white";
                },
                style: {
                  padding: "3px 10px",
                  borderRadius: "14px",
                  border: `1px solid ${C.border}`,
                  backgroundColor: "white",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#475569",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                },
                children: text
              },
              text
            )),
            features.ai && /* @__PURE__ */ jsx(
              "button",
              {
                onClick: handleAiSuggestReply,
                disabled: aiReplying || messages.length === 0,
                style: { ...s.outlineBtn("#7c3aed", aiReplying || messages.length === 0), fontSize: "11px", padding: "3px 10px", borderRadius: "14px" },
                children: aiReplying ? "G\xE9n\xE9ration..." : "Suggestion IA"
              }
            ),
            features.ai && /* @__PURE__ */ jsx(
              RewriteDropdown,
              {
                disabled: aiRewriting || !replyBody.trim(),
                loading: aiRewriting,
                onSelect: (style) => handleAiRewrite(style)
              }
            ),
            /* @__PURE__ */ jsx(
              CodeBlockInserter,
              {
                style: { ...s.outlineBtn("#059669", false), fontSize: "11px", padding: "3px 10px", borderRadius: "14px" },
                onInsert: (block) => {
                  const nb = replyBody ? replyBody + block : block;
                  setReplyBody(nb);
                  setReplyHtml(nb.replace(/\n/g, "<br/>"));
                  replyEditorRef.current?.setContent(nb.replace(/\n/g, "<br/>"));
                }
              }
            ),
            features.canned && cannedResponses.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs("select", { onChange: handleCannedSelect, style: { ...s.input, fontSize: "11px", padding: "3px 8px", fontWeight: 600 }, children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "R\xE9ponse rapide..." }),
                cannedResponses.map((cr) => /* @__PURE__ */ jsx("option", { value: String(cr.id), children: cr.title }, cr.id))
              ] }),
              /* @__PURE__ */ jsx(
                "span",
                {
                  title: "Variables disponibles : {{client.firstName}}, {{client.lastName}}, {{client.company}}, {{client.email}}, {{ticket.number}}, {{ticket.subject}}, {{agent.name}}",
                  style: { cursor: "help", fontSize: "13px", color: C.textMuted },
                  children: "\u24D8"
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { style: { border: `1px solid ${C.border}`, borderRadius: "8px", overflow: "hidden" }, children: /* @__PURE__ */ jsx(
            "textarea",
            {
              value: replyBody,
              onChange: (e) => {
                const text = e.target.value;
                setReplyBody(text);
                setReplyHtml(text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />"));
                sendAdminTyping();
              },
              placeholder: "\xC9crire une r\xE9ponse au client...",
              style: {
                width: "100%",
                minHeight: "120px",
                padding: "12px",
                border: "none",
                outline: "none",
                fontSize: "14px",
                lineHeight: 1.5,
                resize: "vertical",
                fontFamily: "inherit",
                color: "#374151",
                backgroundColor: "transparent",
                boxSizing: "border-box"
              }
            }
          ) }),
          /* @__PURE__ */ jsxs("div", { style: { marginTop: "8px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                ref: fileInputRef,
                type: "file",
                multiple: true,
                onChange: handleReplyFileChange,
                style: { display: "none" },
                accept: "image/*,.pdf,.doc,.docx,.txt,.zip"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => fileInputRef.current?.click(),
                style: { ...s.ghostBtn("#6b7280"), fontSize: "12px", padding: "5px 10px" },
                children: "+ Pi\xE8ce jointe"
              }
            ),
            replyFiles.length > 0 && /* @__PURE__ */ jsx(Fragment, { children: replyFiles.map((file, i) => /* @__PURE__ */ jsxs("span", { style: { ...s.badge("#f1f5f9", "#374151"), display: "inline-flex", alignItems: "center", gap: "4px" }, children: [
              "\u{1F4CE}",
              " ",
              file.name,
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setReplyFiles((prev) => prev.filter((_, idx) => idx !== i)),
                  style: { border: "none", background: "none", color: "#ef4444", fontWeight: 700, cursor: "pointer", fontSize: "14px", lineHeight: 1 },
                  children: "\xD7"
                }
              )
            ] }, i)) })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: "8px" }, children: [
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: sendAsClient ? "client" : "admin",
                onChange: (e) => setSendAsClient(e.target.value === "client"),
                style: { ...s.input, fontSize: "12px", padding: "6px 8px", fontWeight: 600 },
                children: [
                  /* @__PURE__ */ jsx("option", { value: "admin", children: "En tant que : Support" }),
                  /* @__PURE__ */ jsx("option", { value: "client", children: "En tant que : Client" })
                ]
              }
            ),
            /* @__PURE__ */ jsxs("label", { style: { display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }, children: [
              /* @__PURE__ */ jsx("input", { type: "checkbox", checked: isInternal, onChange: (e) => {
                setIsInternal(e.target.checked);
                if (e.target.checked) setNotifyClient(false);
              }, style: { width: "14px", height: "14px", accentColor: C.amber } }),
              "Note interne"
            ] }),
            !isInternal && /* @__PURE__ */ jsxs("label", { style: { display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }, children: [
              /* @__PURE__ */ jsx("input", { type: "checkbox", checked: notifyClient, onChange: (e) => setNotifyClient(e.target.checked), style: { width: "14px", height: "14px", accentColor: "#16a34a" } }),
              "Envoyer au client"
            ] }),
            /* @__PURE__ */ jsx("button", { "data-action": "send-reply", onClick: handleSendReply, disabled: sending || !replyBody.trim() && !replyHtml, style: { ...s.btn(isInternal ? C.amber : notifyClient ? "#16a34a" : C.blue, sending || !replyBody.trim() && !replyHtml), fontSize: "13px", padding: "8px 20px", marginLeft: "auto" }, children: sending ? "Envoi..." : isInternal ? "Ajouter note" : notifyClient ? "Envoyer + Notifier" : "Sauvegarder" }),
            !isInternal && /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setShowSchedule(!showSchedule),
                disabled: !replyBody.trim() && !replyHtml,
                style: { ...s.outlineBtn("#7c3aed", !replyBody.trim() && !replyHtml), fontSize: "12px", padding: "8px 12px" },
                title: "Programmer l'envoi \xE0 une date/heure pr\xE9cise",
                children: "\u23F0"
              }
            )
          ] }),
          showSchedule && /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginTop: "8px", padding: "10px 14px", borderRadius: "8px", backgroundColor: "#faf5ff", border: "1px solid #e9d5ff" }, children: [
            /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", fontWeight: 600, color: "#7c3aed" }, children: "Programmer pour :" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "datetime-local",
                value: scheduleDate,
                onChange: (e) => setScheduleDate(e.target.value),
                min: (/* @__PURE__ */ new Date()).toISOString().slice(0, 16),
                style: { ...s.input, fontSize: "12px", width: "auto" }
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: handleScheduleReply,
                disabled: sending || !scheduleDate || !replyBody.trim() && !replyHtml,
                style: { ...s.btn("#7c3aed", sending || !scheduleDate || !replyBody.trim() && !replyHtml), fontSize: "12px", padding: "6px 14px" },
                children: sending ? "..." : "\u23F0 Programmer"
              }
            ),
            /* @__PURE__ */ jsx("button", { onClick: () => setShowSchedule(false), style: { background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "14px" }, children: "\u2715" })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { fontSize: "11px", color: C.textMuted, marginTop: "4px", textAlign: "right" }, children: [
            "\u2318",
            "Enter pour envoyer \xB7 ",
            "\u2318",
            "\u21E7",
            "N note interne"
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { style: { borderTop: `1px solid ${C.border}`, marginBottom: "16px" } }),
        /* @__PURE__ */ jsx(
          QuickActions,
          {
            statusTransitions,
            statusUpdating,
            onStatusChange: handleStatusChange,
            snoozeUntil,
            snoozeSaving,
            onCancelSnooze: () => handleSnooze(null),
            showMerge,
            showExtMsg,
            showSnooze,
            onToggleMerge: () => {
              setShowMerge(!showMerge);
              setShowExtMsg(false);
              setShowSnooze(false);
            },
            onToggleExtMsg: () => {
              setShowExtMsg(!showExtMsg);
              setShowMerge(false);
              setShowSnooze(false);
            },
            onToggleSnooze: () => {
              setShowSnooze(!showSnooze);
              setShowMerge(false);
              setShowExtMsg(false);
            },
            onNextTicket: handleNextTicket,
            showNextTicket,
            nextTicketId,
            nextTicketInfo,
            onCloseNextTicket: () => setShowNextTicket(false)
          }
        ),
        features.ai && /* @__PURE__ */ jsx(
          AISummaryPanel,
          {
            showAiSummary,
            setShowAiSummary,
            aiSummary,
            aiGenerating,
            aiSaving,
            aiSaved,
            handleAiGenerate,
            handleAiSave
          }
        ),
        features.merge && showMerge && /* @__PURE__ */ jsx(
          MergePanel,
          {
            mergeTarget,
            setMergeTarget,
            mergeTargetInfo,
            setMergeTargetInfo,
            mergeError,
            setMergeError,
            merging,
            handleMergeLookup,
            handleMerge
          }
        ),
        features.externalMessages && showExtMsg && /* @__PURE__ */ jsx(
          ExtMessagePanel,
          {
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
          }
        ),
        features.snooze && showSnooze && /* @__PURE__ */ jsx(SnoozePanel, { snoozeSaving, handleSnooze })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: layoutStyles.sideColumn, children: [
        /* @__PURE__ */ jsx(
          TimeTrackingPanel,
          {
            timeEntries,
            totalMinutes,
            timerRunning,
            timerSeconds,
            setTimerSeconds,
            timerDescription,
            setTimerDescription,
            handleTimerStart,
            handleTimerStop,
            handleTimerSave,
            handleTimerDiscard,
            duration,
            setDuration,
            timeDescription,
            setTimeDescription,
            handleAddTime,
            addingTime,
            timeSuccess
          }
        ),
        features.clientHistory && client && /* @__PURE__ */ jsx(
          ClientHistory,
          {
            client,
            clientTickets,
            clientProjects,
            clientNotes,
            onNotesChange: (v) => {
              setClientNotes(v);
              setNotesSaved(false);
            },
            onNotesSave: async () => {
              if (!client) return;
              setSavingNotes(true);
              try {
                const res = await fetch(`/api/support-clients/${client.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ notes: clientNotes })
                });
                if (res.ok) {
                  setNotesSaved(true);
                  setTimeout(() => setNotesSaved(false), 3e3);
                }
              } catch {
              } finally {
                setSavingNotes(false);
              }
            },
            savingNotes,
            notesSaved
          }
        ),
        features.activityLog && /* @__PURE__ */ jsx(ActivityLog, { activityLog }),
        /* @__PURE__ */ jsx("div", { style: s.section, children: /* @__PURE__ */ jsx(
          "a",
          {
            href: "/api/support/export-csv",
            target: "_blank",
            rel: "noopener noreferrer",
            style: { ...s.ghostBtn("#6b7280"), fontSize: "12px", textDecoration: "none", display: "inline-block" },
            children: "Exporter tous les tickets (CSV)"
          }
        ) })
      ] })
    ] })
  ] });
};
var TicketConversation_default = TicketConversation;

export { TicketConversation_default as default };
