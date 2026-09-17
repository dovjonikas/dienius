import { expect, test } from 'vitest'
import { bandsOnDay, minutesUntilSleep, ownedSleep, wakingDay, wakingOnDay } from './wakingDay'
import { wallInstant } from './wallClock'

// Lithuania's clock - docs/RESEARCH-SHIFTS.md section 4.4.
process.env.TZ = 'Europe/Vilnius'

/**
 * A day between two sleeps - docs/RESEARCH-SHIFTS.md section 3. A sleep
 * belongs to the date it ends on, so a date's waking day runs from the end of
 * the sleep it wakes from to the start of tonight's, which is the next date's
 * sleep and may start after midnight. Every reader of a day's sleep - the grey
 * bands, the free-time figure, "Sleep in" - reads it from here. Generic times
 * only.
 */

const NIGHTS = { start: '23:00', end: '07:00' }
const EARLY = { start: '21:30', end: '05:00' }
const DAYTIME = { start: '08:00', end: '15:00' }
const LATE = { start: '02:00', end: '10:00' }

test("this file runs on Lithuania's clock", () => {
  expect((wallInstant('2026-10-26', 0) - wallInstant('2026-10-25', 0)) / 3_600_000).toBe(25)
})

test('a sleep over midnight is its end date\'s from the evening before, a sleep within a day is that day\'s, and equal times are none', () => {
  expect(ownedSleep(NIGHTS)).toEqual({ start: -60, end: 420 })
  expect(ownedSleep(DAYTIME)).toEqual({ start: 480, end: 900 })
  expect(ownedSleep({ start: '07:00', end: '07:00' })).toBeNull()
})

test('two days on one schedule give exactly the waking hours that schedule has always given', () => {
  expect(wakingDay(NIGHTS, NIGHTS)).toEqual({ woke: { start: -60, end: 420 }, tonight: { start: 1380, end: 1860 }, waking: { start: 420, end: 1380 } })
})

test("the evening ends at tomorrow's bedtime: a rest day before a day shift ends at 21:30", () => {
  expect(wakingDay(NIGHTS, EARLY).waking).toEqual({ start: 420, end: 1290 })
})

test('after nights, a day that slept 08:00 to 15:00 is awake until the rest day\'s 23:00', () => {
  expect(wakingDay(DAYTIME, NIGHTS).waking).toEqual({ start: 900, end: 1380 })
})

test("a night shift's waking day runs past midnight to the next morning's sleep", () => {
  expect(wakingDay(DAYTIME, DAYTIME).waking).toEqual({ start: 900, end: 1920 })
})

test('a bedtime after midnight keeps the evening awake past midnight rather than cutting it at 24:00', () => {
  expect(wakingDay(LATE, LATE).waking).toEqual({ start: 600, end: 1560 })
})

test('no sleep either side is awake from midnight to midnight, and a sleep tomorrow that starts before today\'s ends leaves no waking hours', () => {
  const none = { start: '09:00', end: '09:00' }
  expect(wakingDay(none, none).waking).toEqual({ start: 0, end: 1440 })
  expect(wakingDay({ start: '22:00', end: '10:00' }, { start: '09:00', end: '08:00' }).waking).toEqual({ start: 600, end: 600 })
})

test("the day's own clock shows the sleeps that fall on it, and its waking hours cut at midnight", () => {
  expect(bandsOnDay(wakingDay(NIGHTS, NIGHTS))).toEqual([
    { start: 0, end: 420 },
    { start: 1380, end: 1440 },
  ])
  // Awake from midnight to 08:00 after a night shift: not a band.
  expect(bandsOnDay(wakingDay(DAYTIME, NIGHTS))).toEqual([
    { start: 480, end: 900 },
    { start: 1380, end: 1440 },
  ])
  expect(bandsOnDay(wakingDay(LATE, LATE))).toEqual([{ start: 120, end: 600 }])
  expect(wakingOnDay(wakingDay(DAYTIME, DAYTIME))).toEqual({ start: 900, end: 1440 })
})

test('sleep in counts to the next bedtime, past midnight when that is where it is, and says nothing while asleep', () => {
  const nights = wakingDay(NIGHTS, NIGHTS)
  expect(minutesUntilSleep('2026-09-17', 22 * 60, nights)).toBe(60)
  expect(minutesUntilSleep('2026-09-17', 23 * 60 + 30, nights)).toBeNull()
  expect(minutesUntilSleep('2026-09-17', 6 * 60, nights)).toBeNull()
  expect(minutesUntilSleep('2026-09-17', 7 * 60, nights)).toBe(960)

  const late = wakingDay(LATE, LATE)
  expect(minutesUntilSleep('2026-09-17', 23 * 60, late)).toBe(180)
  // The small hours of the next date, before its own sleep has started.
  expect(minutesUntilSleep('2026-09-18', 60, late)).toBe(60)
  expect(minutesUntilSleep('2026-09-18', 3 * 60, late)).toBeNull()
})

test('sleep in is real time: across the night the clocks go forward it is an hour shorter than the clock says', () => {
  const late = wakingDay({ start: '04:30', end: '12:00' }, { start: '04:30', end: '12:00' })
  expect(minutesUntilSleep('2026-03-28', 23 * 60, late)).toBe(270)
  expect(minutesUntilSleep('2026-10-24', 23 * 60, late)).toBe(390)
})
