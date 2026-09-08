import { addDays } from './dates'
import { weekdayOf } from './repeats'
import { MAX_HIGHLIGHTS, type AppData, type DayPlan, type LibraryList } from './types'

/**
 * What a week actually looked like, computed from the days themselves.
 *
 * Nothing here is recorded as it happens. There is no event log, no daily
 * rollup, no counter incremented on a tick - every figure on the Review tab
 * is derived from the same `days` the rest of the app reads, every time it is
 * asked. That is a deliberate constraint and it is what keeps this honest:
 * a stat that cannot be recomputed from the plan is a stat that can drift
 * from it, and a tracker whose numbers disagree with its own days is worse
 * than one with no numbers at all.
 *
 * It also means nothing to migrate, nothing to backfill, and nothing extra in
 * a backup - a week from before this tab existed reports exactly as well as
 * one from after it.
 */

export interface DayStat {
  date: string
  /** 0 = Sunday, matching `Date.getDay()` - see `weekdayOf`. */
  weekday: number
  /** True for a day that has any plan at all. An empty day is not a zero. */
  planned: boolean
  done: number
  total: number
  /** Minutes of sized, finished work in the Deep work category. */
  focusMinutes: number
  highlights: number
  highlightsDone: number
  /** What somebody wrote when they closed the day, if they did - see eveningClose.ts. */
  /** What was written on the day, if anything - see lib/journal.ts. */
  journal?: string
}

export interface PeriodStats {
  days: DayStat[]
  /** Days with a plan. Every rate below is over these, never over the calendar. */
  plannedDays: number
  done: number
  total: number
  focusMinutes: number
  highlights: number
  highlightsDone: number
  /** Units finished per list in this period - see `libraryProgress`. */
  library: { list: LibraryList; units: number }[]
}

/** The Monday on or before a date. Weeks start on Monday here, as they do. */
export function startOfWeek(dateKey: string): string {
  const weekday = weekdayOf(dateKey)
  return addDays(dateKey, weekday === 0 ? -6 : 1 - weekday)
}

export function startOfMonth(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`
}

/** Every date key from `from` to `to`, inclusive. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) out.push(date)
  return out
}

export function endOfMonth(dateKey: string): string {
  const [y, m] = dateKey.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${dateKey.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

function statFor(date: string, day: DayPlan | undefined): DayStat {
  const tasks = day?.tasks ?? []
  const highlights = tasks.filter(t => t.highlight)
  return {
    date,
    weekday: weekdayOf(date),
    planned: tasks.length > 0,
    done: tasks.filter(t => t.done).length,
    total: tasks.length,
    // Finished and sized only. An unfinished block is time that was set
    // aside, not time that was spent, and this figure is the one people read
    // as "how much of the week actually went to the work".
    focusMinutes: tasks
      .filter(t => t.category === 'core' && t.done && t.minutes !== undefined)
      .reduce((sum, t) => sum + t.minutes!, 0),
    highlights: highlights.length,
    highlightsDone: highlights.filter(t => t.done).length,
    journal: day?.journal,
  }
}

/**
 * Units finished per library list across a period.
 *
 * Counted from the bound tasks that were actually ticked off, not from the
 * items' own progress: progress is a running total with no dates on it, so it
 * cannot answer "this week". A session ticked off is one unit, which is
 * exactly what ticking one does to the item.
 */
export function libraryProgress(data: AppData, dates: string[]): { list: LibraryList; units: number }[] {
  const counts = new Map<string, number>()
  for (const date of dates) {
    for (const task of data.days[date]?.tasks ?? []) {
      if (!task.done || !task.libraryRef) continue
      counts.set(task.libraryRef.listId, (counts.get(task.libraryRef.listId) ?? 0) + 1)
    }
  }
  return data.library
    .map(list => ({ list, units: counts.get(list.id) ?? 0 }))
    .filter(entry => entry.units > 0)
}

export function periodStats(data: AppData, from: string, to: string): PeriodStats {
  const dates = datesBetween(from, to)
  const days = dates.map(date => statFor(date, data.days[date]))
  const planned = days.filter(d => d.planned)

  return {
    days,
    plannedDays: planned.length,
    done: days.reduce((n, d) => n + d.done, 0),
    total: days.reduce((n, d) => n + d.total, 0),
    focusMinutes: days.reduce((n, d) => n + d.focusMinutes, 0),
    highlights: days.reduce((n, d) => n + d.highlights, 0),
    highlightsDone: days.reduce((n, d) => n + d.highlightsDone, 0),
    library: libraryProgress(data, dates),
  }
}

/** 0-1, or null when there was no plan to be a fraction of. */
export function doneRate(stat: { done: number; total: number }): number | null {
  return stat.total > 0 ? stat.done / stat.total : null
}

/** The cap, restated here so the Review tab does not import types for one number. */
export const KEY_TASKS_PER_DAY = MAX_HIGHLIGHTS
