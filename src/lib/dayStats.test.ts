import { expect, test } from 'vitest'
import { HIGH_RATE, LOW_RATE, dayStat, keptEveryKeyTask, monthSummary, summaryLine, toneFor } from './dayStats'
import type { DayPlan, Task } from './types'

function task(over: Partial<Task> = {}): Task {
  return { id: crypto.randomUUID(), title: 'A task', done: false, ...over }
}

function day(tasks: Task[]): DayPlan {
  return { date: '2026-09-01', tasks }
}

// --- the ratio -----------------------------------------------------------

test('an empty day reports null rather than zero', () => {
  const stat = dayStat(day([]))
  expect(stat.rate).toBeNull()
  expect(stat.done).toBe(0)
  expect(stat.total).toBe(0)
})

test('a day that does not exist is the same as an empty one', () => {
  expect(dayStat(undefined).rate).toBeNull()
})

test('the ratio is done over planned', () => {
  const stat = dayStat(day([task({ done: true }), task({ done: true }), task()]))
  expect(stat.done).toBe(2)
  expect(stat.total).toBe(3)
  expect(stat.rate).toBeCloseTo(2 / 3)
})

// --- the colour thresholds -----------------------------------------------
//
// No red at any threshold. A past day is not on trial - low is grey, which
// says quiet rather than bad.

test('an unplanned day gets its own register, not the bottom of the scale', () => {
  expect(toneFor(null)).toBe('none')
})

test('the thresholds are inclusive at the bottom of each band', () => {
  expect(toneFor(HIGH_RATE)).toBe('high')
  expect(toneFor(HIGH_RATE - 0.001)).toBe('mid')
  expect(toneFor(LOW_RATE)).toBe('mid')
  expect(toneFor(LOW_RATE - 0.001)).toBe('low')
})

test('the ends of the scale land where they should', () => {
  expect(toneFor(1)).toBe('high')
  expect(toneFor(0)).toBe('low')
})

test('a day carries its own tone', () => {
  expect(dayStat(day([task({ done: true }), task({ done: true })])).tone).toBe('high')
  // Two of four is a half, which is the middle band; one of three is 33%,
  // which is not - the thresholds are 40% and 80%.
  expect(dayStat(day([task({ done: true }), task({ done: true }), task(), task()])).tone).toBe('mid')
  expect(dayStat(day([task(), task(), task()])).tone).toBe('low')
  expect(dayStat(day([])).tone).toBe('none')
})

// --- what was carried on -------------------------------------------------

test('pushed counts unfinished tasks that have been carried at least once', () => {
  const stat = dayStat(day([task({ pushCount: 1 }), task({ pushCount: 3 }), task()]))
  expect(stat.pushed).toBe(2)
})

// A finished task's push count is history, not a departure.
test('a finished task is not counted as carried on, however long it took', () => {
  expect(dayStat(day([task({ pushCount: 5, done: true })])).pushed).toBe(0)
})

test('a day where nothing was carried says zero', () => {
  expect(dayStat(day([task(), task({ done: true })])).pushed).toBe(0)
})

// --- key tasks -----------------------------------------------------------

test('every key task kept is only true when some were set', () => {
  expect(keptEveryKeyTask(dayStat(day([task({ highlight: true, done: true })])))).toBe(true)
  expect(keptEveryKeyTask(dayStat(day([task({ highlight: true, done: true }), task({ highlight: true })])))).toBe(false)
  // A day that set none did not keep them all - it had none to keep.
  expect(keptEveryKeyTask(dayStat(day([task({ done: true })])))).toBe(false)
})

// --- deep work -----------------------------------------------------------

test('deep work counts finished, sized tasks in that category only', () => {
  const stat = dayStat(
    day([
      task({ category: 'core', minutes: 60, done: true }),
      task({ category: 'core', minutes: 90 }),
      task({ category: 'core', done: true }),
      task({ category: 'meal', minutes: 30, done: true }),
    ]),
  )
  expect(stat.focusMinutes).toBe(60)
})

// --- the month line ------------------------------------------------------

const MONTH = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']

function days(entries: Record<string, Task[]>): Record<string, DayPlan> {
  return Object.fromEntries(Object.entries(entries).map(([date, tasks]) => [date, { date, tasks }]))
}

test('a month nobody used has nothing to say', () => {
  expect(summaryLine(monthSummary({}, MONTH))).toBeNull()
})

test('the summary is over planned days, never over the calendar', () => {
  const store = days({
    '2026-09-01': [task({ done: true }), task({ done: true })],
    '2026-09-03': [task({ done: true }), task()],
  })
  const summary = monthSummary(store, MONTH)
  expect(summary.activeDays).toBe(2)
  expect(summary.done).toBe(3)
  expect(summary.total).toBe(4)
  expect(summary.rate).toBeCloseTo(0.75)
})

test('the streak counts consecutive full days', () => {
  const full = [task({ done: true }), task({ done: true })]
  const store = days({
    '2026-09-01': full,
    '2026-09-02': full,
    '2026-09-03': [task(), task()],
    '2026-09-04': full,
  })
  expect(monthSummary(store, MONTH).longestStreak).toBe(2)
})

// A weekend nobody planned is not a lapse.
test('a day with no plan neither breaks nor extends the streak', () => {
  const full = [task({ done: true }), task({ done: true })]
  const store = days({ '2026-09-01': full, '2026-09-03': full })
  expect(monthSummary(store, MONTH).longestStreak).toBe(2)
})

test('the line names the rate and the active days, and the run only when there is one', () => {
  const full = [task({ done: true })]
  expect(summaryLine(monthSummary(days({ '2026-09-01': full }), MONTH))).toBe('100% done - 1 active day')
  expect(summaryLine(monthSummary(days({ '2026-09-01': full, '2026-09-02': full }), MONTH))).toBe(
    '100% done - 2 active days - longest run 2',
  )
})
