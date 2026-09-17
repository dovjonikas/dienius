import { dayNumber } from './north'
import { parseNorth, type NorthReading } from './northSections'

/**
 * The one line of North's text the day shows.
 *
 * ## One line, from under a heading
 *
 * The day's top carries a single line of the person's own text: a line
 * written under one of the headings. Never a heading - a heading names what
 * the lines under it are about, and read alone it is a label - never a blank
 * line, and never the introduction, which is read whole, once, after sleep
 * and on the page. Not the signature either: the signature stands under the
 * line on its own, always. A paragraph under a heading gives each of its
 * lines, because a line is what was written on a line.
 *
 * ## The same line all day, another tomorrow
 *
 * Deterministic from the date, like the goal and the rule the day used to
 * show (lib/north.ts): every device shows the same line on the same day, and
 * a reload never re-rolls it. The lines are taken in the order they are
 * written, one a day, so a text of twelve lines is read through in twelve
 * days and a line never shows two days running while there is another.
 *
 * ## When: after waking, the evening, and the rest of the day
 *
 * A heading that ends on `[morning]` lends its lines to the first three
 * hours after waking, and only to them; one that ends on `[evening]` lends
 * its lines to the day from 21:00, and only to that. The rest of the day
 * shows the lines of the headings with no tag. Waking is read the way the
 * window after sleep reads it - the first time the app is in view after five
 * hours out of view (lib/northRead.ts) - so a night shift slept through to
 * three in the afternoon wakes at three. A morning that runs past 21:00 is
 * still the morning: somebody who has just got up reads the lines for
 * getting up.
 *
 * Where the part of the day has no lines of its own - a morning with no
 * `[morning]` heading - the untagged lines stand in. Where there are none of
 * those either, the day shows no line: a line from another part of the day
 * would be the one thing the tag was written to prevent.
 *
 * The tags are read here and in lib/northSections.ts and shown nowhere.
 */

/** Which part of the day the line is for. */
export type NorthMoment = 'morning' | 'evening' | 'day'

/** How long after waking the morning's lines stay on the day. */
export const NORTH_MORNING_MS = 3 * 60 * 60 * 1000

/** The hour, on the device's clock, the evening's lines come on. */
export const NORTH_EVENING_HOUR = 21

/**
 * Which part of the day it is at `now`, for somebody who last woke at
 * `wokeAt` - both epoch milliseconds, the hour read on the local clock. A
 * device that has not seen a waking yet has no morning.
 */
export function northMoment(now: number, wokeAt: number | null): NorthMoment {
  if (wokeAt !== null && now >= wokeAt && now - wokeAt < NORTH_MORNING_MS) return 'morning'
  if (new Date(now).getHours() >= NORTH_EVENING_HOUR) return 'evening'
  return 'day'
}

/**
 * Every line written under a heading for this part of the day, in the order
 * written: under the headings tagged for it in the morning and the evening,
 * under the untagged headings the rest of the day. Blank lines are not lines.
 */
export function northLinesFor(reading: NorthReading, moment: NorthMoment): string[] {
  const lines: string[] = []
  for (const section of reading.sections) {
    const wanted = moment === 'day' ? section.tag === undefined : section.tag === moment
    if (!wanted) continue
    for (const paragraph of section.paragraphs) {
      for (const line of paragraph.split('\n')) {
        const t = line.trim()
        if (t) lines.push(t)
      }
    }
  }
  return lines
}

/**
 * The line the day shows on `date` at this part of the day, or nothing when
 * the text has no line for it - see above for where the untagged lines
 * stand in.
 */
export function northLineForDay(text: string, date: string, moment: NorthMoment): string | undefined {
  const reading = parseNorth(text)
  let lines = northLinesFor(reading, moment)
  if (lines.length === 0 && moment !== 'day') lines = northLinesFor(reading, 'day')
  if (lines.length === 0) return undefined
  const n = dayNumber(date) % lines.length
  return lines[n < 0 ? n + lines.length : n]
}
