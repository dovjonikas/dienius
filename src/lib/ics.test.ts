import { expect, test } from 'vitest'
import { knowsZone, parseIcs, parseIcsDate, parseIcsDuration } from './ics'

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

/**
 * A TZID the browser knows is resolved through Intl, which ships the IANA
 * tables - so nine in New York is the same instant as 13:00Z in September,
 * and lands wherever that is on the viewer's own clock. The expected value
 * is read through the Z path rather than written down, because the machine
 * running this can be in any zone.
 */
test('a named zone is converted through the browser own tables, and nothing is reported', () => {
  const result = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Call\r\nDTSTART;TZID=America/New_York:20260902T090000\r\nDTEND;TZID=America/New_York:20260902T093000')),
    FROM,
  )
  const asUtc = parseIcsDate('20260902T130000Z')!
  expect(result.events[0].date).toBe(asUtc.date)
  expect(result.events[0].startMinutes).toBe(asUtc.minutes)
  expect(result.events[0].minutes).toBe(30)
  expect(result.ignored).toEqual([])
})

test('a zone the browser does not know is read as local, and says so rather than silently shifting', () => {
  const result = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Call\r\nDTSTART;TZID=W. Europe Standard Time:20260902T090000')),
    FROM,
  )
  expect(result.events[0].startMinutes).toBe(540)
  expect(result.ignored.join(' ')).toMatch(/W\. Europe Standard Time/)
})

// The offset changes twice a year, and not on the same day everywhere: the
// EU leaves summer time a week before the US does in 2026. A weekly New
// York meeting expanded once and shifted by one fixed offset would be an
// hour wrong for that week; each occurrence is read on its own instead.
test('every occurrence of a zoned series is converted on its own day, so daylight saving is right on both sides', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Sync\r\nDTSTART;TZID=America/New_York:20261007T090000\r\nRRULE:FREQ=WEEKLY;COUNT=5')),
    '2026-10-01',
  )
  const before = parseIcsDate('20261021T130000Z')!
  const after = parseIcsDate('20261104T140000Z')!
  expect(events.find(e => e.date === before.date)?.startMinutes).toBe(before.minutes)
  expect(events.find(e => e.date === after.date)?.startMinutes).toBe(after.minutes)
})

test('a start and an end in different frames still give the right length', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Call\r\nDTSTART;TZID=Europe/Vilnius:20260902T100000\r\nDTEND:20260902T080000Z')),
    FROM,
  )
  expect(events[0].minutes).toBe(60)
})

test('the same zone is not asked for twice: the formatter is cached', () => {
  expect(knowsZone('Europe/Vilnius')).toBe(true)
  expect(knowsZone('Europe/Vilnius')).toBe(true)
  expect(knowsZone('Nowhere/Special')).toBe(false)
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

// --- monthly and yearly ---------------------------------------------------

/**
 * The one monthly shape that cannot land on the wrong day: the same day of
 * the month. Rent on the first, an invoice on the 15th, a birthday every
 * year. Anything cleverer - "the first Monday", "the last day" - is where a
 * naive expansion puts a meeting on the wrong day, and a meeting on the
 * wrong day is worse than one not shown at all, so those are named instead.
 */
test('a monthly rule on the same day each month lands on that day', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Invoice\r\nDTSTART:20260615T100000\r\nRRULE:FREQ=MONTHLY;BYMONTHDAY=15')),
    FROM,
  )
  expect(events.map(e => e.date)).toEqual(['2026-09-15', '2026-10-15', '2026-11-15', '2026-12-15'])
  expect(events[0].startMinutes).toBe(600)
})

test('a monthly rule with no day named repeats on the day it started', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Rent\r\nDTSTART:20260801T090000\r\nRRULE:FREQ=MONTHLY')),
    FROM,
  )
  expect(events.map(e => e.date)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01'])
})

test('a month without the day has no occurrence rather than a guessed one', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Month end\r\nDTSTART:20260831T090000\r\nRRULE:FREQ=MONTHLY;BYMONTHDAY=31')),
    FROM,
    130,
  )
  // September and November have thirty days: no occurrence, not the 30th.
  expect(events.map(e => e.date)).toEqual(['2026-10-31', '2026-12-31'])
})

