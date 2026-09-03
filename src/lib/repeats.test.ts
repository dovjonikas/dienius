import { expect, test } from 'vitest'
import { instanceOf, materialiseRepeats, repeatApplies, repeatSources, weekdayOf } from './repeats'
import type { DayPlan, Task } from './types'

// 2026-09-02 is a Wednesday. Every fixture below is anchored to that week so
// the weekday arithmetic is checkable by eye.
const WED = '2026-09-02'
const THU = '2026-09-03'
const FRI = '2026-09-04'
const SAT = '2026-09-05'
const SUN = '2026-09-06'
const NEXT_WED = '2026-09-09'

function task(over: Partial<Task> = {}): Task {
  return { id: 't1', title: 'Medication', done: false, ...over }
}

function days(entries: Record<string, Task[]>): Record<string, DayPlan> {
  return Object.fromEntries(Object.entries(entries).map(([date, tasks]) => [date, { date, tasks }]))
}

// --- the weekday, built from parts --------------------------------------
//
// `new Date('2026-09-02')` is read as UTC midnight and shifts a day backwards
// for anyone west of Greenwich, which would put weekday tasks on Sundays for
// half the world. This is the guard against that ever coming back.

test('a date key resolves to its own local weekday', () => {
  expect(weekdayOf(WED)).toBe(3)
  expect(weekdayOf(SAT)).toBe(6)
  expect(weekdayOf(SUN)).toBe(0)
})

// --- which days a repeat applies to -------------------------------------

test('daily applies to every later day and never to the source day itself', () => {
  expect(repeatApplies('daily', WED, WED)).toBe(false)
  expect(repeatApplies('daily', WED, THU)).toBe(true)
  expect(repeatApplies('daily', WED, SUN)).toBe(true)
})

test('a repeat never reaches backwards', () => {
  expect(repeatApplies('daily', THU, WED)).toBe(false)
  expect(repeatApplies('weekly', NEXT_WED, WED)).toBe(false)
})

test('weekdays means Monday to Friday, and skips the weekend', () => {
  expect(repeatApplies('weekdays', WED, THU)).toBe(true)
  expect(repeatApplies('weekdays', WED, FRI)).toBe(true)
  expect(repeatApplies('weekdays', WED, SAT)).toBe(false)
  expect(repeatApplies('weekdays', WED, SUN)).toBe(false)
})

test('weekly means the same weekday the source fell on', () => {
  expect(repeatApplies('weekly', WED, NEXT_WED)).toBe(true)
  expect(repeatApplies('weekly', WED, THU)).toBe(false)
})

// --- finding the sources -------------------------------------------------

test('a source is a task that repeats and was not itself generated', () => {
  const store = days({
    [WED]: [task({ id: 'src', repeat: 'daily' }), task({ id: 'gen', repeat: 'daily', repeatOf: 'src' })],
  })
  expect(repeatSources(store, THU).map(s => s.task.id)).toEqual(['src'])
})

test('a source dated on or after the day being filled is not a source for it', () => {
  const store = days({ [FRI]: [task({ id: 'src', repeat: 'daily' })] })
  expect(repeatSources(store, WED)).toEqual([])
})

// --- what an instance carries -------------------------------------------

test('an instance carries what the task is, and not what one day made of it', () => {
  const source = task({
    id: 'src',
    repeat: 'daily',
    time: '09:00',
    minutes: 30,
    category: 'health',
    note: 'with food',
    unbounded: true,
    done: true,
    pushCount: 4,
    highlight: true,
    subtasks: [{ id: 's1', title: 'Fill the glass', done: true }],
  })
  const made = instanceOf(source, 'src')

  expect(made).toMatchObject({
    title: 'Medication',
    time: '09:00',
    minutes: 30,
    category: 'health',
    note: 'with food',
    unbounded: true,
    repeat: 'daily',
    repeatOf: 'src',
    done: false,
  })
  // Not carried: a repeating task that arrived pre-marked every morning
  // would spend the day's three-highlight cap before anybody looked at it,
  // and a push count is a fact about a day that has already happened.
  expect(made.highlight).toBeUndefined()
  expect(made.pushCount).toBeUndefined()
  expect(made.id).not.toBe('src')
  // Steps travel as steps, not as finished ones.
  expect(made.subtasks).toEqual([{ id: expect.any(String), title: 'Fill the glass', done: false }])
})

