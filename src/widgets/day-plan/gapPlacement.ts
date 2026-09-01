import type { DayType, Task } from '../../lib/types'
import { clipToWindow, gapsInWindow, isAnchor, mergeIntervals, timeToMinutes, windowFor, type Gap, type Interval, type SleepSettings } from './capacity'

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
    .filter((t): t is Task & { minutes: number } => t.minutes !== undefined && canPlaceFloatInGap(t.minutes, gapMinutes))
    .sort((a, b) => a.minutes - b.minutes)
    .map(toOption)

  const unsized = floats.filter(t => t.minutes === undefined).map(toOption)

  return { fitting, unsized }
}

/**
 * Whether dropping a float of this size onto a gap of this size is an
 * allowed placement - the single yes/no rule behind `offerForGap`'s two
 * lists, collapsed for callers that only need to know "can this go here,"
 * not the full fitting/unsized split. Step 7's drag-and-drop
 * (`dragDrop.ts`) and its long-press menu both call this rather than
 * re-deriving the rule from `offerForGap`'s shape, so there is exactly one
 * place "does this float fit" is decided.
 *
 * A sized float is allowed when it is no larger than the gap - equal
 * counts as fitting, same as `offerForGap`. An unsized float is always
 * allowed, for the same reason `offerForGap` lists it under its own "size
 * unknown" heading instead of excluding it: its fit is unknown, not false,
 * and refusing it here would make an obviously-short float like "call
 * grandma" undroppable forever just because nobody ever timed it.
 */
export function canPlaceFloatInGap(minutes: number | undefined, gapMinutes: number): boolean {
  return minutes === undefined || minutes <= gapMinutes
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

/**
 * One gap from `matchTaskToGaps`, carrying the title of whatever anchor sits
 * immediately on either side of it - "10:00 to 18:00" is a span of clock
 * time; "between Meeting and Gym" is a place in the day. `undefined` on
 * either side means the gap runs to the edge of the waking window itself
 * (the start of the day, or its end) rather than up against another anchor.
 */
export interface GapWithContext extends Gap {
  before: string | undefined
  after: string | undefined
}

/**
 * What selecting a single float and asking "where does this fit today"
 * comes back with - the inverse of `offerForGap`'s "what fits this gap,"
 * read the other way around the same arithmetic rather than a second copy
 * of it. See docs/TIMELINE.md sections 3 and 9.
 *
 * - `no-size`: the task itself has no `minutes` - there is nothing to match
 *   against a gap, the same refusal `capacity.ts` already makes rather than
 *   guess a duration. Stated plainly by the caller rather than shown as an
 *   empty list.
 * - `already-timed`: the task is already an anchor, not a float - it has a
 *   position, so "where could this go" no longer applies. The UI never
 *   offers selection for an anchor to begin with; this is here so a
 *   selection that outlives some other change to the same task (placed a
 *   different way while still selected) still reads as a plain state
 *   rather than a stale or crashing one - the same defensive reasoning as
 *   an unrecognised `taskId`, which matches nothing rather than throwing.
 * - `unknown`: some other anchor on the day has no size of its own, so its
 *   real position on the timeline is unknown and could fall inside what
 *   would otherwise look like free time - the exact reasoning
 *   `computeCapacity` already applies to the whole day's own free-time
 *   figure, applied here to one task's own match instead.
 * - `matched`: every gap in the day's waking window the task's size fits
 *   into, chronological, including none at all - a full day is a real,
 *   expected outcome here, not an error.
 */
export type TaskGapMatch =
  | { kind: 'no-size' }
  | { kind: 'already-timed' }
  | { kind: 'unknown' }
  | { kind: 'matched'; gaps: GapWithContext[] }

/**
 * Finds every gap in `taskId`'s own day that its size fits into, bounded by
 * the same fixed waking window `computeCapacity` measures the whole day
 * against (`windowFor` in capacity.ts) - never a gap outside it, so this
 * never offers 3am as a place for anything. Built from the same exported
 * pieces `computeTimelineLayout` already uses for the grid's own,
 * differently-scoped display window - `clipToWindow`, `mergeIntervals`,
 * `gapsInWindow` - rather than a second copy of that arithmetic.
 *
 * Deliberately not built from `computeCapacity`'s own `gaps` field: that
 * field is `[]` whenever there are zero anchors at all, because a capacity
 * *sentence* has nothing to say about an empty day ("Free: Xh across Y
 * gaps" needs at least one anchor to be a sentence worth writing in the
 * first place). A *placement* question has no such reason to stay silent -
 * an empty day is real free time, the single largest gap this function
 * will ever return, exactly the waking window itself with nothing on
 * either side of it.
 *
 * `sleep` defaults to the same fixed-window fallback `windowFor` itself
 * falls back to, so a caller that has not been handed the owner's actual
 * sleep settings - most of this file's own tests - matches against exactly
 * the window this app always used.
 */
export function matchTaskToGaps(
  tasks: Task[],
  dayType: DayType | undefined,
  taskId: string,
  sleep?: SleepSettings,
): TaskGapMatch {
  const task = tasks.find(t => t.id === taskId)
  if (!task) return { kind: 'matched', gaps: [] }
  if (isAnchor(task)) return { kind: 'already-timed' }
  if (task.minutes === undefined) return { kind: 'no-size' }
  const minutes = task.minutes

  const anchors = tasks.filter(isAnchor)
  if (anchors.some(a => a.minutes === undefined)) return { kind: 'unknown' }

  const window = windowFor(dayType ?? 'full', sleep)
  const named = anchors
    .map(a => ({
      title: a.title,
      interval: clipToWindow({ start: timeToMinutes(a.time!), end: timeToMinutes(a.time!) + a.minutes! }, window),
    }))
    .filter((a): a is { title: string; interval: Interval } => a.interval !== null)

  const merged = mergeIntervals(named.map(a => a.interval))
  const allGaps = gapsInWindow(merged, window)

  const gaps: GapWithContext[] = allGaps
    .filter(g => canPlaceFloatInGap(minutes, g.minutes))
    .map(g => ({
      ...g,
      before: named.find(a => a.interval.end === g.start)?.title,
      after: named.find(a => a.interval.start === g.end)?.title,
    }))

  return { kind: 'matched', gaps }
}

/**
 * The plain-language "what's on either side" clause for one gap from
 * `matchTaskToGaps` - "between Meeting and Gym", "after Meeting", "before
 * Gym" - or `undefined` when the gap touches neither: the whole waking
 * window on a day with nothing anchored in it yet.
 */
export function describeGapNeighbors(gap: GapWithContext): string | undefined {
  if (gap.before && gap.after) return `between ${gap.before} and ${gap.after}`
  if (gap.before) return `after ${gap.before}`
  if (gap.after) return `before ${gap.after}`
  return undefined
}
