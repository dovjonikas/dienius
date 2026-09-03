import type { AppData, DayPlan, Task } from '../../lib/types'
import type { CategoryId } from '../../lib/categories'
import { addDays } from '../../lib/dates'
import { dayHas, isRoutine } from '../../lib/taskIdentity'
import { clipToWindow, gapsInWindow, isAnchor, mergeIntervals, timeToMinutes, type Gap, type Interval } from './capacity'
import { formatClock } from './timelineLayout'

/**
 * Replan: what to do with the rest of the day when the plan just broke.
 *
 * A call comes in, something needs doing tomorrow morning, the afternoon
 * goes. Moving eight blocks by hand costs more than the day is now worth,
 * and the brain's answer to that arithmetic is "the whole day is gone" -
 * the what-the-hell effect, where one broken piece writes off the rest.
 * Everything here exists so that the honest answer - most of it still
 * fits, here is where - costs ten seconds and one press.
 *
 * Three questions, three pure functions, one plan shape:
 *
 * - **Something came up** (`planInterrupt`): a new block lands at a time.
 *   Which tasks it collides with, and for each: into the next gap, to
 *   tomorrow, or gone.
 * - **Shift the rest** (`planShift`): everything from now moves later by
 *   the same amount. What no longer fits before sleep is named, not lost.
 * - **I'm back** (`planRescue`): after a stretch away, what is still
 *   winnable in the time left. Key tasks first; what fits, fits; the rest
 *   goes to tomorrow.
 *
 * `applyPlan` is the one writer, and it is idempotent: a plan applied twice
 * changes nothing the second time, because sync can deliver the same
 * intention from two devices. A moved task is already at its time, a task
 * already on tomorrow is skipped through the same identity check every
 * other move uses, and the interruption is not added again if a task with
 * its title already sits at its time.
 *
 * Tone, which is part of the contract: a summary says what still fits and
 * what moves. It never counts what was missed. See CONVENTIONS.md.
 */

/** A task with no size is fitted as if it were this long. The task itself stays unsized. */
export const UNSIZED_ASSUMED_MINUTES = 30

export interface Interruption {
  title: string
  /** Minutes from midnight. */
  start: number
  /** Absent means "I do not know how long" - it takes the rest of the day until told otherwise. */
  minutes?: number
  category?: CategoryId
}

export type ConflictChoice = 'squeeze' | 'tomorrow' | 'drop' | 'keep'

export interface ReplanPlan {
  kind: 'interrupt' | 'shift' | 'rescue'
  /** The interruption, as the task it becomes. */
  add?: { title: string; time: string; minutes?: number; category?: CategoryId }
  /** Tasks that stay on the day at a new time. */
  moves: { taskId: string; time: string }[]
  /** Tasks that go to the next day, at the time they had. */
  tomorrow: string[]
  /** Tasks that go. */
  drop: string[]
  /** Tasks the plan looked at and left alone. */
  keep: string[]
  /** One or two sentences: what still fits, what moves. Never what was missed. */
  summary: string
}

function startOf(task: Task): number {
  return timeToMinutes(task.time!)
}

function endOf(task: Task): number {
  return startOf(task) + (task.minutes ?? UNSIZED_ASSUMED_MINUTES)
}

function titleList(tasks: Task[]): string {
  return tasks.map(t => t.title).join(', ')
}

/**
 * The tasks an interruption collides with: anchored, not done, and
 * overlapping it. With no known length the interruption reaches to the end
 * of the day, so everything that starts after it, or is in progress at it,
 * collides.
 */
export function findConflicts(tasks: Task[], interruption: Interruption): Task[] {
  const end = interruption.minutes === undefined ? Number.POSITIVE_INFINITY : interruption.start + interruption.minutes
  return tasks
    .filter(t => !t.done && isAnchor(t))
    .filter(t => startOf(t) < end && endOf(t) > interruption.start)
    .sort((a, b) => startOf(a) - startOf(b))
}

/** Key tasks first, then core, then the order they were in. */
function byPriority(tasks: Task[]): Task[] {
  const rank = (t: Task) => (t.highlight ? 0 : t.core ? 1 : 2)
  return tasks
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i)
    .map(x => x.t)
}

/** Free stretches after `from`, around the blocks that stay where they are. */
function freeGapsAfter(fixed: Interval[], window: Interval, from: number): Gap[] {
  const blocks = mergeIntervals(
    fixed.map(b => clipToWindow(b, window)).filter((b): b is Interval => b !== null),
  )
  return gapsInWindow(blocks, window)
    .map(g => ({ start: Math.max(g.start, from), end: g.end, minutes: 0 }))
    .filter(g => g.end > g.start)
    .map(g => ({ ...g, minutes: g.end - g.start }))
}

/**
 * Places tasks one after another into the gaps, first gap that fits, in
 * the order given. Returns what landed and what did not. The gaps are
 * consumed as it goes, so two tasks never share one.
 */
