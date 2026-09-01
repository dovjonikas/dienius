import type { DayType, Task } from '../../lib/types'
import { TIME_RE } from './parse'

/**
 * A task with `time` is an anchor - it genuinely occupies that stretch of
 * the day. A task with no `time` is a float - it has a size but no
 * position, and never has to be scheduled to be done. This is the same
 * distinction docs/TIMELINE.md section 3 names; it already existed in the
 * data, this just gives it a consequence.
 *
 * Exported so the grid (step 4 of the same section) classifies tasks the
 * same way the capacity line does, rather than re-deciding what an anchor
 * is a second time.
 */
export function isAnchor(task: Task): boolean {
  return task.time !== undefined
}

/**
 * Exported for the same reason as `isAnchor` - the grid turns a task's
 * `time` string into a minute offset for layout using the exact same
 * parsing the capacity arithmetic already relies on.
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export interface Interval {
  start: number
  end: number
}

/** Minutes in one calendar day. */
const DAY_MINUTES = 24 * 60

/**
 * The window free time is measured against for an ordinary day: 07:00 to
 * 23:00, 16 hours. Fixed and never configured - see `computeCapacity`'s
 * own doc comment for why a window has to exist at all and why this is
 * not the same mistake as a per-day setting.
 */
const DEFAULT_WINDOW: Interval = { start: 7 * 60, end: 23 * 60 }

/**
 * The window for a `night`-type day: 13:00 to 24:00, 11 hours. Shifted
 * later than the default window, not just narrower, because a night
 * shift's own morning is spent asleep - either recovering from the
 * previous night or resting before the coming one - the same way a
 * normal day's own late night is. It also runs to midnight rather than
 * stopping short of it, since a night day has no equivalent of the
 * default window's pre-sleep wind-down to exclude: the approach to the
 * shift, or the shift itself, is the end of this day's usable time.
 *
 * This is a coarse read of one label, not a measurement of any specific
 * person's actual schedule - it does not know when tonight's shift
 * really starts, only that the day is a night one. It is still strictly
 * better than applying the daytime window to a night day, which would be
 * wrong in exactly the way section 2 already warns a fixed clock window
 * can be. If a real month of night days shows this window is off, the
 * fix is to adjust these two numbers, not to make the window
 * configurable - the same posture docs/DECISIONS.md already takes on
 * `dayType`'s coarseness elsewhere.
 */
const NIGHT_WINDOW: Interval = { start: 13 * 60, end: DAY_MINUTES }

function windowFor(dayType: DayType): Interval {
  return dayType === 'night' ? NIGHT_WINDOW : DEFAULT_WINDOW
}

function anchorInterval(task: Task): Interval {
  const start = timeToMinutes(task.time!)
  return { start, end: start + task.minutes! }
}

// Cuts an anchor's interval down to the part that actually falls inside
// the window, discarding the rest rather than counting it. An anchor that
// starts before the window, runs past its end, or falls entirely outside
// it (the small hours of an ordinary day, say) contributes only what
// genuinely lands within the hours this feature measures - never a
// negative amount, and never time the window has already decided not to
// speak to. Returns null when nothing of the anchor survives the clip.
//
// Exported: the grid clips anchors to its own, differently-derived window
// with this exact function, rather than a second clipping rule that could
// drift from this one.
export function clipToWindow(interval: Interval, window: Interval): Interval | null {
  const start = Math.max(interval.start, window.start)
  const end = Math.min(interval.end, window.end)
  return start < end ? { start, end } : null
}

// Merges overlapping and back-to-back anchors into contiguous busy blocks,
// so a person double-booked for part of an hour is not counted as if that
// hour happened twice. Two anchors that touch exactly (one ends the moment
// the other starts) merge too - there is no real gap between them.
//
// Exported for the grid's own gap computation - see the note on
// `clipToWindow` above.
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Interval[] = [{ ...sorted[0] }]
  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1]
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push({ ...current })
    }
  }
  return merged
}

