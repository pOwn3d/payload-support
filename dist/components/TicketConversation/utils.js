"use client";
function getDateLabel(dateStr) {
  const date = new Date(dateStr);
  const today = /* @__PURE__ */ new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function formatMessageDate(dateStr) {
  const date = new Date(dateStr);
  const today = /* @__PURE__ */ new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return time;
  if (date.toDateString() === yesterday.toDateString()) return `Hier, ${time}`;
  if (date.getFullYear() === today.getFullYear()) {
    return `${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}, ${time}`;
  }
  return `${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
}

export { formatMessageDate, getDateLabel };
