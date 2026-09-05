import type { AppData, DayPlan, Task } from '../../lib/types'
import type { CategoryId } from '../../lib/categories'
import { addDays } from '../../lib/dates'
import { dayHas, isRoutine } from '../../lib/taskIdentity'
import { DEFAULT_TITLE } from './interrupt'
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

/**
 * How a summary names the day it is about and the day after it. v1 only
 * ever spoke about today, so "today" and "tomorrow" were written into the
 * sentences; a plan for Thursday made on Tuesday has to say "on Thursday"
 * and "Friday" or it is a sentence about the wrong day. `dayWordsFor` in
 * interrupt.ts produces the pair for any date.
 */
export interface DayWords {
  /** "today", "tomorrow", "on Thursday", "on 25 Sep". */
  day: string
  /** "tomorrow", "the day after", "Friday", "26 Sep". */
  next: string
}

export const TODAY_WORDS: DayWords = { day: 'today', next: 'tomorrow' }

export interface InterruptOptions {
  /**
   * The earliest minute a moved task may be put at. Absent means the end of
   * the interruption, which is v1's answer for a block that starts now: the
   * gaps after it are the only ones still ahead. For a day that has not
   * started, the waking window's start - a task the afternoon lost can go
   * into a free morning; for today from another screen, now.
   */
  from?: number
  words?: DayWords
}

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
  opts: InterruptOptions = {},
): ReplanPlan {
  const words = opts.words ?? TODAY_WORDS
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

  // The gaps after the interruption first, then the ones before it that a
  // start-from opened up. A task the afternoon lost goes into the evening
  // when the evening has room, and into the morning only when it does not:
  // "I will do it after" is the reading a person gives it, and lunch moved
  // to eight in the morning is arithmetic nobody believes.
  const gaps = freeGapsAfter(fixed, window, opts.from ?? end)
  const { placed, left } = pack(squeeze, [...gaps.filter(g => g.start >= end), ...gaps.filter(g => g.start < end)])

  const parts: string[] = []
  if (placed.length > 0) {
    const named = placed.map(p => `${squeeze.find(t => t.id === p.taskId)?.title} at ${p.time}`)
    parts.push(`Into the gaps: ${named.join(', ')}.`)
  }
  const toTomorrow = [...tomorrow, ...left]
  if (left.length > 0) parts.push(`No room left ${words.day} for ${titleList(left)} - ${words.next}.`)
  if (tomorrow.length > 0) parts.push(`${capitalise(words.next)}: ${titleList(tomorrow)}.`)
  // Two words for two facts. A routine block skipped for the day is not
  // lost - its template makes it again on the next day it belongs to - and
  // saying "dropped" about it would be reporting a loss that did not
  // happen. A one-off somebody chose to let go of is gone, and says so.
  const skipped = drop.filter(isRoutine)
  const dropped = drop.filter(t => !isRoutine(t))
  if (skipped.length > 0) parts.push(`Skipped ${words.day}: ${titleList(skipped)}.`)
  if (dropped.length > 0) parts.push(`Dropped: ${titleList(dropped)}.`)
  if (conflicts.length === 0) parts.push('Nothing in the way. It goes straight in.')

  return {
    kind: 'interrupt',
    add: {
      title: interruption.title.trim() || DEFAULT_TITLE,
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

/** "tomorrow" at the start of a sentence. */
export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
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
 * Below this a stretch of free time is not something anybody would offer
 * on the phone. "Free 15:30-15:40" is arithmetic, not an answer.
 */
export const FREE_WINDOW_MIN_MINUTES = 30

/**
 * The free stretches left on a day, for saying into a phone.
 *
 * Every open anchor is busy for its size - or the assumed half hour, the
 * same assumption the packing above makes, because a window this reports
 * has to agree with the plan it sits under. Somebody else's calendar is
 * busy too. From `from` on: now on today, the start of the waking window
 * on a day that has not started.
 */
export function freeWindows(
  tasks: Task[],
  window: Interval,
  busy: Interval[] = [],
  from: number = window.start,
  minMinutes = FREE_WINDOW_MIN_MINUTES,
): Gap[] {
  const fixed: Interval[] = tasks.filter(t => !t.done && isAnchor(t)).map(t => ({ start: startOf(t), end: endOf(t) }))
  fixed.push(...busy)
  return freeGapsAfter(fixed, window, from).filter(g => g.minutes >= minMinutes)
}

/**
 * The line that answers "when could you?": "Free tomorrow: 15:30-17:00,
 * after 19:30." A stretch that reaches bedtime is "after", because that is
 * how a person says it. A day with nothing left says so as a fact.
 */
export function formatFreeWindows(gaps: Gap[], window: Interval, words: DayWords = TODAY_WORDS): string {
  if (gaps.length === 0) return `No free time left ${words.day}.`
  const named = gaps.map(g => (g.end >= window.end ? `after ${formatClock(g.start)}` : `${formatClock(g.start)}-${formatClock(g.end)}`))
  return `Free ${words.day}: ${named.join(', ')}.`
}

export interface ApplyOptions {
  /** The date key the plan was accepted on. Written to the day - see `DayPlan.replannedOn`. */
  replannedOn?: string
}

/**
 * Applies a plan to the data. Pure, and idempotent - see the module comment.
 * `makeId` is passed in because the store owns ids; a test passes a counter.
 *
 * A dropped repeat instance also writes its series into the day's
 * `repeatSkips`, the way deleting one by hand does: a skip is a tombstone
 * rather than a silence, and the one pass that generates instances has to
 * be able to see it.
 */
/**
 * A day's tasks with the plan's moves made: what stays at its new time,
 * what leaves for the next day, and what goes. The sheet reads the free
 * windows off `staying` before anything is applied; `applyPlan` is the
 * same split committed.
 */
export function splitByPlan(tasks: Task[], plan: ReplanPlan): { staying: Task[]; leaving: Task[]; dropped: Task[] } {
  const gone = new Set(plan.drop)
  const going = new Set(plan.tomorrow)
  const newTime = new Map(plan.moves.map(m => [m.taskId, m.time]))
  const staying: Task[] = []
  const leaving: Task[] = []
  const dropped: Task[] = []
  for (const task of tasks) {
    if (gone.has(task.id)) dropped.push(task)
    else if (going.has(task.id)) leaving.push(task)
    else {
      const time = newTime.get(task.id)
      staying.push(time !== undefined && time !== task.time ? { ...task, time } : task)
    }
  }
  return { staying, leaving, dropped }
}

export function applyPlan(data: AppData, date: string, plan: ReplanPlan, makeId: () => string, opts: ApplyOptions = {}): AppData {
  const day: DayPlan = data.days[date] ?? { date, tasks: [] }
  const next = addDays(date, 1)
  const target: DayPlan = data.days[next] ?? { date: next, tasks: [] }

  const { staying, leaving: goingTomorrow, dropped } = splitByPlan(day.tasks, plan)
  const skips = new Set(day.repeatSkips ?? [])
  for (const task of dropped) if (task.repeatOf) skips.add(task.repeatOf)

  if (plan.add) {
    const already = staying.some(t => t.title === plan.add!.title && t.time === plan.add!.time)
    if (!already) {
      const task: Task = { id: makeId(), title: plan.add.title, time: plan.add.time, done: false, origin: { type: 'manual' } }
      if (plan.add.minutes !== undefined) task.minutes = plan.add.minutes
      if (plan.add.category) task.category = plan.add.category
      staying.push(task)
    }
  }

  // The same identity check every other move between days uses: a task
  // tomorrow already has is not added a second time.
  const arriving = goingTomorrow.filter(t => !dayHas(target, t))

  const replanned: DayPlan = { ...day, tasks: staying }
  if (skips.size > 0) replanned.repeatSkips = [...skips]
  if (opts.replannedOn) replanned.replannedOn = opts.replannedOn
  const days = { ...data.days, [date]: replanned }
  if (goingTomorrow.length > 0) days[next] = { ...target, tasks: [...target.tasks, ...arriving] }
  return { ...data, days }
}
