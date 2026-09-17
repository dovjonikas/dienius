import { expect, test } from 'vitest'
import { NORTH_EVENING_HOUR, NORTH_MORNING_MS, northLineForDay, northLinesFor, northMoment } from './northLine'
import { isNorthHeading, parseNorth } from './northSections'

/**
 * The one line of North's text the day shows: a line written under a
 * heading - never a heading, a blank line, the introduction or the
 * signature - the same all day and another the next; the lines of a
 * `[morning]` heading only in the three hours after waking, those of an
 * `[evening]` heading only from 21:00, the untagged ones the rest of the
 * day, and the tags themselves never on the screen. Every line here is a
 * generic one.
 */

const TEXT = [
  'An introduction line.',
  'A second introduction line.',
  '',
  'FIRST HEADING',
  'first plain line',
  'second plain line',
  '',
  'third plain line, after a blank line',
  'HEADING FOR WAKING [morning]',
  'first morning line',
  'second morning line',
  'HEADING FOR LATER [evening]',
  'first evening line',
  'SECOND HEADING',
  'fourth plain line',
  'A HEADING WITH NOTHING UNDER IT',
  '---',
  'A signature line.',
].join('\n')

const PLAIN = ['first plain line', 'second plain line', 'third plain line, after a blank line', 'fourth plain line']
const MORNING = ['first morning line', 'second morning line']
const EVENING = ['first evening line']

/** Every date in a stretch, as the day view's keys. */
function dates(from: string, count: number): string[] {
  const out: string[] = []
  const d = new Date(`${from}T12:00:00Z`)
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/** A local moment on the device's clock, for the hour the evening reads. */
const local = (hour: number, minute = 0) => new Date(2026, 8, 16, hour, minute).getTime()
const HOUR = 60 * 60 * 1000

// --- what a line is -----------------------------------------------------------------

test("the day's line is never a heading, a blank line, the introduction or the signature", () => {
  const allowed = new Set([...PLAIN, ...MORNING, ...EVENING])
  const reading = parseNorth(TEXT)
  const forbidden = new Set([
    '',
    ...reading.intro.flatMap(p => p.split('\n')),
    ...reading.signature.flatMap(p => p.split('\n')),
    ...TEXT.split('\n').filter(isNorthHeading),
  ])
  for (const date of dates('2026-01-01', 400)) {
    for (const moment of ['morning', 'evening', 'day'] as const) {
      const line = northLineForDay(TEXT, date, moment)
      expect(line).toBeDefined()
      expect(allowed.has(line!), `${date} ${moment}: ${line}`).toBe(true)
      expect(forbidden.has(line!)).toBe(false)
    }
  }
})

test('every line of a paragraph is a line, and blank lines are not', () => {
  expect(northLinesFor(parseNorth(TEXT), 'day')).toEqual(PLAIN)
  expect(northLinesFor(parseNorth('ONE HEADING\n\n   \nonly line\n\n'), 'day')).toEqual(['only line'])
})

test('a text that is all introduction, or all signature, has no line for the day', () => {
  expect(northLineForDay('Only an introduction.\nAnd a second line of it.', '2026-09-16', 'day')).toBeUndefined()
  expect(northLineForDay('---\nOnly a signature.', '2026-09-16', 'day')).toBeUndefined()
  expect(northLineForDay('', '2026-09-16', 'day')).toBeUndefined()
})

// --- the same day, and the next --------------------------------------------------------

test('the same date gives the same line, and the next date another', () => {
  for (const date of dates('2026-09-01', 60)) {
    expect(northLineForDay(TEXT, date, 'day')).toBe(northLineForDay(TEXT, date, 'day'))
  }
  const days = dates('2026-09-01', 60)
  for (let i = 1; i < days.length; i++) {
    expect(northLineForDay(TEXT, days[i], 'day')).not.toBe(northLineForDay(TEXT, days[i - 1], 'day'))
  }
})

test('the lines are read through in order, one a day, and every one of them comes', () => {
  const seen = new Set(dates('2026-09-01', PLAIN.length).map(date => northLineForDay(TEXT, date, 'day')))
  expect(seen).toEqual(new Set(PLAIN))
})

test('with one line there is one line every day', () => {
  for (const date of dates('2026-09-01', 5)) {
    expect(northLineForDay('ONE HEADING\nthe only line', date, 'day')).toBe('the only line')
  }
})

// --- when --------------------------------------------------------------------------------

test('the three hours after waking are the morning, and not a minute longer', () => {
  const woke = local(7)
  expect(northMoment(woke, woke)).toBe('morning')
  expect(northMoment(woke + NORTH_MORNING_MS - 60_000, woke)).toBe('morning')
  expect(northMoment(woke + NORTH_MORNING_MS, woke)).toBe('day')
  expect(northMoment(woke + 5 * HOUR, woke)).toBe('day')
})

test('waking is read from the gap, not the clock: a sleep through to three in the afternoon wakes at three', () => {
  const woke = local(15)
  expect(northMoment(local(16, 30), woke)).toBe('morning')
  expect(northMoment(local(18, 1), woke)).toBe('day')
})

test('a device that has not seen a waking has no morning', () => {
  expect(northMoment(local(7), null)).toBe('day')
})

test('the evening is from 21:00, and not a minute before', () => {
  expect(NORTH_EVENING_HOUR).toBe(21)
  const wokeLongAgo = local(6)
  expect(northMoment(local(20, 59), wokeLongAgo)).toBe('day')
  expect(northMoment(local(21, 0), wokeLongAgo)).toBe('evening')
  expect(northMoment(local(23, 30), wokeLongAgo)).toBe('evening')
})

test('somebody who has just got up at 20:00 is in their morning at 21:30', () => {
  expect(northMoment(local(21, 30), local(20))).toBe('morning')
})

test("the morning's lines only in the morning, the evening's only in the evening, the untagged the rest of the day", () => {
  for (const date of dates('2026-09-01', 30)) {
    expect(MORNING).toContain(northLineForDay(TEXT, date, 'morning'))
    expect(EVENING).toContain(northLineForDay(TEXT, date, 'evening'))
    expect(PLAIN).toContain(northLineForDay(TEXT, date, 'day'))
  }
})

test('a part of the day with no heading of its own shows the untagged lines, and with none of those it shows no line', () => {
  const untaggedOnly = 'ONE HEADING\na plain line'
  expect(northLineForDay(untaggedOnly, '2026-09-16', 'morning')).toBe('a plain line')
  expect(northLineForDay(untaggedOnly, '2026-09-16', 'evening')).toBe('a plain line')

  const taggedOnly = 'WAKING [morning]\na morning line\nLATER [evening]\nan evening line'
  expect(northLineForDay(taggedOnly, '2026-09-16', 'day')).toBeUndefined()
  expect(northLineForDay(taggedOnly, '2026-09-16', 'morning')).toBe('a morning line')
  expect(northLineForDay(taggedOnly, '2026-09-16', 'evening')).toBe('an evening line')
})

test('the tags are read and never shown: not in a heading, and not in a line', () => {
  const reading = parseNorth(TEXT)
  for (const section of reading.sections) expect(section.heading).not.toMatch(/\[(morning|evening)\]/i)
  for (const date of dates('2026-09-01', 30)) {
    for (const moment of ['morning', 'evening', 'day'] as const) {
      expect(northLineForDay(TEXT, date, moment)).not.toMatch(/\[(morning|evening)\]/i)
    }
  }
})
