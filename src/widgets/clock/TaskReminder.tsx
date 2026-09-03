import { useEffect, useRef, useState } from 'react'
import { useAppData } from '../../lib/store'
import { currentMinutes } from '../day-plan/timelineLayout'
import { timeToMinutes } from '../day-plan/capacity'
import { todayKey } from '../../lib/dates'

/**
 * A nudge shortly before a task with a time on it.
 *
 * Off by default and off for everybody who never turns it on - the same rule
 * the focus-interval nudge already follows, and for the same reason: an app
 * that interrupts you unasked is an app people mute, and a muted app cannot
 * remind you of anything.
 *
 * It is deliberately not a scheduled notification. There is no server, no
 * push subscription and no background worker here, so nothing can fire while
 * the app is closed - and pretending otherwise would be worse than not
 * offering it. What it does do is watch the same minute tick the now-line
 * already runs on: while the app is open, in a tab or installed, a task
 * coming up in five minutes says so once.
 *
 * "Once" is the whole design. A fired reminder is remembered per task per
 * day, so re-rendering, switching tabs, or leaving the app open across the
 * whole window never repeats it.
 */
export function TaskReminder({ date }: { date: string }) {
  const data = useAppData()
  const [now, setNow] = useState(() => currentMinutes())
  const fired = useRef(new Set<string>())
  const { enabled, minutesBefore } = data.settings.taskReminder

  // A minute is plenty: the window a reminder has to land in is minutes wide,
  // and a tick that costs one comparison per task is not worth running four
  // times a second to make it look precise.
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(currentMinutes()), 20_000)
    return () => clearInterval(id)
  }, [enabled])

  useEffect(() => {
    if (!enabled || date !== todayKey()) return
    // A day that is paused does not nudge. The person said they are away;
    // a notification about a task that started without them is exactly the
    // "you missed it" this app does not say. See replan.ts.
    if (data.days[date]?.away) return
    const tasks = data.days[date]?.tasks ?? []
    for (const task of tasks) {
      if (task.done || !task.time) continue
      const start = timeToMinutes(task.time)
      const due = start - minutesBefore
      // A window rather than an instant: a tick that lands two minutes late -
      // a throttled background tab, a laptop waking up - should still fire,
      // and one that lands after the task has already started should not.
      if (now < due || now >= start) continue
      const key = `${date}:${task.id}`
      if (fired.current.has(key)) continue
      fired.current.add(key)
      notify(task.title, Math.max(0, start - now))
    }
  }, [enabled, minutesBefore, now, date, data.days])

  return null
}

function notify(title: string, minutesAway: number): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const when = minutesAway <= 0 ? 'now' : `in ${minutesAway} min`
    // Tagged per task rather than shared: two tasks starting close together
    // are two things to know about, and a shared tag would silently replace
    // the first with the second.
    new Notification('Dienius', { body: `${title} - ${when}`, tag: `dienius-task-${title}` })
  } catch {
    // Notifications are a courtesy. A browser that refuses one is not a
    // reason for anything else to stop working.
  }
}
