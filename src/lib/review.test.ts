import { beforeEach, expect, test } from 'vitest'
import { defaultData } from './storage'
import { addDays, todayKey } from './dates'
import {
  datesBetween,
  doneRate,
  endOfMonth,
  highlightStreak,
  libraryProgress,
  periodStats,
  startOfMonth,
  startOfWeek,
} from './review'
import type { AppData, DayPlan, Task } from './types'

// 2026-08-31 is a Monday; the week runs to Sunday 2026-09-06.
const MON = '2026-08-31'
const TUE = '2026-09-01'
const WED = '2026-09-02'
const SUN = '2026-09-06'

let data: AppData

beforeEach(() => {
  data = defaultData()
})

function task(over: Partial<Task> = {}): Task {
  return { id: crypto.randomUUID(), title: 'A task', done: false, ...over }
}

function day(date: string, tasks: Task[]): DayPlan {
  return { date, tasks }
}

// --- period boundaries ---------------------------------------------------

test('a week starts on the Monday on or before the date', () => {
  expect(startOfWeek(MON)).toBe(MON)
  expect(startOfWeek(WED)).toBe(MON)
  // Sunday belongs to the week that has just ended, not the one starting.
  expect(startOfWeek(SUN)).toBe(MON)
})

test('a month runs from its first to its real last day', () => {
  expect(startOfMonth(WED)).toBe('2026-09-01')
  expect(endOfMonth(WED)).toBe('2026-09-30')
  expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
  expect(endOfMonth('2028-02-10')).toBe('2028-02-29')
})

test('a range is inclusive at both ends', () => {
  expect(datesBetween(MON, WED)).toEqual([MON, TUE, WED])
  expect(datesBetween(MON, MON)).toEqual([MON])
})

// --- the figures ---------------------------------------------------------

test('an empty period reports no planned days rather than a zero rate', () => {
  const stats = periodStats(data, MON, SUN)
  expect(stats.plannedDays).toBe(0)
  expect(doneRate(stats)).toBeNull()
})

test('done counts across the period, and every day is present whether it was used or not', () => {
  data.days[MON] = day(MON, [task({ done: true }), task()])
  data.days[WED] = day(WED, [task({ done: true })])
  const stats = periodStats(data, MON, SUN)

  expect(stats.days).toHaveLength(7)
  expect(stats.done).toBe(2)
  expect(stats.total).toBe(3)
  expect(stats.plannedDays).toBe(2)
  expect(stats.days.filter(d => d.planned).map(d => d.date)).toEqual([MON, WED])
})

// Time set aside is not time spent - an unfinished block is a plan, and this
// figure is read as "how much of the week actually went to the work".
test('deep work counts only finished, sized tasks in that category', () => {
  data.days[MON] = day(MON, [
    task({ category: 'core', minutes: 60, done: true }),
    task({ category: 'core', minutes: 90, done: false }),
    task({ category: 'core', done: true }),
    task({ category: 'meal', minutes: 45, done: true }),
  ])
  expect(periodStats(data, MON, SUN).focusMinutes).toBe(60)
})

test('key tasks are counted set and done, per period', () => {
  data.days[MON] = day(MON, [task({ highlight: true, done: true }), task({ highlight: true })])
  data.days[TUE] = day(TUE, [task({ highlight: true, done: true })])
  const stats = periodStats(data, MON, SUN)
  expect(stats.highlights).toBe(3)
  expect(stats.highlightsDone).toBe(2)
})

// --- the library ---------------------------------------------------------
//
// Counted from the sessions ticked off, not from the item's own progress -
// progress is a running total with no dates on it and cannot answer "this
// week".

test('library units come from bound tasks finished inside the period', () => {
  data.library = [{ id: 'books', name: 'Books', unit: 'chapter', items: [{ id: 'b1', title: 'A book' }] }]
  data.days[MON] = day(MON, [
    task({ done: true, libraryRef: { listId: 'books', itemId: 'b1' } }),
    task({ done: true, libraryRef: { listId: 'books', itemId: 'b1' } }),
    task({ done: false, libraryRef: { listId: 'books', itemId: 'b1' } }),
  ])
  expect(libraryProgress(data, [MON])).toEqual([{ list: data.library[0], units: 2 }])
})

test('a list with nothing finished this period is left out entirely', () => {
  data.library = [{ id: 'books', name: 'Books', unit: 'chapter', items: [] }]
  data.days[MON] = day(MON, [task({ done: true })])
  expect(libraryProgress(data, [MON])).toEqual([])
})

test('a session outside the period does not count toward it', () => {
  data.library = [{ id: 'books', name: 'Books', unit: 'chapter', items: [] }]
  data.days['2026-08-01'] = day('2026-08-01', [
    task({ done: true, libraryRef: { listId: 'books', itemId: 'b1' } }),
  ])
  expect(libraryProgress(data, datesBetween(MON, SUN))).toEqual([])
})

// --- the streak ----------------------------------------------------------

test('a streak counts back from the day given, one day at a time', () => {
  data.days[MON] = day(MON, [task({ highlight: true, done: true })])
  data.days[TUE] = day(TUE, [task({ highlight: true, done: true })])
  data.days[WED] = day(WED, [task({ highlight: true, done: true })])
  expect(highlightStreak(data.days, WED)).toBe(3)
})

test('a day where a key task was set and not done breaks it', () => {
  data.days[MON] = day(MON, [task({ highlight: true, done: true })])
  data.days[TUE] = day(TUE, [task({ highlight: true, done: false })])
  data.days[WED] = day(WED, [task({ highlight: true, done: true })])
  expect(highlightStreak(data.days, WED)).toBe(1)
})

// The streak is about following through on what you decided mattered, and a
// day where nothing was decided cannot have been followed through on.
test('a day with no key task at all breaks it, however busy it was', () => {
  data.days[MON] = day(MON, [task({ highlight: true, done: true })])
  data.days[TUE] = day(TUE, [task({ done: true }), task({ done: true })])
  data.days[WED] = day(WED, [task({ highlight: true, done: true })])
  expect(highlightStreak(data.days, WED)).toBe(1)
})

test('a streak with nothing behind it is zero, not one', () => {
  expect(highlightStreak(data.days, WED)).toBe(0)
})

test('an ordinary task being done is not a key task being done', () => {
  data.days[WED] = day(WED, [task({ highlight: true, done: false }), task({ done: true })])
  expect(highlightStreak(data.days, WED)).toBe(0)
})

// A streak measured from three days in the future breaks on the first empty
// day and reports zero for somebody in the middle of a perfectly good run.
test('the current period measures its streak from today, not from its own last day', () => {
  const today = todayKey()
  data.days[today] = day(today, [task({ highlight: true, done: true })])
  data.days[addDays(today, -1)] = day(addDays(today, -1), [task({ highlight: true, done: true })])

  const stats = periodStats(data, addDays(today, -3), addDays(today, 3))
  expect(stats.streak).toBe(2)
})

test('a period wholly in the past still measures from its own last day', () => {
  data.days[MON] = day(MON, [task({ highlight: true, done: true })])
  data.days[TUE] = day(TUE, [task({ highlight: true, done: true })])
  expect(periodStats(data, MON, TUE).streak).toBe(2)
})
