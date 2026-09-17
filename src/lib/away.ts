import { addDays } from './dates'
import { wakingDayOn } from './shiftDay'
import type { AppData } from './types'

/**
 * Away, across midnight - rotating shifts, stage 4, docs/RESEARCH-SHIFTS.md
 * section 4.5. `DayPlan.away` is a clock time on the day somebody went away
 * on. It stays true past midnight: whoever went away at 22:00 is still away at
 * 00:30, when every reader has moved on to a day with no `away` of its own.
 * So they read it from here, and Back clears it on the date it is written on.
 *
 * Through the night, not for ever: last night's away counts until the day
 * wakes - the end of the sleep it wakes from - after which a new waking day has
 * begun, and an away nobody came back from the day before is not today's.
 */

/** Where the day is away from: today's own away, or last night's. */
export interface AwayMark {
  date: string
  time: string
}

export function awayOn(data: AppData, today: string, nowMinutes: number): AwayMark | undefined {
  const own = data.days[today]?.away
  if (own) return { date: today, time: own }
  const yesterday = addDays(today, -1)
  const lastNight = data.days[yesterday]?.away
  if (!lastNight) return undefined
  const wakes = wakingDayOn(data, today, today).woke?.end ?? 0
  return nowMinutes < wakes ? { date: yesterday, time: lastNight } : undefined
}

/** How the header and Back say it: "22:00", or "22:00 yesterday" after midnight. */
export function awaySince(mark: AwayMark, today: string): string {
  return mark.date === today ? mark.time : `${mark.time} yesterday`
}
