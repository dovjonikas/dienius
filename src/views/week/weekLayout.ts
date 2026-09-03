import type { DayPlan, Task } from '../../lib/types'
import {
  isAnchor,
  timeToMinutes,
  windowFor,
  type Interval,
  type SleepSettings,
} from '../../widgets/day-plan/capacity'

/**
 * Seven days as seven columns, measured in percentages.
 *
 * The day view's own timeline computes pixels, because it has a height to fill
 * and a density to fit into it. A week does not: seven columns share one axis
 * and one height, and the only question about any block is where it sits
 * between waking and sleeping. Percentages answer that without measuring
 * anything, which is what makes the week fit on any screen without a scrollbar
 * or a resize observer - the grid takes the height it is given and the blocks
 * are a fraction of it.
 *
 * Everything here is pure. The view draws what it returns and owns no
 * arithmetic of its own.
 */

/** The shortest a block is drawn, as a fraction of the window. */
const MIN_HEIGHT_PERCENT = 1.6

/** What an untimed task is assumed to take when nothing says otherwise. */
export const DEFAULT_BLOCK_MINUTES = 30

export interface WeekBlock {
  task: Task
  date: string
  startMinutes: number
  endMinutes: number
  topPercent: number
  heightPercent: number
  /** Which of `lanes` side-by-side slots this block sits in. */
  lane: number
  /** How many slots this block's cluster of overlaps needs. */
  lanes: number
}

export interface WeekDayLayout {
  date: string
  blocks: WeekBlock[]
  /** Tasks with no time. They are counted in the footer, never drawn on the grid. */
  untimed: Task[]
  /** The day's own waking window, which may be narrower than the shared axis. */
  window: Interval
  /** Where this day's own waking window sits on the shared axis, for shading. */
  wakeTopPercent: number
  wakeHeightPercent: number
}

export interface WeekLayout {
  days: WeekDayLayout[]
  /** One axis for all seven columns - see `sharedWindow`. */
  window: Interval
  /** Whole hours inside the window, for the axis labels and the gridlines. */
  hours: number[]
}

/**
 * The axis every column is drawn against.
 *
 * The union of the seven days' waking windows, not each day's own. Seven
 * columns at seven different scales would make a block on Tuesday a different
 * size from the identical block on Wednesday, and comparing the days is the
 * entire reason to look at a week. A day whose own window is narrower than the
 * union gets its waking hours shaded instead - see `wakeTopPercent`.
 *
 * Anything scheduled outside every waking window still has to be visible, so
 * the axis stretches to cover it. A 05:00 flight is exactly the sort of thing
 * somebody opens a week view to look at.
 */
export function sharedWindow(days: DayPlan[] | undefined[], dates: string[], sleep: SleepSettings, templateProfile?: (date: string) => string | undefined): Interval {
  let start = Infinity
  let end = -Infinity
  dates.forEach((date, i) => {
    const day = days[i]
    const w = windowFor(day?.sleepProfileId ?? templateProfile?.(date), sleep)
    start = Math.min(start, w.start)
    end = Math.max(end, w.end)
    for (const task of day?.tasks ?? []) {
      if (!isAnchor(task)) continue
      const from = timeToMinutes(task.time!)
      start = Math.min(start, from)
      end = Math.max(end, from + (task.minutes ?? DEFAULT_BLOCK_MINUTES))
    }
  })
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { start: 7 * 60, end: 23 * 60 }
  }
  // Rounded out to whole hours so the axis labels land on the edges rather
  // than at 07:23, which is where the earliest task happens to start.
  return { start: Math.floor(start / 60) * 60, end: Math.min(24 * 60, Math.ceil(end / 60) * 60) }
}

