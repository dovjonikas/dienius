import { addDays, todayKey } from './dates'
import { weekdayOf } from './repeats'
import {
  MAX_ACTIVE_GOALS,
  MAX_RULES_PER_GOAL,
  type AppData,
  type DayPlan,
  type Goal,
  type IfThenEntry,
} from './types'

/**
 * North: the few things the days are for.
 *
 * ## Why this has no progress bar
 *
 * Every other feature in this app measures something. This one refuses to,
 * and the refusal is the feature.
 *
 * The behaviour it is built around is well established and deeply
 * unhelpful: when people are shown how far they have come toward a goal they
 * care about, they *ease off*. A visible advance reads as licence to spend
 * it. The same person shown instead why the goal matters - the commitment
 * itself, restated - keeps going. Progress framing and commitment framing
 * pull in opposite directions, and a progress bar is the purest possible
 * progress framing: a number that goes up, attached to something you already
 * said you wanted.
 *
 * So a goal here has no percentage, no milestones, no target date, no streak
 * and no checkbox. There is nothing to tick and nothing that fills. The one
 * number anywhere near it is how many days it has been carried, and that is
 * deliberately not a score: it does not go up faster when you try harder, it
 * cannot be lost, and it means the same thing on a bad week as on a good one.
 *
 * ## Why four
 *
 * A cap, because four directions is already more than a life points in at
 * once, and because a list of twelve is a list nobody reads. Four is small
 * enough that the rotation below shows each one about twice a week - often
 * enough to stay real, rarely enough that it never becomes wallpaper.
 *
 * ## Why it is barely visible
 *
 * On the day view a goal is one line of quiet text under the header, with no
 * icon, no border, no background - closer to a watermark than to a control.
 * It is not there to be acted on. It is there so that on the four hundredth
 * ordinary Tuesday, the thing the Tuesdays are for is still in the room.
 */

/** Active goals, in the order they were written. */
export function activeGoals(goals: Goal[]): Goal[] {
  return goals.filter(g => !g.archivedAt)
}

export function archivedGoals(goals: Goal[]): Goal[] {
  return goals.filter(g => g.archivedAt)
}

export function canAddGoal(goals: Goal[]): boolean {
  return activeGoals(goals).length < MAX_ACTIVE_GOALS
}

/**
 * Days a goal has been carried, counting the day it was written as the first.
 *
 * Not progress. It is the one fact about a goal that is true regardless of
 * how the week went: you cannot fall behind on it, you cannot lose it, and it
 * says nothing about whether anything is working. "Thirty-two days lived
 * toward this" is a description of a stretch of life, not a measurement of
 * it - which is exactly why it is allowed to exist here when a percentage is
 * not.
 */
export function goalAge(goal: Goal, today = todayKey()): number {
  if (goal.createdAt > today) return 0
  let days = 1
  for (let cursor = goal.createdAt; cursor < today; cursor = addDays(cursor, 1)) days++
  return days
}

/**
 * Which goal today shows.
 *
 * Deterministic from the date, so it is the same goal all day and a different
 * one tomorrow. Random-per-render would re-roll on every refresh, which turns
 * a steady thing into a slot machine; random-per-day would still mean two
 * devices disagree about what today's goal is.
 *
 * The date is turned into a day number rather than parsed, so the rotation
 * does not shift with the timezone the app happens to be opened in.
 */
export function goalForDay(goals: Goal[], date: string): Goal | undefined {
  const active = activeGoals(goals)
  if (active.length === 0) return undefined
  return active[dayNumber(date) % active.length]
}

/** Days since an arbitrary fixed epoch. Only its remainder is ever used. */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * The age, as a sentence. One place, because it is said in three: the goal
 * list in Settings, the North window, and the review's own North line.
 */
export function ageLabel(goal: Goal, asOf: string): string {
  const days = goalAge(goal, asOf)
  return days === 1 ? '1 day lived toward this' : `${days} days lived toward this`
}

// --- what pulls you off a goal -------------------------------------------

/**
 * The rules filed under one goal, in the order they were written.
 *
 * An if-then rule used to live in a flat list of its own, surfaced onto the
 * day view one at a time by day type and time of day. Nobody ever opened the
 * list and the surfaced line read as noise on the one screen that has to
 * answer "what am I doing now" in two seconds, so it was unmounted and the
 * rules went quiet. The diagnosis was wrong: the problem was never how hard
 * they were surfaced, it was that a rule with no goal is a chore somebody
 * set themselves. Under the goal it protects, the same sentence is armour.
 */
export function rulesForGoal(entries: IfThenEntry[], goalId: string): IfThenEntry[] {
  return entries.filter(e => e.goalId === goalId)
}

