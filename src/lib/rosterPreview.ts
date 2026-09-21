import { weekOf } from './dates'
import { isDayKind, kindOnDate } from './dayKinds'
import { handEdits, rosterApplied, type Following, type HandEdits } from './shiftDay'
import type { AppData, Template } from './types'

/**
 * What applying a roster would do, before it is done - rotating shifts, since
 * v2.29, and docs/RESEARCH-SHIFTS.md section 6.1.
 *
 * A rota is a month at a time, and applying one rewrites days that already
 * hold something. So Apply says first, week by week: the letter each date
 * would get, how many routines would land with no time, how many would run
 * into a shift or sleep, and which days were changed by hand. A date whose
 * kind and composition would not change is counted and not listed - a preview
 * that lists thirty unchanged days hides the three that matter.
 *
 * It is read from `rosterApplied`, the function `applyRoster` is, so what it
 * promises is what Apply writes - the days that follow the draft included
 * (section 10.2a): a night's hours on the morning after it, and the routines
 * of the dates around a changed kind. Nothing here touches the plan.
 */

/** One date in the preview: what it would become, and what it would cost. */
export interface RosterPreviewDate {
  date: string
  /** The letter it would carry, absent where the roster takes the kind off. */
  letter?: string
  /** The kind it would become, absent for no kind. */
  kind?: Template
  /** Routines that would land with no time, because the kind has none for them. */
  needsTime: number
  /** Routines that would land with no time because their time is not free. */
  runsInto: number
  /** What was changed by hand on the date as it stands, when there is any. */
  hand?: HandEdits
}

/** A week of the preview, and the three numbers the week is read by. */
export interface RosterPreviewWeek {
  /** The Monday the week starts on. */
  from: string
  dates: RosterPreviewDate[]
  needsTime: number
  runsInto: number
  handEdited: number
}

export interface RosterPreview {
  weeks: RosterPreviewWeek[]
  /** How many dates would change. */
  changing: number
  /** How many dates the draft holds that would change nothing. */
  unchanged: number
  /**
   * The dates that would change without being the draft's to change: the day
   * after a night that changes, and the dates around a changed kind whose
   * routines move - each with the dates of the draft that move it.
   */
  following: Following[]
}

const counted = (hand: HandEdits) => hand.done + hand.moved + hand.deleted

export function rosterPreview(data: AppData, draft: Record<string, string | null>, today: string): RosterPreview {
  // Apply's own reading of the draft: a date behind today is not in reach, and
  // an id that names no kind any more leaves its date alone - and neither is
  // counted here at all.
  const applied = rosterApplied(data, draft, today)
  const following = applied.following
  const reached = Object.keys(draft).filter(date => {
    if (date < today) return false
    const id = draft[date]
    return id === null || applied.plan.templates.some(t => t.id === id && isDayKind(t))
  })
  const unchanged = reached.filter(date => !applied.composed.some(c => c.date === date) && !following.some(f => f.date === date)).length

  const weeks = new Map<string, RosterPreviewWeek>()
  const changing = applied.composed.length

  for (const { date, kind, placements } of applied.composed) {

    const entry: RosterPreviewDate = {
      date,
      letter: kind?.dayKind?.letter,
      kind,
      needsTime: placements.filter(p => 'reason' in p && p.reason === 'needs-time').length,
      runsInto: placements.filter(p => 'reason' in p && p.reason !== 'needs-time').length,
    }
    // What was changed by hand is asked about the day as it stands, not the day
    // it would become - section 6.3. A date with no kind yet has nothing of a
    // kind's to have changed.
    const hand = kindOnDate(data, date) ? handEdits(data, date) : undefined
    if (hand && counted(hand) > 0) entry.hand = hand

    const from = weekOf(date)[0]
    const week = weeks.get(from) ?? { from, dates: [], needsTime: 0, runsInto: 0, handEdited: 0 }
    week.dates.push(entry)
    week.needsTime += entry.needsTime
    week.runsInto += entry.runsInto
    if (entry.hand) week.handEdited++
    weeks.set(from, week)
  }

  return { weeks: [...weeks.values()].sort((a, b) => a.from.localeCompare(b.from)), changing, unchanged, following }
}
