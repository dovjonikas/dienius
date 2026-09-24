import type { AppData, Category, DayPlan, Task } from './types'
import { addDays, dateKey } from './dates'

/**
 * Blocks that end by themselves - the owner's brief of 2026-09-22.
 *
 * A block that is simply running - a twelve-hour shift, the drive there and
 * back - is not a job to tick off: it happens by being lived through. So once
 * its end has passed it is done, quietly, and counts as done in the day's
 * score like anything ticked. Until then it can be ticked by hand - finished
 * early - or marked as not having happened (`Task.missed`), and from either
 * the clock keeps out of it for good.
 *
 * What ends by itself: an ongoing block (`Task.unbounded`), and any block of a
 * category that says so (`Category.endsItself`) - Commute unless it is told
 * otherwise, every other category only once it is told.
 *
 * Written rather than worked out on reading. Done is read in a dozen places -
 * the score, the review, the evening, the push offer - and a second meaning
 * of done kept beside the stored one would be a dozen chances to read the
 * wrong one. The write is the store's own (`actions.endSelfEndingBlocks`),
 * made on open and each minute after, and held for the page's first pull
 * like every write the store makes on its own - see `laterIfHeld`.
 */

/** How far back a block is still ended by the clock. A week: a device left in a drawer over a weekend still closes Friday's shift, and a month's history is left as it was lived. */
export const SELF_ENDING_DAYS = 7

/** Whether a category's blocks end by themselves: its own word, or Commute's by default. */
export function categoryEndsItself(category: Category): boolean {
  return category.endsItself ?? category.id === 'commute'
}

/** Whether a task is one the clock may end. */
export function endsItself(task: Task, categories: readonly Category[]): boolean {
  if (task.unbounded) return true
  if (!task.category) return false
  const category = categories.find(c => c.id === task.category)
  return category ? categoryEndsItself(category) : false
}

/**
 * When a task on a date ends, as a local instant, or null for one with no
 * end - no time, or no length. A block past midnight (a night's hours on
 * the morning after, a twelve-hour night from 19:00) ends where its minutes
 * take it.
 */
export function endOf(task: Task, date: string): Date | null {
  if (!task.time || !task.minutes || task.minutes <= 0) return null
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = task.time.split(':').map(Number)
  if (![y, m, d, h, min].every(Number.isFinite)) return null
  return new Date(y, m - 1, d, h, min + task.minutes)
}

/** Whether a task's end has passed at `now`. */
export function hasEnded(task: Task, date: string, now: Date): boolean {
  const end = endOf(task, date)
  return end !== null && end.getTime() <= now.getTime()
}

/** Whether the clock would mark this one done at `now`. */
function endsNow(task: Task, date: string, now: Date, categories: readonly Category[]): boolean {
  return !task.done && !task.missed && !task.setAside && endsItself(task, categories) && hasEnded(task, date, now)
}

/**
 * The plan with every block that ended by itself by `now` marked done - the
 * last `SELF_ENDING_DAYS` days and today - and the same object when there
 * was none, so a minute that changed nothing writes nothing.
 *
 * `onDone` hears of each, with its date, so the caller can do what a tick
 * does beside marking it - advancing a bound book, say.
 */
export function selfEnded(data: AppData, now: Date, onDone?: (task: Task, date: string) => void): AppData {
  const today = dateKey(now)
  const from = addDays(today, -SELF_ENDING_DAYS)
  let days: Record<string, DayPlan> | null = null
  for (const [date, day] of Object.entries(data.days)) {
    if (date < from || date > today) continue
    if (!day.tasks.some(t => endsNow(t, date, now, data.categories))) continue
    const tasks = day.tasks.map(t => {
      if (!endsNow(t, date, now, data.categories)) return t
      onDone?.(t, date)
      // Done when it ended, not when the app was next opened to see it.
      return { ...t, done: true, doneAt: endOf(t, date)!.toISOString() }
    })
    days = { ...(days ?? data.days), [date]: { ...day, tasks } }
  }
  return days ? { ...data, days } : data
}
