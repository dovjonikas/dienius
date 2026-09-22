import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { addDays } from './dates'
import { endsItself } from './selfEnding'
import { dayScore } from '../widgets/day-plan/score'
import type { Task } from './types'

/**
 * Blocks that end by themselves - the owner's brief of 2026-09-22, part 1.
 *
 * A block that is simply running - a twelve-hour shift, the drive there - is
 * not a job to tick off. Once its end has passed it is done, quietly, and
 * counts as done in the day's score. Before that it can be ticked by hand,
 * finished early, or marked as not having happened; either way the clock
 * keeps out of it from then on. The same for a Commute block, and for any
 * category Settings marks as ending by itself.
 */

const DAY = '2026-09-22'

/** A local wall-clock instant on a date, the way the day view reads one. */
function at(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

function seed(date: string, tasks: Partial<Task>[]): void {
  const data = getData()
  const plan = { ...data, days: { ...data.days } }
  plan.days[date] = {
    date,
    tasks: tasks.map((t, i) => ({ id: `${date}-${i}`, title: `Block ${i}`, done: false, ...t })),
  }
  actions.resetForTests(plan)
}

function task(title: string, date = DAY): Task {
  const found = getData().days[date]?.tasks.find(t => t.title === title)
  if (!found) throw new Error(`no ${title} on ${date}`)
  return found
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(at(DAY, '06:00'))
  actions.resetForTests(defaultData())
})

afterEach(() => {
  vi.useRealTimers()
})

test('an ongoing block is done once its end has passed, and not a minute before', () => {
  seed(DAY, [{ title: 'Shift', time: '07:00', minutes: 720, unbounded: true }])

  actions.endSelfEndingBlocks(at(DAY, '18:59'))
  expect(task('Shift').done).toBe(false)

  actions.endSelfEndingBlocks(at(DAY, '19:00'))
  expect(task('Shift').done).toBe(true)
})

test('ticked by hand before its end, it is done, and stays done', () => {
  seed(DAY, [{ title: 'Shift', time: '07:00', minutes: 720, unbounded: true }])
  vi.setSystemTime(at(DAY, '15:00'))
  actions.toggleTask(DAY, task('Shift').id)
  expect(task('Shift').done).toBe(true)

  actions.endSelfEndingBlocks(at(DAY, '19:30'))
  expect(task('Shift').done).toBe(true)
  expect(task('Shift').missed).toBeFalsy()
})

test('marked as not having happened, it is not done, and the clock never changes that', () => {
  seed(DAY, [{ title: 'Shift', time: '07:00', minutes: 720, unbounded: true }])
  vi.setSystemTime(at(DAY, '08:00'))
  actions.setTaskMissed(DAY, task('Shift').id, true)

  actions.endSelfEndingBlocks(at(DAY, '19:00'))
  actions.endSelfEndingBlocks(at(addDays(DAY, 1), '09:00'))
  expect(task('Shift').done).toBe(false)
  expect(task('Shift').missed).toBe(true)
})

test("opened the next morning, yesterday's shift and last night's are already done", () => {
  const yesterday = addDays(DAY, -1)
  seed(yesterday, [
    { title: 'Day shift', time: '07:00', minutes: 720, unbounded: true },
    { title: 'Night shift', time: '19:00', minutes: 720, unbounded: true },
  ])

  actions.endSelfEndingBlocks(at(DAY, '07:30'))

  expect(task('Day shift', yesterday).done).toBe(true)
  expect(task('Night shift', yesterday).done).toBe(true)
})

test('a Commute block ends by itself, and another category only once Settings says so', () => {
  seed(DAY, [
    { title: 'Drive in', time: '06:30', minutes: 30, category: 'commute' },
    { title: 'Stretch', time: '07:00', minutes: 20, category: 'health' },
  ])
  actions.endSelfEndingBlocks(at(DAY, '08:00'))
  expect(task('Drive in').done).toBe(true)
  expect(task('Stretch').done).toBe(false)

  actions.setCategoryEndsItself('health', true)
  actions.endSelfEndingBlocks(at(DAY, '08:00'))
  expect(task('Stretch').done).toBe(true)

  // And Commute can be told not to.
  actions.setCategoryEndsItself('commute', false)
  const commute = getData().categories.find(c => c.id === 'commute')!
  expect(endsItself({ id: 'x', title: 'Drive home', done: false, category: 'commute' }, [commute])).toBe(false)
})

test('a block with no time, or no length, has no end, and is left alone', () => {
  seed(DAY, [
    { title: 'Somewhere', minutes: 60, unbounded: true },
    { title: 'Open-ended', time: '09:00', unbounded: true },
  ])
  actions.endSelfEndingBlocks(at(addDays(DAY, 1), '09:00'))
  expect(task('Somewhere').done).toBe(false)
  expect(task('Open-ended').done).toBe(false)
})

test('an ordinary block is never ticked by the clock', () => {
  seed(DAY, [{ title: 'Write the report', time: '09:00', minutes: 60, category: 'core' }])
  actions.endSelfEndingBlocks(at(DAY, '12:00'))
  expect(task('Write the report').done).toBe(false)
})

test('unticked after its end, it did not happen - and the clock does not tick it again', () => {
  seed(DAY, [{ title: 'Drive in', time: '06:30', minutes: 30, category: 'commute' }])
  actions.endSelfEndingBlocks(at(DAY, '07:00'))
  expect(task('Drive in').done).toBe(true)

  vi.setSystemTime(at(DAY, '07:10'))
  actions.toggleTask(DAY, task('Drive in').id)
  actions.endSelfEndingBlocks(at(DAY, '07:20'))
  expect(task('Drive in').done).toBe(false)
  expect(task('Drive in').missed).toBe(true)

  // Ticked again, it happened after all.
  actions.toggleTask(DAY, task('Drive in').id)
  expect(task('Drive in').done).toBe(true)
  expect(task('Drive in').missed).toBeFalsy()
})

test('a day more than a week back is left the way it was', () => {
  const old = addDays(DAY, -9)
  seed(old, [{ title: 'Shift', time: '07:00', minutes: 720, unbounded: true }])
  actions.endSelfEndingBlocks(at(DAY, '12:00'))
  expect(task('Shift', old).done).toBe(false)
})

test('a block that ended by itself counts as done in the score', () => {
  seed(DAY, [
    { title: 'Shift', time: '07:00', minutes: 720, unbounded: true },
    { title: 'Stretch', time: '20:00', minutes: 20, category: 'health' },
  ])
  actions.endSelfEndingBlocks(at(DAY, '19:30'))
  expect(dayScore(getData().days[DAY].tasks)).toEqual({ planned: true, done: 1, total: 2 })
})

test('nothing changed is nothing written', () => {
  seed(DAY, [{ title: 'Shift', time: '07:00', minutes: 720, unbounded: true }])
  const before = getData()
  actions.endSelfEndingBlocks(at(DAY, '10:00'))
  expect(getData()).toBe(before)
})
