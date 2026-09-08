import type { AppData } from '../../lib/types'
import { todayKey } from '../../lib/dates'
import { weekdayOf } from '../../lib/repeats'

/**
 * What "Stamp week" would do, worked out before it does it.
 *
 * Three conditions, and a day has to pass all of them: the weekday plan names
 * a template for it, it has no template yet, and it is not already behind you.
 * Stamping over a week somebody has already arranged by hand is not a
 * convenience, it is a loss, and this button is deliberately the one-press
 * kind that has to be safe to press by accident.
 *
 * A plain function rather than a handler so the calendar bar can decide
 * whether to show the button at all (`mapped === 0` means there is nothing it
 * could ever do) and whether to enable it (`stamps` empty means it has already
 * been done), without either of those being a second copy of the rule.
 */
export interface WeekStampPlan {
  /** Date -> template id, for `actions.stamp`. Empty when there is nothing left to do. */
  stamps: Record<string, string>
  /**
   * How many of the days this could ever act on have a template named for
   * their weekday - which counts from the day the stamp is made from, not
   * from Monday. A week wholly behind you has nothing mapped, so the button
   * is not drawn on it at all rather than drawn and refusing: a control that
   * explains it cannot do anything is worse than one that is not there.
   */
  mapped: number
}

/**
 * @param from The day the stamp is being made from - today, unless a caller
 * says otherwise. An argument rather than a `todayKey()` read inside, because
 * a function that consults the wall clock is one no test can pin: a fixture
 * week written down as literal dates would pass this morning and start
 * failing the morning those dates went by.
 */
export function planWeekStamp(
  days: string[],
  data: Pick<AppData, 'days' | 'settings'>,
  from: string = todayKey(),
): WeekStampPlan {
  const mapping = data.settings.weekdayTemplates
  const stamps: Record<string, string> = {}
  let mapped = 0
  for (const day of days) {
    // The owner's rule: put the week template in on a Wednesday and it starts
    // on that Wednesday. A day already past is left alone even when it is
    // empty, because what did not happen did not happen - filling it in
    // afterwards invents a plan that the month grid then draws a ratio for
    // and that Review reads back as a week's worth of disagreement. Date keys
    // are YYYY-MM-DD, so this comparison is the app's usual chronological one.
    if (day < from) continue
    const templateId = mapping[weekdayOf(day)]
    if (!templateId) continue
    mapped += 1
    if (!data.days[day]?.templateId) stamps[day] = templateId
  }
  return { stamps, mapped }
}

/** The line the app says after stamping, or instead of it. */
export function weekStampMessage(plan: WeekStampPlan): string {
  const count = Object.keys(plan.stamps).length
  // Not 'every day this week already has a template': since v2.8 the plan
  // starts at the day it is made from, so the days behind you are not
  // counted and may well be empty. What is true either way is that there is
  // nothing left for this press to do.
  if (count === 0) return 'Nothing left to stamp this week.'
  return `${count} ${count === 1 ? 'day' : 'days'} stamped from your weekday plan.`
}
