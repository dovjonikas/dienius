import type { SleepWindow } from './types'
import { wallInstant } from './wallClock'

/**
 * A day between two sleeps - rotating shifts, since v2.29, and
 * docs/RESEARCH-SHIFTS.md section 3. A sleep belongs to the date it ends on,
 * the day you wake into, so a date's waking day runs from the end of the sleep
 * it wakes from to the start of tonight's - and tonight's sleep is the next
 * date's, which may start before midnight or after it.
 *
 * Everything here is in minutes on the date's own wall clock: below zero is
 * the evening before, past 1440 the date after. The grey bands, the free-time
 * figure and "Sleep in" all read a day's sleep from one `WakingDay`, so they
 * cannot disagree about when the day ends; on two days that share a schedule
 * - every plan before shifts - it is exactly the waking window there has
 * always been.
 */

/** A stretch of a day's clock, in minutes from its midnight. */
export interface Span {
  start: number
  end: number
}

/** The sleep a date wakes from, the sleep tonight, and the waking hours between. */
export interface WakingDay {
  /** The sleep the date wakes from, or null when its schedule has no sleep. Its start is below zero when it began the evening before. */
  woke: Span | null
  /** Tonight's sleep - the next date's - or null. Past 1440 where it starts after midnight. */
  tonight: Span | null
  /** From the end of the sleep the date woke from to the start of tonight's. Its end may pass 1440. */
  waking: Span
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY_MINUTES = 24 * 60

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * The sleep a schedule gives the date that owns it - the date it ends on. Over
 * midnight it starts the evening before, so its start is below zero; within
 * one day it is that day's. Bedtime equal to wake time is no sleep at all,
 * rather than twenty-four hours of it, as it has always been read.
 */
export function ownedSleep(window: SleepWindow): Span | null {
  if (!CLOCK.test(window.start) || !CLOCK.test(window.end)) return null
  const start = minutesOf(window.start)
  const end = minutesOf(window.end)
  if (start === end) return null
  return start < end ? { start, end } : { start: start - DAY_MINUTES, end }
}

/**
 * A date's day, from the schedule of the sleep it wakes from and the schedule
 * of tonight's - its own and the next date's, or one schedule twice for a
 * template, which has no next date.
 *
 * With no sleep to wake from the day starts at its midnight, and with none
 * tonight it ends at the next: a day nobody sleeps through is the whole
 * calendar day, as it always was. A sleep tomorrow that would begin before
 * today's has ended leaves no waking hours rather than negative ones.
 */
export function wakingDay(woke: SleepWindow, tonight: SleepWindow): WakingDay {
  const own = ownedSleep(woke)
  const next = ownedSleep(tonight)
  const later = next ? { start: next.start + DAY_MINUTES, end: next.end + DAY_MINUTES } : null
  const start = own ? own.end : 0
  const end = later ? Math.max(start, later.start) : DAY_MINUTES
  return { woke: own, tonight: later, waking: { start, end } }
}

/**
 * The sleeps that fall on the day's own clock, cut to it - what a day's grid
 * greys. Not the waking hours turned inside out: after a night shift the hours
 * from midnight to a daytime sleep are awake, and are not grey.
 */
export function bandsOnDay(day: WakingDay): Span[] {
  return [day.woke, day.tonight]
    .filter((sleep): sleep is Span => sleep !== null)
    .map(sleep => ({ start: Math.max(0, sleep.start), end: Math.min(DAY_MINUTES, sleep.end) }))
    .filter(band => band.start < band.end)
}

/**
 * The waking hours cut to the day's own clock: what a task on this date can be
 * placed in, since a task's time is on its own date's clock.
 */
export function wakingOnDay(day: WakingDay): Span {
  return { start: Math.min(day.waking.start, DAY_MINUTES), end: Math.min(day.waking.end, DAY_MINUTES) }
}

/**
 * Real minutes from `nowMinutes` on `date`'s clock until the next sleep
 * begins, or null while asleep. The next sleep can be the one this date wakes
 * from - in its small hours, before a bedtime after midnight - or tonight's,
 * past midnight when that is where it starts. Counted in real time, so across
 * the night the clocks change it is an hour more or an hour less than the
 * clock face says.
 */
export function minutesUntilSleep(date: string, nowMinutes: number, day: WakingDay): number | null {
  const sleeps = [day.woke, day.tonight].filter((sleep): sleep is Span => sleep !== null)
  if (sleeps.some(sleep => nowMinutes >= sleep.start && nowMinutes < sleep.end)) return null
  const next = sleeps.find(sleep => sleep.start > nowMinutes)
  if (!next) return null
  return Math.round((wallInstant(date, next.start) - wallInstant(date, nowMinutes)) / 60_000)
}
