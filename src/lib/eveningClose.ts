import type { DayPlan, EveningCloseSettings, Task } from './types'
import { dayScore } from '../widgets/day-plan/score'

/**
 * The end of the day, said once, quietly.
 *
 * A day needs an ending. Midnight is not one - it is a rollover, and a
 * planner whose only closing gesture is the clock going round leaves every
 * evening open, which is how a list that was three quarters finished at nine
 * becomes, by bedtime, a list that was not finished.
 *
 * **Everything here is tone, and the tone is the feature.** The arithmetic is
 * four lines; the rest of this file is about what the app is allowed to say
 * with it. The rule, in one sentence: the evening close never appraises. The
 * day is being closed, not judged.
 *
 * Concretely, and none of these is negotiable:
 *
 * - **What was not done is not mentioned.** Not counted, not named, not
 *   implied. It is still in the list underneath, where somebody can look at
 *   it if they want to; the card does not point at it.
 * - **No red, no percentage, no arrow, no comparison with yesterday.** The
 *   same rules the day score has followed since v1.0, applied at the moment
 *   they are hardest to hold.
 * - **"Enough" is reachable every day.** Half the day's tasks, or every key
 *   one - see `isEnough`. That threshold is the 40% doctrine in
 *   docs/RESEARCH-ADHD.md written as a sentence: a day that got half of a
 *   real plan done is a day that went well, and an app that only says so at
 *   ten out of ten is an app that says so four times a year.
 * - **A day that did not reach it is not failed either.** "The day gave what
 *   it gave" is the whole of what is said about it. There is no third,
 *   sadder tier below that, and adding one would be inventing a way to lose.
 *
 * If a line here ever reads like a report to a manager, it is wrong,
 * whatever the numbers say.
 */

export const DEFAULT_EVENING_CLOSE: EveningCloseSettings = {
  enabled: true,
  // Late enough that the evening is genuinely over, early enough that it is
  // not competing with sleep. The sleep window's own default bedtime is
  // 23:00, so this is an hour and a half of slack rather than a nudge on the
  // way to bed.
  at: '21:30',
  askBestMoment: true,
}

export interface EveningSummary {
  done: number
  total: number
  keyDone: number
  keyTotal: number
  /** Whether this day reached "enough" - see `isEnough`. */
  enough: boolean
  /** The one sentence the card says. Never mentions what was not done. */
  line: string
}

/**
 * Half of a real plan, or every key task.
 *
 * The second clause is the one that matters most. Three key tasks done out of
 * nine is a day that did the things that mattered, and a threshold that
 * called that "not enough" because 3/9 is under a half would be measuring the
 * wrong thing - the whole reason this app has a three-a-day key mark is that
 * the key ones are the day.
 */
export function isEnough(summary: Pick<EveningSummary, 'done' | 'total' | 'keyDone' | 'keyTotal'>): boolean {
  if (summary.keyTotal > 0 && summary.keyDone === summary.keyTotal) return true
  return summary.total > 0 && summary.done / summary.total >= 0.5
}

/**
 * What the card says about a day, or `null` when there is nothing to close.
 *
 * A day with no plan has no ending to give it: `dayScore` already refuses to
 * call an empty day a zero, and this refuses to close one. That is not an
 * edge case being handled, it is the same principle - an app that says
 * "0 of 0 - the day gave what it gave" about a Sunday somebody never planned
 * has just made something out of nothing, and made it slightly sad.
 */
export function eveningSummary(day: DayPlan | undefined): EveningSummary | null {
  const tasks: Task[] = day?.tasks ?? []
  const score = dayScore(tasks, day?.dayType)
  if (!score.planned) return null

  const key = tasks.filter(t => t.highlight)
  const summary = {
    done: score.done,
    total: score.total,
    keyDone: key.filter(t => t.done).length,
    keyTotal: key.length,
  }
  const enough = isEnough(summary)
  return { ...summary, enough, line: lineFor({ ...summary, enough }) }
}

function lineFor(s: Omit<EveningSummary, 'line'>): string {
  const count = `${s.done} of ${s.total}`
  // The key clause only appears when every key task is done, because that is
  // the only thing it could say without counting what was not.
  const allKey = s.keyTotal > 0 && s.keyDone === s.keyTotal
  // "all 1 key task" is a sentence nobody says. One is named as one.
  const key = allKey ? (s.keyTotal === 1 ? ', and the key one' : `, all ${s.keyTotal} key tasks`) : ''
  if (s.enough) return `${count} done${key} - enough.`
  return `${count} - the day gave what it gave.`
}

/**
 * Whether the card should be on screen right now.
 *
 * Two ways in, and the second is the better one. The clock is the fallback -
 * a time somebody set once, for the evenings that just end. Finishing the
 * last thing on the list is the real trigger: the day is *over*, and being
 * told so in the same second is the whole point. Neither ever fires twice,
 * because dismissing is remembered for the date.
 *
 * `nowMinutes` is passed in rather than read, the same way every other piece
 * of arithmetic in this app takes its clock as an argument.
 */
export function shouldClose(input: {
  day: DayPlan | undefined
  settings: EveningCloseSettings
  nowMinutes: number
  /** True only on the day being looked at - yesterday does not close itself. */
  isToday: boolean
  dismissed: boolean
}): boolean {
  const { day, settings, nowMinutes, isToday, dismissed } = input
  if (!settings.enabled || dismissed || !isToday) return false
  const summary = eveningSummary(day)
  if (!summary) return false
  // Everything on the list is done. It does not matter what time it is: the
  // day this app was built for can end at four in the afternoon.
  if (summary.done === summary.total) return true
  return nowMinutes >= atMinutes(settings.at)
}

function atMinutes(at: string): number {
  const [h, m] = at.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.POSITIVE_INFINITY
  return h * 60 + m
}

/**
 * How many tasks would move if the offer to push were taken.
 *
 * Reported as a plain number on a plain offer, never as a reason. The card
 * says "3 unfinished - push them to tomorrow?"; it does not say that leaving
 * them is a problem, because it is not one.
 */
export function pushableAtClose(day: DayPlan | undefined): number {
  return (day?.tasks ?? []).filter(t => !t.done).length
}