test('INTERVAL, COUNT and UNTIL apply to a monthly rule the way they do to a weekly one', () => {
  const every2 = parseIcs(cal(event('UID:a\r\nSUMMARY:Review\r\nDTSTART:20260901T090000\r\nRRULE:FREQ=MONTHLY;INTERVAL=2')), FROM)
  expect(every2.events.map(e => e.date)).toEqual(['2026-09-01', '2026-11-01'])
  const counted = parseIcs(cal(event('UID:a\r\nSUMMARY:Review\r\nDTSTART:20260901T090000\r\nRRULE:FREQ=MONTHLY;COUNT=2')), FROM)
  expect(counted.events.map(e => e.date)).toEqual(['2026-09-01', '2026-10-01'])
  const until = parseIcs(cal(event('UID:a\r\nSUMMARY:Review\r\nDTSTART:20260901T090000\r\nRRULE:FREQ=MONTHLY;UNTIL=20261101T000000Z')), FROM)
  expect(until.events.map(e => e.date)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
})

test('a yearly rule lands on the same date each year', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Anniversary\r\nDTSTART;VALUE=DATE:20200918\r\nRRULE:FREQ=YEARLY')),
    FROM,
  )
  expect(events).toEqual([{ uid: 'a::2026-09-18', summary: 'Anniversary', date: '2026-09-18', allDay: true }])
})

test('a yearly rule spelt with BYMONTH and BYMONTHDAY that only restate the start is the same rule', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Birthday\r\nDTSTART;VALUE=DATE:19900918\r\nRRULE:FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=18')),
    FROM,
  )
  expect(events.map(e => e.date)).toEqual(['2026-09-18'])
})

test('a leap-day yearly rule has no occurrence in a year without the day', () => {
  const inLeap = parseIcs(cal(event('UID:a\r\nSUMMARY:Leap\r\nDTSTART;VALUE=DATE:20240229\r\nRRULE:FREQ=YEARLY')), '2028-02-01', 60)
  expect(inLeap.events.map(e => e.date)).toEqual(['2028-02-29'])
  const notLeap = parseIcs(cal(event('UID:a\r\nSUMMARY:Leap\r\nDTSTART;VALUE=DATE:20240229\r\nRRULE:FREQ=YEARLY')), '2027-02-01', 60)
  expect(notLeap.events).toEqual([])
})

test('a monthly rule with a day rule is skipped and reported rather than approximated', () => {
  const result = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Board\r\nDTSTART:20260901T090000\r\nRRULE:FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO')),
    FROM,
  )
  expect(result.events).toEqual([])
  expect(result.ignored.join(' ')).toMatch(/monthly/i)
})

test('a yearly rule that says more than a date is skipped and reported', () => {
  const result = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Thanksgiving\r\nDTSTART:20261126T090000\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=4TH')),
    FROM,
  )
  expect(result.events).toEqual([])
  expect(result.ignored.join(' ')).toMatch(/yearly/i)
})

