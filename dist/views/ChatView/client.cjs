'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');
var useTranslation = require('../../components/TicketConversation/hooks/useTranslation');
var styles = require('../../styles/ChatView.module.scss');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var styles__default = /*#__PURE__*/_interopDefault(styles);

const ChatViewClient = () => {
  const { t } = useTranslation.useTranslation();
  const [sessions, setSessions] = react.useState({ active: [], closed: [] });
  const [selectedSession, setSelectedSession] = react.useState(null);
  const [messages, setMessages] = react.useState([]);
  const [input, setInput] = react.useState("");
  const [sending, setSending] = react.useState(false);
  const [showClosed, setShowClosed] = react.useState(false);
  const [loading, setLoading] = react.useState(true);
  const [cannedResponses, setCannedResponses] = react.useState([]);
  const messagesEndRef = react.useRef(null);
  const lastFetchRef = react.useRef(null);
  const sessionsPollInterval = react.useRef(5e3);
  const sessionsPollTimeout = react.useRef(void 0);
  const messagesPollInterval = react.useRef(3e3);
  const messagesPollTimeout = react.useRef(void 0);
  const [sessionExpired, setSessionExpired] = react.useState(false);
  const fetchSessions = react.useCallback(async () => {
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
  react.useEffect(() => {
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
  react.useEffect(() => {
    fetch("/api/canned-responses?sort=sortOrder&limit=50&depth=0", { credentials: "include" }).then((res) => res.ok ? res.json() : null).then((data) => {
      if (data?.docs) setCannedResponses(data.docs);
    }).catch(() => {
    });
  }, []);
  react.useEffect(() => {
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
  react.useEffect(() => {
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
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.page, children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.header, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntime.jsx("h1", { className: styles__default.default.title, children: t("chat.title") }),
      /* @__PURE__ */ jsxRuntime.jsx("p", { className: styles__default.default.subtitle, children: sessions.active.length !== 1 ? t("chat.sessionCountPlural", { count: String(sessions.active.length) }) : t("chat.sessionCount", { count: String(sessions.active.length) }) })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.container, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.sidebar, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.tabs, children: [
          /* @__PURE__ */ jsxRuntime.jsxs(
            "button",
            {
              onClick: () => setShowClosed(false),
              className: `${styles__default.default.tab} ${!showClosed ? styles__default.default.tabActive : ""}`,
              children: [
                t("chat.tabs.active"),
                " (",
                sessions.active.length,
                ")"
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsxs(
            "button",
            {
              onClick: () => setShowClosed(true),
              className: `${styles__default.default.tab} ${showClosed ? styles__default.default.tabActive : ""}`,
              children: [
                t("chat.tabs.closed"),
                " (",
                sessions.closed.length,
                ")"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.sessionList, children: loading ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.loadingState, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.emptyState, children: t("common.loading") }) }) : displayedSessions.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.emptyState, children: showClosed ? t("chat.noSessionClosed") : t("chat.noSessionActive") }) : displayedSessions.map((s) => /* @__PURE__ */ jsxRuntime.jsxs(
          "button",
          {
            onClick: () => setSelectedSession(s.session),
            className: `${styles__default.default.sessionItem} ${selectedSession === s.session ? styles__default.default.sessionItemActive : ""}`,
            children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.sessionHeader, children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.sessionName, children: getClientName(s.client) }),
                s.unreadCount > 0 && /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.unreadBadge, children: s.unreadCount })
              ] }),
              getClientCompany(s.client) && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.sessionCompany, children: getClientCompany(s.client) }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.sessionPreview, children: s.lastMessage.startsWith("Note:") ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.sessionRating, children: s.lastMessage.match(/[★☆]+/)?.[0] || "\u2B50" }) : s.lastMessage }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.sessionMeta, children: [
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
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.chatPanel, children: !selectedSession ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.chatEmpty, children: t("chat.selectSession") }) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.chatHeader, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: styles__default.default.chatSessionId, children: selectedSession }),
          /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: closeSession, className: styles__default.default.closeBtn, children: t("chat.closeChat") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.messagesArea, children: [
          messages.map((msg) => /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: `${styles__default.default.messageRow} ${msg.senderType === "agent" ? styles__default.default.messageRowAgent : msg.senderType === "system" ? styles__default.default.messageRowSystem : styles__default.default.messageRowClient}`,
              children: msg.senderType === "system" ? msg.message.startsWith("Note:") || msg.message.startsWith("Commentaire:") ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.bubbleRating, children: [
                msg.message.includes("\u2605") && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.ratingStars, children: msg.message.match(/[★☆]+/)?.[0] || "" }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.ratingComment, children: msg.message.includes("\u2014") ? msg.message.split("\u2014").slice(1).join("\u2014").trim() : msg.message.replace(/Note:\s*[★☆]+\s*\(\d\/5\)\s*/, "").replace("Commentaire: ", "") }),
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.ratingMeta, children: [
                  t("chat.clientReview"),
                  " \xB7 ",
                  new Date(msg.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                ] })
              ] }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.bubbleSystem, children: msg.message }) : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `${styles__default.default.bubble} ${msg.senderType === "agent" ? styles__default.default.bubbleAgent : styles__default.default.bubbleClient}`, children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.bubbleSender, children: msg.senderType === "agent" ? msg.agent ? `${msg.agent.firstName || t("chat.agent")}` : t("chat.you") : t("chat.clientLabel") }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.bubbleBody, children: msg.message }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles__default.default.bubbleTime, children: new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) })
              ] })
            },
            msg.id
          )),
          /* @__PURE__ */ jsxRuntime.jsx("div", { ref: messagesEndRef })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("form", { onSubmit: sendMessage, className: styles__default.default.composer, children: [
          cannedResponses.length > 0 && /* @__PURE__ */ jsxRuntime.jsxs(
            "select",
            {
              onChange: (e) => {
                const cr = cannedResponses.find((c) => String(c.id) === e.target.value);
                if (cr) setInput(cr.body);
                e.target.value = "";
              },
              className: styles__default.default.cannedSelect,
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "", children: t("chat.quickReply") }),
                cannedResponses.map((cr) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: String(cr.id), children: cr.title }, cr.id))
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles__default.default.composerRow, children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                type: "text",
                value: input,
                onChange: (e) => setInput(e.target.value),
                placeholder: t("chat.inputPlaceholder"),
                maxLength: 2e3,
                className: styles__default.default.composerInput,
                autoFocus: true
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "submit",
                disabled: !input.trim() || sending,
                className: styles__default.default.sendBtn,
                children: t("chat.sendButton")
              }
            )
          ] })
        ] })
      ] }) })
    ] })
  ] });
};

exports.ChatViewClient = ChatViewClient;
