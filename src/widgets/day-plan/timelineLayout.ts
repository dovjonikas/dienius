import type { Task } from '../../lib/types'
import { clipToWindow, isAnchor, mergeIntervals, timeToMinutes, type Interval } from './capacity'

/**
 * Minutes in one calendar day - the grid never draws past this either.
 * Exported so `TimelineGrid.tsx` can format a clipped anchor's real end
 * time (which can run past midnight) without a second copy of this
 * constant drifting from the one used here.
 */
export const DAY_MINUTES = 24 * 60

/**
 * The breathing room added on each side of the anchors that actually
 * exist, per docs/TIMELINE.md section 5: "first anchor minus an hour to
 * last anchor plus an hour, not 00:00 to 23:59." This is a display
 * constant, not a capacity boundary - see the module comment below for how
 * it differs from `computeCapacity`'s fixed waking window.
 */
const DISPLAY_BUFFER_MINUTES = 60

/**
 * An anchor with no `minutes` has no honest duration to draw - see the
 * module comment. This is the fixed height it renders at instead: a UI
 * floor big enough to read a label and clear the 44px touch target
 * guideline, not a guess at how long the task actually takes. It is never
 * shown as a time range and never enters any arithmetic; it only decides
 * how many pixels the placeholder card occupies on screen, and how much
 * room an unsized anchor claims when deciding whether it collides with a
 * neighbour for column placement.
 */
const UNSIZED_ANCHOR_MINUTES = 30

/** One anchor, positioned and sized for the grid. */
export interface TimelineAnchorBlock {
  id: string
  title: string
  time: string
  /** The task's real `minutes`, undefined when unsized - never invented. */
  minutes: number | undefined
  sized: boolean
  startMinutes: number
  /**
   * Where the block is actually drawn to. For a sized anchor this is the
   * real end, unless the window's edge cut it short - see `clippedEnd`.
   * Undefined for an unsized anchor: there is no known end to draw to, so
   * `UNSIZED_ANCHOR_MINUTES` decides the drawn height directly rather than
   * pretending this is a real timestamp.
   */
  endMinutes: number | undefined
  /**
   * True when this anchor's real end (`startMinutes + minutes`) runs past
   * the window's edge - a shift starting at 23:00 that runs past midnight,
   * say. The block still draws with its real title and time range; only
   * the drawn height stops at the window edge, with a visual cut to say so.
   */
  clippedEnd: boolean
  /**
   * Symmetrical case for the window's start edge. The window is always
   * derived from the anchors themselves, so in practice no anchor's own
   * start ever precedes it - kept for the same reason `clippedEnd` exists,
   * so a future change to how the window is derived cannot silently start
   * drawing an anchor off the top of the grid with no visual cue.
   */
  clippedStart: boolean
  /** 0-based column index among anchors it overlaps in time. */
  column: number
  /** How many columns this anchor's overlap cluster was split into. */
  columns: number
}

/** A free stretch between two anchors - never at the window's own edges, see the module comment. */
export interface TimelineGap {
  startMinutes: number
  endMinutes: number
  minutes: number
}

export interface TimelineLayout {
  /** Null when there are no anchors at all - nothing anchors a window, so there is nothing to draw. */
  window: Interval | null
  anchors: TimelineAnchorBlock[]
  /** Empty whenever any anchor is unsized, or there are fewer than two sized anchors - see the module comment. */
  gaps: TimelineGap[]
  unsizedAnchorCount: number
}