/**
 * Walks a window left to right against a set of already-merged busy
 * blocks and returns whatever is left over as gaps, including before the
 * first block and after the last. Used by `computeCapacity`'s own fixed
 * waking window, and by `computeInteriorGaps` in `timelineLayout.ts` -
 * the grid wants only the gaps strictly between two anchors, never the one
 * before the first or after the last, so it filters out whichever of these
 * gaps touches either edge of its own, differently-derived window exactly,
 * rather than drawing every gap this function reports.
 */
export function gapsInWindow(merged: Interval[], window: Interval): Gap[] {
  const gaps: Gap[] = []
  let cursor = window.start
  for (const block of merged) {
    if (block.start > cursor) gaps.push({ start: cursor, end: block.start, minutes: block.start - cursor })
    cursor = Math.max(cursor, block.end)
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end, minutes: window.end - cursor })
  return gaps
}

/** One free stretch of time within the window, outside every sized anchor block. */
export interface Gap {
  start: number
  end: number
  minutes: number
}

/**
 * The result of comparing a day's anchors against its floats.
 *
 * `anchorsMinutes` and `freeMinutes` are `null`, not zero, only when there
 * are no anchors at all - zero is a real answer ("no free time"); null
 * means there is nothing to measure in the first place. When at least one
 * anchor exists but its size is unknown, `freeMinutes` is also `null` -
 * see `unsizedAnchorCount` below - because asserting a free-time figure
 * around an anchor of unknown length would be a guess dressed up as
 * arithmetic, which is exactly what this app refuses to do.
 */
export interface Capacity {
  /** Every task with a `time`, sized or not. */
  anchorCount: number
  /** Anchors with a `time` but no `minutes` - their true length is unknown. */
  unsizedAnchorCount: number
  /**
   * Total occupied time, within the day's window, from the anchors whose
   * size is actually known - merged so overlapping ones are not double-
   * counted, and clipped so nothing outside the window is counted either.
   * `null` only when `anchorCount` is 0. Can be a real number - including
   * 0, if every sized anchor falls outside the window entirely - even
   * when `unsizedAnchorCount` is greater than 0.
   */
  anchorsMinutes: number | null
  /**
   * True when at least one sized anchor's real length, from its own
   * `minutes`, is longer than the portion `clipToWindow` kept - a night
   * shift that runs past the window's close, say. `anchorsMinutes` is
   * still the correct figure for the window's own arithmetic, but a
   * sentence that reports it as "the" length of that anchor would read as
   * wrong to a person who knows their shift is longer - see
   * `formatCapacityLine`, which qualifies the anchors clause when this is
   * true rather than changing the number itself.
   */
  anchorsClippedByWindow: boolean
  /**
   * Free stretches within the window, outside every sized anchor block.
   * Only ever populated when every anchor is sized - see `freeMinutes`.
   */
  gaps: Gap[]
  /**
   * `null` when there are no anchors, or when any anchor's size is
   * unknown - in either case there is no trustworthy free-time figure to
   * report. Otherwise the total minutes left in the window once every
   * sized anchor's occupied time is removed.
   */
  freeMinutes: number | null
  floatsMinutes: number
  unsizedFloatCount: number
  /**
   * How far the floats exceed the free time, or 0 when they fit. `null`
   * whenever `freeMinutes` is `null` - there is nothing to compare against.
   */
  overMinutes: number | null
}

