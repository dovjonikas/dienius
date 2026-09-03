import { expect, test } from 'vitest'
import { parseIcs, parseIcsDate, parseIcsDuration } from './ics'

const FROM = '2026-09-01'

function cal(body: string): string {
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`
}

function event(lines: string): string {
  return `BEGIN:VEVENT\r\n${lines}\r\nEND:VEVENT`
}

/**
 * A work calendar is the one feed in this app whose contents nobody controls.
 * Everything here is some version of the same rule: read what is understood,
 * say what was not, and never throw - a parser that dies on the one Tuesday
 * an employer adds an exotic property is a feature that cannot be trusted.
 */

test('a plain meeting comes back with its time and its length', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Standup\r\nDTSTART:20260902T090000\r\nDTEND:20260902T091500')),
    FROM,
  )
  expect(events).toEqual([
    { uid: 'a', summary: 'Standup', date: '2026-09-02', startMinutes: 540, minutes: 15, allDay: false },
  ])
})

test('a length can be stated as a duration instead of an end', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Review\r\nDTSTART:20260902T140000\r\nDURATION:PT1H30M')),
    FROM,
  )
  expect(events[0].minutes).toBe(90)
})

test('an all-day event is marked as one rather than given a fake 00:00 start', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Conference\r\nDTSTART;VALUE=DATE:20260903\r\nDTEND;VALUE=DATE:20260904')),
    FROM,
  )
  expect(events[0]).toMatchObject({ allDay: true, startMinutes: undefined, minutes: undefined })
})

test('the calendar name is picked up when the feed offers one', () => {
  const { name } = parseIcs(cal('X-WR-CALNAME:Work\r\n' + event('UID:a\r\nDTSTART:20260902T090000')), FROM)
  expect(name).toBe('Work')
})

// --- what must not break it ----------------------------------------------

test('something that is not a calendar comes back empty, with a reason', () => {
  const result = parseIcs('<html><body>Sign in</body></html>', FROM)
  expect(result.events).toEqual([])
  expect(result.ignored[0]).toMatch(/calendar/i)
})

test('an empty string is not a crash', () => {
  expect(() => parseIcs('', FROM)).not.toThrow()
  expect(parseIcs('', FROM).events).toEqual([])
})

test('an event with no start is skipped and reported, not guessed at', () => {
  const result = parseIcs(cal(event('UID:a\r\nSUMMARY:Mystery')), FROM)
  expect(result.events).toEqual([])
  expect(result.ignored.join(' ')).toMatch(/no start/i)
})

test('an event with no title still appears, because when it is matters more than what', () => {
  const { events } = parseIcs(cal(event('UID:a\r\nDTSTART:20260902T090000\r\nDTEND:20260902T100000')), FROM)
  expect(events[0].summary).toBe('(no title)')
})

/**
 * RFC 5545 folds long lines with a leading space. Read as separate lines, one
 * meeting becomes a property called " Weekly" - exactly the sort of quiet
 * corruption that makes people stop trusting an import.
 */
test('a folded line is put back together', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Quarterly planning with the\r\n  whole team\r\nDTSTART:20260902T090000')),
    FROM,
  )
  expect(events[0].summary).toBe('Quarterly planning with the whole team')
})

test('a colon inside a quoted parameter does not cut the line in the wrong place', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nATTENDEE;CN="Smith, J:r":mailto:j@example.com\r\nSUMMARY:One to one\r\nDTSTART:20260902T090000')),
    FROM,
  )
  expect(events[0].summary).toBe('One to one')
})

test('escaped commas and newlines are unescaped rather than shown raw', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Lunch\\, then a walk\\nand back\r\nDTSTART:20260902T120000')),
    FROM,
  )
  expect(events[0].summary).toBe('Lunch, then a walk and back')
})

test('properties nobody asked for are simply not read', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Standup\r\nDTSTART:20260902T090000\r\nX-MICROSOFT-CDO-BUSYSTATUS:BUSY\r\nCLASS:PRIVATE\r\nSEQUENCE:3')),
    FROM,
  )
  expect(events).toHaveLength(1)
})

// --- time zones -----------------------------------------------------------

/**
 * An event at 07:00Z is at 10:00 for somebody in Vilnius. Putting it at 07:00
 * would be a lie about their morning, so the Z form goes through the viewer's
 * own clock.
 */
test('a UTC time is converted to the reader own clock', () => {
  const { events } = parseIcs(cal(event('UID:a\r\nSUMMARY:Call\r\nDTSTART:20260902T070000Z\r\nDTEND:20260902T080000Z')), FROM)
  const expected = new Date(Date.UTC(2026, 8, 2, 7, 0, 0))
  expect(events[0].startMinutes).toBe(expected.getHours() * 60 + expected.getMinutes())
})

test('a named zone is read as local, and says so rather than silently shifting', () => {
  const result = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Call\r\nDTSTART;TZID=America/New_York:20260902T090000')),
    FROM,
  )
  expect(result.events[0].startMinutes).toBe(540)
  expect(result.ignored.join(' ')).toMatch(/America\/New_York/)
})

// --- length edge cases ----------------------------------------------------

/**
 * A shift from 22:00 to 06:00 is a real thing to plan around. Left as its
 * arithmetic length it would run 480 minutes past midnight and draw off the
 * bottom of every view in the app.
 */
test('an event that runs past midnight is clipped to the end of its own day', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Night shift\r\nDTSTART:20260902T220000\r\nDTEND:20260903T060000')),
    FROM,
  )
  expect(events[0].minutes).toBe(120)
})

test('an end before its own start leaves the length unstated rather than negative', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Backwards\r\nDTSTART:20260902T140000\r\nDTEND:20260902T130000')),
    FROM,
  )
  expect(events[0].minutes).toBeUndefined()
})

// --- recurrence -----------------------------------------------------------

test('a daily standup appears on every day in view', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Standup\r\nDTSTART:20260901T090000\r\nDTEND:20260901T091500\r\nRRULE:FREQ=DAILY;COUNT=5')),
    FROM,
  )
  expect(events.map(e => e.date)).toEqual([
    '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05',
  ])
})

test('every instance of a series gets its own id, so two fetches do not double it', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Standup\r\nDTSTART:20260901T090000\r\nRRULE:FREQ=DAILY;COUNT=3')),
    FROM,
  )
  expect(new Set(events.map(e => e.uid)).size).toBe(3)
})

test('a weekly meeting lands on its own weekday only', () => {
  // 2026-09-01 is a Tuesday.
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Review\r\nDTSTART:20260901T150000\r\nRRULE:FREQ=WEEKLY;COUNT=3')),
    FROM,
  )
  expect(events.map(e => e.date)).toEqual(['2026-09-01', '2026-09-08', '2026-09-15'])
})

test('BYDAY puts a weekly rule on the days it names', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Gym\r\nDTSTART:20260901T070000\r\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=4')),
    FROM,
  )
  expect(events.map(e => e.date)).toEqual(['2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10'])
})

test('an every-other-week rule skips the weeks in between', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:One to one\r\nDTSTART:20260901T110000\r\nRRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=3')),
    FROM,
  )
  expect(events.map(e => e.date)).toEqual(['2026-09-01', '2026-09-15', '2026-09-29'])
})

test('UNTIL ends the series where it says', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Standup\r\nDTSTART:20260901T090000\r\nRRULE:FREQ=DAILY;UNTIL=20260903T000000Z')),
    FROM,
  )
  expect(events.map(e => e.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
})

/**
 * A meeting shown on the wrong day is worse than one not shown at all, and
 * monthly rules are where a naive expansion gets it wrong - BYSETPOS, an
 * ordinal BYDAY, the month-end cases. Named instead of guessed.
 */
test('a monthly rule is skipped and reported rather than approximated', () => {
  const result = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Board\r\nDTSTART:20260901T090000\r\nRRULE:FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO')),
    FROM,
  )
  expect(result.events).toEqual([])
  expect(result.ignored.join(' ')).toMatch(/monthly/i)
})

test('an unusual day rule is skipped rather than half understood', () => {
  const result = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Board\r\nDTSTART:20260901T090000\r\nRRULE:FREQ=WEEKLY;BYDAY=2MO')),
    FROM,
  )
  expect(result.events).toEqual([])
  expect(result.ignored.join(' ')).toMatch(/unusual/i)
})

// A five-year-old daily standup is a real feed. Expanding all of it would be
// thousands of events nobody will ever look at.
test('a long-running series is only expanded as far as anybody can see', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Standup\r\nDTSTART:20200101T090000\r\nRRULE:FREQ=DAILY')),
    FROM,
    30,
  )
  expect(events).toHaveLength(31)
  expect(events[0].date).toBe(FROM)
  expect(events.at(-1)!.date).toBe('2026-10-01')
})

test('an endless rule cannot spin forever', () => {
  const start = Date.now()
  parseIcs(cal(event('UID:a\r\nSUMMARY:Forever\r\nDTSTART:20260901T090000\r\nRRULE:FREQ=DAILY;COUNT=999999999')), FROM, 30)
  expect(Date.now() - start).toBeLessThan(2000)
})

test('several events in one feed all come through', () => {
  const { events } = parseIcs(
    cal(
      event('UID:a\r\nSUMMARY:One\r\nDTSTART:20260902T090000') +
        '\r\n' +
        event('UID:b\r\nSUMMARY:Two\r\nDTSTART:20260902T110000'),
    ),
    FROM,
  )
  expect(events.map(e => e.summary)).toEqual(['One', 'Two'])
})

// --- the small parsers ----------------------------------------------------

test('a date-time is read in each of the three forms that appear in the wild', () => {
  expect(parseIcsDate('20260903')).toEqual({ date: '2026-09-03', allDay: true })
  expect(parseIcsDate('20260903T091500')).toEqual({ date: '2026-09-03', minutes: 555, allDay: false })
  expect(parseIcsDate('nonsense')).toBeNull()
})

test('a duration is read for the parts a meeting ever uses', () => {
  expect(parseIcsDuration('PT30M')).toBe(30)
  expect(parseIcsDuration('PT1H')).toBe(60)
  expect(parseIcsDuration('P1D')).toBe(1440)
  expect(parseIcsDuration('PT0S')).toBeUndefined()
  expect(parseIcsDuration('nonsense')).toBeUndefined()
})
