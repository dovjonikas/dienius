import type { AppData } from '../../lib/types'
import { weekdayOf } from '../../lib/repeats'

/**
 * What "Stamp week" would do, worked out before it does it.
 *
 * Only days the weekday plan actually names, and only days that have no
 * template yet: stamping over a week somebody has already arranged by hand is
 * not a convenience, it is a loss, and this button is deliberately the
 * one-press kind that has to be safe to press by accident.
 *
 * A plain function rather than a handler so the calendar bar can decide
 * whether to show the button at all (`mapped === 0` means there is nothing it
 * could ever do) and whether to enable it (`stamps` empty means it has already
 * been done), without either of those being a second copy of the rule.
 */
export interface WeekStampPlan {
  /** Date -> template id, for `actions.stamp`. Empty when there is nothing left to do. */
  stamps: Record<string, string>
  /** How many of the days have a template named for their weekday at all. */
  mapped: number
}

export function planWeekStamp(days: string[], data: Pick<AppData, 'days' | 'settings'>): WeekStampPlan {
  const mapping = data.settings.weekdayTemplates
  const stamps: Record<string, string> = {}
  let mapped = 0
  for (const day of days) {
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
  if (count === 0) return 'Every day this week already has a template.'
  return `${count} ${count === 1 ? 'day' : 'days'} stamped from your weekday plan.`
}
