import type { AppData, DayPlan } from './types'
import { materialiseRepeats, weekdayOf } from './repeats'
import { addWithoutDuplicates } from './taskIdentity'
import { applyStamps } from './stamping'

/**
 * Everything a day gets on its own, as a pure function of the state.
 *
 * Until Replan v2 this lived inside `actions.ensureDay`, and ran in exactly
 * one situation: a day being opened. An interruption landing on Thursday
 * from Tuesday's phone call is the second caller: Accept has to put the plan
 * onto the Thursday that will exist, not onto an empty record the weekday
 * template then stamps over the moment Thursday is opened, so `applyReplan`
 * runs this first and applies on top, in one commit. The arithmetic is here
 * so both actions commit the same answer.
 *
 * The sheet itself does not preview through this. It tried: a preview
 * stamps its own copy of the template, with its own task ids, and a plan
 * made against that copy names tasks the committed day does not have. So
 * choosing a day in the sheet opens it, through the action, exactly as
 * looking at it would - idempotent, and what the weekday map promised for
 * that day anyway.
 *
 * Two things, once, and `autoApplied` so it never does them again for that
 * day: the template its weekday maps to, unless the day already carries a
 * `templateId` - a deliberate stamp outranks a standing rule, always - and
 * the instances every repeating task owes it. Returns null for a day that
 * has already been through this, so a caller can tell "nothing to do" from
 * "did it, and it changed nothing".
 */
export interface EnsuredDay {
  days: Record<string, DayPlan>
  /** A template was stamped or a repeat instance added - the same answer the action returns. */
  changed: boolean
}

export function ensuredDay(data: AppData, date: string): EnsuredDay | null {
  const existing = data.days[date]
  if (existing?.autoApplied) return null

  const mapped = data.settings.weekdayTemplates[weekdayOf(date)]
  const template = mapped ? data.templates.find(t => t.id === mapped) : undefined
  // A day that already carries a templateId was stamped on purpose - by
  // hand, or from the calendar - and the weekday map does not get to argue
  // with it.
  const shouldStamp = !!template && !existing?.templateId

  let days = data.days
  if (shouldStamp) {
    days = applyStamps(days, data.templates, { [date]: template.id }, data.library)
  }

  const base = days[date] ?? { date, tasks: [] }
  const { tasks, added } = materialiseRepeats(days, date, base.tasks)
  // The one guard everything that adds to a day goes through - see
  // taskIdentity.ts. Generation is already idempotent on its own; this is
  // the belt to that pair of braces, and the thing that catches a series
  // whose instance arrived by being pushed rather than generated.
  const guarded = addWithoutDuplicates(base.tasks, tasks.slice(base.tasks.length))

  return {
    days: { ...days, [date]: { ...base, tasks: guarded, autoApplied: true } },
    changed: shouldStamp || added,
  }
}
