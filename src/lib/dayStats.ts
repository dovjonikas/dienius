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
  /**
   * The one line somebody wrote when they closed the day, if they did.
   *
   * The only thing on a stat that is not a number, and the only thing here
   * that came from a person rather than from arithmetic. It is carried so
   * that a month of squares can occasionally say what a Tuesday was.
   */
  /** What was written on the day, if anything - see lib/journal.ts. */
  journal?: string
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
  const highlights = tasks.filter(t => t.highlight)
  // A low day is measured on its key tasks alone, the same count the day
  // score keeps - see lowDay.ts. Nothing else on it counts either way.
  const counted = day?.lowDay ? highlights : tasks
  const total = counted.length
  const done = counted.filter(t => t.done).length
  const rate = total > 0 ? done / total : null

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
    journal: day?.journal,
    tone: toneFor(rate),
  }
}

/** True when every key task set that day was finished. Never true when none were set. */
export function keptEveryKeyTask(stat: DayStat): boolean {
  return stat.highlights > 0 && stat.highlightsDone === stat.highlights
}

export interface MonthSummary {
  /** Days with a plan, over the month's own dates and never over the calendar around them. */
  activeDays: number
}

/**
 * One line about a month, for the calendar header.
 *
 * A count of the days that had a plan, and nothing else. Until v2.7 the line
 * also said what share of the month's tasks got done and how long the best
 * run of full days was, and both were verdicts: the share is the score this
 * app declines to put beside anything, and a longest run is a streak under a
 * softer name - a counter that resets to zero encodes a rule the psychology
 * does not support, whichever screen it is on (docs/RESEARCH-ADHD.md
 * section 8). How many days were used has no direction to it.
 */
export function monthSummary(days: Record<string, DayPlan>, dates: string[]): MonthSummary {
  let activeDays = 0
  for (const date of dates) {
    if (dayStat(days[date]).rate !== null) activeDays++
  }
  return { activeDays }
}

/** "14 days with a plan". Null when there is nothing to say. */
export function summaryLine(summary: MonthSummary): string | null {
  if (summary.activeDays === 0) return null
  return `${summary.activeDays} ${summary.activeDays === 1 ? 'day' : 'days'} with a plan`
}
