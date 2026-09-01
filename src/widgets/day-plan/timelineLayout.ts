import type { Task } from '../../lib/types'
import { clipToWindow, gapsInWindow, isAnchor, mergeIntervals, timeToMinutes, type Interval } from './capacity'

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
 * Pixel positions for every clock-minutes value in the window, guaranteeing
 * that an anchor cluster or a gap never draws shorter than its own touch-
 * target floor - and, critically, that nothing after a floored segment can
 * ever be positioned underneath it.
 *
 * The grid used to be laid out purely proportionally (a straight percent-
 * of-window-minutes conversion), with a pixel floor applied afterward only
 * as a CSS `min-height` on the rendered box. That floor could grow a box
 * past where its own proportional bottom edge sat, but nothing told the
 * *next* element to move - so a real gap shorter than about 38 minutes
 * (44px / 1.15px-per-minute) drew its floored box straight over the anchor
 * card that followed it. Short buffers under 38 minutes are common in a
 * real shift schedule, so this was not a rare edge case.
 *
 * The fix is a piecewise-linear map instead of a straight proportional one:
 * clock time is split into the same segments the grid actually draws -
 * an anchor cluster (touching or overlapping anchors, packed into columns
 * but sharing one vertical extent), the real gap between one cluster and
 * the next, and the one-hour buffer on each end - and every segment is
 * given at least its own pixel floor before segments are stacked in order.
 * A segment that already earns more than its floor from real proportional
 * time is left alone; one that does not is stretched to the floor, and the
 * stretch pushes every later segment down by exactly the same amount. The
 * result reads as an honest hour grid everywhere nothing is too short to
 * draw, and as a grid that made deliberate room everywhere something was.
 *
 * `gapFloorPx` is passed in rather than hardcoded because a day with any
 * unsized anchor never draws a gap object at all (its real end is unknown,
 * so no gap around it can be trusted - see `computeTimelineLayout`'s own
 * comment) - the caller passes 0 for that case so a floor is never
 * reserved for a button that will never exist.
 */
export function computeVerticalLayout(
  window: Interval,
  anchors: TimelineAnchorBlock[],
  opts: {
    /** How many pixels one minute of window time earns before any floor is applied. */
    pxPerMinute: number
    /** Floor for a cluster containing only sized anchors. */
    sizedAnchorFloorPx: number
    /** Floor for a cluster containing at least one unsized anchor. */
    unsizedAnchorFloorPx: number
    /** Floor for the real, interior gap between two clusters. 0 when the day draws no gaps at all. */
    gapFloorPx: number
  },
): { totalHeightPx: number; topPx: (minutes: number) => number } {
  const clusters = buildAnchorClusters(anchors, opts.sizedAnchorFloorPx, opts.unsizedAnchorFloorPx)

  const segments: Array<{ start: number; end: number; floorPx: number }> = []
  if (clusters.length === 0) {
    segments.push({ start: window.start, end: window.end, floorPx: 0 })
  } else {
    segments.push({ start: window.start, end: clusters[0].start, floorPx: 0 })
    segments.push(clusters[0])
    for (let i = 1; i < clusters.length; i++) {
      segments.push({ start: clusters[i - 1].end, end: clusters[i].start, floorPx: opts.gapFloorPx })
      segments.push(clusters[i])
    }
    segments.push({ start: clusters[clusters.length - 1].end, end: window.end, floorPx: 0 })
  }

  const breakpoints: Array<{ real: number; px: number }> = [{ real: segments[0].start, px: 0 }]
  let px = 0
  for (const seg of segments) {
    const rawPx = Math.max(0, seg.end - seg.start) * opts.pxPerMinute
    px += Math.max(rawPx, seg.floorPx)
    breakpoints.push({ real: seg.end, px })
  }

  function topPx(minutes: number): number {
    if (minutes <= breakpoints[0].real) return breakpoints[0].px
    for (let i = 1; i < breakpoints.length; i++) {
      const prev = breakpoints[i - 1]
      const cur = breakpoints[i]
      if (minutes <= cur.real) {
        const span = cur.real - prev.real
        if (span <= 0) return prev.px
        return prev.px + ((minutes - prev.real) / span) * (cur.px - prev.px)
      }
    }
    return breakpoints[breakpoints.length - 1].px
  }

  return { totalHeightPx: px, topPx }
}

// Anchors that touch or overlap in their drawn interval (see
// `drawnInterval`) share one vertical extent on the grid regardless of how
// many side-by-side columns they end up packed into - a cluster's own
// floor is the largest floor any of its members need, so a short anchor
// sharing a cluster with a longer one never has to fend for itself.
function buildAnchorClusters(
  anchors: TimelineAnchorBlock[],
  sizedFloorPx: number,
  unsizedFloorPx: number,
): Array<{ start: number; end: number; floorPx: number }> {
  const clusters: Array<{ start: number; end: number; floorPx: number }> = []
  for (const block of anchors) {
    const interval = drawnInterval(block)
    const floorPx = block.sized ? sizedFloorPx : unsizedFloorPx
    const last = clusters[clusters.length - 1]
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end)
      last.floorPx = Math.max(last.floorPx, floorPx)
    } else {
      clusters.push({ start: interval.start, end: interval.end, floorPx })
    }
  }
  return clusters
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
 * Every half-hour mark within the window, excluding the whole hours
 * `hourMarks` already covers - a lighter, unlabelled rule at each one, per
 * docs/RESEARCH-TIMELINE-UI.md section 5 point 4. Position within the day
 * carries the information; a half-hour never gets its own text, only the
 * hour does, so this stays a plain list of minute offsets for the caller to
 * draw a rule at, not a labelled mark like `hourMarks`.
 */
export function halfHourMarks(window: Interval): number[] {
  const marks: number[] = []
  for (let m = Math.ceil(window.start / 30) * 30; m <= window.end; m += 30) {
    if (m % 60 !== 0) marks.push(m)
  }
  return marks
}

/**
 * The current wall-clock time as minutes since midnight, for the
 * current-time indicator - see docs/RESEARCH-TIMELINE-UI.md section 5
 * point 7. Takes an explicit `Date` (defaulting to `new Date()`) so the
 * caller's interval-driven re-render is the only place real time enters,
 * and so this stays trivially testable with a fixed clock the same way
 * every other pure function in this module already is.
 */
export function currentMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes()
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
// `mergeIntervals` and `clipToWindow` from capacity.ts rather than a second
// merging rule, and `gapsInWindow` for the walk-and-report step itself
// rather than a second copy of that loop - `gapsInWindow` also reports the
// gap before the first block and after the last, which `computeCapacity`
// wants and this grid does not, so whichever of the two gaps it returns
// touches either edge of the window exactly is dropped here rather than
// drawn. An edge gap always has `start === window.start` or
// `end === window.end` by construction (`gapsInWindow` measures both from
// the window's own bounds); no interior gap - which only ever spans between
// two real anchors - can ever coincide with either.
function computeInteriorGaps(anchors: Task[], window: Interval): TimelineGap[] {
  const rawIntervals = anchors.map(a => {
    const start = timeToMinutes(a.time!)
    return { start, end: start + a.minutes! }
  })
  const clipped = rawIntervals
    .map(interval => clipToWindow(interval, window))
    .filter((interval): interval is Interval => interval !== null)
  const merged = mergeIntervals(clipped)

  return gapsInWindow(merged, window)
    .filter(g => g.start > window.start && g.end < window.end)
    .map(g => ({ startMinutes: g.start, endMinutes: g.end, minutes: g.minutes }))
}
