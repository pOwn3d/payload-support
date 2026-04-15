"use client";
import { useState, useRef } from 'react';

function useTicketActions(id, fetchAll) {
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeTargetInfo, setMergeTargetInfo] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const [showExtMsg, setShowExtMsg] = useState(false);
  const [extMsgBody, setExtMsgBody] = useState("");
  const [extMsgAuthor, setExtMsgAuthor] = useState("client");
  const [extMsgDate, setExtMsgDate] = useState("");
  const [extMsgFiles, setExtMsgFiles] = useState([]);
  const [sendingExtMsg, setSendingExtMsg] = useState(false);
  const extFileInputRef = useRef(null);
  const [showSnooze, setShowSnooze] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState(null);
  const [snoozeSaving, setSnoozeSaving] = useState(false);
  const [showNextTicket, setShowNextTicket] = useState(false);
  const [nextTicketId, setNextTicketId] = useState(null);
  const [nextTicketInfo, setNextTicketInfo] = useState("");
  const handleStatusChange = async (newStatus) => {
    if (!id) return;
    setStatusUpdating(true);
    try {
      await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus })
      });
      window.location.reload();
    } catch {
    } finally {
      setStatusUpdating(false);
    }
  };
  const handleMergeLookup = async () => {
    if (!mergeTarget.trim()) return;
    setMergeTargetInfo(null);
    setMergeError("");
    try {
      const searchVal = mergeTarget.trim().toUpperCase();
      const res = await fetch(`/api/tickets?where[ticketNumber][equals]=${encodeURIComponent(searchVal)}&limit=1&depth=0`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        if (d.docs?.length > 0) {
          const t = d.docs[0];
          if (String(t.id) === String(id)) {
            setMergeError("Impossible de fusionner un ticket avec lui-m\xEAme");
          } else {
            setMergeTargetInfo({ id: t.id, ticketNumber: t.ticketNumber, subject: t.subject });
          }
        } else {
          setMergeError("Ticket introuvable");
        }
      }
    } catch {
      setMergeError("Erreur de recherche");
    }
  };
  const handleMerge = async () => {
    if (!mergeTargetInfo || !id) return;
    setMerging(true);
    setMergeError("");
    try {
      const res = await fetch("/api/support/merge-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceTicketId: id, targetTicketId: mergeTargetInfo.id })
      });
      if (res.ok) {
        window.location.href = `/admin/collections/tickets/${mergeTargetInfo.id}`;
      } else {
        const d = await res.json().catch(() => ({}));
        setMergeError(d.error || "Erreur de fusion");
      }
    } catch {
      setMergeError("Erreur r\xE9seau");
    } finally {
      setMerging(false);
    }
  };
  const handleExtFileChange = (e) => {
    if (e.target.files) {
      const maxSize = 1 * 1024 * 1024;
      const newFiles = Array.from(e.target.files);
      const tooLarge = newFiles.filter((f) => f.size > maxSize);
      if (tooLarge.length > 0) {
        alert(`Fichier(s) trop volumineux (max 1 Mo) : ${tooLarge.map((f) => f.name).join(", ")}`);
      }
      setExtMsgFiles((prev) => [...prev, ...newFiles.filter((f) => f.size <= maxSize)]);
    }
    if (extFileInputRef.current) extFileInputRef.current.value = "";
  };
  const handleSendExtMsg = async () => {
    if (!extMsgBody.trim() || !id) return;
    setSendingExtMsg(true);
    try {
      const uploadedIds = [];
      for (const file of extMsgFiles) {
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
      const messageData = {
        ticket: id,
        body: extMsgBody.trim(),
        authorType: extMsgAuthor,
        isInternal: false,
        skipNotification: true
      };
      if (extMsgDate) {
        messageData.createdAt = new Date(extMsgDate).toISOString();
      }
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
        setExtMsgBody("");
        setExtMsgDate("");
        setExtMsgFiles([]);
        setShowExtMsg(false);
        fetchAll();
      }
    } catch {
    } finally {
      setSendingExtMsg(false);
    }
  };
  const handleSnooze = async (days, customDate) => {
    if (!id) return;
    setSnoozeSaving(true);
    try {
      let newSnooze = null;
      if (days !== null) {
        const d = /* @__PURE__ */ new Date();
        d.setDate(d.getDate() + days);
        newSnooze = d.toISOString();
      } else if (customDate) {
        newSnooze = new Date(customDate).toISOString();
      }
      await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ snoozeUntil: newSnooze })
      });
      setSnoozeUntil(newSnooze);
      setShowSnooze(false);
      fetchAll();
    } catch {
    } finally {
      setSnoozeSaving(false);
    }
  };
  const handleNextTicket = async () => {
    try {
      const res = await fetch("/api/tickets?where[status][equals]=open&sort=updatedAt&limit=1&depth=0", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        if (d.docs?.length > 0 && String(d.docs[0].id) !== String(id)) {
          setNextTicketId(d.docs[0].id);
          setNextTicketInfo(`${d.docs[0].ticketNumber} \u2014 ${d.docs[0].subject}`);
        } else {
          setNextTicketId(null);
          setNextTicketInfo("Aucun autre ticket ouvert");
        }
        setShowNextTicket(true);
      }
    } catch {
    }
  };
  return {
    statusUpdating,
    handleStatusChange,
    showMerge,
    setShowMerge,
    mergeTarget,
    setMergeTarget,
    mergeTargetInfo,
    setMergeTargetInfo,
    mergeError,
    setMergeError,
    merging,
    handleMergeLookup,
    handleMerge,
    showExtMsg,
    setShowExtMsg,
    extMsgBody,
    setExtMsgBody,
    extMsgAuthor,
    setExtMsgAuthor,
    extMsgDate,
    setExtMsgDate,
    extMsgFiles,
    setExtMsgFiles,
    sendingExtMsg,
    handleExtFileChange,
    handleSendExtMsg,
    showSnooze,
    setShowSnooze,
    snoozeUntil,
    setSnoozeUntil,
    snoozeSaving,
    handleSnooze,
    showNextTicket,
    setShowNextTicket,
    nextTicketId,
    nextTicketInfo,
    handleNextTicket
  };
}

export { useTicketActions };
