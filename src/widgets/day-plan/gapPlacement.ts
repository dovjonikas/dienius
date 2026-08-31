import type { Task } from '../../lib/types'
import { isAnchor } from './capacity'

/**
 * One float as it is offered inside a gap's picker - just enough to render
 * a row and place it. `minutes` is `undefined` for an unsized float, never
 * a guessed number - see the module comment on `offerForGap`.
 */
export interface GapFloatOption {
  id: string
  title: string
  minutes: number | undefined
}

/**
 * What a gap of a given size has to offer, split by how sure the app is
 * that the float actually fits.
 */
export interface GapOffer {
  /** Sized floats whose own `minutes` is no larger than the gap, smallest first. */
  fitting: GapFloatOption[]
  /** Floats with no size at all - fit is unknown, not claimed either way. */
  unsized: GapFloatOption[]
}

/**
 * Decides what a single gap offers from the day's current tasks. Pure and
 * synchronous, the same shape as `computeCapacity` and
 * `computeTimelineLayout` - no React, no notion of which gap is on screen.
 *
 * **Sized floats fit when their `minutes` is no larger than the gap's own
 * `minutes`.** Equal counts as fitting - a float exactly the size of the
 * gap uses all of it, which is still a fit, not an overflow.
 *
 * **Unsized floats are never said to "fit."** `capacity.ts` already refuses
 * to invent a duration for an unsized item rather than guess one that could
 * silently poison the arithmetic - this is the same refusal applied to a
 * single gap instead of the whole day. An unsized float is listed
 * separately, under its own heading in the picker, precisely because
 * whether it fits is unknown rather than false: excluding it outright would
 * make an obviously-short float like "call grandma" unplaceable through
 * this gap forever just because nobody has ever typed a number into it,
 * and pretending it fits would be exactly the invented-duration mistake
 * `capacity.ts` was built to avoid. Placing one is still a fully honest
 * action - the placed task becomes an anchor whose length is unknown, the
 * same as any other unsized anchor already in this app, and it already
 * carries the same consequence: it suppresses gap arithmetic for the rest
 * of the day until it is either undone or given a size.
 *
 * **A float larger than the gap is left out entirely** - not fitting, not
 * unsized, just absent. There is nothing honest to say about it here; it
 * belongs in a different gap, or none at all.
 *
 * Only tasks that are floats (no `time`) and not yet done are ever offered;
 * an anchor is already placed somewhere, and a finished float has nothing
 * left to place.
 */
export function offerForGap(tasks: Task[], gapMinutes: number): GapOffer {
  const floats = tasks.filter(t => !isAnchor(t) && !t.done)

  const fitting = floats
    .filter((t): t is Task & { minutes: number } => t.minutes !== undefined && t.minutes <= gapMinutes)
    .sort((a, b) => a.minutes - b.minutes)
    .map(toOption)

  const unsized = floats.filter(t => t.minutes === undefined).map(toOption)

  return { fitting, unsized }
}

function toOption(task: Task): GapFloatOption {
  return { id: task.id, title: task.title, minutes: task.minutes }
}

export function hasNothingForGap(offer: GapOffer): boolean {
  return offer.fitting.length === 0 && offer.unsized.length === 0
}

/**
 * How many rows the picker shows before it needs a "show more" step. Visual
 * working memory holds about four integrated objects (Luck and Vogel 1997;
 * Cowan 2001) - see docs/RESEARCH-ADHD.md section 7. A gap with eleven
 * floats that fit is not eleven pieces of information, it is noise with
 * four pieces of information in it, so the picker shows this many rows and
 * asks before it shows the rest rather than dumping every option at once.
 */
export const VISIBLE_ROW_LIMIT = 4

/**
 * The rows the picker draws by default: every fitting float first (already
 * sorted smallest first by `offerForGap`), then unsized floats, capped at
 * `VISIBLE_ROW_LIMIT`. Fitting floats come first because they are the
 * actionable ones - a fit is known, an unsized float is a maybe - and
 * within "fitting," smallest first surfaces the easiest thing to start.
 * Anything past the cap is still reachable, just not dumped in front of the
 * reader by default - see the picker component for the "show more" step.
 */
export function visibleRows(offer: GapOffer): GapFloatOption[] {
  return [...offer.fitting, ...offer.unsized].slice(0, VISIBLE_ROW_LIMIT)
}

/** Every row the picker has to offer, fitting first - what "show more" reveals. */
export function allRows(offer: GapOffer): GapFloatOption[] {
  return [...offer.fitting, ...offer.unsized]
}