/**
 * Computes a day's capacity from its raw task list and day type. Pure and
 * synchronous, no notion of "today" or the clock - the caller decides
 * which day's tasks to pass in. `dayType` defaults to 'full', the same
 * default `dayScore` already uses for a day with no type of its own.
 *
 * Free time needs a window, and the window has been wrong twice before
 * settling here. The calendar day (00:00-24:00) counted sleep as free
 * time - a 09:00-21:00 shift reported twelve hours free, when most of
 * that was the middle of the night, and the overage line would as a
 * result almost never fire. The anchor span (first anchor's start to
 * last anchor's end) failed the opposite way - a shift with real hours
 * free before and after it reported no free time at all, because nothing
 * outside the anchors' own span was ever considered.
 *
 * **The window is a fixed waking window, not configured per day and not
 * derived from the day's own anchors: 07:00-23:00 for an ordinary day,
 * 13:00-24:00 for a `night` one.** See `DEFAULT_WINDOW` and
 * `NIGHT_WINDOW` above for the reasoning behind each. Using the day's own
 * `dayType` is not one more decision the owner has to make - it is
 * information already given once, when the template was built or the day
 * was typed, the same way `dayScore` already reads it. Anchors are
 * clipped to the window rather than counted outside it - a shift that
 * starts before the window opens or runs past where it closes only
 * contributes the portion that falls inside, and an anchor entirely
 * outside the window (a stray task logged for 03:00) contributes nothing
 * and does not distort the arithmetic.
 *
 * It degrades correctly on its own: zero anchors mean nothing is claimed,
 * reported as `null` rather than a fabricated "16h free," and a single
 * anchor that fills or overruns the whole window correctly leaves nothing
 * free - clipping means an anchor can never push free time negative.
 *
 * Clipping is correct arithmetic but can read as wrong on its own: a
 * night shift clipped down to the two hours before midnight is genuinely
 * only two hours of today's window, but a sentence that just says
 * "Anchors take 2h" for an eight-hour shift looks like the app got the
 * shift's length wrong, not like it scoped the day correctly. See
 * `anchorsClippedByWindow` and `formatCapacityLine`, which say so rather
 * than let a true number read as a mistake.
 */
export function computeCapacity(tasks: Task[], dayType: DayType = 'full'): Capacity {
  const anchors = tasks.filter(isAnchor)
  const floats = tasks.filter(t => !isAnchor(t))

  const floatsMinutes = floats.reduce((sum, t) => sum + (t.minutes ?? 0), 0)
  const unsizedFloatCount = floats.filter(t => t.minutes === undefined).length

  if (anchors.length === 0) {
    return {
      anchorCount: 0,
      unsizedAnchorCount: 0,
      anchorsMinutes: null,
      anchorsClippedByWindow: false,
      gaps: [],
      freeMinutes: null,
      floatsMinutes,
      unsizedFloatCount,
      overMinutes: null,
    }
  }

  const window = windowFor(dayType)
  const sizedAnchors = anchors.filter(t => t.minutes !== undefined)
  const unsizedAnchorCount = anchors.length - sizedAnchors.length
  const rawIntervals = sizedAnchors.map(anchorInterval)
  const clippedOrNull = rawIntervals.map(interval => clipToWindow(interval, window))
  const clipped = clippedOrNull.filter((interval): interval is Interval => interval !== null)
  const merged = mergeIntervals(clipped)
  const anchorsMinutes = merged.reduce((sum, block) => sum + (block.end - block.start), 0)
  // Compared against the raw, unclipped interval for each sized anchor in
  // turn (not against the merged blocks) - merging two overlapping anchors
  // into their union is already-accepted, separate honesty, not a
  // truncation the window imposed, so it must never trip this flag.
  const anchorsClippedByWindow = rawIntervals.some((interval, i) => {
    const kept = clippedOrNull[i]
    const keptMinutes = kept ? kept.end - kept.start : 0
    return keptMinutes < interval.end - interval.start
  })

  // At least one anchor's real length is unknown, so its true position on
  // the timeline is unknown too - it might run through what would
  // otherwise look like a free gap. Reporting a free-time figure here
  // would be asserting something the app cannot actually verify, the same
  // reasoning that already keeps an unsized float out of the float total
  // rather than guessing it at zero.
  if (unsizedAnchorCount > 0) {
    return {
      anchorCount: anchors.length,
      unsizedAnchorCount,
      anchorsMinutes,
      anchorsClippedByWindow,
      gaps: [],
      freeMinutes: null,
      floatsMinutes,
      unsizedFloatCount,
      overMinutes: null,
    }
  }

  const gaps = gapsInWindow(merged, window)

  const freeMinutes = gaps.reduce((sum, gap) => sum + gap.minutes, 0)
  const overMinutes = Math.max(0, floatsMinutes - freeMinutes)

  return {
    anchorCount: anchors.length,
    unsizedAnchorCount: 0,
    anchorsMinutes,
    anchorsClippedByWindow,
    gaps,
    freeMinutes,
    floatsMinutes,
    unsizedFloatCount,
    overMinutes,
  }
}

