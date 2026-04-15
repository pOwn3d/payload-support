'use strict';

var react = require('react');

function useMessageActions(id, client, fetchAll) {
  const [togglingAuthor, setTogglingAuthor] = react.useState(null);
  const [editingMsg, setEditingMsg] = react.useState(null);
  const [editBody, setEditBody] = react.useState("");
  const [editHtml, setEditHtml] = react.useState("");
  const [savingEdit, setSavingEdit] = react.useState(false);
  const [deletingMsg, setDeletingMsg] = react.useState(null);
  const [resendingMsg, setResendingMsg] = react.useState(null);
  const [resendSuccess, setResendSuccess] = react.useState(null);
  const handleEditStart = (msg) => {
    setEditingMsg(msg.id);
    setEditBody(msg.body);
    setEditHtml(msg.bodyHtml || msg.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />"));
  };
  const handleEditSave = async (msgId) => {
    if (!editBody.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/ticket-messages/${msgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: editBody.trim(), ...editHtml ? { bodyHtml: editHtml } : {} })
      });
      if (res.ok) {
        setEditingMsg(null);
        setEditBody("");
        fetchAll();
      }
    } catch {
    } finally {
      setSavingEdit(false);
    }
  };
  const handleEditCancel = () => {
    setEditingMsg(null);
    setEditBody("");
    setEditHtml("");
  };
  const handleDelete = async (msgId) => {
    if (!window.confirm("Supprimer ce message ?")) return;
    setDeletingMsg(msgId);
    try {
      const res = await fetch(`/api/ticket-messages/${msgId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) fetchAll();
    } catch {
    } finally {
      setDeletingMsg(null);
    }
  };
  const handleResend = async (msgId) => {
    setResendingMsg(msgId);
    setResendSuccess(null);
    try {
      const res = await fetch("/api/support/resend-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messageId: msgId })
      });
      if (res.ok) {
        setResendSuccess(msgId);
        setTimeout(() => setResendSuccess(null), 3e3);
      }
    } catch {
    } finally {
      setResendingMsg(null);
    }
  };
  const handleToggleAuthor = async (msgId, currentType) => {
    const newType = currentType === "admin" ? "client" : "admin";
    setTogglingAuthor(msgId);
    try {
      const patchData = { authorType: newType };
      if (newType === "client" && client) {
        patchData.authorClient = client.id;
      }
      const res = await fetch(`/api/ticket-messages/${msgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patchData)
      });
      if (res.ok) fetchAll();
    } catch {
    } finally {
      setTogglingAuthor(null);
    }
  };
  const handleSplitMessage = async (msgId, ticketSubject) => {
    const subject = prompt("Sujet du nouveau ticket :", `Split: ${ticketSubject}`);
    if (!subject) return;
    try {
      const res = await fetch("/api/support/split-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messageId: msgId, subject })
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Ticket ${data.ticketNumber} cr\xE9\xE9`);
        fetchAll();
      }
    } catch {
    }
  };
  return {
    togglingAuthor,
    editingMsg,
    editBody,
    editHtml,
    setEditHtml,
    savingEdit,
    handleEditStart,
    handleEditSave,
    handleEditCancel,
    deletingMsg,
    handleDelete,
    resendingMsg,
    resendSuccess,
    handleResend,
    handleToggleAuthor,
    handleSplitMessage,
    setEditBody
  };
}

exports.useMessageActions = useMessageActions;
