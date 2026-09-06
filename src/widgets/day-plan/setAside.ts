import type { Task } from '../../lib/types'
import type { Interval } from './capacity'
import { UNSIZED_ASSUMED_MINUTES, freeWindows } from './replan'
import { formatClock } from './timelineLayout'
import { formatDuration } from './capacity'

/**
 * Set aside, not deleted.
 *
 * The owner's scenario, in their words: you replan without knowing how long
 * it will take - "something this evening" - and something comes off the
 * day. That something must not disappear. It waits, quietly, at the bottom
 * of the day, and when you get home one press puts it back where there is
 * room.
 *
 * Until v2.5 a block a replan took off was deleted, with a repeat skip so
 * the template would not make it again. That is a decision the app made on
 * somebody's behalf at the worst possible moment - during an interruption,
 * about a thing they had not yet decided to give up. Now the block stays on
 * the day with `setAside` on it: out of the timeline, out of the score, out
 * of the way, and one press from coming back.
 *
 * This module is the arithmetic of that press. The sheet shows it and asks
 * once, the way every other replan does.
 */

/** The shortest a returning block is ever cut to. Under this it is not a sitting. */
export const RETURN_MIN_MINUTES = 15

/**
 * And never under half of what it was. Forty minutes of a two-hour deep
 * work block is not that block shortened, it is a different and smaller
 * thing wearing its name - so it waits for a day that has room for it.
 */
export const RETURN_MIN_SHARE = 0.5

export interface ReturnOffer {
  taskId: string
  /** Where it would go today. Absent when the answer is tomorrow. */
  time?: string
  /** The length it would come back at. Absent for a block that never had one. */
  minutes?: number
  /** What it was, when the answer is shorter than that. */
  wasMinutes?: number
  /** Whether the length had to be cut to fit what is left. */
  shortened: boolean
  /** Whether today has no room worth using. */
  tomorrow: boolean
  /** The one line the sheet shows. Never counts what was missed. */
  line: string
}

/** The blocks waiting, in the order they were put down. Done is not waiting. */
export function setAsideOf(tasks: Task[]): Task[] {
  return tasks.filter(t => t.setAside && !t.done)
}

/**
 * Where a set-aside block would go if it came back now.
 *
 * The first free stretch from now that is worth using, the block's own
 * length if it fits and what is left if it does not - and tomorrow when
 * what is left is too little to be the thing at all.
 */
export function planReturn(task: Task, tasks: Task[], nowMinutes: number, window: Interval, busy: Interval[] = []): ReturnOffer {
  const wanted = task.minutes ?? UNSIZED_ASSUMED_MINUTES
  const floor = Math.max(RETURN_MIN_MINUTES, Math.ceil(wanted * RETURN_MIN_SHARE))
  // Everything else on the day, including the other blocks that are waiting -
  // one of those is not something to plan around, so they are left out.
  const others = tasks.filter(t => t.id !== task.id && !t.setAside)
  const from = Math.max(nowMinutes, window.start)
  const gaps = freeWindows(others, window, busy, from, floor)
  // Whole if anything holds it, and only then the nearest stretch that is
  // at least worth using. A block does not come back shortened because
  // there was a half hour before it that it could have been squeezed into.
  const gap = gaps.find(g => g.minutes >= wanted) ?? gaps[0]

  if (!gap) {
    return {
      taskId: task.id,
      shortened: false,
      tomorrow: true,
      line: 'Tomorrow, at the time it had',
    }
  }

  const minutes = Math.min(wanted, gap.minutes)
  const shortened = minutes < wanted
  const end = gap.start + minutes
  const sized = task.minutes !== undefined

  return {
    taskId: task.id,
    time: formatClock(gap.start),
    // A block that never had a length does not gain one by coming back.
    minutes: sized ? minutes : undefined,
    wasMinutes: sized && shortened ? wanted : undefined,
    shortened: sized && shortened,
    tomorrow: false,
    line:
      sized && shortened
        ? `${formatClock(gap.start)} - ${formatClock(end)}, ${formatDuration(wanted)} shortened to ${formatDuration(minutes)} - that is what is left`
        : sized
          ? `${formatClock(gap.start)} - ${formatClock(end)}`
          : `${formatClock(gap.start)}`,
  }
}
