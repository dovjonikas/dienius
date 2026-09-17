import type { CategoryId } from './categories'
import { ROUTINE_LIMITS, type Routine } from './types'

/**
 * Routines - rotating shifts, since v2.29, and docs/RESEARCH-SHIFTS.md section
 * 2.3. A routine is written once: a title, a length, the weekdays it is on and a
 * time for each kind of day. What it does on a date - placing its task, or saying
 * why it cannot - is composition's, in stage 3; this file is how a routine is
 * kept.
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
