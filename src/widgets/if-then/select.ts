import type { DayType, IfThenEntry } from '../../lib/types'

/**
 * The three time-of-day bands `IfThenEntry.when` can target. A coarse read
 * of the clock, not a personalized schedule - the same posture
 * `capacity.ts`'s own fixed waking windows already take. There is no
 * separate "night" band: the small hours read as `'morning'` here, since
 * docs/TIMELINE.md section 6 only ever asks for these three plus `'any'`,
 * and a fourth band would be one more thing for a person to reason about
 * when writing a rule for no clear gain.
 */
export type TimeBand = 'morning' | 'day' | 'evening'

/**
 * Which band `now` falls into. Two boundaries - noon and 18:00 - split the
 * day into three roughly even bands. Pure: takes the clock as an argument
 * rather than reading it, so the caller decides what "now" means and this
 * stays trivially testable at each boundary.
 */
export function timeBandFor(now: Date): TimeBand {
  const hour = now.getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'day'
  return 'evening'
}

// Absent dayTypes means every day - the same absence-is-fine treatment
// every optional field on data written before it existed gets elsewhere in
// this app.
function matchesDayType(entry: IfThenEntry, dayType: DayType): boolean {
  return entry.dayTypes === undefined || entry.dayTypes.includes(dayType)
}

// Absent when, or the explicit 'any', both mean every band.
function matchesBand(entry: IfThenEntry, band: TimeBand): boolean {
  return entry.when === undefined || entry.when === 'any' || entry.when === band
}

// How targeted a rule is toward "today" specifically. A rule pinned to
// particular day types or a particular time band is more relevant to right
// now than one that applies everywhere - "the sleep protocol matters on a
// night, not on a rest day" is exactly this: among several eligible rules,
// the one actually written for this day should win over a generic one that
// merely happens not to be excluded.
function specificity(entry: IfThenEntry): number {
  let score = 0
  if (entry.dayTypes !== undefined) score += 1
  if (entry.when !== undefined && entry.when !== 'any') score += 1
  return score
}

/**
 * Picks the one rule to surface on the day view for `date` - see
 * docs/TIMELINE.md section 6. Pure: `dayType` and `band` are passed in
 * rather than looked up, and `date` is a plain date key, so this has no
 * notion of "today" of its own.
 *
 * Eligibility is a strict filter, not a soft preference: a rule scoped to
 * specific day types or a specific time band simply does not surface
 * outside them, matching the spec's own wording exactly - "a night-shift
 * rule surfaces only on night days." Nothing eligible means nothing
 * surfaces; a quiet day with no rule shown is a correct outcome, not a
 * fallback that needs papering over.
 *
 * Among what is eligible, the most specific rule wins - see `specificity`
 * above - and ties break toward whichever eligible rule has gone longest
 * without a turn: `lastSurfaced` is a plain date key, a rule that has
 * never been shown sorts before every rule that has, and an ordinary
 * string comparison is enough because every real value is the same
 * `YYYY-MM-DD` shape.
 *
 * Stability matters as much as rotation. Once a rule has already been
 * recorded as shown for this exact `date` (see `actions.markIfThenSurfaced`
 * in `store.ts`), it keeps being the pick for that date even though, by
 * the time it is checked again, its own `lastSurfaced` now makes it look
 * like the most-recently-shown rule in the list - without this check the
 * pick would flip to a different rule the moment the first one was marked,
 * which is rotation happening within a day instead of across days. This is
 * the one place this function looks at `lastSurfaced` for anything other
 * than ranking.
 */
export function pickIfThenRule(
  entries: IfThenEntry[],
  dayType: DayType,
  band: TimeBand,
  date: string,
): IfThenEntry | null {
  const eligible = entries.filter(e => matchesDayType(e, dayType) && matchesBand(e, band))
  if (eligible.length === 0) return null

  const alreadyPickedToday = eligible.find(e => e.lastSurfaced === date)
  if (alreadyPickedToday) return alreadyPickedToday

  const ranked = [...eligible].sort((a, b) => {
    const bySpecificity = specificity(b) - specificity(a)
    if (bySpecificity !== 0) return bySpecificity
    return (a.lastSurfaced ?? '').localeCompare(b.lastSurfaced ?? '')
  })
  return ranked[0]
}
