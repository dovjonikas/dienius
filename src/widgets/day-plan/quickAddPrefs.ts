const DURATION_KEY = 'dienius:quick-add-duration'

/**
 * The four lengths offered as chips, and the one a fresh install starts on.
 *
 * Half an hour is the default because it is the length of the thing this app
 * is mostly used to catch: a call, an errand, a piece of admin. It is also
 * the only default that is wrong in a way somebody notices immediately - too
 * long and the day looks full, too short and nothing fits - which is exactly
 * the kind of default worth having, because it gets corrected once and then
 * remembered.
 */
export const DURATION_CHOICES = [15, 30, 45, 60] as const
export const DEFAULT_DURATION_MINUTES = 30

const MAX_DURATION_MINUTES = 24 * 60

/**
 * The length quick-add reaches for next time, remembered across sessions.
 *
 * localStorage rather than sessionStorage, unlike the text draft next door in
 * draft.ts: a half-typed line is about this tab right now, but "my tasks are
 * usually 45 minutes" is a fact about how somebody works, and being asked to
 * re-establish it every morning is exactly the papercut this whole control
 * exists to remove.
 *
 * Its own key rather than a field in `Settings`, and so deliberately outside
 * the backup and outside sync - the same reasoning as the clock tools and the
 * yesterday dismissal, listed in docs/ARCHITECTURE.md section 2. It is a
 * device's habit, not a plan: restoring a seven-day-old snapshot has no
 * business changing which chip is lit, and a phone and a laptop are allowed
 * to disagree about it.
 */
export function readLastDuration(): number {
  try {
    const raw = localStorage.getItem(DURATION_KEY)
    if (raw === null) return DEFAULT_DURATION_MINUTES
    const parsed = Number(raw)
    // Anything that is not a plausible length falls back rather than being
    // clamped into one. A stored value this cannot read is a value written by
    // something other than this function, and the honest response to that is
    // the default, not a rescued number.
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_DURATION_MINUTES) return DEFAULT_DURATION_MINUTES
    return parsed
  } catch {
    return DEFAULT_DURATION_MINUTES
  }
}

export function rememberDuration(minutes: number): void {
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_DURATION_MINUTES) return
  try {
    localStorage.setItem(DURATION_KEY, String(minutes))
  } catch {
    // Best effort, the same as the draft next door: a forgotten preference is
    // one extra tap tomorrow, not a lost plan.
  }
}
