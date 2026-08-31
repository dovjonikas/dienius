import { dayScore, formatDayScore } from './score'
import type { Task } from '../../lib/types'

function task(title: string, done: boolean, core = false): Task {
  return { id: title, title, done, core: core || undefined }
}

test('a day with tasks scores done over total', () => {
  const score = dayScore([task('a', true), task('b', false), task('c', true)])
  expect(score).toEqual({ planned: true, done: 2, total: 3 })
})

test('a day with no tasks reports no plan, not zero', () => {
  const score = dayScore([])
  expect(score).toEqual({ planned: false })
})

test('a fully done day scores done equal to total', () => {
  const score = dayScore([task('a', true), task('b', true)])
  expect(score).toEqual({ planned: true, done: 2, total: 2 })
})

test('a day with nothing done yet still counts as planned, not no-plan', () => {
  const score = dayScore([task('a', false), task('b', false)])
  expect(score).toEqual({ planned: true, done: 0, total: 2 })
})

test('a single hand-typed task still counts as a plan', () => {
  const score = dayScore([task('a', false)])
  expect(score).toEqual({ planned: true, done: 0, total: 1 })
})

test('formats a planned day as a plain fraction', () => {
  expect(formatDayScore({ planned: true, done: 4, total: 6 })).toBe('4/6')
})

test('formats an unplanned day as null, never a placeholder fraction', () => {
  expect(formatDayScore({ planned: false })).toBeNull()
})

test('does not render a percentage anywhere in the formatted output', () => {
  const formatted = formatDayScore({ planned: true, done: 1, total: 3 })
  expect(formatted).not.toMatch(/%/)
})

test('a full day counts every task regardless of core, same as omitting the day type', () => {
  const tasks = [task('a', true, true), task('b', false, false), task('c', true, false)]
  expect(dayScore(tasks, 'full')).toEqual({ planned: true, done: 2, total: 3 })
  expect(dayScore(tasks)).toEqual({ planned: true, done: 2, total: 3 })
})

test('a shift day counts only core tasks, ignoring the rest entirely', () => {
  const tasks = [task('Shift', true, true), task('Errand', false, false), task('Gym', false, false)]
  expect(dayScore(tasks, 'shift')).toEqual({ planned: true, done: 1, total: 1 })
})

test('a night day counts only core tasks, the same rule as shift', () => {
  const tasks = [task('Overnight', false, true), task('Snack', true, false)]
  expect(dayScore(tasks, 'night')).toEqual({ planned: true, done: 0, total: 1 })
})

test('a rest day counts only core tasks, the same rule as shift and night', () => {
  const tasks = [task('Nothing required', true, false)]
  expect(dayScore(tasks, 'rest')).toEqual({ planned: false })
})

test('a non-full day with tasks but none of them core reports no plan, not a zero', () => {
  const tasks = [task('Optional one', false, false), task('Optional two', true, false)]
  expect(dayScore(tasks, 'shift')).toEqual({ planned: false })
})

test('a non-full day with every task core behaves exactly like a full day of the same tasks', () => {
  const tasks = [task('a', true, true), task('b', false, true)]
  expect(dayScore(tasks, 'shift')).toEqual({ planned: true, done: 1, total: 2 })
})
