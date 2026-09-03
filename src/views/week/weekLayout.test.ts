import { expect, test } from 'vitest'
import { computeWeekLayout, sharedWindow, timeAtPercent, DEFAULT_BLOCK_MINUTES } from './weekLayout'
import { DEFAULT_SLEEP_SETTINGS } from '../../widgets/day-plan/capacity'
import type { DayPlan, Task } from '../../lib/types'
import { weekOf } from '../../lib/dates'

// 2026-09-02 is a Wednesday, so this week runs Mon 31 Aug to Sun 6 Sep.
const WEEK = weekOf('2026-09-02')
const MON = WEEK[0]
const TUE = WEEK[1]

function task(over: Partial<Task> = {}): Task {
  return { id: `t${Math.random()}`, title: 'Thing', done: false, ...over }
}

function days(entries: Record<string, Task[]>): Record<string, DayPlan> {
  return Object.fromEntries(Object.entries(entries).map(([date, tasks]) => [date, { date, tasks }]))
}

const SLEEP = DEFAULT_SLEEP_SETTINGS

/**
 * The week is measured in percentages rather than pixels - see weekLayout.ts.
 * These pin the arithmetic that lets it fit any screen without measuring one:
 * one axis for seven columns, blocks as a fraction of it, and overlaps that
 * sit beside each other rather than on top.
 */

test('the axis is one window for the whole week, not seven', () => {
  const layout = computeWeekLayout(WEEK, {}, SLEEP)
  expect(layout.days).toHaveLength(7)
  // Default sleep is 23:00-07:00, so waking is 07:00-23:00.
  expect(layout.window).toEqual({ start: 7 * 60, end: 23 * 60 })
})

// Comparing days is the entire reason to look at a week, and a block that is
// one height on Tuesday and another on Wednesday makes that impossible.
test('the same block is the same height whichever day it is on', () => {
  const layout = computeWeekLayout(
    WEEK,
    days({ [MON]: [task({ time: '09:00', minutes: 60 })], [TUE]: [task({ time: '14:00', minutes: 60 })] }),
    SLEEP,
  )
  const mon = layout.days[0].blocks[0]
  const tue = layout.days[1].blocks[0]
  expect(mon.heightPercent).toBeCloseTo(tue.heightPercent, 6)
})

test('a block sits at its own fraction of the window', () => {
  // 07:00 to 23:00 is 960 minutes. 15:00 is 480 in, exactly half way.
  const layout = computeWeekLayout(WEEK, days({ [MON]: [task({ time: '15:00', minutes: 96 })] }), SLEEP)
  const block = layout.days[0].blocks[0]
  expect(block.topPercent).toBeCloseTo(50, 6)
  expect(block.heightPercent).toBeCloseTo(10, 6)
})

// A 05:00 flight is exactly what somebody opens a week view to look at, and an
// axis that started at seven would simply not draw it.
test('the axis stretches to cover anything scheduled outside waking hours', () => {
  const layout = computeWeekLayout(WEEK, days({ [MON]: [task({ time: '05:00', minutes: 120 })] }), SLEEP)
  expect(layout.window.start).toBe(5 * 60)
  expect(layout.days[0].blocks[0].topPercent).toBe(0)
})

test('the axis rounds out to whole hours, so labels land on edges', () => {
  const layout = computeWeekLayout(WEEK, days({ [MON]: [task({ time: '05:23', minutes: 10 })] }), SLEEP)
  expect(layout.window.start).toBe(5 * 60)
  expect(layout.hours[0]).toBe(5 * 60)
})

test('an untimed task is counted, never drawn', () => {
  const layout = computeWeekLayout(WEEK, days({ [MON]: [task({ title: 'Someday' }), task({ time: '09:00' })] }), SLEEP)
  expect(layout.days[0].blocks).toHaveLength(1)
  expect(layout.days[0].untimed.map(t => t.title)).toEqual(['Someday'])
})

test('a task with no size is drawn at the default rather than at nothing', () => {
  const layout = computeWeekLayout(WEEK, days({ [MON]: [task({ time: '09:00' })] }), SLEEP)
  const block = layout.days[0].blocks[0]
  expect(block.endMinutes - block.startMinutes).toBe(DEFAULT_BLOCK_MINUTES)
})

// Five minutes at a week's scale is under three pixels tall. Drawn honestly it
// would be invisible, and a task you cannot see is a task you cannot click.
test('a very short block still has something to click', () => {
  const layout = computeWeekLayout(WEEK, days({ [MON]: [task({ time: '09:00', minutes: 5 })] }), SLEEP)
  expect(layout.days[0].blocks[0].heightPercent).toBeGreaterThanOrEqual(1.6)
})

// --- overlaps ------------------------------------------------------------

