import type { Task } from '../../lib/types'

/**
 * A task with `time` is an anchor - it genuinely occupies that stretch of
 * the day. A task with no `time` is a float - it has a size but no
 * position, and never has to be scheduled to be done. This is the same
 * distinction docs/TIMELINE.md section 3 names; it already existed in the
 * data, this just gives it a consequence.
 */
function isAnchor(task: Task): boolean {
  return task.time !== undefined
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

interface Interval {
  start: number
  end: number
}

/** Minutes in one calendar day - the fixed window everything below measures against. */
const DAY_MINUTES = 24 * 60

// An anchor that runs past midnight (a night shift stamped as, say, "23:00"
// for 480 minutes) is clamped to the end of this calendar day. capacity.ts
// only ever sees one day's tasks at a time - a DayPlan has no notion of
// tomorrow's - so "does today fit" can only honestly account for the part
// of the anchor that falls within today. The remainder is tomorrow's own
// capacity to compute, separately, the next time that day is viewed.
function anchorInterval(task: Task): Interval {
  const start = timeToMinutes(task.time!)
  const end = Math.min(DAY_MINUTES, start + task.minutes!)
  return { start, end }
}

// Merges overlapping and back-to-back anchors into contiguous busy blocks,
// so a person double-booked for part of an hour is not counted as if that
// hour happened twice. Two anchors that touch exactly (one ends the moment
// the other starts) merge too - there is no real gap between them.
function mergeIntervals(intervals: Interval[]): Interval[] {
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

/** One free stretch of time within the day, outside every sized anchor block. */
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
   * Total occupied time from the anchors whose size is actually known,
   * merged so overlapping ones are not double-counted. `null` only when
   * `anchorCount` is 0. Can be a real number - including 0 - even when
   * `unsizedAnchorCount` is greater than 0, if some anchors are sized and
   * others are not.
   */
  anchorsMinutes: number | null
  /**
   * Free stretches within the calendar day, outside every sized anchor
   * block. Only ever populated when every anchor is sized - see
   * `freeMinutes`.
   */
  gaps: Gap[]
  /**
   * `null` when there are no anchors, or when any anchor's size is
   * unknown - in either case there is no trustworthy free-time figure to
   * report. Otherwise the total minutes left in the day once every sized
   * anchor's occupied time is removed.
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
 * Computes a day's capacity from its raw task list. Pure and synchronous,
 * no notion of "today" or the clock - the caller decides which day's
 * tasks to pass in.
 *
 * The window free time is measured against is the calendar day itself -
 * 00:00 to 24:00, always, for every day. Not a fixed waking window (any
 * single clock range is wrong for someone's real day - 07:00-23:00 is
 * wrong for a night shift), not something read off the day's type (still
 * an invented number, just hidden behind a setting), and not the span
 * between the earliest and latest anchor either: that shape looked
 * config-free but was not honest - a single midday shift with real hours
 * free before and after it reported "no free time," and a morning-only
 * anchor silently ignored an entire afternoon and evening, because
 * nothing outside the anchors' own span was ever considered. The full day
 * is not an invented number - every day genuinely has 1440 minutes - so
 * there is nothing to configure and nothing that can be wrong for anyone's
 * schedule. It degrades correctly on its own: zero anchors mean the whole
 * day is unclaimed, which is reported as `null` rather than a fabricated
 * "24h free" (see `anchorCount` below), and a single anchor spanning the
 * entire day correctly leaves nothing free with no special case needed.
 */
export function computeCapacity(tasks: Task[]): Capacity {
  const anchors = tasks.filter(isAnchor)
  const floats = tasks.filter(t => !isAnchor(t))

  const floatsMinutes = floats.reduce((sum, t) => sum + (t.minutes ?? 0), 0)
  const unsizedFloatCount = floats.filter(t => t.minutes === undefined).length

  if (anchors.length === 0) {
    return {
      anchorCount: 0,
      unsizedAnchorCount: 0,
      anchorsMinutes: null,
      gaps: [],
      freeMinutes: null,
      floatsMinutes,
      unsizedFloatCount,
      overMinutes: null,
    }
  }

  const sizedAnchors = anchors.filter(t => t.minutes !== undefined)
  const unsizedAnchorCount = anchors.length - sizedAnchors.length
  const merged = mergeIntervals(sizedAnchors.map(anchorInterval))
  const anchorsMinutes = merged.reduce((sum, block) => sum + (block.end - block.start), 0)

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
      gaps: [],
      freeMinutes: null,
      floatsMinutes,
      unsizedFloatCount,
      overMinutes: null,
    }
  }

  const gaps: Gap[] = []
  let cursor = 0
  for (const block of merged) {
    if (block.start > cursor) gaps.push({ start: cursor, end: block.start, minutes: block.start - cursor })
    cursor = Math.max(cursor, block.end)
  }
  if (cursor < DAY_MINUTES) gaps.push({ start: cursor, end: DAY_MINUTES, minutes: DAY_MINUTES - cursor })

  const freeMinutes = gaps.reduce((sum, gap) => sum + gap.minutes, 0)
  const overMinutes = Math.max(0, floatsMinutes - freeMinutes)

  return {
    anchorCount: anchors.length,
    unsizedAnchorCount: 0,
    anchorsMinutes,
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
      const unsizedNote = capacity.unsizedAnchorCount > 0 ? `, plus ${capacity.unsizedAnchorCount} unsized` : ''
      sentences.push(`Anchors take ${formatDuration(capacity.anchorsMinutes!)}${unsizedNote}.`)
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