// --- generation ----------------------------------------------------------

test('a day is given the instances it is owed', () => {
  const store = days({ [WED]: [task({ id: 'src', repeat: 'daily' })] })
  const { tasks, added } = materialiseRepeats(store, THU, [])
  expect(added).toBe(true)
  expect(tasks.map(t => [t.title, t.repeatOf])).toEqual([['Medication', 'src']])
})

// Idempotence is not a nicety here: generation re-runs every time a day is
// opened, so any of these three would produce duplicates within a week.
test('generation is idempotent - an instance already there is not added twice', () => {
  const store = days({
    [WED]: [task({ id: 'src', repeat: 'daily' })],
    [THU]: [task({ id: 'gen', repeat: 'daily', repeatOf: 'src' })],
  })
  const { tasks, added } = materialiseRepeats(store, THU, store[THU].tasks)
  expect(added).toBe(false)
  expect(tasks).toHaveLength(1)
})

test('a series the day has skipped is not resurrected', () => {
  const store: Record<string, DayPlan> = {
    [WED]: { date: WED, tasks: [task({ id: 'src', repeat: 'daily' })] },
    [THU]: { date: THU, tasks: [], repeatSkips: ['src'] },
  }
  expect(materialiseRepeats(store, THU, []).added).toBe(false)
})

test('a weekend day gets nothing from a weekdays series', () => {
  const store = days({ [WED]: [task({ id: 'src', repeat: 'weekdays' })] })
  expect(materialiseRepeats(store, SAT, []).added).toBe(false)
  expect(materialiseRepeats(store, FRI, []).added).toBe(true)
})

test('two sources both land on the same day, in the order they were made', () => {
  const store = days({
    [WED]: [task({ id: 'a', title: 'Medication', repeat: 'daily' })],
    [THU]: [task({ id: 'b', title: 'Stretch', repeat: 'daily' })],
  })
  const { tasks } = materialiseRepeats(store, FRI, [])
  expect(tasks.map(t => t.title)).toEqual(['Medication', 'Stretch'])
})

test('generated tasks are appended after whatever the day already had', () => {
  const store = days({ [WED]: [task({ id: 'src', repeat: 'daily' })] })
  const existing = [task({ id: 'own', title: 'Call the bank' })]
  expect(materialiseRepeats(store, THU, existing).tasks.map(t => t.title)).toEqual([
    'Call the bank',
    'Medication',
  ])
})

/**
 * Generation used to ignore any source older than four hundred days. That
 * limit was removed rather than documented - see repeatSources. A source is
 * the day a repeating task was first written and never moves, so the limit was
 * an expiry date: a weekly task set up thirteen months ago would stop arriving
 * one morning with nothing said. These pin that it does not.
 */
test('a source from years ago still owes today its instance', () => {
  const store = days({ '2020-01-01': [task({ id: 'src', repeat: 'daily' })] })
  const { tasks, added } = materialiseRepeats(store, THU, [])
  expect(added).toBe(true)
  expect(tasks.map(t => t.title)).toEqual(['Medication'])
})

test('a weekly source from years ago still lands on its own weekday and no other', () => {
  // 2020-01-01 was a Wednesday.
  const store = days({ '2020-01-01': [task({ id: 'src', repeat: 'weekly' })] })
  expect(materialiseRepeats(store, NEXT_WED, []).added).toBe(true)
  expect(materialiseRepeats(store, THU, []).added).toBe(false)
})

test('an old source is still found by repeatSources at all', () => {
  const store = days({ '2019-06-06': [task({ id: 'src', repeat: 'weekdays' })] })
  expect(repeatSources(store, THU).map(s => s.date)).toEqual(['2019-06-06'])
})
