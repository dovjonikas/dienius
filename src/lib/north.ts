import { dateKey } from './dates'
import { parseNorth } from './northSections'
import type { AppData, Goal } from './types'

/**
 * North: one text, in the person's own words.
 *
 * Since v2.28 it is nothing else - see DECISIONS "North is one text, goals
 * retired". The text reads in three parts, by lib/northSections.ts: the
 * picture before the first heading, the headings with the lines under them,
 * and the signature after a line of `---`. The page reads all of it, the
 * window after sleep the picture and the signature, the day's top one line
 * from under a heading, and the evening the signature.
 *
 * ## Why this has no progress bar
 *
 * Every other feature in this app measures something. This one refuses to,
 * and the refusal is the feature. When people are shown how far they have
 * come toward something they care about, they ease off: a visible advance
 * reads as licence to spend it. The same person shown instead why it matters
 * - the commitment itself, restated - keeps going. A text read every morning
 * is the commitment restated, and there is nothing in it to tick, fill or
 * count.
 */

/** Days since an arbitrary fixed epoch. Only its remainder is ever used. */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * The store with the text written, rewritten or - when the text is empty -
 * removed. Removed rather than blank, because absent is what syncs as a
 * deletion (see `PICTURE_KEY`) and a blank would be a body that wins the
 * next merge and comes back. The same object is kept when the text has not
 * changed, so nothing is stamped for a save that changed nothing.
 */
export function withPicture(data: AppData, text: string): AppData {
  const trimmed = text.trim()
  const next: AppData = { ...data }
  if (!trimmed) {
    delete next.picture
    return next
  }
  next.picture = data.picture?.text === trimmed ? data.picture : { ...data.picture, text: trimmed }
  return next
}

/**
 * Goals retired, once, at every door a plan comes in through: `loadData` and
 * `importJson` by way of `normalizeLoaded`, and the sync merge.
 *
 * Until v2.28 a goal was a title, a why, an identity, two short lists and
 * the rules under it, shown on North, on the day and on four cards. North is
 * one text now and nothing shows a goal, so a plan that still has active
 * goals is handled here, in two steps:
 *
 * - **Where the text has no picture part** - no text at all, or a text that
 *   starts with a heading or its signature - the active goals' titles and
 *   whys become its picture, one paragraph a goal in the order they were
 *   written, so what somebody wrote there is still the first thing North
 *   shows. A text that already has a picture is left exactly as it is: it is
 *   the person's own picture, and goals stacked over it would be a second
 *   one. The words are kept as written; only their ends are trimmed.
 * - **Every active goal is archived**, dated today. Nothing is deleted: every
 *   field of every goal and every rule stays in the plan, in a backup and in
 *   sync, readable by an older device and by any later import. Archiving is
 *   what makes this happen once. A plan with no active goal is handed back
 *   as the same object, so a picture part deleted months later does not
 *   bring the goals back, and the ordinary open costs one pass over a short
 *   list.
 *
 * What changed is stamped now, the way the inbox fold stamps its tombstones
 * (see later.ts): the text and the archived goals have to win the next merge
 * against a device that still holds the goals active, or the move would be
 * undone there and done again here on every round trip.
 */
export function retireGoals(data: AppData, now: string): AppData {
  const active = data.goals.filter(goal => !goal.archivedAt)
  if (active.length === 0) return data

  const today = dateKey(new Date(now))
  const next: AppData = {
    ...data,
    goals: data.goals.map(goal => (goal.archivedAt ? goal : { ...goal, archivedAt: today, updatedAt: now })),
  }

  const text = data.picture?.text ?? ''
  const words = active.map(goalWords).filter(Boolean).join('\n\n')
  if (words && parseNorth(text).intro.length === 0) {
    next.picture = { ...data.picture, text: text ? `${words}\n\n${text}` : words, updatedAt: now }
  }
  return next
}

/** A goal as a paragraph of the picture: its title, and its why under it. */
function goalWords(goal: Goal): string {
  return [goal.title, goal.why]
    .map(part => part?.trim())
    .filter(Boolean)
    .join('\n')
}
