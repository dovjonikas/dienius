import { useEffect, useState } from 'react'
import { todayKey } from './dates'

/**
 * Which day it is, in an app that is not reloaded.
 *
 * `todayKey()` is a reading, not a subscription: every caller in this app
 * takes it once, at the moment it runs, and nothing ever asks again. That was
 * fine while every session started with a page load - a phone swaps the tab
 * out overnight and the morning's first look is a fresh mount. It is not fine
 * on the desk the owner works at all day, or on a PWA the system keeps warm:
 * the tab that is open at 07:00 is the tab that was open at 23:00, and the
 * day it decided on is yesterday's.
 *
 * What that cost, before this existed: the header said "Today" over
 * yesterday's date until the day view's own thirty-second tick re-rendered
 * it, and then said "Past" and stayed there - and the first task typed that
 * morning was written onto the day before. See `e2e/overnight.e2e.ts`.
 *
 * One timeout aimed at the next midnight rather than a poll, which is the
 * shape `useTimerTick` already uses and for the same reason: a background tab
 * has its intervals clamped hard, and a single timeout is treated far more
 * kindly than a repeating one. It re-arms itself unconditionally, so a fire
 * that finds the same date - a clock nudged backwards, a timeout a hair early
 * - schedules the next one instead of going quiet for ever.
 *
 * And a laptop that was asleep at midnight fires no timeout at all, so
 * `visibilitychange` and `focus` re-read as well. Those are the events that
 * actually carry a real morning: the lid opening, the tab coming back.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayKey)

  useEffect(() => {
    let id: ReturnType<typeof setTimeout>
    function arm() {
      id = setTimeout(() => {
        setToday(todayKey())
        arm()
      }, msUntilNextMidnight(new Date()))
    }
    arm()
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    function resync() {
      if (!document.hidden) setToday(todayKey())
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)
    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
    }
  }, [])

  return today
}

/**
 * Milliseconds from `now` until the next local midnight, plus a second.
 *
 * The second is not a rounding habit: a timeout that fires a hair *before*
 * the instant it was aimed at would read the old date, set the same value,
 * and re-arm for a whole day later - so the app would notice the new day
 * twenty four hours after it started. Landing just inside the new day costs
 * a second and cannot do that.
 *
 * Built from the local calendar fields rather than by adding 86,400,000ms,
 * so the two days a year that are not twenty four hours long land on
 * midnight rather than an hour either side of it.
 */
export function msUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(1000, next.getTime() - now.getTime() + 1000)
}
