import type { DayPlan } from './types'

/**
 * What one past day amounts to, small enough to fit in a calendar cell.
 *
 * Derived, like everything in `review.ts`, from the day itself - there is no
 * record of "how Tuesday went" anywhere, only Tuesday.
 *
 * The tone is the constraint. A calendar of past days is a wall of judgements
 * if you let it be, so: no red at any threshold, no zero on a day nobody
 * planned, and nothing that reads as a grade. A day that got away is shown in
 * grey, which says "quiet" rather than "bad". The scale tops out at a green
 * that is barely green.
 */

export type DayTone = 'none' | 'low' | 'mid' | 'high'

export interface DayStat {
  /** Null for a day with no plan at all - not zero. An unplanned day is not a failure. */
  rate: number | null
  done: number
  total: number
  /** Tasks carried to another day - the sum of what left, not what remains. */
  pushed: number
  highlights: number
  highlightsDone: number
  /** Minutes of finished, sized deep work. */
  focusMinutes: number
  tone: DayTone
}

/** At or above this share, the day reads as a full one. */
export const HIGH_RATE = 0.8
/** Below this, it reads as quiet. Never as bad - see `toneFor`. */
export const LOW_RATE = 0.4

/**
 * Which of four registers a day is drawn in.
 *
 * 'none' is its own case rather than a zero: a day nobody planned has nothing
 * to report, and colouring it as a failure would make an ordinary rest day
 * look like the worst square on the calendar.
 */
export function toneFor(rate: number | null): DayTone {
  if (rate === null) return 'none'
  if (rate >= HIGH_RATE) return 'high'
  if (rate >= LOW_RATE) return 'mid'
  return 'low'
}

export function dayStat(day: DayPlan | undefined): DayStat {
  const tasks = day?.tasks ?? []
  const total = tasks.length
  const done = tasks.filter(t => t.done).length
  const rate = total > 0 ? done / total : null
  const highlights = tasks.filter(t => t.highlight)

  return {
    rate,
    done,
    total,
    // A task's pushCount says how many days it has been carried; what this
    // cell wants is how many tasks left *this* day, which is every unfinished
    // task that has been carried at least once. A finished task's count is
    // history, not a departure.
    pushed: tasks.filter(t => !t.done && (t.pushCount ?? 0) > 0).length,
    highlights: highlights.length,
    highlightsDone: highlights.filter(t => t.done).length,
    focusMinutes: tasks
      .filter(t => t.category === 'core' && t.done && t.minutes !== undefined)
      .reduce((sum, t) => sum + t.minutes!, 0),
    tone: toneFor(rate),
  }
}

/** True when every key task set that day was finished. Never true when none were set. */
export function keptEveryKeyTask(stat: DayStat): boolean {
  return stat.highlights > 0 && stat.highlightsDone === stat.highlights
}

export interface MonthSummary {
  /** Days with a plan. Every figure below is over these, never over the calendar. */
  activeDays: number
  done: number
  total: number
  rate: number | null
  /** The longest run of consecutive planned days at or above HIGH_RATE. */
  longestStreak: number
}

/**
 * One line about a month, for the calendar header.
 *
 * The streak here is over *full* days rather than key tasks - the Review
 * tab's streak asks a different question and they are deliberately different
 * numbers. A day with no plan does not break it and does not extend it: it is
 * skipped, because a weekend nobody planned is not a lapse.
 */
export function monthSummary(days: Record<string, DayPlan>, dates: string[]): MonthSummary {
  let done = 0
  let total = 0
  let activeDays = 0
  let streak = 0
  let longest = 0

  for (const date of dates) {
    const stat = dayStat(days[date])
    if (stat.rate === null) continue
    activeDays++
    done += stat.done
    total += stat.total
    if (stat.rate >= HIGH_RATE) {
      streak++
      longest = Math.max(longest, streak)
    } else {
      streak = 0
    }
  }

  return { activeDays, done, total, rate: total > 0 ? done / total : null, longestStreak: longest }
}

/** "62% done, 14 active days, longest run 5". Null when there is nothing to say. */
export function summaryLine(summary: MonthSummary): string | null {
  if (summary.activeDays === 0) return null
  const parts = [`${Math.round((summary.rate ?? 0) * 100)}% done`]
  parts.push(`${summary.activeDays} active ${summary.activeDays === 1 ? 'day' : 'days'}`)
  if (summary.longestStreak > 1) parts.push(`longest run ${summary.longestStreak}`)
  return parts.join(' - ')
}