test('two blocks at the same time sit beside each other', () => {
  const layout = computeWeekLayout(
    WEEK,
    days({ [MON]: [task({ time: '09:00', minutes: 60 }), task({ time: '09:30', minutes: 60 })] }),
    SLEEP,
  )
  const [a, b] = layout.days[0].blocks
  expect(a.lanes).toBe(2)
  expect(b.lanes).toBe(2)
  expect([a.lane, b.lane].sort()).toEqual([0, 1])
})

test('blocks that do not overlap are both full width', () => {
  const layout = computeWeekLayout(
    WEEK,
    days({ [MON]: [task({ time: '09:00', minutes: 60 }), task({ time: '11:00', minutes: 60 })] }),
    SLEEP,
  )
  expect(layout.days[0].blocks.map(b => b.lanes)).toEqual([1, 1])
})

/**
 * A and B overlap, B and C overlap, A and C do not touch. All three share one
 * cluster, so all three are drawn at the same width and the columns line up -
 * but the width is set by how many actually collide at once, which is two.
 * Making it three would leave a permanently empty third of the day and narrow
 * every block for a clash that never happens.
 */
test('a chain of overlaps is one cluster, at the width the worst moment needs', () => {
  const layout = computeWeekLayout(
    WEEK,
    days({
      [MON]: [
        task({ time: '09:00', minutes: 60 }),
        task({ time: '09:45', minutes: 60 }),
        task({ time: '10:30', minutes: 60 }),
      ],
    }),
    SLEEP,
  )
  expect(layout.days[0].blocks.map(b => b.lanes)).toEqual([2, 2, 2])
  // A ends before C starts, so C takes A's slot back rather than opening a third.
  expect(layout.days[0].blocks.map(b => b.lane)).toEqual([0, 1, 0])
})

test('a freed slot is reused rather than widening the whole day', () => {
  const layout = computeWeekLayout(
    WEEK,
    days({
      [MON]: [
        task({ time: '09:00', minutes: 30 }),
        task({ time: '09:00', minutes: 180 }),
        task({ time: '10:00', minutes: 30 }),
      ],
    }),
    SLEEP,
  )
  // The first block has ended by 10:00, so the third takes its slot back.
  expect(layout.days[0].blocks.map(b => b.lanes)).toEqual([2, 2, 2])
})

// --- per-day waking window ----------------------------------------------

test('a day whose own hours are narrower than the axis reports where they are', () => {
  const sleep = {
    profiles: [
      { id: 'default', name: 'Default', window: { start: '23:00', end: '07:00' } },
      { id: 'late', name: 'Late', window: { start: '03:00', end: '11:00' } },
    ],
  }
  const plans: Record<string, DayPlan> = {
    [MON]: { date: MON, tasks: [], sleepProfileId: 'late' },
    [TUE]: { date: TUE, tasks: [] },
  }
  const layout = computeWeekLayout(WEEK, plans, sleep)
  // The axis covers 07:00 to 03:00-next-day, clipped to midnight.
  expect(layout.days[0].wakeHeightPercent).toBeGreaterThan(0)
  expect(layout.days[0].wakeTopPercent).toBeGreaterThanOrEqual(0)
  expect(layout.days[0].wakeTopPercent + layout.days[0].wakeHeightPercent).toBeLessThanOrEqual(100.0001)
})

test('an empty week still has a usable axis rather than a collapsed one', () => {
  const layout = computeWeekLayout(WEEK, {}, { profiles: [] })
  expect(layout.window.end).toBeGreaterThan(layout.window.start)
  expect(layout.hours.length).toBeGreaterThan(1)
})

test('sharedWindow falls back to a plain day when it is handed nothing at all', () => {
  expect(sharedWindow([], [], { profiles: [] })).toEqual({ start: 7 * 60, end: 23 * 60 })
})

// --- clicking an empty column -------------------------------------------

/**
 * Half past is a time somebody means; 14:23 is a time they missed. At a week's
 * scale one pixel is about two minutes, so a five-minute snap would make the
 * result depend on where inside a single pixel the click landed.
 */
test('a click in an empty column lands on a half hour', () => {
  const window = { start: 7 * 60, end: 23 * 60 }
  expect(timeAtPercent(0, window)).toBe('07:00')
  expect(timeAtPercent(50, window)).toBe('15:00')
  expect(timeAtPercent(51, window)).toBe('15:00')
  expect(timeAtPercent(53, window)).toBe('15:30')
})

test('a click at the very bottom does not land past the end of the day', () => {
  const window = { start: 7 * 60, end: 23 * 60 }
  expect(timeAtPercent(100, window)).toBe('22:30')
})

test('a click above the top does not land before it', () => {
  const window = { start: 7 * 60, end: 23 * 60 }
  expect(timeAtPercent(-20, window)).toBe('07:00')
})
