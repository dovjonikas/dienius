import type { AppData } from './types'

/**
 * Whether this install has genuinely nothing in it yet - no template ever
 * saved, and no day that ever held a real task. Deliberately not a stored
 * flag: docs' own brief for this feature is explicit that a
 * "hasSeenOnboarding" boolean is one more thing to migrate and one more way
 * for a person who deletes everything to land on a blank screen instead of
 * the state that actually describes their data. Computing it fresh from
 * `AppData` on every render means Settings' "Erase all data" needs no
 * special case at all - the very next read is `defaultData()`, which this
 * function already reports as a first run.
 *
 * A `DayPlan` entry with an empty task list (left behind by an erased
 * stamp, or a day visited but never touched) does not count as having
 * planned anything - only a day that actually holds at least one task ends
 * the first run.
 */
export function isFirstRun(data: AppData): boolean {
  if (data.templates.length > 0) return false
  return Object.values(data.days).every(day => day.tasks.length === 0)
}
