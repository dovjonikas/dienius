import type { CategoryId } from './categories'
import { ROUTINE_LIMITS, type DayPlan, type Routine, type Task } from './types'

/**
 * Routines - rotating shifts, since v2.29, and docs/RESEARCH-SHIFTS.md section
 * 2.3. A routine is written once: a title, a length, the weekdays it is on and a
 * time for each kind of day. What it does on a date - placing its task, or saying
 * why it cannot - is composition's (`shiftDay.ts`); this file is how a routine
 * is kept, and what happens to its task when a person takes it somewhere else.
 */

/** A routine as a form hands it over, before it is kept. */
export interface RoutineInput {
  title: string
  category?: CategoryId
  minutes: number
  weekdays: number[]
  times: Record<string, string>
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * The routine as it is kept, or nothing when there is no routine in it.
 *
 * - The title trimmed and cut to `ROUTINE_LIMITS.title`; none means no routine.
 * - The length a whole number of minutes, from one to `ROUTINE_LIMITS.minutes`.
 * - The weekdays each once, in order, only 0 to 6; none means no routine, since
 *   a routine on no day is not one.
 * - A time kept only for a kind that exists and only on the clock (`HH:MM`): a
 *   time for a template that is no longer a kind would sit in the file meaning
 *   nothing, and a half-typed "9:" is not a time.
 */
export function cleanRoutine(input: RoutineInput, kindIds: string[]): Omit<Routine, 'id'> | undefined {
  const title = input.title.trim().slice(0, ROUTINE_LIMITS.title)
  if (!title) return undefined
  const weekdays = [...new Set(input.weekdays)].filter(d => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b)
  if (weekdays.length === 0) return undefined
  const whole = Number.isFinite(input.minutes) ? Math.round(input.minutes) : 1
  const minutes = Math.min(ROUTINE_LIMITS.minutes, Math.max(1, whole))
  const kinds = new Set(kindIds)
  const times = Object.fromEntries(Object.entries(input.times).filter(([kind, time]) => kinds.has(kind) && CLOCK.test(time)))
  const category = input.category?.trim()
  return { title, ...(category ? { category } : {}), minutes, weekdays, times }
}

/**
 * A day that some of its tasks left by hand - deleted, cleared, moved, pushed,
 * sent on by a replan or a low day - with each routine among them remembered
 * as gone from it (`routineSkips`), so composing the day again does not put
 * the routine back. The same tombstone `repeatSkips` is for a repeat, and the
 * rule the app keeps everywhere: what arrived and was taken away stays away.
 * The day itself when nothing leaving is a routine's.
 */
export function leftByHand(day: DayPlan, leaving: Task[]): DayPlan {
  const gone = leaving.map(t => t.routineId).filter((id): id is string => !!id)
  if (gone.length === 0) return day
  return { ...day, routineSkips: [...new Set([...(day.routineSkips ?? []), ...gone])] }
}

/**
 * A routine's task arriving on another date by hand. It stays its routine's,
 * so no date holds two of it, but it is no longer where the rule put it: with
 * no echo, composing the date it landed on leaves it where it was put, and
 * never takes it away.
 */
export function arrivingByHand(task: Task): Task {
  if (!task.fromRoutine) return task
  const { fromRoutine: _echo, ...rest } = task
  return rest
}
