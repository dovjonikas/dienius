import { expect, test } from 'vitest'
import { parseIcs } from './ics'

// Lithuania's clock, whose offset to UTC changes twice a year - the case
// this file is about.
process.env.TZ = 'Europe/Vilnius'

function cal(body: string): string {
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`
}

/**
 * A weekly night shift written in UTC, 21:30Z to 05:30Z. In January that is
 * 23:30 to 07:30 here, cut at midnight to half an hour; in July it is 00:30
 * to 08:30, the whole shift inside one date. The cut was worked out once,
 * on the first occurrence, and given to every repeat - so the July shift was
 * a half-hour stub and the morning it runs into looked free.
 */
test('each repeat of an event is cut at its own midnight, not at the first one', () => {
  const { events } = parseIcs(
    cal(
      [
        'BEGIN:VEVENT',
        'UID:shift',
        'SUMMARY:Night shift',
        'DTSTART:20260105T213000Z',
        'DTEND:20260106T053000Z',
        'RRULE:FREQ=WEEKLY',
        'END:VEVENT',
      ].join('\r\n'),
    ),
    '2026-07-01',
  )
  const july = events.find(e => e.date === '2026-07-07')
  expect(july).toMatchObject({ startMinutes: 30, minutes: 480 })

  const winter = parseIcs(
    cal(
      [
        'BEGIN:VEVENT',
        'UID:shift',
        'SUMMARY:Night shift',
        'DTSTART:20260105T213000Z',
        'DTEND:20260106T053000Z',
        'RRULE:FREQ=WEEKLY',
        'END:VEVENT',
      ].join('\r\n'),
    ),
    '2026-01-05',
  ).events.find(e => e.date === '2026-01-05')
  expect(winter).toMatchObject({ startMinutes: 23 * 60 + 30, minutes: 30 })
})
