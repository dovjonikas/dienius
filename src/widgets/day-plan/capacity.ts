import type { Task } from '../../lib/types'
import { MAX_PUSHES } from '../../lib/pushRules'

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

// An anchor with no minutes is not guessed at - see the rule in
// docs/TIMELINE.md section 4. It still marks a real point in the day (it
// has a `time`), so it is kept as a zero-width interval rather than
// dropped: it contributes nothing to the occupied total, but it still sits
// on the timeline and can still separate two gaps that would otherwise
// have merged into one on either side of it.
function anchorInterval(task: Task): Interval {
  const start = timeToMinutes(task.time!)
  return { start, end: start + (task.minutes ?? 0) }
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

/** One free stretch of time between two anchor blocks. */
export interface Gap {
  start: number
  end: number
  minutes: number
}

/**
 * The result of comparing a day's anchors against its floats. Anchors and
 * free time are `null`, not zero, when there are no anchors at all - see
 * the window decision in docs/TIMELINE.md section 8. Zero is a real
 * answer ("no free time"); null means there is no window to measure in
 * the first place, and the two must never be confused.
 */
export interface Capacity {
  anchorsMinutes: number | null
  gaps: Gap[]
  freeMinutes: number | null
  floatsMinutes: number
  unsizedFloatCount: number
  /**
   * How far the floats exceed the free time, or 0 when they fit. `null`
   * only when there is no window to compare against at all (no anchors).
   */
  overMinutes: number | null
}

/**
 * Computes a day's capacity from its raw task list. Pure and synchronous,
 * no notion of "today" or the clock - the caller decides which day's
 * tasks to pass in.
 *
 * The window this measures against is the span from the earliest anchor's
 * start to the latest anchor's end, and nothing else - not a fixed waking
 * window, not a per-day-type setting. See docs/TIMELINE.md section 8 for
 * why: any other choice is either an invented constant that is wrong for
 * some real day (a fixed 07:00-23:00 is wrong for a night shift), or a
 * setting the owner would have to configure, which section 9 rules out.
 * A window derived purely from the day's own anchors needs no
 * configuration and degrades correctly on its own: one anchor produces a
 * window equal to its own span (zero free time, zero gaps, no special
 * case needed), and zero anchors produce no window at all, which is
 * reported as `null` rather than guessed at.
 */
export function computeCapacity(tasks: Task[]): Capacity {
  const anchors = tasks.filter(isAnchor)
  const floats = tasks.filter(t => !isAnchor(t))

  const floatsMinutes = floats.reduce((sum, t) => sum + (t.minutes ?? 0), 0)
  const unsizedFloatCount = floats.filter(t => t.minutes === undefined).length

  if (anchors.length === 0) {
    return { anchorsMinutes: null, gaps: [], freeMinutes: null, floatsMinutes, unsizedFloatCount, overMinutes: null }
  }

  const merged = mergeIntervals(anchors.map(anchorInterval))
  const anchorsMinutes = merged.reduce((sum, block) => sum + (block.end - block.start), 0)

  const gaps: Gap[] = []
  for (let i = 1; i < merged.length; i++) {
    const start = merged[i - 1].end
    const end = merged[i].start
    if (end > start) gaps.push({ start, end, minutes: end - start })
  }
  const freeMinutes = gaps.reduce((sum, gap) => sum + gap.minutes, 0)
  const overMinutes = Math.max(0, floatsMinutes - freeMinutes)

  return { anchorsMinutes, gaps, freeMinutes, floatsMinutes, unsizedFloatCount, overMinutes }
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
 */
export function formatCapacityLine(capacity: Capacity): string | null {
  const sentences: string[] = []

  if (capacity.anchorsMinutes !== null) {
    sentences.push(`Anchors take ${formatDuration(capacity.anchorsMinutes)}.`)
    if (capacity.gaps.length > 0) {
      const gapWord = capacity.gaps.length === 1 ? 'gap' : 'gaps'
      sentences.push(`Free: ${formatDuration(capacity.freeMinutes!)} across ${capacity.gaps.length} ${gapWord}.`)
    } else {
      sentences.push('No free time between anchors.')
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
 * Picks the one float "trim" would move to tomorrow: the largest sized,
 * undone float that has not already reached the push bound. Largest,
 * because a single tap should close as much of the overage as it can.
 * Anchors are never eligible - trim only ever moves a float, never a
 * fixed commitment. Returns undefined when nothing is eligible, so the
 * caller knows to hide the trim action rather than offer one that would
 * either do nothing or silently exceed the push bound.
 */
export function trimCandidate(tasks: Task[]): Task | undefined {
  const eligible = tasks.filter(
    t => !isAnchor(t) && !t.done && t.minutes !== undefined && (t.pushCount ?? 0) < MAX_PUSHES,
  )
  return eligible.reduce<Task | undefined>((largest, t) => {
    if (!largest) return t
    return (t.minutes ?? 0) > (largest.minutes ?? 0) ? t : largest
  }, undefined)
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
