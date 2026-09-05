import { useEffect, useRef, useState } from 'react'
import { useRestoreFocus } from '../../lib/useRestoreFocus'
import type { Task } from '../../lib/types'
import { categoryColor } from '../../lib/categories'
import { useAppData } from '../../lib/store'
import { timeToMinutes } from './capacity'

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Radius of the progress ring's own circle, in the SVG's own coordinates. */
const RING_RADIUS = 92
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export interface FocusViewProps {
  /** The task being worked on - always the one `activeTask` picked, never an arbitrary one. */
  task: Task
  /** Marks it done and closes. The one action this view offers besides leaving. */
  onDone: () => void
  onClose: () => void
}

function secondsNow(): number {
  const d = new Date()
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
}

/** "53:12", or "1:02:40" once there is more than an hour left. */
function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`
}

/**
 * One task, the time left on it, and a way out. Nothing else on the screen.
 *
 * **Not a pomodoro.** There is no length to choose here and no timer to start:
 * the countdown is the task's own planned duration, running against the clock
 * the rest of the app already runs against. That is the whole difference. A
 * pomodoro asks you to decide how long to work and then contradicts the plan
 * you already made; this shows the plan you made, larger. It also means
 * closing this view loses nothing - there is no timer state to lose, only a
 * screen, so leaving and coming back lands on exactly the same number.
 *
 * The one thing it does not do is nag. When the planned time runs out the ring
 * completes and the number stops at zero; nothing flashes, nothing sounds, and
 * the task is not marked as anything. Overrunning a block is ordinary, and a
 * planner that treats it as a failure is a planner people stop opening - see
 * docs/RESEARCH-ADHD.md section 12 on what not to build.
 *
 * Ticks once a second, unlike everything else in this app, which is coarse on
 * purpose. A view whose entire content is a countdown is the one place where a
 * number that visibly moves is the point rather than a distraction, and it
 * only runs while this is actually open.
 */
export function FocusView({ task, onDone, onClose }: FocusViewProps) {
  useRestoreFocus()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [nowSeconds, setNowSeconds] = useState(secondsNow)

  useEffect(() => {
    const timer = setInterval(() => setNowSeconds(secondsNow()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (!focusables || focusables.length === 0) return
    const list = Array.from(focusables)
    const first = list[0]
    const last = list[list.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const startSeconds = task.time !== undefined ? timeToMinutes(task.time) * 60 : 0
  const totalSeconds = (task.minutes ?? 0) * 60
  const elapsed = Math.min(Math.max(0, nowSeconds - startSeconds), totalSeconds)
  const remaining = Math.max(0, totalSeconds - elapsed)
  const fraction = totalSeconds > 0 ? elapsed / totalSeconds : 0
  const color = categoryColor(task.category, useAppData().categories)

  return (
    <div
      className="focus-view"
      role="dialog"
      aria-modal="true"
      aria-label={`Focus: ${task.title}`}
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={color ? ({ ['--cat' as string]: color } as React.CSSProperties) : undefined}
    >
      <button type="button" className="focus-close" onClick={onClose}>
        Close
        <span className="focus-close-hint" aria-hidden="true">Esc</span>
      </button>

      <p className="focus-task">{task.title}</p>

      <div className="focus-ring">
        {/* Decorative: the same number the countdown under it already states
            in text, drawn as a shape. rotate(-90) starts the arc at the top
            rather than at three o'clock, which is where a clock's own minute
            hand starts and therefore where the eye expects it. */}
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle className="focus-ring-track" cx="100" cy="100" r={RING_RADIUS} />
          <circle
            className="focus-ring-fill"
            cx="100"
            cy="100"
            r={RING_RADIUS}
            transform="rotate(-90 100 100)"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
          />
        </svg>
        <div className="focus-count">
          <span className="focus-count-number">{formatCountdown(remaining)}</span>
          <span className="focus-count-unit">{remaining > 0 ? 'left' : 'time is up'}</span>
        </div>
      </div>

      <button type="button" className="focus-done primary" onClick={onDone}>
        Done
      </button>
    </div>
  )
}
