'use strict';

var react = require('react');

function useTimeTracking(id, fetchAll) {
  const [duration, setDuration] = react.useState("");
  const [timeDescription, setTimeDescription] = react.useState("");
  const [addingTime, setAddingTime] = react.useState(false);
  const [timeSuccess, setTimeSuccess] = react.useState("");
  const [timerRunning, setTimerRunning] = react.useState(false);
  const [timerSeconds, setTimerSeconds] = react.useState(0);
  const [timerDescription, setTimerDescription] = react.useState("");
  const timerIntervalRef = react.useRef(null);
  const timerKeepAliveRef = react.useRef(null);
  const handleAddTime = async () => {
    if (!duration || !id) return;
    setAddingTime(true);
    setTimeSuccess("");
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ticket: id,
          duration: parseInt(duration, 10),
          date: (/* @__PURE__ */ new Date()).toISOString(),
          description: timeDescription.trim() || void 0
        })
      });
      if (res.ok) {
        setDuration("");
        setTimeDescription("");
        setTimeSuccess(`${duration} min ajout\xE9es`);
        setTimeout(() => setTimeSuccess(""), 3e3);
        fetchAll();
      }
    } catch {
    } finally {
      setAddingTime(false);
    }
  };
  const handleTimerStart = (reset = false) => {
    setTimerRunning(true);
    if (reset) setTimerSeconds(0);
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1e3);
    timerKeepAliveRef.current = setInterval(() => {
      fetch("/api/users/me", { credentials: "include" }).catch(() => {
      });
    }, 5 * 60 * 1e3);
  };
  const handleTimerStop = () => {
    setTimerRunning(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (timerKeepAliveRef.current) {
      clearInterval(timerKeepAliveRef.current);
      timerKeepAliveRef.current = null;
    }
  };
  const handleTimerSave = async () => {
    if (!id || timerSeconds < 60) return;
    const minutes = Math.round(timerSeconds / 60);
    setAddingTime(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ticket: id,
          duration: minutes,
          date: (/* @__PURE__ */ new Date()).toISOString(),
          description: timerDescription.trim() || "Timer"
        })
      });
      if (res.ok) {
        setTimeSuccess(`${minutes} min ajout\xE9es (timer)`);
        setTimeout(() => setTimeSuccess(""), 3e3);
        setTimerSeconds(0);
        setTimerDescription("");
        fetchAll();
      }
    } catch {
    } finally {
      setAddingTime(false);
    }
  };
  const handleTimerDiscard = () => {
    setTimerSeconds(0);
    setTimerDescription("");
  };
  react.useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (timerKeepAliveRef.current) clearInterval(timerKeepAliveRef.current);
    };
  }, []);
  return {
    duration,
    setDuration,
    timeDescription,
    setTimeDescription,
    addingTime,
    timeSuccess,
    timerRunning,
    timerSeconds,
    setTimerSeconds,
    timerDescription,
    setTimerDescription,
    handleAddTime,
    handleTimerStart,
    handleTimerStop,
    handleTimerSave,
    handleTimerDiscard
  };
}

exports.useTimeTracking = useTimeTracking;
