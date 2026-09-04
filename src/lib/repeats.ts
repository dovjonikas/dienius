import { todayKey } from './dates'
import type { DayPlan, Repeat, Task } from './types'

/**
 * Repeating tasks, materialised rather than derived.
 *
 * A task with `repeat` set is the source of a series. Every later day it
 * applies to gets its own real `Task`, generated the first time that day is
 * opened and stored like anything else. The alternative - computing a day's
 * repeating tasks on every render - was rejected for one reason: an instance
 * has to be a first-class task. It gets ticked off, dragged onto the
 * timeline, given a note, pushed to tomorrow, half-finished. A derived view
 * has nowhere to put any of that, and would need a parallel store of
 * per-instance state which is just a task with extra steps.
 *
 * The cost of materialising is that generation must be idempotent and must
 * respect deletion, which is what `repeatSkips` on the day is for: without
 * a tombstone, a Tuesday instance deleted on Tuesday would come straight back
 * on Wednesday's visit.
 *
 * Everything here is pure. The store owns the writes.
 */

export function repeatApplies(repeat: Repeat, sourceDate: string, targetDate: string): boolean {
  if (targetDate <= sourceDate) return false
  switch (repeat) {
    case 'daily':
      return true
    case 'weekdays': {
      const day = weekdayOf(targetDate)
      return day >= 1 && day <= 5
    }
    case 'weekly':
      return weekdayOf(targetDate) === weekdayOf(sourceDate)
  }
}

/**
 * The weekday of a date key, 0 = Sunday, matching `Date.getDay()`.
 *
 * Built from the parts rather than parsed, because `new Date('2026-09-02')`
 * is read as UTC midnight and shifts a day backwards for anyone west of
 * Greenwich - which would put "weekdays" tasks on Sundays for half the world.
 */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/**
 * Whether an unfinished task is the source of a series that will put its
 * own instance on `targetDate` anyway.
 *
 * The rollover asks this before carrying a task forward. It already knew a
 * repeat *instance* is covered - the series generates tomorrow's copy - but
 * the *source* of a series is a manual task with `repeat` set, has no
 * identity of its own, and was pushed like any one-off. Tomorrow then held
 * two: the instance the series had already made, and the source arriving
 * with a push count. Found by the rollover e2e test in v1.11.
 */
export function sourceCovers(task: Task, sourceDate: string, targetDate: string): boolean {
  return task.repeat !== undefined && task.repeatOf === undefined && repeatApplies(task.repeat, sourceDate, targetDate)
}

export interface RepeatSource {
  task: Task
  date: string
}

/**
 * Every task that is the source of a series, oldest first.
 *
 * A source is a task with `repeat` and no `repeatOf` - an instance carries
 * the repeat forward so that editing it can reach the series, but it is not
 * itself a source, or every generated day would start generating its own.
 *
 * There is no age limit on how far back a source may be. There used to be one
 * - four hundred days - and it was removed rather than documented, because it
 * was an expiry date pretending to be an optimisation. A source is the day the
 * repeating task was first written, and that day never moves; a weekly task
 * set up thirteen months ago would simply stop arriving one morning, with
 * nothing said and nothing to find. It also bought no speed: this loop reads
 * every day in the store either way, and the floor only skipped the handful of
 * task arrays inside the old ones. A planner meant to be lived in for years
 * cannot have a series quietly expire in its second year.
 */
export function repeatSources(days: Record<string, DayPlan>, before: string): RepeatSource[] {
  const found: RepeatSource[] = []
  for (const [date, day] of Object.entries(days)) {
    if (date >= before) continue
    for (const task of day.tasks) {
      if (task.repeat && !task.repeatOf) found.push({ task, date })
    }
  }
  return found.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))
}

/**
 * The instance a source produces on one day.
 *
 * Deliberately not a copy. What travels is what the task *is*: its title,
 * when and how long, what kind of thing it is, its note and its steps. What
 * does not travel is what a particular day made of it - whether it was done,
 * how many times it was pushed, whether it was one of that day's three key
 * tasks. Highlights in particular are a decision about one day's priorities,
 * and a repeating task that arrived pre-marked every morning would spend the
 * cap before anybody looked at the day.
 */
export function instanceOf(source: Task, sourceId: string): Task {
  return {
    id: crypto.randomUUID(),
    title: source.title,
    time: source.time,
    minutes: source.minutes,
    category: source.category,
    unbounded: source.unbounded,
    note: source.note,
    subtasks: source.subtasks?.map(step => ({ id: crypto.randomUUID(), title: step.title, done: false })),
    repeat: source.repeat,
    repeatOf: sourceId,
    origin: { type: 'repeat', sourceId },
    done: false,
  }
}

export interface MaterialiseResult {
  tasks: Task[]
  /** True when anything was actually added - lets the caller skip a write. */
  added: boolean
}

/**
 * Adds the instances one day is owed, and nothing else.
 *
 * Idempotent in three ways, each of which is a bug that would otherwise be
 * hit within a week of use: a series already present on the day is not added
 * twice, a series the day has skipped is not resurrected, and a source dated
 * on or after this day never reaches back in time.
 */
export function materialiseRepeats(
  days: Record<string, DayPlan>,
  date: string,
  existing: Task[],
): MaterialiseResult {
  const day = days[date]
  const skips = new Set(day?.repeatSkips ?? [])
  const present = new Set(existing.map(t => t.repeatOf).filter((id): id is string => !!id))
  const added: Task[] = []

  for (const { task, date: sourceDate } of repeatSources(days, date)) {
    if (skips.has(task.id) || present.has(task.id)) continue
    if (!repeatApplies(task.repeat!, sourceDate, date)) continue
    added.push(instanceOf(task, task.id))
    present.add(task.id)
  }

  return added.length === 0 ? { tasks: existing, added: false } : { tasks: [...existing, ...added], added: true }
}

/**
 * The source task a given task belongs to, or the task itself when it is one.
 * Undefined when it is part of no series, or when its source has been deleted
 * - which reads the same as never having had one.
 */
export function sourceFor(days: Record<string, DayPlan>, task: Task): RepeatSource | undefined {
  if (!task.repeatOf) return task.repeat ? { task, date: dateOfTask(days, task.id) ?? todayKey() } : undefined
  for (const [date, day] of Object.entries(days)) {
    const found = day.tasks.find(t => t.id === task.repeatOf)
    if (found) return { task: found, date }
  }
  return undefined
}

function dateOfTask(days: Record<string, DayPlan>, id: string): string | undefined {
  for (const [date, day] of Object.entries(days)) {
    if (day.tasks.some(t => t.id === id)) return date
  }
  return undefined
}
