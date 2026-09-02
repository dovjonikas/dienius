import { useEffect, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { clockTools, useClockTools } from '../../lib/clockTools'
import { categoryColor } from '../../lib/categories'
import { formatDuration, minutesLeft, timeToMinutes } from '../day-plan/capacity'
import { currentMinutes } from '../day-plan/timelineLayout'

const RING_RADIUS = 13
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export interface FocusBarProps {
  /** Opens the optional full-screen version - see `FocusView`. */
  onExpand: () => void
}

/**
 * Focus, as a state the app is in rather than a screen it goes to.
 *
 * It used to be a full-screen takeover, and the takeover was the problem: the
 * moment you needed to see what was next, add the thing you just remembered,
 * or start a timer for the pasta, you had to leave focus to do it - which
 * meant focus was something you left, constantly, and a mode you keep leaving
 * is not a mode. Now it is a strip under the header: the task, what is left of
 * it, and three things you can do about it. Everything else in the app stays
 * exactly as usable as it was.
 *
 * The full-screen version survives as an option, one tap away on the Expand
 * button, for the people and the moments that want nothing else on the screen.
 * It is no longer the default, because it should never have been.
 *
 * **There is no pause.** A pause would be a lie: this counts down the task's
 * own planned window against the wall clock, and the wall clock does not stop
 * because you pressed a button. What it offers instead is the two things that
 * are actually true - the task is done, or you are no longer sitting with it.
 * Something that needs a real pause is a timer, and there is one in the header.
 */
export function FocusBar({ onExpand }: FocusBarProps) {
  const data = useAppData()
  const tools = useClockTools()
  const [now, setNow] = useState(() => currentMinutes())

  const session = tools.focus
  const task = session ? data.days[session.date]?.tasks.find(t => t.id === session.taskId) : undefined

  useEffect(() => {
    if (!session) return
    const id = setInterval(() => setNow(currentMinutes()), 20_000)
    return () => clearInterval(id)
  }, [session])

  // A session pointing at a task that no longer exists - deleted, or its day
  // wiped by an import - ends itself rather than leaving a bar with nothing
  // behind it. Done is handled separately below, because that one wants the
  // bar to stay for a beat rather than vanish mid-click.
  useEffect(() => {
    if (session && !task) clockTools.endFocus()
  }, [session, task])

  if (!session || !task) return null

  const left = task.time !== undefined ? minutesLeft(task, now) : undefined
  const total = task.minutes
  const elapsed = task.time !== undefined && total !== undefined
    ? Math.min(total, Math.max(0, now - timeToMinutes(task.time)))
    : 0
  const fraction = total ? elapsed / total : 0
  const color = categoryColor(task.category)

  return (
    <div
      className="focus-bar"
      role="region"
      aria-label="Focus"
      style={color ? ({ ['--cat' as string]: color } as React.CSSProperties) : undefined}
    >
      <div className="focus-bar-ring" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <circle className="focus-bar-track" cx="16" cy="16" r={RING_RADIUS} />
          <circle
            className="focus-bar-fill"
            cx="16"
            cy="16"
            r={RING_RADIUS}
            transform="rotate(-90 16 16)"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
          />
        </svg>
      </div>

      <span className="focus-bar-label">Focus</span>
      <span className="focus-bar-task">{task.title}</span>
      <span className="focus-bar-left">
        {left !== undefined ? `${formatDuration(left)} left` : task.done ? 'finished' : 'time is up'}
      </span>

      <div className="focus-bar-actions">
        <button type="button" className="btn-secondary" onClick={onExpand}>
          Expand
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            if (!task.done) actions.toggleTask(session.date, task.id)
            clockTools.endFocus()
          }}
        >
          Done
        </button>
        <button
          type="button"
          className="focus-bar-exit"
          aria-label="Leave focus"
          title="Leave focus"
          onClick={() => clockTools.endFocus()}
        >
          &times;
        </button>
      </div>
    </div>
  )
}
