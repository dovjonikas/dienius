import { expect, test } from 'vitest'
import { dateFromArrow, tabStopFor } from './gridKeys'
import { monthGrid } from './dates'

test('the four arrows move a day, a day, a week and a week', () => {
  expect(dateFromArrow('ArrowLeft', '2026-09-16')).toBe('2026-09-15')
  expect(dateFromArrow('ArrowRight', '2026-09-16')).toBe('2026-09-17')
  expect(dateFromArrow('ArrowUp', '2026-09-16')).toBe('2026-09-09')
  expect(dateFromArrow('ArrowDown', '2026-09-16')).toBe('2026-09-23')
})

test('a key that is not an arrow moves nowhere, so the grid leaves it alone', () => {
  expect(dateFromArrow('Enter', '2026-09-16')).toBeNull()
  expect(dateFromArrow('Tab', '2026-09-16')).toBeNull()
})

test('arrows cross a month boundary, which is where the grid has to turn the page', () => {
  expect(dateFromArrow('ArrowRight', '2026-09-30')).toBe('2026-10-01')
  expect(dateFromArrow('ArrowUp', '2026-09-03')).toBe('2026-08-27')
})

/**
 * One tab stop per grid: the viewed day when it is on the page, today when
 * it is, and otherwise the first of the month - never a cell from the
 * month before that only fills out the first row.
 */
test('the tab stop is the viewed day, then today, then the first of the month', () => {
  const cells = monthGrid(2026, 8)
  expect(tabStopFor(cells, ['2026-09-12', '2026-09-16'])).toBe('2026-09-12')
  expect(tabStopFor(cells, ['2026-10-12', '2026-09-16'])).toBe('2026-09-16')
  expect(tabStopFor(cells, ['2026-10-12', '2026-11-01'])).toBe('2026-09-01')
  expect(tabStopFor(cells, [null, undefined])).toBe('2026-09-01')
})
