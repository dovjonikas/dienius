import type { DayPlan, Task, TaskOrigin } from './types'

/**
 * What makes two tasks the same task.
 *
 * The bug this exists to end: a "Commute" pushed from Monday and the
 * template's own "Commute" stamped onto Tuesday were two unrelated rows, so
 * Tuesday held both, and the timeline - which lays out overlapping anchors
 * side by side - drew them as two columns. Nothing was wrong with either
 * feature. What was missing was any way to ask whether they were the same
 * intention.
 *
 * A task's identity across days is the pair `(sourceId, blockId)`. A template
 * block is the same block wherever it lands; a repeat instance is the same
 * series wherever it lands. A manual task has no identity at all, on purpose:
 * two tasks both called "Call the bank" on one day are two calls, and the app
 * has no business merging them.
 */

/** The stable key for a task, or null when it is a one-off. */
export function identityOf(task: Task): string | null {
  const origin = task.origin
  if (origin && origin.type !== 'manual' && origin.sourceId) {
    return `${origin.type}:${origin.sourceId}:${origin.blockId ?? ''}`
  }
  // A repeat instance written before origins existed still knows its series.
  if (task.repeatOf) return `repeat:${task.repeatOf}:`
  return null
}

export function isRoutine(task: Task): boolean {
  return identityOf(task) !== null
}

export function originFor(task: Task): TaskOrigin {
  return task.origin ?? (task.repeatOf ? { type: 'repeat', sourceId: task.repeatOf } : { type: 'manual' })
}

/**
 * Adds tasks to a day, dropping any whose identity is already there.
 *
 * The single guard the whole fix rests on, and the reason it lives here
 * rather than in each caller: stamping, the weekday map, repeat generation
 * and pushing all add tasks to a day, and any one of them forgetting is a
 * duplicate. A one-off is always added - it has no identity to collide with.
 */
export function addWithoutDuplicates(existing: Task[], incoming: Task[]): Task[] {
  const present = new Set(existing.map(identityOf).filter((k): k is string => k !== null))
  const added: Task[] = []
  for (const task of incoming) {
    const key = identityOf(task)
    if (key !== null) {
      if (present.has(key)) continue
      present.add(key)
    }
    added.push(task)
  }
  return added.length === 0 ? existing : [...existing, ...added]
}

/**
 * Whether a day already holds this task's intention.
 *
 * What "push to tomorrow" asks before moving anything: a template block that
 * tomorrow is going to stamp anyway does not need carrying there by hand, and
 * carrying it is what produced two of everything.
 */
export function dayHas(day: DayPlan | undefined, task: Task): boolean {
  const key = identityOf(task)
  if (key === null) return false
  return (day?.tasks ?? []).some(t => identityOf(t) === key)
}

/**
 * How much state a task carries, for deciding which of two duplicates to keep.
 *
 * Not a quality score - it is a tiebreak, and it only ever runs between two
 * rows that are already the same task. A row somebody has ticked, marked as
 * key, written a note on or broken into steps is the row their work is in;
 * the other one is the accident.
 */
export function stateWeight(task: Task): number {
  let weight = 0
  if (task.done) weight += 8
  if (task.highlight) weight += 4
  if (task.note) weight += 2
  if (task.subtasks?.some(s => s.done)) weight += 2
  if (task.subtasks?.length) weight += 1
  if ((task.pushCount ?? 0) > 0) weight += 1
  return weight
}

/**
 * Removes duplicates already sitting in a day, keeping the one with the work
 * in it.
 *
 * A repair, run once at load - see `repairDuplicates` in storage.ts. Two
 * tasks count as the same when they share an identity, or, for tasks written
 * before origins existed, when their title, time and size all match. That
 * second rule is deliberately narrow: two untimed tasks with the same name
 * are plausibly two real errands, and merging them would lose one. Two with
 * the same name at the same time for the same length are a duplicate.
 */
export function dedupeTasks(tasks: Task[]): Task[] {
  // A legacy task - one written before origins existed - is matched on its
  // shape, but only when it has a time. Two untimed tasks with the same name
  // are plausibly two real errands, and merging them would lose one; two at
  // the same minute for the same length are a duplicate. A task that says it
  // is manual is never shape-matched at all: it has already said it is its
  // own thing.
  const keyOf = (t: Task, index: number) => {
    const identity = identityOf(t)
    if (identity !== null) return identity
    if (t.origin?.type === 'manual' || !t.time) return `unique:${index}`
    return `shape:${t.title}|${t.time}|${t.minutes ?? ''}`
  }
  const best = new Map<string, Task>()
  const order: string[] = []

  for (const [index, task] of tasks.entries()) {
    const key = keyOf(task, index)
    const held = best.get(key)
    if (!held) {
      best.set(key, task)
      order.push(key)
      continue
    }
    // Ties keep the one already in place: an arbitrary swap would move a task
    // in the list for no reason a person could see.
    if (stateWeight(task) > stateWeight(held)) best.set(key, task)
  }

  return order.map(key => best.get(key)!)
}

/**
 * Whether a day is going to receive this task on its own, whether or not it
 * has yet.
 *
 * Three ways that happens: the day already holds it, the day is stamped from
 * the same template, or the weekday map will stamp that template when the day
 * is first opened. A repeat series is not counted here - `willRepeatOnto`
 * below answers that, because it needs the repeat rules.
 */
export function willReceive(
  day: DayPlan | undefined,
  task: Task,
  mappedTemplateId: string | undefined,
): boolean {
  if (dayHas(day, task)) return true
  const origin = originFor(task)
  if (origin.type !== 'template' || !origin.sourceId) return false
  if (day?.templateId === origin.sourceId) return true
  // A day nobody has opened yet has no templateId, and will get one from the
  // map the moment it is opened. A day that has been opened and carries a
  // different template will not.
  return day?.autoApplied !== true && mappedTemplateId === origin.sourceId
}