/**
 * Turns a day's tasks into the grid's read-only layout: which anchors draw
 * where, and which interior stretches between them are free. Pure and
 * synchronous, the same shape as `computeCapacity` - no React, no notion
 * of "now."
 *
 * **This window is not `computeCapacity`'s window, and the two are meant
 * to disagree at the edges.** `computeCapacity` measures free time against
 * a fixed waking window (07:00-23:00, or 13:00-24:00 on a night day) - a
 * real clock boundary the capacity line's arithmetic is answerable to, so
 * "Free: 1h20 across 3 gaps" means something specific and stable. This
 * grid instead answers "what does today's shape actually look like,"
 * cropped tightly to where anchors exist: first anchor's start minus one
 * hour to last anchor's end plus one hour. A day whose first anchor is at
 * 09:00 draws a window starting at 08:00 even though the capacity window
 * opened at 07:00 - that missing hour was real free time by the capacity
 * line's own arithmetic, and this grid deliberately does not draw it,
 * because showing it would mean either inventing a fourth "gap" object
 * that dangles off the top edge with nothing on the other side of it, or
 * quietly padding the window back out toward 00:00-23:59, which is exactly
 * the wall of empty rows section 5 rules out. The one-hour buffer this
 * window keeps on each side is air for the eye, not a claim about free
 * time - it never becomes a `TimelineGap`. Only the stretches strictly
 * between two anchors do, matching section 5's own example of a gap ("a
 * 90-minute hole between the shift and the gym").
 *
 * An anchor with no `minutes` is drawn, at its real start time, but never
 * with an invented duration - see `UNSIZED_ANCHOR_MINUTES`. Because its
 * true end is unknown, it might run through what would otherwise look
 * like free time, so exactly like `computeCapacity`, an unsized anchor
 * suppresses every gap for the day rather than let one be drawn around a
 * span that anchor could actually occupy.
 */
export function computeTimelineLayout(tasks: Task[]): TimelineLayout {
  const anchors = tasks.filter(isAnchor).slice().sort((a, b) => a.time!.localeCompare(b.time!))

  if (anchors.length === 0) {
    return { window: null, anchors: [], gaps: [], unsizedAnchorCount: 0 }
  }

  const unsizedAnchorCount = anchors.filter(a => a.minutes === undefined).length

  const starts = anchors.map(a => timeToMinutes(a.time!))
  const effectiveEndsForWindow = anchors.map((a, i) =>
    a.minutes !== undefined ? starts[i] + a.minutes : starts[i],
  )
  const window: Interval = {
    start: Math.max(0, Math.min(...starts) - DISPLAY_BUFFER_MINUTES),
    end: Math.min(DAY_MINUTES, Math.max(...effectiveEndsForWindow) + DISPLAY_BUFFER_MINUTES),
  }

  const blocks: TimelineAnchorBlock[] = anchors.map((task, i) => {
    const start = starts[i]
    const sized = task.minutes !== undefined
    if (!sized) {
      return {
        id: task.id,
        title: task.title,
        time: task.time!,
        minutes: undefined,
        sized: false,
        startMinutes: start,
        endMinutes: undefined,
        clippedEnd: false,
        clippedStart: start < window.start,
        column: 0,
        columns: 1,
      }
    }
    const realEnd = start + task.minutes!
    return {
      id: task.id,
      title: task.title,
      time: task.time!,
      minutes: task.minutes,
      sized: true,
      startMinutes: start,
      endMinutes: Math.min(realEnd, window.end),
      clippedEnd: realEnd > window.end,
      clippedStart: start < window.start,
      column: 0,
      columns: 1,
    }
  })

  assignColumns(blocks)

  const gaps = unsizedAnchorCount > 0 ? [] : computeInteriorGaps(anchors, window)

  return { window, anchors: blocks, gaps, unsizedAnchorCount }
}

// The drawn interval used for both column placement and gap computation -
// an unsized anchor claims `UNSIZED_ANCHOR_MINUTES` of visual room so it
// does not silently overlap whatever is drawn next to it, without that
// room ever being reported as the anchor's actual duration.
function drawnInterval(block: TimelineAnchorBlock): Interval {
  const end = block.sized ? block.endMinutes! : block.startMinutes + UNSIZED_ANCHOR_MINUTES
  return { start: block.startMinutes, end }
}

