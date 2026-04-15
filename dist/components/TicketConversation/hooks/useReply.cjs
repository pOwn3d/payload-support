'use strict';

var react = require('react');

function useReply(id, client, cannedResponses, ticketNumber, ticketSubject, fetchAll, handleNextTicket, replyEditorRef) {
  const fileInputRef = react.useRef(null);
  const [replyBody, setReplyBody] = react.useState("");
  const [replyHtml, setReplyHtml] = react.useState("");
  const [replyFiles, setReplyFiles] = react.useState([]);
  const [isInternal, setIsInternal] = react.useState(false);
  const [notifyClient, setNotifyClient] = react.useState(false);
  const [sendAsClient, setSendAsClient] = react.useState(false);
  const [sending, setSending] = react.useState(false);
  const [showSchedule, setShowSchedule] = react.useState(false);
  const [scheduleDate, setScheduleDate] = react.useState("");
  const handleEditorFileUpload = react.useCallback(async (file) => {
    if (file.size > 5 * 1024 * 1024) return null;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("_payload", JSON.stringify({ alt: file.name }));
    try {
      const res = await fetch("/api/media", { method: "POST", credentials: "include", body: formData });
      if (res.ok) {
        const data = await res.json();
        return data.doc?.url || null;
      }
    } catch {
    }
    return null;
  }, []);
  const replaceCannedVariables = react.useCallback((text) => {
    let result = text;
    if (client) {
      result = result.replace(/\{\{client\.firstName\}\}/g, client.firstName || "Client");
      result = result.replace(/\{\{client\.lastName\}\}/g, client.lastName || "");
      result = result.replace(/\{\{client\.company\}\}/g, client.company || "");
      result = result.replace(/\{\{client\.email\}\}/g, client.email || "");
      result = result.replace(/\{\{clientName\}\}/g, client.firstName || "Client");
    }
    result = result.replace(/\{\{ticket\.number\}\}/g, ticketNumber || "");
    result = result.replace(/\{\{ticket\.subject\}\}/g, ticketSubject || "");
    result = result.replace(/\{\{agent\.name\}\}/g, "Support");
    return result;
  }, [client, ticketNumber, ticketSubject]);
  const handleCannedSelect = (e) => {
    const selected = cannedResponses.find((cr) => String(cr.id) === e.target.value);
    if (selected) {
      const body = replaceCannedVariables(selected.body);
      const html = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />");
      setReplyBody(body);
      setReplyHtml(html);
      replyEditorRef.current?.setContent(html);
    }
    e.target.value = "";
  };
  const handleReplyFileChange = (e) => {
    if (e.target.files) {
      const maxSize = 1 * 1024 * 1024;
      const newFiles = Array.from(e.target.files);
      const tooLarge = newFiles.filter((f) => f.size > maxSize);
      if (tooLarge.length > 0) {
        alert(`Fichier(s) trop volumineux (max 1 Mo) : ${tooLarge.map((f) => f.name).join(", ")}`);
      }
      setReplyFiles((prev) => [...prev, ...newFiles.filter((f) => f.size <= maxSize)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const uploadFiles = async (files) => {
    const uploadedIds = [];
    for (const file of files) {
      if (file.size > 1 * 1024 * 1024) continue;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("_payload", JSON.stringify({ alt: file.name }));
      const uploadRes = await fetch("/api/media", { method: "POST", credentials: "include", body: formData });
      if (uploadRes.ok) {
        const d = await uploadRes.json();
        if (d.doc?.id) uploadedIds.push(d.doc.id);
      }
    }
    return uploadedIds;
  };
  const resetReply = () => {
    setReplyBody("");
    setReplyHtml("");
    setReplyFiles([]);
    setIsInternal(false);
    setNotifyClient(false);
    setSendAsClient(false);
    replyEditorRef.current?.clear();
  };
  const handleSendReply = async () => {
    if (!replyBody.trim() || !id) return;
    setSending(true);
    try {
      const uploadedIds = await uploadFiles(replyFiles);
      const finalBody = replyBody.trim() || (replyHtml ? "[Contenu enrichi]" : "");
      const messageData = {
        ticket: id,
        body: finalBody,
        ...replyHtml ? { bodyHtml: replyHtml } : {},
        authorType: sendAsClient ? "client" : "admin",
        isInternal,
        skipNotification: isInternal || !notifyClient,
        ...sendAsClient && client ? { authorClient: client.id } : {}
      };
      if (uploadedIds.length > 0) {
        messageData.attachments = uploadedIds.map((mid) => ({ file: mid }));
      }
      const res = await fetch("/api/ticket-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(messageData)
      });
      if (res.ok) {
        resetReply();
        fetchAll();
        if (!isInternal) handleNextTicket();
      }
    } catch {
    } finally {
      setSending(false);
    }
  };
  const handleScheduleReply = async () => {
    if (!replyBody.trim() || !id || !scheduleDate) return;
    setSending(true);
    try {
      const uploadedIds = await uploadFiles(replyFiles);
      const messageData = {
        ticket: id,
        body: replyBody.trim(),
        ...replyHtml ? { bodyHtml: replyHtml } : {},
        authorType: "admin",
        isInternal: false,
        skipNotification: true,
        scheduledAt: new Date(scheduleDate).toISOString(),
        scheduledSent: false
      };
      if (uploadedIds.length > 0) {
        messageData.attachments = uploadedIds.map((mid) => ({ file: mid }));
      }
      const res = await fetch("/api/ticket-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(messageData)
      });
      if (res.ok) {
        resetReply();
        setShowSchedule(false);
        setScheduleDate("");
        fetchAll();
      }
    } catch {
    } finally {
      setSending(false);
    }
  };
  return {
    fileInputRef,
    replyBody,
    setReplyBody,
    replyHtml,
    setReplyHtml,
    replyFiles,
    setReplyFiles,
    isInternal,
    setIsInternal,
    notifyClient,
    setNotifyClient,
    sendAsClient,
    setSendAsClient,
    sending,
    showSchedule,
    setShowSchedule,
    scheduleDate,
    setScheduleDate,
    handleEditorFileUpload,
    handleCannedSelect,
    handleReplyFileChange,
    handleSendReply,
    handleScheduleReply
  };
}

exports.useReply = useReply;
