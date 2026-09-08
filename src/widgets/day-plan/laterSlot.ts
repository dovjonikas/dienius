import type { AppData } from '../../lib/types'
import type { Interval } from './capacity'
import { todayKey } from '../../lib/dates'
import { suggestSlot } from './autoSlot'

export interface LaterSlotQuery {
  data: AppData
  /** The day the item is being pulled onto. */
  date: string
  /** The item's size. Absent is unsized, and an unsized item is given half an hour to find room for. */
  minutes?: number
  /** Time an external calendar has already spoken for on that day - see calendars.ts. */
  busy: Interval[]
  /**
   * The clock, as minutes since midnight, if the caller has one. Only
   * honoured on today: on any other day "now" has no honest position, and
   * the answer is the day's first free slot - the same rule quick-add's
   * time control and the grid's time indicator follow.
   */
  nowMinutes?: number
}

/**
 * Where an item pulled out of Later would land on a day: the start of the
 * first free gap that holds it, or `undefined` for a float when the day has
 * no such gap.
 *
 * Its own function because two screens ask the question - the day view's
 * fold and the strip under the week - and a drop on the week used to answer
 * it differently from a press on the day, landing the item with no time at
 * all while its comment promised the next free slot. One piece of
 * arithmetic, the one quick-add's own time control already uses, so a
 * pulled item lands where a typed one would have.
 *
 * Worked out at the moment of the press rather than shown on the row: a
 * list that displays a time for every line has quietly become a plan for a
 * day nobody made.
 */
export function nextSlotFor({ data, date, minutes, busy, nowMinutes }: LaterSlotQuery): string | undefined {
  const day = data.days[date]
  const template = day?.templateId ? data.templates.find(t => t.id === day.templateId) : undefined
  return suggestSlot({
    tasks: day?.tasks ?? [],
    durationMinutes: minutes ?? 30,
    busy,
    sleepProfileId: day?.sleepProfileId ?? template?.sleepProfileId,
    sleep: { profiles: data.settings.sleepProfiles },
    notBefore: date === todayKey() ? nowMinutes : undefined,
  })
}
