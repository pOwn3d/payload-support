import { useState, useRef, useEffect } from 'react'

export function useTimeTracking(id: string | number | undefined, fetchAll: () => void) {
  const [duration, setDuration] = useState('')
  const [timeDescription, setTimeDescription] = useState('')
  const [addingTime, setAddingTime] = useState(false)
  const [timeSuccess, setTimeSuccess] = useState('')
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerDescription, setTimerDescription] = useState('')
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleAddTime = async () => {
    if (!duration || !id) return
    setAddingTime(true)
    setTimeSuccess('')
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ticket: id,
          duration: parseInt(duration, 10),
          date: new Date().toISOString(),
          description: timeDescription.trim() || undefined,
        }),
      })
      if (res.ok) {
        setDuration('')
        setTimeDescription('')
        setTimeSuccess(`${duration} min ajoutées`)
        setTimeout(() => setTimeSuccess(''), 3000)
        fetchAll()
      }
    } catch { /* ignore */ } finally {
      setAddingTime(false)
    }
  }

  const handleTimerStart = (reset = false) => {
    setTimerRunning(true)
    if (reset) setTimerSeconds(0)
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1)
    }, 1000)
    timerKeepAliveRef.current = setInterval(() => {
      fetch('/api/users/me', { credentials: 'include' }).catch(() => {})
    }, 5 * 60 * 1000)
  }

  const handleTimerStop = () => {
    setTimerRunning(false)
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null }
    if (timerKeepAliveRef.current) { clearInterval(timerKeepAliveRef.current); timerKeepAliveRef.current = null }
  }

  const handleTimerSave = async () => {
    if (!id || timerSeconds < 60) return
    const minutes = Math.round(timerSeconds / 60)
    setAddingTime(true)
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ticket: id,
          duration: minutes,
          date: new Date().toISOString(),
          description: timerDescription.trim() || 'Timer',
        }),
      })
      if (res.ok) {
        setTimeSuccess(`${minutes} min ajoutées (timer)`)
        setTimeout(() => setTimeSuccess(''), 3000)
        setTimerSeconds(0)
        setTimerDescription('')
        fetchAll()
      }
    } catch { /* ignore */ } finally {
      setAddingTime(false)
    }
  }

  const handleTimerDiscard = () => {
    setTimerSeconds(0)
    setTimerDescription('')
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (timerKeepAliveRef.current) clearInterval(timerKeepAliveRef.current)
    }
  }, [])

  return {
    duration, setDuration,
    timeDescription, setTimeDescription,
    addingTime, timeSuccess,
    timerRunning, timerSeconds, setTimerSeconds, timerDescription, setTimerDescription,
    handleAddTime, handleTimerStart, handleTimerStop, handleTimerSave, handleTimerDiscard,
  }
}