/**
 * Renders a duration the way the capacity line speaks: hours and minutes
 * together with no separator ("6h10"), a bare hour count when there is no
 * remainder ("6h"), or a plain minute count under an hour ("40 min"). This
 * one function is reused everywhere a duration appears - the capacity
 * line, the per-task size chip, the template editor - so the wording
 * never drifts between them.
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${minutes} min`
  if (remainder === 0) return `${hours}h`
  return `${hours}h${String(remainder).padStart(2, '0')}`
}

/**
 * Renders the capacity line - the one sentence at the top of the day view.
 * Returns null for a day with nothing measurable at all, the same way
 * `formatDayScore` returns null for an unplanned day: there is nothing to
 * say, not a zero to report.
 *
 * "About" appears exactly once, on the floats estimate, because that
 * number is built from estimates a person typed in - the anchor and free
 * figures come from real clock times and are stated plainly. Being over
 * is stated as a fact, never as a warning: no red, no icon, no
 * exclamation mark, matching the same no-guilt principle as the day score.
 *
 * When any anchor's size is unknown, the line says so instead of stating a
 * free-time figure it cannot back up - see `computeCapacity`. There is no
 * "trim" action embedded here: this sentence only ever states the
 * arithmetic. Choosing which float moves to tomorrow is offered on each
 * float's own row instead, so the app never pre-selects it - see
 * docs/TIMELINE.md section 8.
 */
export function formatCapacityLine(capacity: Capacity): string | null {
  const sentences: string[] = []

  if (capacity.anchorCount > 0) {
    const sizedAnchorCount = capacity.anchorCount - capacity.unsizedAnchorCount
    if (sizedAnchorCount > 0) {
      // An anchor that runs past the window's close (a night shift, say)
      // is genuinely longer than the figure below - it is only cut down
      // to the part that falls in today's window, not shortened in
      // reality. Saying so here keeps the number honest without a second
      // sentence: the reader is not told an eight-hour shift is two hours
      // long, only that two of its hours are today's.
      const windowNote = capacity.anchorsClippedByWindow ? " within today's window" : ''
      const unsizedNote = capacity.unsizedAnchorCount > 0 ? `, plus ${capacity.unsizedAnchorCount} unsized` : ''
      sentences.push(`Anchors take ${formatDuration(capacity.anchorsMinutes!)}${windowNote}${unsizedNote}.`)
    } else {
      const word = capacity.unsizedAnchorCount === 1 ? 'anchor' : 'anchors'
      sentences.push(`${capacity.unsizedAnchorCount} ${word} with no size yet.`)
    }

    if (capacity.unsizedAnchorCount > 0) {
      sentences.push("Free time isn't known until every anchor has a size.")
    } else if (capacity.gaps.length > 0) {
      const gapWord = capacity.gaps.length === 1 ? 'gap' : 'gaps'
      sentences.push(`Free: ${formatDuration(capacity.freeMinutes!)} across ${capacity.gaps.length} ${gapWord}.`)
    } else {
      sentences.push('No free time left today.')
    }
  }

  if (capacity.floatsMinutes > 0) {
    const unsized = capacity.unsizedFloatCount > 0 ? `, plus ${capacity.unsizedFloatCount} unsized` : ''
    sentences.push(`Floats need about ${formatDuration(capacity.floatsMinutes)}${unsized}.`)
    if (capacity.overMinutes !== null && capacity.overMinutes > 0) {
      sentences.push(`You are ${formatDuration(capacity.overMinutes)} over.`)
    }
  } else if (capacity.unsizedFloatCount > 0) {
    const floatWord = capacity.unsizedFloatCount === 1 ? 'float' : 'floats'
    sentences.push(`${capacity.unsizedFloatCount} ${floatWord} with no size yet.`)
  }

  return sentences.length > 0 ? sentences.join(' ') : null
}

