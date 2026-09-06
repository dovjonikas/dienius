import type { Task } from '../../lib/types'
import { timeToMinutes } from './capacity'

/**
 * When a block may land, beyond "there is a gap there".
 *
 * A gap in a calendar is not the same as a time a thing can actually
 * happen, and every replan in this app has been treating them as the same
 * thing. The owner put it plainly: gym at eleven at night is not gym. So
 * two rules, both about what a block *is* rather than about where there is
 * room.
 *
 * They are advisory in one specific sense: they narrow where a plan will
 * *put* something, and they never stop somebody putting a block wherever
 * they like by hand. A person dragging a block to 23:00 has decided; a
 * plan that puts it there has guessed.
 */

/**
 * The hour past which a kind of block stops being that kind, by category
 * id. Only the ones with an honest answer are here: a personal errand or a
 * one-off has no natural latest and inventing one would be the app having
 * an opinion about somebody's evening.
 *
 * Deep work is the earliest of them, at eight: two hours of real work
 * started at nine at night is a bargain with tomorrow morning.
 */
export const LATEST_BY_CATEGORY: Record<string, number> = {
  core: 20 * 60,
  health: 21 * 60,
  meal: 21 * 60,
  commute: 21 * 60,
}

/** How far apart two meals stay when a plan moves one of them. */
export const MEALS_APART_MINUTES = 120

/** A block's own latest wins over the rule for its kind; neither is required. */
export function latestFor(task: Task): number | undefined {
  if (task.latest) return timeToMinutes(task.latest)
  return task.category ? LATEST_BY_CATEGORY[task.category] : undefined
}

const isMeal = (task: Task) => task.category === 'meal'

/**
 * Whether this block may start at this minute, given the day around it.
 *
 * Two questions, in the order they cost anything: is it too late to be the
 * thing it is, and would it land on top of another meal. A meal already
 * eaten still counts for the two hours after it - the stomach does not know
 * the task was ticked.
 */
export function placementOk(task: Task, startMinutes: number, others: Task[]): boolean {
  const latest = latestFor(task)
  if (latest !== undefined && startMinutes > latest) return false

  if (!isMeal(task)) return true
  for (const other of others) {
    if (other.id === task.id || !isMeal(other) || other.time === undefined) continue
    // Start to start, and in both directions: a lunch pushed into the
    // afternoon holds dinner off, and a dinner already at six holds a late
    // lunch off. Measured from the starts because that is how a person says
    // it, "two hours between meals", and because a block's length is the one
    // part of it a replan is allowed to change.
    if (Math.abs(startMinutes - timeToMinutes(other.time)) < MEALS_APART_MINUTES) return false
  }
  return true
}
