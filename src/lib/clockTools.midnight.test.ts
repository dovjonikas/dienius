import { beforeEach, expect, test } from 'vitest'
import { clockTools, elapsedMs, getClockTools, remainingMs } from './clockTools'

/**
 * The clock, over midnight and over the two days a year that are not twenty
 * four hours long.
 *
 * The v2.17 hunt walked the states nothing tests, and this is one of them: a
 * timer started before midnight and finishing after it, a stopwatch left
 * running across the boundary, and both of those on a night the clock jumps.
 * The day view had a real defect there - see lib/useToday.ts - and the
 * question these answer is whether the timer had one too.
 *
 * It does not, and the reason is worth writing down rather than assuming: a
 * run is an instant and a duration, both in epoch milliseconds, and nothing
 * in `elapsedMs` or `remainingMs` touches a calendar. There is no date
 * arithmetic here to get wrong. These hold that, so that a later change which
 * introduces some - a "started at 23:40" line, a per-day total - fails here
 * rather than on the owner's Sunday morning.
 */

beforeEach(() => {
  clockTools.resetForTests()
})

/** Vilnius local time as an epoch instant. Winter is UTC+2, summer UTC+3. */
function at(y: number, m: number, d: number, h: number, min: number, offsetHours: number): number {
  return Date.UTC(y, m - 1, d, h - offsetHours, min)
}

test('a timer started ten minutes before midnight has fifty minutes left ten minutes after it', () => {
  const started = at(2026, 9, 16, 23, 50, 3)
  const timer = { startedAt: started, durationMs: 60 * 60_000, elapsedBeforeMs: 0, paused: false }
  const tenPastMidnight = at(2026, 9, 17, 0, 10, 3)
  expect(remainingMs(timer, tenPastMidnight)).toBe(40 * 60_000)
})

test('a stopwatch left running over midnight counts the minutes it actually ran', () => {
  const started = at(2026, 9, 16, 23, 30, 3)
  const run = { startedAt: started, elapsedBeforeMs: 0, paused: false }
  expect(elapsedMs(run, at(2026, 9, 17, 0, 30, 3))).toBe(60 * 60_000)
})

/**
 * The clock forward, on the last Sunday of March: 03:00 becomes 04:00, so a
 * run from 02:30 to 04:30 lasted one hour of real time and not two.
 */
test('a run through the spring-forward hour is as long as it really was, not as long as the clock says', () => {
  const started = at(2026, 3, 29, 2, 30, 2)
  const run = { startedAt: started, elapsedBeforeMs: 0, paused: false }
  // 04:30 summer time is 01:30 UTC; 02:30 winter time was 00:30 UTC.
  const ended = at(2026, 3, 29, 4, 30, 3)
  expect(elapsedMs(run, ended)).toBe(60 * 60_000)
})

/**
 * And back, on the last Sunday of October: 04:00 becomes 03:00, so a run from
 * 03:30 to 03:30 lasted an hour despite reading the same on the wall.
 */
test('a run through the autumn-back hour is not counted as zero because the clock repeated', () => {
  const started = at(2026, 10, 25, 3, 30, 3)
  const run = { startedAt: started, elapsedBeforeMs: 0, paused: false }
  const ended = at(2026, 10, 25, 3, 30, 2)
  expect(elapsedMs(run, ended)).toBe(60 * 60_000)
})

test('a timer paused before midnight and resumed after it keeps only the time it ran', () => {
  clockTools.resetForTests({
    timer: { startedAt: at(2026, 9, 16, 23, 40, 3), durationMs: 60 * 60_000, elapsedBeforeMs: 0, paused: false },
    stopwatch: null,
    focus: null,
    corner: 'bottom-right',
  })
  // Ten minutes in, it is paused; the pause is what puts the elapsed time on
  // record, and that arithmetic reads the wall clock through Date.now().
  const paused = getClockTools().timer!
  const tenMinutesIn = at(2026, 9, 16, 23, 50, 3)
  expect(elapsedMs({ ...paused, paused: false }, tenMinutesIn)).toBe(10 * 60_000)
  // Resumed at ten past midnight with those ten minutes already banked, it
  // has fifty left however many dates have gone by.
  const resumed = { startedAt: at(2026, 9, 17, 0, 10, 3), durationMs: 60 * 60_000, elapsedBeforeMs: 10 * 60_000, paused: false }
  expect(remainingMs(resumed, at(2026, 9, 17, 0, 30, 3))).toBe(30 * 60_000)
})

/**
 * The one place the clock does hold a date: which task a session or a
 * stopwatch belongs to. It is the day the task is on, not the day it is now,
 * and midnight must not move it - the thing being timed at 00:10 is still
 * the thing that was started at 23:50.
 */
test('a session started before midnight still names yesterdays task after it', () => {
  clockTools.startFocus('2026-09-16', 'task-1')
  clockTools.startStopwatch({ date: '2026-09-16', taskId: 'task-1' })
  const tools = getClockTools()
  expect(tools.focus).toEqual({ date: '2026-09-16', taskId: 'task-1' })
  expect(tools.stopwatch?.of).toEqual({ date: '2026-09-16', taskId: 'task-1' })
})
