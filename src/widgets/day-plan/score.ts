import type { Task } from '../../lib/types'

/**
 * A day's score, computed only from that day's own tasks. There is no
 * global target and nothing carries in from other days.
 *
 * An empty day is not a zero - it has no plan at all, so there is nothing
 * to score. `planned: false` is the only way to represent that; it is
 * deliberately not folded into `{ done: 0, total: 0 }`, which would read
 * as a completed empty plan rather than the absence of one.
 */
export type DayScore =
  | { planned: false }
  | { planned: true; done: number; total: number }

/**
 * A day counts as planned the moment it has any task in it, whether that
 * task came from a stamped template, was typed by hand, or arrived by
 * rollover. Rollover only ever happens on an explicit button press, so a
 * rolled-over task reflects a choice already made about this day, not
 * something that landed on it automatically. Only an empty task list has
 * no plan.
 */
export function dayScore(tasks: Task[]): DayScore {
  if (tasks.length === 0) {
    return { planned: false }
  }
  return { planned: true, done: tasks.filter(t => t.done).length, total: tasks.length }
}

/**
 * Renders a planned day as a plain fraction, "done/total" - never a
 * percentage, never rounded, never padded with a placeholder for an
 * unplanned day. An unplanned day formats to null so a caller cannot
 * accidentally render "0/0" and imply a failed plan that never existed.
 */
export function formatDayScore(score: DayScore): string | null {
  return score.planned ? `${score.done}/${score.total}` : null
}
