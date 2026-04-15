"use client";
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation.js';
import styles from '../../styles/ChatView.module.scss';

const ChatViewClient = () => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState({ active: [], closed: [] });
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cannedResponses, setCannedResponses] = useState([]);
  const messagesEndRef = useRef(null);
  const lastFetchRef = useRef(null);
  const sessionsPollInterval = useRef(5e3);
  const sessionsPollTimeout = useRef(void 0);
  const messagesPollInterval = useRef(3e3);
  const messagesPollTimeout = useRef(void 0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const fetchSessions = useCallback(async () => {
    let hadChanges = false;
    try {
      const res = await fetch("/api/support/admin-chat");
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSessions((prev) => {
          const newActive = data.active || [];
          const newClosed = data.closed || [];
          if (JSON.stringify(prev.active) !== JSON.stringify(newActive) || JSON.stringify(prev.closed) !== JSON.stringify(newClosed)) {
            hadChanges = true;
            return { active: newActive, closed: newClosed };
          }
          return prev;
        });
      }
    } catch {
    }
    setLoading(false);
    if (hadChanges) {
      sessionsPollInterval.current = 5e3;
    } else {
      sessionsPollInterval.current = Math.min(sessionsPollInterval.current + 2e3, 15e3);
    }
  }, []);
  useEffect(() => {
    fetchSessions();
    if (sessionExpired) return;
    const schedulePoll = () => {
      sessionsPollTimeout.current = setTimeout(async () => {
        await fetchSessions();
        schedulePoll();
      }, sessionsPollInterval.current);
    };
    schedulePoll();
    return () => clearTimeout(sessionsPollTimeout.current);
  }, [fetchSessions, sessionExpired]);
  useEffect(() => {
    fetch("/api/canned-responses?sort=sortOrder&limit=50&depth=0", { credentials: "include" }).then((res) => res.ok ? res.json() : null).then((data) => {
      if (data?.docs) setCannedResponses(data.docs);
    }).catch(() => {
    });
  }, []);
  useEffect(() => {
    if (!selectedSession) return;
    const fetchMessages = async () => {
      let hadNewMessages = false;
      try {
        const after = lastFetchRef.current || "";
        const url = `/api/support/admin-chat?session=${selectedSession}${after ? `&after=${after}` : ""}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (!lastFetchRef.current) {
            setMessages(data.messages || []);
            hadNewMessages = (data.messages?.length || 0) > 0;
          } else if (data.messages?.length > 0) {
            setMessages((prev) => {
              const ids = new Set(prev.map((m) => m.id));
              const newMsgs = data.messages.filter((m) => !ids.has(m.id));
              return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
            });
            hadNewMessages = true;
          }
          if (data.messages?.length > 0) {
            lastFetchRef.current = data.messages[data.messages.length - 1].createdAt;
          }
        }
      } catch {
      }
      if (hadNewMessages) {
        messagesPollInterval.current = 3e3;
      } else {
        messagesPollInterval.current = Math.min(messagesPollInterval.current + 1e3, 1e4);
      }
    };
    lastFetchRef.current = null;
    messagesPollInterval.current = 3e3;
    fetchMessages();
    const schedulePoll = () => {
      messagesPollTimeout.current = setTimeout(async () => {
        await fetchMessages();
        schedulePoll();
      }, messagesPollInterval.current);
    };
    schedulePoll();
    return () => clearTimeout(messagesPollTimeout.current);
  }, [selectedSession]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedSession || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/support/admin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", session: selectedSession, message: input.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        lastFetchRef.current = data.message.createdAt;
        setInput("");
      }
    } catch {
    }
    setSending(false);
  };
  const closeSession = async () => {
    if (!selectedSession) return;
    try {
      await fetch("/api/support/admin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", session: selectedSession })
      });
      setSelectedSession(null);
      fetchSessions();
    } catch {
    }
  };
  const getClientName = (client) => {
    if (typeof client === "number") return `Client #${client}`;
    const parts = [client.firstName, client.lastName].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    return client.email || `Client #${client.id}`;
  };
  const getClientCompany = (client) => {
    if (typeof client === "number") return "";
    return client.company || "";
  };
  const displayedSessions = showClosed ? sessions.closed : sessions.active;
  return /* @__PURE__ */ jsxs("div", { className: styles.page, children: [
    /* @__PURE__ */ jsx("div", { className: styles.header, children: /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h1", { className: styles.title, children: t("chat.title") }),
      /* @__PURE__ */ jsx("p", { className: styles.subtitle, children: sessions.active.length !== 1 ? t("chat.sessionCountPlural", { count: String(sessions.active.length) }) : t("chat.sessionCount", { count: String(sessions.active.length) }) })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: styles.container, children: [
      /* @__PURE__ */ jsxs("div", { className: styles.sidebar, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.tabs, children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setShowClosed(false),
              className: `${styles.tab} ${!showClosed ? styles.tabActive : ""}`,
              children: [
                t("chat.tabs.active"),
                " (",
                sessions.active.length,
                ")"
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setShowClosed(true),
              className: `${styles.tab} ${showClosed ? styles.tabActive : ""}`,
              children: [
                t("chat.tabs.closed"),
                " (",
                sessions.closed.length,
                ")"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: styles.sessionList, children: loading ? /* @__PURE__ */ jsx("div", { className: styles.loadingState, children: /* @__PURE__ */ jsx("div", { className: styles.emptyState, children: t("common.loading") }) }) : displayedSessions.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.emptyState, children: showClosed ? t("chat.noSessionClosed") : t("chat.noSessionActive") }) : displayedSessions.map((s) => /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setSelectedSession(s.session),
            className: `${styles.sessionItem} ${selectedSession === s.session ? styles.sessionItemActive : ""}`,
            children: [
              /* @__PURE__ */ jsxs("div", { className: styles.sessionHeader, children: [
                /* @__PURE__ */ jsx("span", { className: styles.sessionName, children: getClientName(s.client) }),
                s.unreadCount > 0 && /* @__PURE__ */ jsx("span", { className: styles.unreadBadge, children: s.unreadCount })
              ] }),
              getClientCompany(s.client) && /* @__PURE__ */ jsx("div", { className: styles.sessionCompany, children: getClientCompany(s.client) }),
              /* @__PURE__ */ jsx("div", { className: styles.sessionPreview, children: s.lastMessage.startsWith("Note:") ? /* @__PURE__ */ jsx("span", { className: styles.sessionRating, children: s.lastMessage.match(/[★☆]+/)?.[0] || "\u2B50" }) : s.lastMessage }),
              /* @__PURE__ */ jsxs("div", { className: styles.sessionMeta, children: [
                new Date(s.lastMessageAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
                " \xB7 ",
                s.messageCount,
                " ",
                t("chat.msg")
              ] })
            ]
          },
          s.session
        )) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: styles.chatPanel, children: !selectedSession ? /* @__PURE__ */ jsx("div", { className: styles.chatEmpty, children: t("chat.selectSession") }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: styles.chatHeader, children: [
          /* @__PURE__ */ jsx("span", { className: styles.chatSessionId, children: selectedSession }),
          /* @__PURE__ */ jsx("button", { onClick: closeSession, className: styles.closeBtn, children: t("chat.closeChat") })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.messagesArea, children: [
          messages.map((msg) => /* @__PURE__ */ jsx(
            "div",
            {
              className: `${styles.messageRow} ${msg.senderType === "agent" ? styles.messageRowAgent : msg.senderType === "system" ? styles.messageRowSystem : styles.messageRowClient}`,
              children: msg.senderType === "system" ? msg.message.startsWith("Note:") || msg.message.startsWith("Commentaire:") ? /* @__PURE__ */ jsxs("div", { className: styles.bubbleRating, children: [
                msg.message.includes("\u2605") && /* @__PURE__ */ jsx("div", { className: styles.ratingStars, children: msg.message.match(/[★☆]+/)?.[0] || "" }),
                /* @__PURE__ */ jsx("div", { className: styles.ratingComment, children: msg.message.includes("\u2014") ? msg.message.split("\u2014").slice(1).join("\u2014").trim() : msg.message.replace(/Note:\s*[★☆]+\s*\(\d\/5\)\s*/, "").replace("Commentaire: ", "") }),
                /* @__PURE__ */ jsxs("div", { className: styles.ratingMeta, children: [
                  t("chat.clientReview"),
                  " \xB7 ",
                  new Date(msg.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                ] })
              ] }) : /* @__PURE__ */ jsx("div", { className: styles.bubbleSystem, children: msg.message }) : /* @__PURE__ */ jsxs("div", { className: `${styles.bubble} ${msg.senderType === "agent" ? styles.bubbleAgent : styles.bubbleClient}`, children: [
                /* @__PURE__ */ jsx("div", { className: styles.bubbleSender, children: msg.senderType === "agent" ? msg.agent ? `${msg.agent.firstName || t("chat.agent")}` : t("chat.you") : t("chat.clientLabel") }),
                /* @__PURE__ */ jsx("div", { className: styles.bubbleBody, children: msg.message }),
                /* @__PURE__ */ jsx("div", { className: styles.bubbleTime, children: new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) })
              ] })
            },
            msg.id
          )),
          /* @__PURE__ */ jsx("div", { ref: messagesEndRef })
        ] }),
        /* @__PURE__ */ jsxs("form", { onSubmit: sendMessage, className: styles.composer, children: [
          cannedResponses.length > 0 && /* @__PURE__ */ jsxs(
            "select",
            {
              onChange: (e) => {
                const cr = cannedResponses.find((c) => String(c.id) === e.target.value);
                if (cr) setInput(cr.body);
                e.target.value = "";
              },
              className: styles.cannedSelect,
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: t("chat.quickReply") }),
                cannedResponses.map((cr) => /* @__PURE__ */ jsx("option", { value: String(cr.id), children: cr.title }, cr.id))
              ]
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: styles.composerRow, children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: input,
                onChange: (e) => setInput(e.target.value),
                placeholder: t("chat.inputPlaceholder"),
                maxLength: 2e3,
                className: styles.composerInput,
                autoFocus: true
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "submit",
                disabled: !input.trim() || sending,
                className: styles.sendBtn,
                children: t("chat.sendButton")
              }
            )
          ] })
        ] })
      ] }) })
    ] })
  ] });
};

export { ChatViewClient };