function pack(tasks: Task[], gaps: Gap[]): { placed: { taskId: string; time: string }[]; left: Task[] } {
  const free = gaps.map(g => ({ ...g }))
  const placed: { taskId: string; time: string }[] = []
  const left: Task[] = []
  for (const task of tasks) {
    const need = task.minutes ?? UNSIZED_ASSUMED_MINUTES
    const gap = free.find(g => g.end - g.start >= need)
    if (!gap) {
      left.push(task)
      continue
    }
    placed.push({ taskId: task.id, time: formatClock(gap.start) })
    gap.start += need
  }
  return { placed, left }
}

/**
 * Something came up.
 *
 * `choices` says what to do with each colliding task; a task with no choice
 * is squeezed. Squeezing means the next gap after the interruption that
 * holds it, key tasks first - and a task that fits nowhere today is put on
 * tomorrow and named in the summary, never silently kept at a time it can
 * no longer have.
 */
export function planInterrupt(
  tasks: Task[],
  interruption: Interruption,
  choices: Record<string, ConflictChoice>,
  window: Interval,
  busy: Interval[] = [],
): ReplanPlan {
  const conflicts = findConflicts(tasks, interruption)
  const choiceOf = (t: Task): ConflictChoice => choices[t.id] ?? 'squeeze'
  const squeeze = byPriority(conflicts.filter(t => choiceOf(t) === 'squeeze'))
  const tomorrow = conflicts.filter(t => choiceOf(t) === 'tomorrow')
  const drop = conflicts.filter(t => choiceOf(t) === 'drop')
  const keep = conflicts.filter(t => choiceOf(t) === 'keep')
  const moving = new Set(squeeze.map(t => t.id))
  const gone = new Set([...tomorrow, ...drop].map(t => t.id))

  const end = interruption.minutes === undefined ? window.end : interruption.start + interruption.minutes
  const fixed: Interval[] = tasks
    .filter(t => !t.done && isAnchor(t) && !moving.has(t.id) && !gone.has(t.id))
    .map(t => ({ start: startOf(t), end: endOf(t) }))
  fixed.push({ start: interruption.start, end }, ...busy)

  const { placed, left } = pack(squeeze, freeGapsAfter(fixed, window, end))

  const parts: string[] = []
  if (placed.length > 0) {
    const named = placed.map(p => `${squeeze.find(t => t.id === p.taskId)?.title} at ${p.time}`)
    parts.push(`Into the gaps: ${named.join(', ')}.`)
  }
  const toTomorrow = [...tomorrow, ...left]
  if (left.length > 0) parts.push(`No room left today for ${titleList(left)} - tomorrow.`)
  else if (tomorrow.length > 0) parts.push(`Tomorrow: ${titleList(tomorrow)}.`)
  if (drop.length > 0) parts.push(`Dropped: ${titleList(drop)}.`)
  if (conflicts.length === 0) parts.push('Nothing in the way. It goes straight in.')

  return {
    kind: 'interrupt',
    add: {
      title: interruption.title.trim(),
      time: formatClock(interruption.start),
      minutes: interruption.minutes,
      category: interruption.category,
    },
    moves: placed,
    tomorrow: toTomorrow.map(t => t.id),
    drop: drop.map(t => t.id),
    keep: keep.map(t => t.id),
    summary: parts.join(' '),
  }
}

/**
 * Shift the rest.
 *
 * Everything anchored from now on moves later by `delta` minutes; whatever
 * would then end after the waking window goes to tomorrow, and is named.
 * A task already in progress stays where it is - it started, and moving
 * its start into the future would be a lie about the present.
 */
export function planShift(tasks: Task[], nowMinutes: number, delta: number, window: Interval): ReplanPlan {
  const rest = tasks.filter(t => !t.done && isAnchor(t) && startOf(t) >= nowMinutes).sort((a, b) => startOf(a) - startOf(b))
  const moves: { taskId: string; time: string }[] = []
  const spill: Task[] = []
  for (const task of rest) {
    const start = startOf(task) + delta
    const end = start + (task.minutes ?? 0)
    if (end > window.end || start >= window.end) spill.push(task)
    else moves.push({ taskId: task.id, time: formatClock(start) })
  }
  const parts: string[] = []
  if (rest.length === 0) parts.push('Nothing left to move today.')
  else parts.push(`${moves.length === rest.length ? 'Everything' : `${moves.length} of ${rest.length}`} from ${formatClock(nowMinutes)} moves ${describeDelta(delta)}.`)
  if (spill.length > 0) parts.push(`Past ${formatClock(window.end)} by then: ${titleList(spill)} - tomorrow.`)
  return {
    kind: 'shift',
    moves,
    tomorrow: spill.map(t => t.id),
    drop: [],
    keep: [],
    summary: parts.join(' '),
  }
}

export function describeDelta(delta: number): string {
  const h = Math.floor(delta / 60)
  const m = delta % 60
  const parts = [h > 0 ? `${h}h` : '', m > 0 ? `${m} min` : ''].filter(Boolean).join(' ')
  return `${parts} later`
}

