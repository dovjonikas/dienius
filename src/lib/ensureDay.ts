import type { AppData, DayPlan } from './types'
import { addDays, todayKey } from './dates'
import { materialiseRepeats, weekdayOf } from './repeats'
import { addWithoutDuplicates } from './taskIdentity'
import { applyStamps, columnFor, isNightBlock, refreshFromTemplate } from './stamping'
import { isDayKind, kindOnDate } from './dayKinds'
import { composeDay, followNeighbours } from './shiftDay'

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

/**
 * @param today The day the person is standing on. An argument rather than a
 * `todayKey()` read inside, so a test can say which day that is instead of
 * asking the wall clock and hoping - a fixture dated as a literal passes
 * until the morning that date goes by. Both callers pass nothing, because for
 * both of them it really is today: the day view opens the day on screen, and
 * the replan sheet opens the day somebody chose in it.
 */
export function ensuredDay(data: AppData, date: string, today: string = todayKey()): EnsuredDay | null {
  // Last night's hours arrive with the night - section 10.2a of
  // RESEARCH-SHIFTS. The date before, where the weekday map is about to give
  // it a template with hours after its midnight and nobody has opened it yet,
  // is opened first, so its night is on this date whichever of the two is
  // opened first. The one date before, today or ahead, and no further: that
  // date's own night-before is its own open's to bring.
  const before = addDays(date, -1)
  const night = before >= today && nightWaits(data, before) ? ensuredOne(data, before, today) : null
  const own = ensuredOne(night ? { ...data, days: night.days } : data, date, today)
  if (!night) return own
  return own ? { days: own.days, changed: true } : { days: night.days, changed: true }
}

/**
 * Whether a date nobody has opened will be given a template by the weekday
 * map that puts hours on the date after it.
 */
function nightWaits(data: AppData, date: string): boolean {
  const day = data.days[date]
  if (day?.autoApplied || day?.templateId) return false
  const mapped = data.settings.weekdayTemplates[weekdayOf(date)]
  const template = mapped ? data.templates.find(t => t.id === mapped) : undefined
  return !!template && columnFor(template, date).blocks.some(isNightBlock)
}

/** One date, opened - the whole of what `ensuredDay` did before a night could wait on the date before. */
function ensuredOne(data: AppData, date: string, today: string): EnsuredDay | null {
  const existing = data.days[date]

  /**
   * The one repair that runs on every open, including a day that has been
   * through here before.
   *
   * Everything else on this function happens once - `autoApplied` is the
   * flag that says so, and it is what stops a day being re-stamped every
   * time somebody looks at it. A library binding cannot work that way: it
   * resolves to whatever is next in a list, and a list changes after the
   * stamp far more often than before it. See refreshFromTemplate.
   *
   * Today and the days ahead only. A day that has been lived says what was
   * on it.
   */
  const rebound = existing && date >= today ? refreshFromTemplate(existing, data.templates, data.library) : null
  const withRebind = rebound ? { ...data.days, [date]: rebound } : data.days

  if (existing?.autoApplied) return rebound ? { days: withRebind, changed: true } : null

  const mapped = data.settings.weekdayTemplates[weekdayOf(date)]
  const template = mapped ? data.templates.find(t => t.id === mapped) : undefined
  // A day that already carries a templateId was stamped on purpose - by
  // hand, or from the calendar - and the weekday map does not get to argue
  // with it.
  //
  // Nor does the map reach backwards. Scrolling back to look at a Friday
  // nobody opened is not a reason to fill it in: a plan stamped onto a day
  // that was already over is a plan nobody made, and the month grid draws it
  // a ratio and Review counts it in "where the plan and the week disagreed"
  // as though it had been. Repeats are the other promise on this function and
  // are deliberately left alone - a series that was running was running, and
  // that is a fact about the day rather than an invention.
  const shouldStamp = !!template && !existing?.templateId && date >= today

  let days = withRebind
  if (shouldStamp) {
    // A kind of day is composed, not stamped: the map is one of the doors a
    // kind arrives through, and a kind without its routines is half a day -
    // docs/RESEARCH-SHIFTS.md section 6.2.
    if (isDayKind(template)) {
      const composing = { ...data, days }
      const composed = composeDay(composing, date, template, on => kindOnDate(composing, on), today)
      days = { ...days, [date]: composed.day, ...(composed.nextDay ? { [addDays(date, 1)]: composed.nextDay } : {}) }
      // A kind reaches the dates around it, and every door says so - section 10.2a.
      days = followNeighbours({ ...data, days }, [date], today).days
    } else {
      days = applyStamps(days, data.templates, { [date]: template.id }, data.library)
    }
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