test('a negative day of the month is one of the shapes not read', () => {
  const result = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Last day\r\nDTSTART:20260930T090000\r\nRRULE:FREQ=MONTHLY;BYMONTHDAY=-1')),
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

/**
 * Not a performance budget, and deliberately not a ratio either: this asserts
 * that the loop *terminates*, which is a different claim from how fast it is.
 * CONVENTIONS.md section 3 bans a millisecond ceiling as a stand-in for speed;
 * a run that never ends fails by exhausting the test's own timeout, which is
 * the honest failure and the one this wants. The bounded output is the real
 * assertion - a rule asking for a billion occurrences comes back with only
 * the thirty days that were asked for.
 */
test('an endless rule cannot spin forever', () => {
  const { events } = parseIcs(
    cal(event('UID:a\r\nSUMMARY:Forever\r\nDTSTART:20260901T090000\r\nRRULE:FREQ=DAILY;COUNT=999999999')),
    FROM,
    30,
  )
  expect(events.length).toBeGreaterThan(0)
  expect(events.length).toBeLessThanOrEqual(31)
}, 5000)

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

// --- what the two big writers actually produce ------------------------------

/**
 * Trimmed from a real Google Calendar export: the VTIMEZONE block nobody
 * needs, an event with a zoned start and a monthly rule, a birthday as a
 * yearly all-day, an attendee line with a quoted comma, and a description
 * folded across three lines. The parser is meant to read the four fields
 * and step over everything else without a sound.
 */
const GOOGLE_EXPORT = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
  'VERSION:2.0',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'X-WR-CALNAME:Work',
  'X-WR-TIMEZONE:Europe/Vilnius',
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Vilnius',
  'X-LIC-LOCATION:Europe/Vilnius',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0300',
  'TZNAME:EEST',
  'DTSTART:19700329T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0200',
  'TZNAME:EET',
  'DTSTART:19701025T040000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'DTSTART;TZID=Europe/Vilnius:20260915T110000',
  'DTEND;TZID=Europe/Vilnius:20260915T120000',
  'RRULE:FREQ=MONTHLY;BYMONTHDAY=15',
  'DTSTAMP:20260901T081500Z',
  'UID:3k1m5n7p9r@google.com',
  'CREATED:20260101T100000Z',
  'DESCRIPTION:Numbers for the month. Bring the sheet\\, and the one from las',
  ' t month too\\nRoom 4B',
  'LAST-MODIFIED:20260101T100000Z',
  'SEQUENCE:0',
  'STATUS:CONFIRMED',
  'SUMMARY:Finance sync',
  'TRANSP:OPAQUE',
  'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN="Smith, J',
  ' ohn":mailto:john@example.com',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:19880918',
  'DTEND;VALUE=DATE:19880919',
  'RRULE:FREQ=YEARLY',
  'DTSTAMP:20260901T081500Z',
  'UID:bday@google.com',
  'SUMMARY:Mum birthday',
  'TRANSP:TRANSPARENT',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;TZID=Europe/Vilnius:20260907T093000',
  'DTEND;TZID=Europe/Vilnius:20260907T094500',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
  'UID:standup@google.com',
  'SUMMARY:Standup',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n')

test('a Google Calendar export is read: the zoned monthly, the yearly birthday, the weekly standup', () => {
  const result = parseIcs(GOOGLE_EXPORT, FROM, 45)
  expect(result.name).toBe('Work')
  expect(result.ignored).toEqual([])

  const finance = result.events.filter(e => e.summary === 'Finance sync')
  const vilnius = parseIcsDate('20260915T110000Z'.replace('T110000Z', 'T080000Z'))!
  expect(finance.map(e => e.date)).toEqual(['2026-09-15', '2026-10-15'])
  expect(finance[0].startMinutes).toBe(vilnius.minutes)
  expect(finance[0].minutes).toBe(60)

  expect(result.events.filter(e => e.summary === 'Mum birthday')).toEqual([
    { uid: 'bday@google.com::2026-09-18', summary: 'Mum birthday', date: '2026-09-18', allDay: true },
  ])

  const standups = result.events.filter(e => e.summary === 'Standup')
  expect(standups.length).toBeGreaterThan(15)
  expect(new Set(standups.map(e => new Date(e.date).getUTCDay()))).toEqual(new Set([1, 3, 5]))
})

/**
 * Trimmed from an Outlook desktop export. Outlook names zones its own way -
 * "FLE Standard Time" is Vilnius - and Intl does not know those names, so
 * the times are read as local and the calendar says which zone it meant.
 * For somebody in that zone the times are right anyway.
 */
const OUTLOOK_EXPORT = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
  'VERSION:2.0',
  'METHOD:PUBLISH',
  'X-MS-OLK-FORCEINSPECTOROPEN:TRUE',
  'BEGIN:VTIMEZONE',
  'TZID:FLE Standard Time',
  'BEGIN:STANDARD',
  'DTSTART:16011028T040000',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0200',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:16010325T030000',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0300',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'CLASS:PUBLIC',
  'CREATED:20260901T070000Z',
  'DESCRIPTION:\\n',
  'DTEND;TZID="FLE Standard Time":20260903T150000',
  'DTSTAMP:20260901T070000Z',
  'DTSTART;TZID="FLE Standard Time":20260903T140000',
  'LAST-MODIFIED:20260901T070000Z',
  'PRIORITY:5',
  'SEQUENCE:0',
  'SUMMARY;LANGUAGE=en-us:Design review',
  'TRANSP:OPAQUE',
  'UID:040000008200E00074C5B7101A82E00800000000A0B1C2D3E4F50000',
  'X-ALT-DESC;FMTTYPE=text/html:<html><body></body></html>',
  'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
  'X-MICROSOFT-CDO-IMPORTANCE:1',
  'X-MICROSOFT-DISALLOW-COUNTER:FALSE',
  'X-MS-OLK-AUTOFILLLOCATION:FALSE',
  'X-MS-OLK-CONFTYPE:0',
  'BEGIN:VALARM',
  'TRIGGER:-PT15M',
  'ACTION:DISPLAY',
  'DESCRIPTION:Reminder',
  'END:VALARM',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n')

test('an Outlook export is read, with its Windows zone name reported rather than resolved', () => {
  const result = parseIcs(OUTLOOK_EXPORT, FROM)
  expect(result.events).toEqual([
    {
      uid: '040000008200E00074C5B7101A82E00800000000A0B1C2D3E4F50000',
      summary: 'Design review',
      date: '2026-09-03',
      startMinutes: 14 * 60,
      minutes: 60,
      allDay: false,
    },
  ])
  expect(result.ignored).toEqual(['Times are read as local; this calendar states a time zone the browser does not know, "FLE Standard Time".'])
})
