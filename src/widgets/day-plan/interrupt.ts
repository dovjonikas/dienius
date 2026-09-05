import { addDays, shortWeekday } from '../../lib/dates'
import { isRoutine } from '../../lib/taskIdentity'
import type { Task } from '../../lib/types'
import type { Interval } from './capacity'
import type { ConflictChoice, DayWords } from './replan'

/**
 * The shape of an interruption, before its arithmetic.
 *
 * A phone call rarely names a length. "Tomorrow morning I need a hand" and
 * "Thursday after lunch" are how a day actually gets taken, and asking for
 * a start time and a number of minutes at that moment is asking somebody to
 * translate. So the sheet's first answers are shapes - the morning, the
 * afternoon, the evening, the whole day - and everything here turns one of
 * those, on a given day's waking window, into the interval `planInterrupt`
 * already knows how to fit around. See replan.ts for the arithmetic and
 * interruptParse.ts for the typed line; this file is the vocabulary both
 * share.
 */

export type Shape = 'morning' | 'afternoon' | 'evening' | 'whole'

/** The six chips: four shapes, a time and a length, and a time with no end. */
export type Preset = Shape | 'custom' | 'open'

export const SHAPES: { id: Shape; label: string }[] = [
  { id: 'morning', label: 'Morning gone' },
  { id: 'afternoon', label: 'Afternoon gone' },
  { id: 'evening', label: 'Evening gone' },
  { id: 'whole', label: 'Whole day gone' },
]

/**
 * Where the morning ends and the evening starts, as clock minutes. One
 * o'clock and six, because "after lunch" and "after work" are what the
 * words mean to the person saying them; the waking window supplies the
 * other two edges, so a late riser's morning is shorter and a night owl's
 * evening longer without either being asked.
 */
export const MORNING_ENDS = 13 * 60
export const EVENING_STARTS = 18 * 60

/** What stands in when nobody typed a name. The sheet's own title, so the block says what it is. */
export const DEFAULT_TITLE = 'Something came up'

/**
 * The stretch a shape covers on a day with this waking window, from `from`
 * on, or null when nothing of it is left - "the morning is gone" said at
 * three in the afternoon is not an interruption, and the chip for it is
 * disabled rather than fitted to nothing.
 */
export function shapeInterval(shape: Shape, window: Interval, from: number = window.start): Interval | null {
  const raw =
    shape === 'morning'
      ? { start: window.start, end: MORNING_ENDS }
      : shape === 'afternoon'
        ? { start: MORNING_ENDS, end: EVENING_STARTS }
        : shape === 'evening'
          ? { start: EVENING_STARTS, end: window.end }
          : { start: window.start, end: window.end }
  const start = Math.max(raw.start, from, window.start)
  const end = Math.min(raw.end, window.end)
  return start < end ? { start, end } : null
}

/** Rounds up to the next five minutes, the same grain the grid snaps to. */
export function roundUp(minutes: number, step = 5): number {
  return Math.ceil(minutes / step) * step
}

// --- which day ---------------------------------------------------------------

export interface DayChoice {
  date: string
  label: string
}

/**
 * The WHEN row: today, tomorrow, and the five days after those with their
 * dates. Seven days from today rather than Monday to Sunday of this week,
 * because a chip for a day that has already happened is a chip nobody can
 * press, and "Thursday" said on a Sunday means the one coming.
 */
export function dayChoices(today: string): DayChoice[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i)
    return { date, label: dayLabel(date, today) }
  })
}

/** "Today", "Tomorrow", "Thu 10" inside the week ahead, "Fri 25 Sep" beyond it. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  const dayOfMonth = Number(date.slice(8))
  if (date > today && date <= addDays(today, 6)) return `${shortWeekday(date)} ${dayOfMonth}`
  return `${shortWeekday(date)} ${shortDate(date)}`
}

function toDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "25 Sep". */
export function shortDate(key: string): string {
  // Day before month, built by hand: en-US puts the month first and en-GB
  // spells September "Sept", and the week title in dates.ts already builds
  // its dates this way.
  return `${Number(key.slice(8))} ${toDate(key).toLocaleDateString('en-US', { month: 'short' })}`
}

function longWeekday(key: string): string {
  return toDate(key).toLocaleDateString('en-US', { weekday: 'long' })
}

/**
 * How a plan for this day names it and the day after - "today" and
 * "tomorrow", "on Thursday" and "Friday", "on 25 Sep" and "26 Sep". The
 * summary and the free-windows line both read from this, so the two never
 * disagree about which day they are talking about.
 */
export function dayWordsFor(date: string, today: string): DayWords {
  if (date === today) return { day: 'today', next: 'tomorrow' }
  if (date === addDays(today, 1)) return { day: 'tomorrow', next: 'the day after' }
  const next = addDays(date, 1)
  if (date > today && date <= addDays(today, 6)) return { day: `on ${longWeekday(date)}`, next: longWeekday(next) }
  return { day: `on ${shortDate(date)}`, next: shortDate(next) }
}

// --- the proposal ------------------------------------------------------------

/**
 * What the sheet proposes for each block in the way, before anybody says
 * anything: a routine block - a template's or a repeat's, see `isRoutine` -
 * is skipped for the day, because the template makes it again wherever it
 * belongs and moving it would put a commute at nine in the evening; every
 * one-off is fitted into the gaps, key tasks first, which is what
 * `planInterrupt` does with no choice recorded. Only the routine ones need
 * an entry, so this is exactly the record of what is not the default.
 */
export function defaultChoices(conflicts: Task[]): Record<string, ConflictChoice> {
  return Object.fromEntries(conflicts.filter(isRoutine).map(t => [t.id, 'drop' as const]))
}