// Standard interval-graph column packing: cluster anchors that overlap
// (transitively) into groups, then within each group assign every anchor
// the lowest column index not already claimed by something it overlaps.
// Anchors that only touch (one starts exactly when another ends) are not
// treated as overlapping here - they each get their own column - matching
// `mergeIntervals`'s own touching-merges rule being a separate, gap-only
// concern from this one.
function assignColumns(blocks: TimelineAnchorBlock[]): void {
  let clusterStart = 0
  let clusterEnd = -Infinity
  for (let i = 0; i < blocks.length; i++) {
    const interval = drawnInterval(blocks[i])
    if (interval.start >= clusterEnd) {
      packCluster(blocks, clusterStart, i)
      clusterStart = i
      clusterEnd = interval.end
    } else {
      clusterEnd = Math.max(clusterEnd, interval.end)
    }
  }
  packCluster(blocks, clusterStart, blocks.length)
}

function packCluster(blocks: TimelineAnchorBlock[], from: number, to: number): void {
  if (to <= from) return
  const columnEnds: number[] = []
  for (let i = from; i < to; i++) {
    const interval = drawnInterval(blocks[i])
    let column = columnEnds.findIndex(end => end <= interval.start)
    if (column === -1) {
      column = columnEnds.length
      columnEnds.push(interval.end)
    } else {
      columnEnds[column] = interval.end
    }
    blocks[i].column = column
  }
  const columns = columnEnds.length
  for (let i = from; i < to; i++) blocks[i].columns = columns
}

/**
 * Converts a clock-minutes value into a percentage position within the
 * window - the one piece of "time and duration into a position" maths the
 * component needs, kept here and tested rather than duplicated inline in
 * JSX. A block's height is the difference between its own start and end
 * percentages.
 */
export function windowPercent(window: Interval, minutes: number): number {
  const span = window.end - window.start
  if (span <= 0) return 0
  return ((minutes - window.start) / span) * 100
}

/** Every whole hour mark that falls within the window, for the hour gridlines. */
export function hourMarks(window: Interval): number[] {
  const marks: number[] = []
  for (let h = Math.ceil(window.start / 60) * 60; h <= window.end; h += 60) {
    marks.push(h)
  }
  return marks
}

/**
 * Renders a clock-minutes value as "HH:MM", the same plain 24-hour format
 * every anchor's own `time` already uses. `DAY_MINUTES` itself (the night
 * window's own close) renders as "24:00" rather than wrapping to "00:00" -
 * it is the end of today, not the start of tomorrow.
 */
export function formatClock(minutes: number): string {
  if (minutes >= DAY_MINUTES) return '24:00'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * The label under a sized anchor's title: its real time range, even when
 * the block itself is drawn clipped to the window's edge - see
 * `clippedEnd` on `TimelineAnchorBlock`. An anchor that runs past midnight
 * wraps its end back to the next day's clock rather than reporting an end
 * before its own start, with a plain note saying so; the anchor's real
 * length was never in question, only how much of it fits in today's view.
 */
export function formatAnchorTimeRange(startMinutes: number, minutes: number): string {
  const realEnd = startMinutes + minutes
  if (realEnd <= DAY_MINUTES) {
    return `${formatClock(startMinutes)} - ${formatClock(realEnd)}`
  }
  return `${formatClock(startMinutes)} - ${formatClock(realEnd - DAY_MINUTES)} (next day)`
}

// Only the stretches strictly between two sized anchors - never before the
// first or after the last, see the module comment above. Reuses
// `mergeIntervals` and `clipToWindow` from capacity.ts rather than a
// second merging rule.
function computeInteriorGaps(anchors: Task[], window: Interval): TimelineGap[] {
  const rawIntervals = anchors.map(a => {
    const start = timeToMinutes(a.time!)
    return { start, end: start + a.minutes! }
  })
  const clipped = rawIntervals
    .map(interval => clipToWindow(interval, window))
    .filter((interval): interval is Interval => interval !== null)
  const merged = mergeIntervals(clipped)

  const gaps: TimelineGap[] = []
  for (let i = 1; i < merged.length; i++) {
    const start = merged[i - 1].end
    const end = merged[i].start
    if (end > start) gaps.push({ startMinutes: start, endMinutes: end, minutes: end - start })
  }
  return gaps
}
