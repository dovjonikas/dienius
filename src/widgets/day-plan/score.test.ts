import { dayScore, formatDayScore } from './score'
import type { Task } from '../../lib/types'

function task(title: string, done: boolean): Task {
  return { id: title, title, done }
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