/**
 * Parses free-typed text from a size field into a valid whole number of
 * minutes, or undefined when the text does not describe one - including
 * an empty field, which is read as "clear the size" rather than an error.
 * Zero is rejected rather than accepted as a size: a task that takes no
 * time at all is not a duration estimate, it is the absence of one, and
 * that is what leaving the field empty already means.
 */
export function parseMinutesInput(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  if (!/^\d+$/.test(trimmed)) return undefined
  const value = Number(trimmed)
  return value > 0 ? value : undefined
}

/**
 * Parses free-typed text from a time field into a canonical "HH:MM", or
 * undefined when the text does not describe a real clock time - including
 * an empty field, which is read as "leave this a float" rather than an
 * error, the same way an empty size field reads as "clear the size" in
 * `parseMinutesInput` above.
 *
 * Accepts what a person is actually likely to type in a hurry:
 * - a colon-separated time, one or two digit hour ("9:30", "09:30"),
 *   reusing the exact hour/minute definition `parseQuickAdd` already
 *   matches at the start of a quick-add line (`TIME_RE` in parse.ts), so
 *   "a valid hour" and "a valid minute" are defined in one place, not two;
 * - three or four bare digits with no colon ("930", "0930"), the last two
 *   read as minutes and whatever is left as the hour;
 * - one or two bare digits with no colon ("9", "14"), read as an hour on
 *   its own with no minute component.
 *
 * Anything else - "banana", "25:00", "2500", a minute or hour out of range
 * - returns undefined rather than being coerced into a guess. There is no
 * error message for a rejected value: the caller's job is to revert
 * quietly to whatever was last valid, not to nag someone mid-keystroke.
 */
export function parseTimeInput(text: string): string | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined

  const colonMatch = TIME_RE.exec(trimmed)
  if (colonMatch) return `${colonMatch[1].padStart(2, '0')}:${colonMatch[2]}`

  if (!/^\d{1,4}$/.test(trimmed)) return undefined
  if (trimmed.length <= 2) {
    const hour = Number(trimmed)
    return hour <= 23 ? `${trimmed.padStart(2, '0')}:00` : undefined
  }
  const hourPart = trimmed.slice(0, -2)
  const minutePart = trimmed.slice(-2)
  const hour = Number(hourPart)
  const minute = Number(minutePart)
  return hour <= 23 && minute <= 59 ? `${hourPart.padStart(2, '0')}:${minutePart}` : undefined
}

/**
 * Moves a canonical "HH:MM" time forward or backward by `deltaMinutes`,
 * wrapping around midnight in either direction rather than clamping at the
 * edges of the day - a clock keeps turning, it does not stop at 23:59 or
 * refuse to go earlier than 00:00. Used by the block-add time field's
 * arrow-key and step-button handling; kept pure and separate from that
 * component so the wraparound arithmetic is unit tested with no DOM
 * involved.
 */
export function stepTime(time: string, deltaMinutes: number): string {
  const wrapped = ((timeToMinutes(time) + deltaMinutes) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES
  const hour = Math.floor(wrapped / 60)
  const minute = wrapped % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
