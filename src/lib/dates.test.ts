import { dateKey, addDays, monthAndDay, monthGrid, formatDayTitle, weekdayName } from './dates'

test('dateKey formats local date as YYYY-MM-DD', () => {
  expect(dateKey(new Date(2026, 8, 1))).toBe('2026-09-01')
})

test('addDays crosses month boundaries', () => {
  expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
})

// --- the month grid ------------------------------------------------------
//
// Whole Monday-to-Sunday weeks, and only the ones the month is actually in.
// It used to be a flat 42 cells: September 2026 fills five rows exactly and
// the sixth was a whole week of October drawn under the month, spending a
// seventh of the height the zero-scroll rule fights for on days nobody asked
// about.

test('monthGrid starts on the Monday of the week the first falls in', () => {
  const cells = monthGrid(2026, 8) // September 2026, Tuesday the 1st
  expect(cells[0]).toEqual({ key: '2026-08-31', inMonth: false }) // Monday
  expect(cells[1]).toEqual({ key: '2026-09-01', inMonth: true })
})

test('a month that fits in five weeks gets five, not six', () => {
  const cells = monthGrid(2026, 8) // 30 days from a Tuesday: 35 cells
  expect(cells).toHaveLength(35)
  expect(cells.at(-1)).toEqual({ key: '2026-10-04', inMonth: false })
})

test('a month that needs six weeks gets six', () => {
  // March 2026 starts on a Sunday, so its first is the last cell of week one.
  expect(monthGrid(2026, 2)).toHaveLength(42)
})

test('a February of exactly four weeks starting on a Monday gets four', () => {
  const cells = monthGrid(2027, 1)
  expect(cells).toHaveLength(28)
  expect(cells[0]).toEqual({ key: '2027-02-01', inMonth: true })
  expect(cells.at(-1)).toEqual({ key: '2027-02-28', inMonth: true })
})

test('every grid is a whole number of weeks and covers every day of its month', () => {
  for (let month = 0; month < 12; month++) {
    const cells = monthGrid(2026, month)
    expect(cells.length % 7).toBe(0)
    const inMonth = cells.filter(c => c.inMonth).length
    expect(inMonth).toBe(new Date(2026, month + 1, 0).getDate())
  }
})

test('formatDayTitle renders a readable title', () => {
  expect(formatDayTitle('2026-09-01')).toBe('Tuesday, September 1')
})

// The widest day this format can print - the longest weekday, the longest
// month, two digits - which is what the day header's block was sized
// against while it was measured by a hidden copy of it. The block is the
// month's own width now and the two halves below are what it prints, but
// the string is still the worst case any of them has to fit, so it is
// pinned here where a change to the format shows up first.
test('the widest day the format prints is 2026-09-30: Wednesday, September 30', () => {
  expect(formatDayTitle('2026-09-30')).toBe('Wednesday, September 30')
})

// The two halves the wide header prints instead, because the whole form is
// 250px in the heading's type and the block is 240 with two arrows in it.
// Together they say the same date.
test('the header prints the day in two halves, and they add up to the whole', () => {
  expect(weekdayName('2026-09-30')).toBe('Wednesday')
  expect(monthAndDay('2026-09-30')).toBe('September 30')
  expect(`${weekdayName('2026-09-30')}, ${monthAndDay('2026-09-30')}`).toBe(formatDayTitle('2026-09-30'))
})
