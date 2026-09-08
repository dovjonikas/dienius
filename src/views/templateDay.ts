import type { Interval } from '../widgets/day-plan/capacity'
import { mergeIntervals, timeToMinutes } from '../widgets/day-plan/capacity'
import { formatClock } from '../widgets/day-plan/timelineLayout'
import { UNSIZED_ASSUMED_MINUTES } from '../widgets/day-plan/replan'
import type { Task, TemplateBlock } from '../lib/types'

/**
 * A template read as a day rather than as a list.
 *
 * The owner's words, building one: you want to see not only the items but
 * the timeline, how each falls, with the sleep you have chosen. A list
 * cannot show the thing that matters when you are deciding what a day is
 * for - how much day there actually is, and whether what you have put in it
 * fits.
 *
 * So the editor draws the same picture the day view draws, from the same
 * component, and this module is only the arithmetic between the two: a
 * block turned into the task shape the grid already knows, what clashes,
 * and the one line under it.
 *
 * The timeline is a picture and nothing else in v2.5 - blocks are not
 * dragged in it. That is in STATE's "Asked for, not yet built".
 */

/**
 * A block on its way to being drawn.
 *
 * The editor's own draft blocks have no id until they are saved - see
 * `DraftBlock` in TemplatesView - and the picture has to draw a block the
 * moment it is typed, not the moment it is kept. So the position stands in
 * for a missing id, which is stable for as long as the list is not
 * reordered and is only ever used to key a rectangle and to name a clash.
 */
export type DrawableBlock = Omit<TemplateBlock, 'id'> & { id?: string }

const idOf = (block: DrawableBlock, index: number) => block.id ?? `draft-${index}`

/**
 * The blocks as tasks, for a grid that has never heard of a template.
 *
 * `done: false` because a template block is a plan and nothing on a plan
 * has happened yet, and the ids are the blocks' own, so a clash the
 * overlap line names is the same id the list shows.
 */
export function blocksAsTasks(blocks: DrawableBlock[], weekday?: number): Task[] {
  return blocks
    .filter(b => weekday === undefined || b.weekday === weekday)
    .map((b, i) => {
      const task: Task = { id: idOf(b, i), title: b.title, done: false }
      if (b.time !== undefined) task.time = b.time
      if (b.minutes !== undefined) task.minutes = b.minutes
      if (b.category !== undefined) task.category = b.category
      if (b.core) task.core = true
      // So the picture marks a key block the way the day marks a key task:
      // the same mark, drawn by the same code, rather than a second one that
      // would then have to be kept looking like the first.
      if (b.highlight) task.highlight = true
      return task
    })
}

export interface TemplateOverlap {
  /** The stretch they share. */
  from: string
  to: string
  /** Every block on it, in the order they were written. */
  ids: string[]
}

/** A timed block's stretch. An unsized one is read as the half hour everything unsized is. */
function spanOf(block: DrawableBlock): Interval | null {
  if (block.time === undefined) return null
  const start = timeToMinutes(block.time)
  return { start, end: start + (block.minutes ?? UNSIZED_ASSUMED_MINUTES) }
}

/**
 * Where two or more blocks sit on the same minutes.
 *
 * Named rather than prevented: somebody may mean it - a commute that
 * overlaps the start of a shift is a real Tuesday - so this reports and the
 * editor shows, and Save is never blocked. Blocks that merely touch are not
 * an overlap: the end of one is the start of the next is how a day is
 * written.
 */
export function overlapsIn(blocks: DrawableBlock[]): TemplateOverlap[] {
  const timed = blocks
    .map((b, i) => ({ id: idOf(b, i), span: spanOf(b) }))
    .filter((x): x is { id: string; span: Interval } => x.span !== null)
  const edges = [...new Set(timed.flatMap(x => [x.span.start, x.span.end]))].sort((a, b) => a - b)

  const out: TemplateOverlap[] = []
  for (let i = 0; i < edges.length - 1; i += 1) {
    const from = edges[i]
    const to = edges[i + 1]
    const on = timed.filter(x => x.span.start <= from && x.span.end >= to)
    if (on.length < 2) continue
    const ids = on.map(x => x.id)
    // One clash rather than a slice per edge: two blocks that overlap in
    // three places because a third crosses them is still one thing to say.
    const last = out[out.length - 1]
    if (last && last.to === formatClock(from) && last.ids.some(id => ids.includes(id))) {
      last.to = formatClock(to)
      for (const id of ids) if (!last.ids.includes(id)) last.ids.push(id)
      continue
    }
    out.push({ from: formatClock(from), to: formatClock(to), ids })
  }
  return out
}

export interface TemplateSummary {
  /** Minutes the timed blocks cover, counted once however much they overlap. */
  timedMinutes: number
  /** What is left of the waking day. */
  freeMinutes: number
  sleepMinutes: number
  /**
   * How many of the day's three that matter this template already names.
   *
   * It counted `core` until v2.12, and said "key" while doing it - which was
   * the word for a different thing the whole time. Core is what scores on a
   * day type that does not score everything; KEY is the three that matter,
   * which every kind of day has. There was no `TemplateBlock.highlight` to
   * count back then. There is now, so the word and the number agree.
   */
  keyCount: number
}

/**
 * The one line under the timeline. Live, because the number that matters is
 * the one that changes as a block is added: this is where somebody sees a
 * day is overloaded before they have stamped it onto a month of Tuesdays.
 *
 * Overlapping blocks are counted once. A day cannot hold more hours than it
 * has, and a summary that said so would be the arithmetic disagreeing with
 * the picture above it.
 */
export function templateSummary(blocks: DrawableBlock[], window: Interval): TemplateSummary {
  const spans = blocks.map(spanOf).filter((s): s is Interval => s !== null)
  const clipped = spans
    .map(s => ({ start: Math.max(s.start, window.start), end: Math.min(s.end, window.end) }))
    .filter(s => s.end > s.start)
  const timedMinutes = mergeIntervals(clipped).reduce((sum, s) => sum + (s.end - s.start), 0)
  const waking = window.end - window.start
  return {
    timedMinutes,
    freeMinutes: waking - timedMinutes,
    sleepMinutes: 24 * 60 - waking,
    keyCount: blocks.filter(b => b.highlight).length,
  }
}
