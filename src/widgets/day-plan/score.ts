import type { DayType, Task } from '../../lib/types'

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
 *
 * `dayType` defaults to 'full', the same as an unstamped day or a
 * template saved before day types existed. On a full day every task
 * counts, exactly as before this feature shipped. On any other type -
 * shift, night, rest - only tasks marked `core` count, on the theory that
 * a twelve-hour shift leaves no realistic room for the rest of a normal
 * day's list, so nothing but what genuinely had to happen should be able
 * to drag the score down. A non-full day with tasks but none of them
 * core reports no plan, the same way an empty day does: there is nothing
 * required today, so there is nothing to measure - not a failed 0/0.
 */
export function dayScore(tasks: Task[], dayType: DayType = 'full'): DayScore {
  const counted = dayType === 'full' ? tasks : tasks.filter(t => t.core)
  if (counted.length === 0) {
    return { planned: false }
  }
  return { planned: true, done: counted.filter(t => t.done).length, total: counted.length }
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
