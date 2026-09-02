import { useEffect, useRef, useState } from 'react'
import { useAppData } from '../../lib/store'
import { activeTask, timeToMinutes } from '../day-plan/capacity'
import { currentMinutes } from '../day-plan/timelineLayout'
import { todayKey } from '../../lib/dates'

/** How long the nudge stays on screen before removing itself. */
const TOAST_MS = 6000

/**
 * A quieter chime than the timer's, for something that is a tap on the
 * shoulder rather than an alarm. One tone, softer, shorter - see the timer's
 * own note on why this is synthesised rather than loaded.
 */
function playSoftTone(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 660
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.37)
    setTimeout(() => void ctx.close(), 700)
  } catch {
    // A missing tone is fine; the toast is the message.
  }
}

export interface IntervalReminderProps {
  /** The day currently open, so the reminder only ever fires against today. */
  date: string
}

/**
 * "Stand up, drink water", every so often, but only while a Focus task is
 * actually running.
 *
 * Off by default, and the condition is the entire design. An app that
 * interrupts on a fixed schedule is an app that interrupts during dinner, and
 * gets turned off within a week. This one can only speak while a task the
 * owner themselves marked as Focus work is in progress on today's date - which
 * is exactly the situation where losing an hour without moving is a real
 * thing that happens, and the only situation where an interruption is doing
 * somebody a favour.
 *
 * It counts from the start of the running task rather than from when the
 * feature was switched on, so the first nudge in a two-hour block lands
 * twenty minutes into the work rather than twenty minutes after the app
 * happened to be opened. Starting a different task resets the count, because
 * switching tasks is itself a break from sitting still.
 */
export function IntervalReminder({ date }: IntervalReminderProps) {
  const data = useAppData()
  const reminder = data.settings.reminder
  const [now, setNow] = useState(() => currentMinutes())
  const [showing, setShowing] = useState(false)
  // Which nudge has already fired for the current run, as a count of
  // intervals - so a re-render, a tab regaining focus or a clock tick cannot
  // fire the same one twice.
  const firedRef = useRef<{ taskId: string; count: number } | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isToday = date === todayKey()
  const running = isToday ? activeTask(data.days[date]?.tasks ?? [], now) : undefined
  const isFocus = running?.category === 'core'
  const armed = reminder.enabled && !!running && isFocus

  useEffect(() => {
    if (!armed) return
    const id = setInterval(() => setNow(currentMinutes()), 30_000)
    return () => clearInterval(id)
  }, [armed])

  useEffect(() => {
    if (!armed || !running?.time) {
      firedRef.current = null
      return
    }
    const minutesIn = now - timeToMinutes(running.time)
    const count = Math.floor(minutesIn / reminder.everyMinutes)
    if (count < 1) return
    const already = firedRef.current
    if (already && already.taskId === running.id && already.count >= count) return
    firedRef.current = { taskId: running.id, count }
    setShowing(true)
    playSoftTone()
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setShowing(false), TOAST_MS)
  }, [armed, running, now, reminder.everyMinutes])

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }, [])

  if (!showing) return null

  return (
    <div className="reminder-toast" role="status">
      <span className="reminder-toast-text">{reminder.text}</span>
      <button
        type="button"
        className="reminder-toast-close"
        aria-label="Dismiss"
        onClick={() => setShowing(false)}
      >
        &times;
      </button>
    </div>
  )
}
