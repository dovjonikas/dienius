import type { AppData, DayPlan, Task } from '../../lib/types'
import { addDays } from '../../lib/dates'
import { dayHas, isRoutine } from '../../lib/taskIdentity'
import { formatDuration } from './capacity'

/**
 * A low day: the 40% doctrine as one press.
 *
 * Some days are not going to be full ones, and the failure this exists to
 * prevent is treating them as full ones that went badly - which is what a
 * plan written for a good morning does to a bad one. RESEARCH-ADHD.md's
 * 40% rule, in the owner's own words: on a day like that, do 40% of what
 * matters and call it a day that went well. So one press keeps the key
 * tasks at 40% of their length, leaves the routine blocks where they are,
 * sends everything else to tomorrow, and marks the day; the score then
 * counts the key tasks alone (`dayScore`, `dayStat`).
 *
 * Pure, the way replan.ts is: `planLowDay` says what would happen and the
 * sheet shows it before Accept; `applyLowDayPlan` is the same plan
 * committed, idempotent so that the same intention arriving twice from two
 * devices changes nothing the second time.
 *
 * Tone is part of the contract, as it is for every replan: the summary
 * says what stays and what waits, and never counts what will not happen.
 */

/** The share of a key task's length that stays. */
export const LOW_DAY_SHARE = 0.4

/**
 * The shortest a cut task is ever made. Under a quarter of an hour a block
 * is not a sitting, and a five-minute deep work block is a lie about what
 * deep work is.
 */
export const LOW_DAY_MIN_MINUTES = 15

/** A cut lands on the five minutes a plan is made at, the way a dragged block snaps. */
const STEP_MINUTES = 5

export interface LowDayKeep {
  taskId: string
  /** The new length. Absent for a task that had no size - nothing invents one to cut. */
  minutes?: number
  wasMinutes?: number
}

export interface LowDayPlan {
  kind: 'low'
  /** The key tasks, kept and shortened. */
  keep: LowDayKeep[]
  /** The routine blocks, left exactly as they are. */
  stay: string[]
  /** Everything else that is not done, to the next day at the time it had. */
  tomorrow: string[]
  /** What stays and what waits. Never what was missed. */
  summary: string
}

/** 40% of a length, on the five-minute grid, never under the floor and never past what it was. */
export function lowDayMinutes(minutes: number): number {
  const cut = Math.round((minutes * LOW_DAY_SHARE) / STEP_MINUTES) * STEP_MINUTES
  return Math.min(minutes, Math.max(LOW_DAY_MIN_MINUTES, cut))
}

export function planLowDay(tasks: Task[]): LowDayPlan {
  const open = tasks.filter(t => !t.done)
  // Key wins over routine: a standup marked key is the standup that matters
  // today, and it is kept and cut like any other key task.
  const key = open.filter(t => t.highlight)
  const routine = open.filter(t => !t.highlight && isRoutine(t))
  const rest = open.filter(t => !t.highlight && !isRoutine(t))

  const keep: LowDayKeep[] = key.map(t =>
    t.minutes === undefined ? { taskId: t.id } : { taskId: t.id, minutes: lowDayMinutes(t.minutes), wasMinutes: t.minutes },
  )

  const parts: string[] = []
  if (key.length > 0) {
    const named = key.map(t => (t.minutes === undefined ? t.title : `${t.title} ${formatDuration(lowDayMinutes(t.minutes))}`))
    parts.push(`${key.length === 1 ? 'Key task stays' : 'Key tasks stay'}: ${named.join(', ')}.`)
  } else {
    parts.push('No key task today, so nothing is shortened.')
  }
  if (routine.length > 0) parts.push(`Routine stays: ${routine.map(t => t.title).join(', ')}.`)
  if (rest.length > 0) parts.push(`Tomorrow: ${rest.map(t => t.title).join(', ')}.`)
  if (routine.length === 0 && rest.length === 0 && key.length > 0) parts.push('Nothing else on the day.')

  return {
    kind: 'low',
    keep,
    stay: routine.map(t => t.id),
    tomorrow: rest.map(t => t.id),
    summary: parts.join(' '),
  }
}

/**
 * The plan committed: the kept tasks at their new length, the rest on the
 * next day at the time they had - a task the next day already holds by
 * identity is not added twice, the same check every move between days
 * keeps - and the day marked. Pure; the store commits it with one undo.
 */
export function applyLowDayPlan(data: AppData, date: string, plan: LowDayPlan): AppData {
  const day: DayPlan = data.days[date] ?? { date, tasks: [] }
  const next = addDays(date, 1)
  const target: DayPlan = data.days[next] ?? { date: next, tasks: [] }

  const sizes = new Map(plan.keep.filter(k => k.minutes !== undefined).map(k => [k.taskId, k.minutes!]))
  const going = new Set(plan.tomorrow)
  const staying: Task[] = []
  const leaving: Task[] = []
  for (const task of day.tasks) {
    if (going.has(task.id)) {
      leaving.push(task)
      continue
    }
    const minutes = sizes.get(task.id)
    staying.push(minutes !== undefined && minutes !== task.minutes ? { ...task, minutes } : task)
  }
  const arriving = leaving.filter(t => !dayHas(target, t))

  const lowered: DayPlan = { ...day, tasks: staying, lowDay: true }
  const days = { ...data.days, [date]: lowered }
  if (leaving.length > 0) days[next] = { ...target, tasks: [...target.tasks, ...arriving] }
  return { ...data, days }
}
