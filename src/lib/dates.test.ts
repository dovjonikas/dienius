import { dateKey, addDays, monthGrid, formatDayTitle } from './dates'

test('dateKey formats local date as YYYY-MM-DD', () => {
  expect(dateKey(new Date(2026, 8, 1))).toBe('2026-09-01')
})

test('addDays crosses month boundaries', () => {
  expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
})

test('monthGrid returns 42 cells starting on Monday', () => {
  const cells = monthGrid(2026, 8) // September 2026, Tuesday the 1st
  expect(cells).toHaveLength(42)
  expect(cells[0]).toEqual({ key: '2026-08-31', inMonth: false }) // Monday
  expect(cells[1]).toEqual({ key: '2026-09-01', inMonth: true })
})

test('formatDayTitle renders a readable title', () => {
  expect(formatDayTitle('2026-09-01')).toBe('Tuesday, September 1')
})