export function computeWeekLayout(
  dates: string[],
  days: Record<string, DayPlan>,
  sleep: SleepSettings,
  templateProfile?: (date: string) => string | undefined,
): WeekLayout {
  const plans = dates.map(d => days[d])
  const window = sharedWindow(plans, dates, sleep, templateProfile)
  const span = window.end - window.start

  return {
    window,
    hours: hoursIn(window),
    days: dates.map((date, i) => {
      const plan = plans[i]
      const tasks = plan?.tasks ?? []
      const anchors = tasks.filter(isAnchor)
      const untimed = tasks.filter(t => !isAnchor(t))
      const own = windowFor(plan?.sleepProfileId ?? templateProfile?.(date), sleep)

      const placed = anchors
        .map(task => {
          const startMinutes = timeToMinutes(task.time!)
          const endMinutes = startMinutes + (task.minutes ?? DEFAULT_BLOCK_MINUTES)
          return { task, date, startMinutes, endMinutes }
        })
        .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)

      const laned = assignLanes(placed)

      return {
        date,
        untimed,
        window: own,
        wakeTopPercent: clamp(((own.start - window.start) / span) * 100),
        wakeHeightPercent: clamp(((own.end - own.start) / span) * 100),
        blocks: laned.map(b => ({
          ...b,
          topPercent: clamp(((b.startMinutes - window.start) / span) * 100),
          heightPercent: Math.max(MIN_HEIGHT_PERCENT, clamp(((b.endMinutes - b.startMinutes) / span) * 100)),
        })),
      }
    }),
  }
}

function clamp(percent: number): number {
  return Math.max(0, Math.min(100, percent))
}

function hoursIn(window: Interval): number[] {
  const out: number[] = []
  for (let m = Math.ceil(window.start / 60) * 60; m <= window.end; m += 60) out.push(m)
  return out
}

interface Placed {
  task: Task
  date: string
  startMinutes: number
  endMinutes: number
}

/**
 * Side-by-side slots for blocks that overlap in time.
 *
 * A cluster is a run of blocks connected by overlap, and every block in one
 * gets the same width, so the columns inside it line up instead of reading as
 * ragged widths. The width comes from how many blocks actually collide at
 * once, not from how many are in the run: a slot freed by a block that has
 * ended is taken back rather than left empty, which is the difference between
 * a day drawn in halves and the same day drawn in permanently-one-third-empty
 * thirds.
 *
 * A week column is about forty pixels wide on a phone, so past two or three
 * deep the blocks simply get thin - which is itself the honest signal that
 * the day is over-booked.
 */
function assignLanes(placed: Placed[]): (Placed & { lane: number; lanes: number })[] {
  const out: (Placed & { lane: number; lanes: number })[] = []
  let cluster: (Placed & { lane: number })[] = []
  let clusterEnd = -Infinity

  const flush = () => {
    if (cluster.length === 0) return
    const lanes = Math.max(...cluster.map(b => b.lane)) + 1
    out.push(...cluster.map(b => ({ ...b, lanes })))
    cluster = []
    clusterEnd = -Infinity
  }

  for (const block of placed) {
    if (block.startMinutes >= clusterEnd) flush()
    // The lowest slot free at this block's start.
    const taken = new Set(cluster.filter(b => b.endMinutes > block.startMinutes).map(b => b.lane))
    let lane = 0
    while (taken.has(lane)) lane++
    cluster.push({ ...block, lane })
    clusterEnd = Math.max(clusterEnd, block.endMinutes)
  }
  flush()
  return out
}

/**
 * Where a click in a column lands, snapped to the half hour.
 *
 * Half an hour rather than the five minutes the day timeline snaps to: at a
 * week's scale a pixel is roughly two minutes, so a five-minute snap would
 * mean the time you get depends on where inside a single pixel you happened to
 * click. Half past is a time somebody means; 14:23 is a time they missed.
 */
export function timeAtPercent(percent: number, window: Interval, step = 30): string {
  // A track with no measurable height - laid out but not yet painted, or a
  // hidden tab - divides by zero on the way in. The top of the window is the
  // honest answer to "where in a column of no height", and it is certainly a
  // better task than one scheduled at NaN:NaN.
  if (!Number.isFinite(percent)) percent = 0
  const raw = window.start + (percent / 100) * (window.end - window.start)
  const snapped = Math.round(raw / step) * step
  const clamped = Math.max(window.start, Math.min(window.end - step, snapped))
  const h = Math.floor(clamped / 60) % 24
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