/**
 * Rules that are not under any goal that exists.
 *
 * Two shapes land here and they are treated identically: a rule written
 * before rules had goals, and a rule whose goal has since been deleted. A
 * dangling id degrades rather than erroring anywhere in this app, and
 * "degrades" here means the rule is still yours, still readable, and still
 * one press from being filed - not that it quietly vanishes with the goal.
 *
 * Archived goals are still goals: their rules stay with them rather than
 * falling back into this group, because archiving a direction is not the
 * same as deciding the things that pull you off it never happened.
 */
export function unfiledRules(entries: IfThenEntry[], goals: Goal[]): IfThenEntry[] {
  const known = new Set(goals.map(g => g.id))
  return entries.filter(e => !e.goalId || !known.has(e.goalId))
}

/** Whether one more rule fits under this goal. The cap refuses; it never evicts. */
export function canAddRule(entries: IfThenEntry[], goalId: string): boolean {
  return rulesForGoal(entries, goalId).length < MAX_RULES_PER_GOAL
}

/**
 * The one rule from a goal that the slack card shows under the why.
 *
 * Deterministic from the date, exactly like `goalForDay` above and for the
 * same reason: the same line all day, a different one tomorrow. Rotating on
 * render would turn a steady sentence into a slot machine, and there is
 * deliberately nothing recorded about which rule was shown when - the old
 * `lastSurfaced` bookkeeping went with the day view's surfacing, and nothing
 * replaced it, because arithmetic on a date needs no memory.
 */
export function ruleForDay(entries: IfThenEntry[], goalId: string, date: string): IfThenEntry | undefined {
  const rules = rulesForGoal(entries, goalId)
  if (rules.length === 0) return undefined
  return rules[dayNumber(date) % rules.length]
}

// --- when a goal comes forward on its own --------------------------------

export type NorthPrompt =
  | { kind: 'slack'; goal: Goal }
  | { kind: 'monday'; goal: Goal }

/** Below this share of a day's tasks done, the day is treated as one that got away. */
export const SLOW_DAY_RATE = 0.4

/** How many days the same task must be carried before it counts as stuck. */
export const STUCK_PUSH_DAYS = 3

/**
 * Whether yesterday was a day that got away.
 *
 * Two conditions, and both have to be true, because either alone is a normal
 * day: a low done rate *and* nothing that was marked as mattering got
 * finished. A day where two of nine ordinary tasks happened but the one key
 * thing did is a good day with a long list on it, and this must not fire on
 * it.
 *
 * A day with no plan at all is not a slow day. Nothing was intended, so
 * nothing was missed, and an app that treats a rest day as a failure is an
 * app that gets closed.
 */
export function wasSlowDay(day: DayPlan | undefined): boolean {
  const tasks = day?.tasks ?? []
  if (tasks.length === 0) return false
  const done = tasks.filter(t => t.done).length
  if (done / tasks.length >= SLOW_DAY_RATE) return false
  const highlights = tasks.filter(t => t.highlight)
  return !highlights.some(t => t.done)
}

/**
 * Whether the same task has been carried forward for several days running.
 *
 * Read off `pushCount` rather than by walking history: the count is exactly
 * "how many days this has been moved", it survives a reload, and it is
 * already the number the push bound is measured against.
 */
export function hasStuckTask(day: DayPlan | undefined, days = STUCK_PUSH_DAYS): boolean {
  return (day?.tasks ?? []).some(t => !t.done && (t.pushCount ?? 0) >= days)
}

/**
 * The card today should show, if any.
 *
 * Order matters: Monday wins over a slow day. A week that begins by being
 * told the last one went badly is a week that begins with an apology, and the
 * Monday card says the same thing in the register somebody can actually use
 * on a Monday morning.
 *
 * Both conditions are read from yesterday and from today's own tasks - there
 * is no separate record of "the app noticed something", because a stored flag
 * would need clearing and could drift from the days it describes.
 */
export function northPrompt(data: AppData, today: string, dismissedOn: string | null): NorthPrompt | undefined {
  if (dismissedOn === today) return undefined
  const goal = goalForDay(data.goals, today)
  if (!goal) return undefined

  const { afterASlowDay, onMonday } = data.settings.north

  if (onMonday && weekdayOf(today) === 1) return { kind: 'monday', goal }

  if (!afterASlowDay) return undefined
  const yesterday = data.days[addDays(today, -1)]
  if (wasSlowDay(yesterday) || hasStuckTask(data.days[today]) || hasStuckTask(yesterday)) {
    return { kind: 'slack', goal }
  }
  return undefined
}
