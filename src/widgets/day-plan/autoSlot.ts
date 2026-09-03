import type { Task } from '../../lib/types'
import {
  DEFAULT_SLEEP_SETTINGS,
  clipToWindow,
  gapsInWindow,
  isAnchor,
  mergeIntervals,
  minutesToTime,
  timeToMinutes,
  windowFor,
  type Interval,
  type SleepSettings,
} from './capacity'

/**
 * Where the next thing you type would go if nobody asked you.
 *
 * This is the arithmetic behind quick-add's time control: the field opens
 * already holding a real clock time, so the ordinary path from "Call mom" to
 * a placed task is a title and Enter, with no digits typed by hand. The
 * control shows what this returns and can be stepped or overridden, which is
 * why a *good* answer is enough here and a perfect one is not needed - the
 * cost of being fifteen minutes off is two taps, and the cost of asking is a
 * decision every single time.
 *
 * Deliberately not built on `computeCapacity`. That function answers "what
 * can this day honestly claim about itself" and goes silent - `gaps: []`,
 * `freeMinutes: null` - whenever an anchor has no size or there are no
 * anchors at all, because a *sentence* about free time has nothing to say in
 * either case. A placement question is not a claim about the day: an empty
 * day is the largest gap this will ever return, and a day with one unsized
 * anchor still has obvious room around it. Same reasoning as
 * `matchTaskToGaps` in gapPlacement.ts, which is the other side of this coin
 * - that one takes a task and finds its gaps, this one takes a length and
 * finds the first gap that holds it.
 */

/** One press of an arrow, and the grid the arrows snap a suggestion onto. */
export const SLOT_STEP_MINUTES = 15

/**
 * Gap starts are rounded up to this rather than to the full quarter hour. A
 * gap that opens at 10:20 because a meeting ended at 10:20 is genuinely free
 * at 10:20, and rounding that to 10:30 would give away ten minutes for the
 * sake of a rounder number.
 */
const GAP_GRAIN_MINUTES = 5

export function roundUpTo(minutes: number, step: number): number {
  return Math.ceil(minutes / step) * step
}

/**
 * The next quarter hour in `delta`'s direction, from wherever the time
 * currently is - "snap, then step", not "add fifteen minutes".
 *
 * It matters because the value the arrows start from is usually the clock:
 * pressing up at 14:07 should offer 14:15, not 14:22, and pressing it again
 * should offer 14:30. Adding a flat quarter hour would carry those seven
 * stray minutes through every press for the rest of the session.
 */
export function stepToQuarter(time: string, delta: number): string {
  const minutes = timeToMinutes(time)
  const stepped =
    delta > 0
      ? (Math.floor(minutes / SLOT_STEP_MINUTES) + 1) * SLOT_STEP_MINUTES
      : (Math.ceil(minutes / SLOT_STEP_MINUTES) - 1) * SLOT_STEP_MINUTES
  const wrapped = ((stepped % (24 * 60)) + 24 * 60) % (24 * 60)
  return minutesToTime(wrapped)
}

export interface SlotQuery {
  /** Everything already on the day. Anchors block; floats do not. */
  tasks: Task[]
  /** How long the thing being typed is expected to take. */
  durationMinutes: number
  /** Time an external calendar has already spoken for - see calendars.ts. */
  busy?: Interval[]
  sleepProfileId?: string
  sleep?: SleepSettings
  /**
   * The earliest minute the answer may start at: the clock on today, and
   * absent on any other day, where "now" has no honest position - the same
   * rule the grid's own time indicator and the day header already follow.
   */
  notBefore?: number
}

/**
 * The start of the first gap in the day's waking window that holds
 * `durationMinutes`, as "HH:MM" - or `undefined` when there is no such gap,
 * which is a real and expected answer on a full day and late in the evening.
 * The caller shows that as "No time" and the task goes in as a float rather
 * than being squeezed past bedtime; a planner that answers a full day by
 * booking 23:45 is one people stop believing.
 *
 * **An unsized anchor blocks its own start minute and nothing else.** Its
 * real length is unknown, and `capacity.ts` has refused to invent one since
 * v1.0 - so this refuses too, in the only way that is still useful: a zero
 * length interval splits a gap without consuming any of it, so a suggestion
 * never runs across the moment that anchor begins, and the day after it is
 * still offered rather than written off. The one place a nicety is applied
 * on top of the arithmetic is the minute itself: a gap that opens exactly
 * where an unsized anchor starts has its candidate moved on by one step, so
 * "Call mom" is never proposed for the same minute "Dentist" begins. That is
 * a choice about what to put in front of somebody, not a claim about how
 * long the dentist takes, and stepping the control back undoes it.
 */
export function suggestSlot({
  tasks,
  durationMinutes,
  busy = [],
  sleepProfileId,
  sleep = DEFAULT_SLEEP_SETTINGS,
  notBefore,
}: SlotQuery): string | undefined {
  if (durationMinutes <= 0) return undefined
  const window = windowFor(sleepProfileId, sleep)

  // Now, to the minute, and deliberately not rounded up to the next quarter.
  // 14:15 reads tidier than 14:07, and it is wrong: a task starting eight
  // minutes from now is not the *running* task, and Focus is only ever
  // offered on the running card - so a rounded-up default would quietly put
  // the thing you just typed out of reach of the one feature for doing it
  // immediately. The arrows snap to the quarter from here, which is where a
  // round number belongs: in the answer somebody asked for, not the one they
  // were handed.
  const floor = Math.max(window.start, notBefore ?? window.start)

  const anchors = tasks.filter(isAnchor)
  const sized = anchors
    .filter(t => t.minutes !== undefined)
    .map(t => clipToWindow({ start: timeToMinutes(t.time!), end: timeToMinutes(t.time!) + t.minutes! }, window))
    .filter((interval): interval is Interval => interval !== null)
  const external = busy
    .map(interval => clipToWindow(interval, window))
    .filter((interval): interval is Interval => interval !== null)
  const unsizedStarts = anchors
    .filter(t => t.minutes === undefined)
    .map(t => timeToMinutes(t.time!))
    .filter(start => start >= window.start && start <= window.end)
    .map(start => ({ start, end: start }))

  const merged = mergeIntervals([...sized, ...external, ...unsizedStarts])
  const beginsSomething = new Set(unsizedStarts.map(u => u.start))

  for (const gap of gapsInWindow(merged, window)) {
    if (gap.end <= floor) continue
    // The grain applies to the gap's own start, never to `floor`: "you are
    // free from 10:22" rounds to 10:25, but "it is 14:07 and you are free
    // now" stays 14:07 for the reason spelled out on `floor` above.
    let start = Math.max(roundUpTo(gap.start, GAP_GRAIN_MINUTES), floor)
    while (beginsSomething.has(start)) start += SLOT_STEP_MINUTES
    if (start + durationMinutes <= gap.end) return minutesToTime(start)
  }
  return undefined
}
