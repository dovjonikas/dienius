import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  absorb,
  busyIntervals,
  clearCalendarCache,
  dropCalendarEntry,
  eventsOn,
  formatFetchedAt,
  getCalendarCache,
  putCalendarEntry,
  refreshCalendar,
  subscriptionBlocker,
} from './calendars'
import { resetSyncForTests, setSyncConfig } from './syncClient'
import type { CalendarSubscription } from './types'

const DATE = '2026-09-02'

function sub(over: Partial<CalendarSubscription> = {}): CalendarSubscription {
  return { id: 'c1', name: 'Work', url: 'https://example.com/x.ics', color: '#a7c4f5', enabled: true, ...over }
}

function cal(body: string): string {
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`
}

beforeEach(() => {
  localStorage.clear()
  clearCalendarCache()
  resetSyncForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetSyncForTests()
})

/**
 * The cache is deliberately local and deliberately disposable - see
 * calendars.ts. What these pin is the part that is not: a feed that goes wrong
 * must never take the day with it.
 */

test('events land on their own day, in the order they start', () => {
  putCalendarEntry('c1', {
    events: [
      { uid: 'b', summary: 'Later', date: DATE, startMinutes: 660, minutes: 30, allDay: false },
      { uid: 'a', summary: 'Earlier', date: DATE, startMinutes: 540, minutes: 30, allDay: false },
      { uid: 'c', summary: 'Another day', date: '2026-09-03', startMinutes: 540, allDay: false },
    ],
  })
  expect(eventsOn(DATE, [sub()]).map(e => e.summary)).toEqual(['Earlier', 'Later'])
})

// "You are at a conference today" is the frame the rest of the day sits inside,
// not a thing that happens at a time within it.
test('an all-day event sorts above everything with a time', () => {
  putCalendarEntry('c1', {
    events: [
      { uid: 'a', summary: 'Standup', date: DATE, startMinutes: 540, minutes: 15, allDay: false },
      { uid: 'b', summary: 'Conference', date: DATE, allDay: true },
    ],
  })
  expect(eventsOn(DATE, [sub()]).map(e => e.summary)).toEqual(['Conference', 'Standup'])
})

test('a calendar switched off contributes nothing at all', () => {
  putCalendarEntry('c1', {
    events: [{ uid: 'a', summary: 'Standup', date: DATE, startMinutes: 540, minutes: 15, allDay: false }],
  })
  expect(eventsOn(DATE, [sub({ enabled: false })])).toEqual([])
  expect(busyIntervals(DATE, [sub({ enabled: false })])).toEqual([])
})

test('each event carries the colour and name of the calendar it came from', () => {
  putCalendarEntry('c1', {
    events: [{ uid: 'a', summary: 'Standup', date: DATE, startMinutes: 540, minutes: 15, allDay: false }],
  })
  expect(eventsOn(DATE, [sub()])[0]).toMatchObject({ color: '#a7c4f5', calendarName: 'Work', calendarId: 'c1' })
})

test('no calendars at all is not an error, it is an empty day', () => {
  expect(eventsOn(DATE, undefined)).toEqual([])
  expect(busyIntervals(DATE, undefined)).toEqual([])
})

/**
 * "At a conference" does not mean every minute is booked. Counting an all-day
 * event as busy would report zero free time on a day somebody can still plan
 * an evening in.
 */
test('an all-day event does not eat the whole day of free time', () => {
  putCalendarEntry('c1', { events: [{ uid: 'a', summary: 'Conference', date: DATE, allDay: true }] })
  expect(busyIntervals(DATE, [sub()])).toEqual([])
})

test('a timed event becomes exactly the interval it occupies', () => {
  putCalendarEntry('c1', {
    events: [{ uid: 'a', summary: 'Standup', date: DATE, startMinutes: 540, minutes: 15, allDay: false }],
  })
  expect(busyIntervals(DATE, [sub()])).toEqual([{ start: 540, end: 555 }])
})

test('an event with no stated length still takes up a plausible amount of time', () => {
  putCalendarEntry('c1', {
    events: [{ uid: 'a', summary: 'Standup', date: DATE, startMinutes: 540, allDay: false }],
  })
  expect(busyIntervals(DATE, [sub()])).toEqual([{ start: 540, end: 570 }])
})

// --- the cache ------------------------------------------------------------

test('the cache survives a reload, because a feed is not refetched on every render', () => {
  putCalendarEntry('c1', { events: [{ uid: 'a', summary: 'Standup', date: DATE, allDay: true }], fetchedAt: 'x' })
  expect(JSON.parse(localStorage.getItem('dienius:calendars')!).c1.events).toHaveLength(1)
})

test('removing a calendar takes its events with it', () => {
  putCalendarEntry('c1', { events: [{ uid: 'a', summary: 'Standup', date: DATE, allDay: true }] })
  dropCalendarEntry('c1')
  expect(getCalendarCache().c1).toBeUndefined()
})

test('a corrupt cache reads as no cache rather than throwing on boot', () => {
  localStorage.setItem('dienius:calendars', 'not json')
  clearCalendarCache()
  expect(getCalendarCache()).toEqual({})
})

// --- absorbing a feed -----------------------------------------------------

test('a good feed replaces what was there and records when', () => {
  const result = absorb('c1', cal('BEGIN:VEVENT\r\nUID:a\r\nSUMMARY:Standup\r\nDTSTART:20260902T090000\r\nDTEND:20260902T091500\r\nEND:VEVENT'), '2026-09-01')
  expect(result.ok).toBe(true)
  expect(getCalendarCache().c1.events).toHaveLength(1)
  expect(getCalendarCache().c1.fetchedAt).toEqual(expect.any(String))
})

/**
 * The rule that matters most here. An expired secret address answers with a
 * login page, and reading that as "your calendar is now empty" would blank a
 * day that was correct a minute ago.
 */
test('a reply that is not a calendar keeps the events already held, and says why', () => {
  putCalendarEntry('c1', {
    events: [{ uid: 'a', summary: 'Standup', date: DATE, startMinutes: 540, allDay: false }],
  })
  const result = absorb('c1', '<html>Sign in</html>', '2026-09-01')

  expect(result.ok).toBe(false)
  expect(getCalendarCache().c1.events).toHaveLength(1)
  expect(getCalendarCache().c1.error).toMatch(/calendar/i)
})

test('a calendar that is genuinely empty is allowed to be empty', () => {
  putCalendarEntry('c1', { events: [{ uid: 'old', summary: 'Gone', date: DATE, allDay: true }] })
  const result = absorb('c1', cal('X-WR-CALNAME:Work'), '2026-09-01')
  expect(result.ok).toBe(true)
  expect(getCalendarCache().c1.events).toEqual([])
})

// --- fetching -------------------------------------------------------------

/**
 * A browser cannot fetch a Google or Outlook iCal address itself - those hosts
 * send no CORS headers. Said up front in Settings rather than discovered as a
 * failure: without sync, file import is the way in, and that is a sentence,
 * not an error.
 */
test('without sync there is no way to subscribe, and it is stated rather than attempted', async () => {
  expect(subscriptionBlocker()).toMatch(/sync server/i)
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  const outcome = await refreshCalendar(sub())
  expect(outcome.ok).toBe(false)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(getCalendarCache().c1.error).toMatch(/sync server/i)
})

test('with sync on, the feed is fetched through the server and parsed', async () => {
  // A fresh Response per call: a body can only be read once, and turning sync
  // on makes the sync client fetch as well.
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            text: cal('BEGIN:VEVENT\r\nUID:a\r\nSUMMARY:Standup\r\nDTSTART:20260902T090000\r\nDTEND:20260902T091500\r\nEND:VEVENT'),
          }),
          { status: 200 },
        ),
      ),
    ),
  )
  setSyncConfig({ url: 'http://sync.test:8787', token: 'abc', enabled: true })
  expect(subscriptionBlocker()).toBeNull()

  const outcome = await refreshCalendar(sub(), '2026-09-01')
  expect(outcome.ok).toBe(true)
  expect(getCalendarCache().c1.events[0].summary).toBe('Standup')
})

test('a feed that is briefly unreachable does not blank the day it was describing', async () => {
  putCalendarEntry('c1', {
    events: [{ uid: 'a', summary: 'Standup', date: DATE, startMinutes: 540, allDay: false }],
  })
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  setSyncConfig({ url: 'http://sync.test:8787', token: 'abc', enabled: true })

  const outcome = await refreshCalendar(sub())
  expect(outcome.ok).toBe(false)
  expect(getCalendarCache().c1.events).toHaveLength(1)
  expect(getCalendarCache().c1.error).toMatch(/sync server/i)
})

test('the server explaining why is passed straight through rather than replaced with a number', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: 'the calendar answered 404' }), { status: 502 }))),
  )
  setSyncConfig({ url: 'http://sync.test:8787', token: 'abc', enabled: true })

  const outcome = await refreshCalendar(sub())
  expect(outcome.message).toBe('the calendar answered 404')
})

test('a calendar imported from a file has nothing to refresh, and says so', async () => {
  const outcome = await refreshCalendar(sub({ url: undefined }))
  expect(outcome.ok).toBe(false)
  expect(outcome.message).toMatch(/file/i)
})

test('the refreshed line reads as a person would say it', () => {
  const now = Date.parse('2026-09-01T12:00:00.000Z')
  expect(formatFetchedAt(undefined, now)).toBe('not yet')
  expect(formatFetchedAt('2026-09-01T11:59:50.000Z', now)).toBe('just now')
  expect(formatFetchedAt('2026-09-01T11:56:00.000Z', now)).toBe('4 min ago')
  expect(formatFetchedAt('2026-08-30T12:00:00.000Z', now)).toBe('2 days ago')
})
