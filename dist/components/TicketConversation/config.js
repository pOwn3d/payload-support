"use client";
const DEFAULT_FEATURES = {
  timeTracking: true,
  ai: true,
  satisfaction: true,
  chat: true,
  emailTracking: true,
  canned: true,
  merge: true,
  snooze: true,
  externalMessages: true,
  clientHistory: true,
  activityLog: true,
  splitTicket: true,
  scheduledReplies: true,
  autoClose: true,
  autoCloseDays: 7,
  roundRobin: false
};
const STORAGE_KEY = "ticketing_features";
function getFeatures() {
  if (typeof window === "undefined") return DEFAULT_FEATURES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_FEATURES, ...parsed };
    }
  } catch {
  }
  return DEFAULT_FEATURES;
}
function saveFeatures(features) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
  } catch {
  }
}

export { DEFAULT_FEATURES, getFeatures, saveFeatures };
