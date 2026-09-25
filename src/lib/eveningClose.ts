import type { AppData, DayPlan, EveningCloseSettings, Task } from './types'
import { addDays } from './dates'
import { kindOnDate } from './dayKinds'
import { wakingDayOn } from './shiftDay'
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
  const score = dayScore(tasks, day?.dayType, day?.lowDay)
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

const DAY_MINUTES = 24 * 60

/** The card comes this long before the sleep that ends a day with a kind. */
export const BEFORE_SLEEP = 30

/**
 * A day's evening on its own clock - minutes from its midnight, past 1440 the
 * date after: from when the card may come to when the day is over.
 */
export interface Evening {
  from: number
  until: number
}

/**
 * When a date's evening is - the owner's brief of 2026-09-25, before the
 * freeze. A date with a kind of day closes half an hour before the sleep
 * that ends it, and that sleep is the next date's, as every reader of a
 * date's sleep has it (lib/wakingDay.ts): a day shift at its early bedtime,
 * a free day at its late one, a free day before a day shift at the day
 * shift's, and a night the morning after, when the sleep after it begins.
 * Its evening lasts until that sleep is over. A date with no kind, or no
 * sleep to end it, keeps the time in Settings until midnight, as every
 * evening did before kinds.
 */
export function eveningOf(data: AppData, date: string, today: string): Evening {
  const settings = data.settings.eveningClose ?? DEFAULT_EVENING_CLOSE
  const tonight = kindOnDate(data, date) ? wakingDayOn(data, date, today).tonight : null
  if (tonight) return { from: tonight.start - BEFORE_SLEEP, until: tonight.end }
  return { from: atMinutes(settings.at), until: DAY_MINUTES }
}

/**
 * The day a card closes: the date's own tasks, and its night's hours on the
 * date after - a night's day ends at the morning's bedtime, and the snack at
 * half past two was the night's. Not the hours of the night before, on the
 * date's own list: those closed with that night.
 */
export function closingDay(data: AppData, date: string): DayPlan | undefined {
  const day = data.days[date]
  const night = (data.days[addDays(date, 1)]?.tasks ?? []).filter(t => t.nightOf === date)
  if (!day && night.length === 0) return undefined
  return { ...(day ?? { date, tasks: [] }), tasks: [...(day?.tasks ?? []).filter(t => !t.nightOf), ...night] }
}

/**
 * Whether the day's ongoing block - a shift - is running at `nowMinutes` on
 * the day's clock. Its night's hours are on the clock of the date after.
 */
function shiftRunning(day: DayPlan | undefined, nowMinutes: number): boolean {
  return (day?.tasks ?? []).some(t => {
    if (!t.unbounded || t.done || t.missed || !t.time || !CLOCK.test(t.time) || !t.minutes) return false
    const start = atMinutes(t.time) + (t.nightOf === day?.date ? DAY_MINUTES : 0)
    return start <= nowMinutes && nowMinutes < start + t.minutes
  })
}

/**
 * Whether the card should be on screen right now.
 *
 * Two ways in, and the second is the better one. The clock is the fallback -
 * the day's evening, `eveningOf`. Finishing the last thing on the list is the
 * real trigger: the day is *over*, and being told so in the same second is
 * the whole point. Neither ever fires twice, because dismissing is remembered
 * for the date; neither fires once the day's evening is over - yesterday does
 * not close itself - and neither while a shift of the day is still running.
 *
 * `nowMinutes` is passed in rather than read, the same way every other piece
 * of arithmetic in this app takes its clock as an argument - on the day's own
 * clock, past 1440 once its evening runs into the date after.
 */
export function shouldClose(input: {
  day: DayPlan | undefined
  settings: EveningCloseSettings
  nowMinutes: number
  /** The day's evening; the time in Settings until midnight where none is given. */
  evening?: Evening
  dismissed: boolean
}): boolean {
  const { day, settings, nowMinutes, dismissed } = input
  if (!settings.enabled || dismissed) return false
  const evening = input.evening ?? { from: atMinutes(settings.at), until: DAY_MINUTES }
  if (nowMinutes >= evening.until) return false
  const summary = eveningSummary(day)
  if (!summary) return false
  if (shiftRunning(day, nowMinutes)) return false
  // Everything on the list is done. It does not matter what time it is: the
  // day this app was built for can end at four in the afternoon.
  if (summary.done === summary.total) return true
  return nowMinutes >= evening.from
}

/** The day a card closes, and the moment on its clock. */
export interface Closing {
  date: string
  /** Its day, as the card counts it - `closingDay`. */
  day: DayPlan
  /** Now, on the closing date's own clock. */
  nowMinutes: number
}

/**
 * The date whose day the card closes at `nowMinutes` on `today`, or null:
 * yesterday while its evening still runs into this morning - a night closed
 * at eight the morning after, a day shift before a night at one - and today.
 * Yesterday first, since its evening is the one ending.
 */
export function closingAt(data: AppData, today: string, nowMinutes: number, dismissed: (date: string) => boolean): Closing | null {
  const settings = data.settings.eveningClose ?? DEFAULT_EVENING_CLOSE
  for (const [date, offset] of [
    [addDays(today, -1), DAY_MINUTES],
    [today, 0],
  ] as const) {
    const day = closingDay(data, date)
    const now = nowMinutes + offset
    if (day && shouldClose({ day, settings, nowMinutes: now, evening: eveningOf(data, date, today), dismissed: dismissed(date) })) {
      return { date, day, nowMinutes: now }
    }
  }
  return null
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
 * says "Push 3 to tomorrow"; it does not say that leaving them is a problem,
 * because it is not one.
 */
export function pushableAtClose(day: DayPlan | undefined, leave: readonly string[] = []): number {
  return (day?.tasks ?? []).filter(t => !t.done && !leave.includes(t.id)).length
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * What on a day is still tonight's at `nowMinutes`: a timed task that has not
 * started yet, and one that is happening now. Neither is unfinished - rotating
 * shifts, v2.29 stage 9. The card shows from half past nine, and on a
 * night-shift day the shift starts at ten; offering to push it to tomorrow was
 * offering to move the one thing the evening is for.
 *
 * The ids, for the push to leave where they are - the same `leave` the push
 * already takes for last night's shift still running after midnight.
 */
export function stillAhead(day: DayPlan | undefined, nowMinutes: number): string[] {
  return (day?.tasks ?? [])
    .filter(t => {
      if (t.done || !t.time || !CLOCK.test(t.time)) return false
      const [h, m] = t.time.split(':').map(Number)
      const start = h * 60 + m
      return start >= nowMinutes || (t.minutes !== undefined && start + t.minutes > nowMinutes)
    })
    .map(t => t.id)
}