/**
 * I'm back.
 *
 * Everything not done whose time has passed, plus every untimed task, is
 * fitted into the time left - key tasks first, then core, then the order
 * they were in - around the anchors that are still to come, which keep
 * their slots. What fits is placed; what does not goes to tomorrow. The
 * summary leads with what is still winnable among the key tasks, because
 * that is the question the person came back asking.
 *
 * **A routine task whose time has passed is left exactly where it is.** This
 * used to fit a missed Standup into the evening because the evening was
 * free, which was honest arithmetic and a silly plan: nobody does a standup
 * at eight at night, and the whole point of the rescue is producing a plan
 * somebody believes. What makes a task routine is `isRoutine` - it came from
 * a template or a repeat, which means it has a slot in the shape of the day
 * rather than a job that needs doing at some point - and it is the same
 * judgment the rollover button already makes when it declines to push a
 * routine task tomorrow is getting anyway.
 *
 * Left where it is, not sent to tomorrow: tomorrow's own template will
 * produce it, and moving it there would be the same duplicate the rollover
 * refuses to make. It is named in the summary rather than silently skipped,
 * because CONVENTIONS.md section 12 says nothing disappears without being
 * mentioned - and "stays where it is" is a fact about the plan, not a count
 * of what was missed.
 */
export function planRescue(tasks: Task[], nowMinutes: number, window: Interval, busy: Interval[] = []): ReplanPlan {
  const open = tasks.filter(t => !t.done)
  const passed = open.filter(t => isAnchor(t) && startOf(t) < nowMinutes)
  const passedRoutine = passed.filter(isRoutine)
  const passedOneOffs = passed.filter(t => !isRoutine(t))
  const floats = open.filter(t => !isAnchor(t))
  const upcoming = open.filter(t => isAnchor(t) && startOf(t) >= nowMinutes)
  const candidates = byPriority([...passedOneOffs, ...floats])

  const fixed: Interval[] = upcoming.map(t => ({ start: startOf(t), end: endOf(t) }))
  fixed.push(...busy)
  const { placed, left } = pack(candidates, freeGapsAfter(fixed, window, nowMinutes))

  const keyOpen = open.filter(t => t.highlight)
  const keyWinnable = keyOpen.filter(t => upcoming.includes(t) || placed.some(p => p.taskId === t.id))
  const onToday = upcoming.length + placed.length

  const parts: string[] = []
  if (keyOpen.length > 0) parts.push(`Still winnable: ${keyWinnable.length} of ${keyOpen.length} key.`)
  if (onToday > 0) parts.push(`${onToday} on today${left.length > 0 ? `, ${left.length} to tomorrow` : ''}.`)
  else if (left.length > 0) parts.push(`No room left today - ${left.length} to tomorrow.`)
  else parts.push('Nothing left on the list. The day is yours.')
  if (passedRoutine.length > 0) {
    const word = passedRoutine.length === 1 ? 'Routine block' : 'Routine blocks'
    parts.push(`${word} left where ${passedRoutine.length === 1 ? 'it is' : 'they are'}.`)
  }

  return {
    kind: 'rescue',
    moves: placed,
    tomorrow: left.map(t => t.id),
    drop: [],
    keep: [...upcoming.map(t => t.id), ...passedRoutine.map(t => t.id)],
    summary: parts.join(' '),
  }
}

/**
 * Applies a plan to the data. Pure, and idempotent - see the module comment.
 * `makeId` is passed in because the store owns ids; a test passes a counter.
 */
export function applyPlan(data: AppData, date: string, plan: ReplanPlan, makeId: () => string): AppData {
  const day: DayPlan = data.days[date] ?? { date, tasks: [] }
  const next = addDays(date, 1)
  const target: DayPlan = data.days[next] ?? { date: next, tasks: [] }
  const dropped = new Set(plan.drop)
  const leaving = new Set(plan.tomorrow)
  const newTime = new Map(plan.moves.map(m => [m.taskId, m.time]))

  const staying: Task[] = []
  const goingTomorrow: Task[] = []
  for (const task of day.tasks) {
    if (dropped.has(task.id)) continue
    if (leaving.has(task.id)) {
      goingTomorrow.push(task)
      continue
    }
    const time = newTime.get(task.id)
    staying.push(time !== undefined && time !== task.time ? { ...task, time } : task)
  }

  if (plan.add) {
    const already = staying.some(t => t.title === plan.add!.title && t.time === plan.add!.time)
    if (!already) {
      const task: Task = { id: makeId(), title: plan.add.title, time: plan.add.time, done: false }
      if (plan.add.minutes !== undefined) task.minutes = plan.add.minutes
      if (plan.add.category) task.category = plan.add.category
      staying.push(task)
    }
  }

  // The same identity check every other move between days uses: a task
  // tomorrow already has is not added a second time.
  const arriving = goingTomorrow.filter(t => !dayHas(target, t))

  const days = { ...data.days, [date]: { ...day, tasks: staying } }
  if (goingTomorrow.length > 0) days[next] = { ...target, tasks: [...target.tasks, ...arriving] }
  return { ...data, days }
}
