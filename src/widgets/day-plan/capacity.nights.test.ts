import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import { computeCapacity, minutesLeft, wakingDayFor, windowFor } from './capacity'
import { computeTimelineLayout, emptyDayLayout } from './timelineLayout'

/**
 * A day's sleep read by the day's own arithmetic - rotating shifts, stage 4,
 * docs/RESEARCH-SHIFTS.md section 3. A sleep belongs to the date it ends on,
 * so a day's evening ends at tonight's bedtime, which is the next date's
 * schedule; the free-time figure counts the waking day to that bedtime, past
 * midnight where it is; the grid greys the sleeps that fall on the day and
 * nothing else; and what still runs in from last night takes its time.
 * Generic names and times only.
 */

const PROFILES = [
  { id: 'default', name: 'Nights', window: { start: '23:00', end: '07:00' } },
  { id: 'early', name: 'Early', window: { start: '21:30', end: '05:00' } },
  { id: 'daytime', name: 'Daytime', window: { start: '08:00', end: '15:00' } },
  { id: 'late', name: 'Late', window: { start: '01:00', end: '09:00' } },
]

function anchor(title: string, time: string, minutes?: number): Task {
  return { id: title, title, done: false, time, minutes }
}

test("a day's evening ends at tonight's bedtime, which is the next date's schedule", () => {
  expect(windowFor('default', { profiles: PROFILES, tonightProfileId: 'early' })).toEqual({ start: 420, end: 1290 })
  expect(windowFor('default', { profiles: PROFILES })).toEqual({ start: 420, end: 1380 })
})

test('the waking day is the whole stretch between the two sleeps, past midnight where tonight starts after it', () => {
  expect(wakingDayFor('late', { profiles: PROFILES }).waking).toEqual({ start: 540, end: 1500 })
  expect(wakingDayFor('daytime', { profiles: PROFILES }).waking).toEqual({ start: 900, end: 1920 })
})

test('free time counts to a bedtime after midnight rather than stopping at 24:00', () => {
  // Awake 09:00 to 01:00: sixteen hours, less a two-hour block.
  const capacity = computeCapacity([anchor('Class', '10:00', 120)], 'late', { profiles: PROFILES })
  expect(capacity.freeMinutes).toBe(16 * 60 - 120)
})

test("a night shift is the start date's whole: free time on its day runs to the next morning's sleep and the shift is not cut at midnight", () => {
  const capacity = computeCapacity([anchor('Night shift', '22:00', 480)], 'daytime', { profiles: PROFILES, tonightProfileId: 'daytime' })
  // Awake 15:00 to 08:00 the next morning, seventeen hours, less the eight-hour shift.
  expect(capacity.anchorsClippedByWindow).toBe(false)
  expect(capacity.anchorsMinutes).toBe(480)
  expect(capacity.freeMinutes).toBe(9 * 60)
})

test('what still runs in from last night takes its time from the morning, without being one of the day\'s tasks', () => {
  // Awake from 07:00 on a schedule that did not plan for it; last night's block runs to 09:00.
  const capacity = computeCapacity([anchor('Lunch', '12:00', 60)], 'default', { profiles: PROFILES }, [], [{ start: -120, end: 540 }])
  expect(capacity.anchorCount).toBe(1)
  expect(capacity.anchorsMinutes).toBe(60)
  expect(capacity.freeMinutes).toBe(16 * 60 - 120 - 60)
})

test('time left is real time when the date is known: an hour more on the night the clocks go back', () => {
  process.env.TZ = 'Europe/Vilnius'
  const night = anchor('Night shift', '22:00', 480)
  expect(minutesLeft(night, 23 * 60, '2026-10-24')).toBe(8 * 60)
  expect(minutesLeft(night, 23 * 60)).toBe(7 * 60)
})

test('the grid greys the sleeps that fall on the day: the hours from midnight to a daytime sleep are awake', () => {
  const layout = computeTimelineLayout([anchor('Walk', '07:30', 60)], 'daytime', { profiles: PROFILES, tonightProfileId: 'default' })
  expect(layout.sleepBands.every(band => band.start >= 480)).toBe(true)
  expect(layout.sleepBands[0]).toMatchObject({ start: 480 })
})

test("an empty day's grid is the waking hours on the day's own clock, and tonight's bedtime closes it", () => {
  expect(emptyDayLayout('default', { profiles: PROFILES, tonightProfileId: 'early' }).displayWindow).toEqual({ start: 420, end: 1290 })
  expect(emptyDayLayout('daytime', { profiles: PROFILES, tonightProfileId: 'daytime' }).displayWindow).toEqual({ start: 900, end: 1440 })
})
