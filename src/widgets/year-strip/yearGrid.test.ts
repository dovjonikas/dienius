import { buildYearCells, formatYearCellLabel, monthLabelPositions, weekCount } from './yearGrid'
import type { DayPlan, Template } from '../../lib/types'

const template: Template = { id: 't1', name: 'Office day', color: '#a7c4f5', blocks: [] }

test('builds one cell per day of the year, in date order', () => {
  const cells = buildYearCells(2026, {}, [])
  expect(cells).toHaveLength(365)
  expect(cells[0].key).toBe('2026-01-01')
  expect(cells[cells.length - 1].key).toBe('2026-12-31')
})

test('a leap year gets 366 cells', () => {
  expect(buildYearCells(2028, {}, [])).toHaveLength(366)
})

// January 1st, 2024 fell on a Monday.
test('aligns weekday and week column to a known Monday-starting year', () => {
  const cells = buildYearCells(2024, {}, [])
  expect(cells[0]).toMatchObject({ key: '2024-01-01', weekday: 0, weekIndex: 0 })
  // January 8th is the following Monday.
  const jan8 = cells.find(c => c.key === '2024-01-08')
  expect(jan8).toMatchObject({ weekday: 0, weekIndex: 1 })
  // 2024 is a leap year; December 31st is a Tuesday, 52 full weeks after
  // the first Monday.
  const last = cells[cells.length - 1]
  expect(last).toMatchObject({ key: '2024-12-31', weekday: 1, weekIndex: 52 })
})

// January 1st, 2025 fell on a Wednesday, so the grid's first column is
// only partially filled - weekIndex still starts at 0 for that day.
test('a year that does not start on a Monday still starts at week column 0', () => {
  const cells = buildYearCells(2025, {}, [])
  expect(cells[0]).toMatchObject({ key: '2025-01-01', weekday: 2, weekIndex: 0 })
})

test('weekIndex never resets at a month boundary', () => {
  const cells = buildYearCells(2026, {}, [])
  const jan31 = cells.find(c => c.key === '2026-01-31')!
  const feb1 = cells.find(c => c.key === '2026-02-01')!
  // Consecutive calendar days land in the same or the very next column,
  // never back at 0, regardless of which month they belong to.
  expect(feb1.weekIndex).toBeGreaterThanOrEqual(jan31.weekIndex)
  expect(feb1.weekIndex).toBeLessThanOrEqual(jan31.weekIndex + 1)
})

test('a day with no stored plan has no template color and is not complete', () => {
  const cells = buildYearCells(2026, {}, [])
  const cell = cells.find(c => c.key === '2026-06-15')!
  expect(cell.templateColor).toBeUndefined()
  expect(cell.templateName).toBeUndefined()
  expect(cell.complete).toBe(false)
})

test('a stamped day picks up its template color and name', () => {
  const days: Record<string, DayPlan> = {
    '2026-06-15': { date: '2026-06-15', templateId: 't1', tasks: [{ id: '1', title: 'Gym', done: false }] },
  }
  const cells = buildYearCells(2026, days, [template])
  const cell = cells.find(c => c.key === '2026-06-15')!
  expect(cell.templateColor).toBe('#a7c4f5')
  expect(cell.templateName).toBe('Office day')
})

test('a dangling templateId with no matching template is colored neutrally, not thrown', () => {
  const days: Record<string, DayPlan> = {
    '2026-06-15': { date: '2026-06-15', templateId: 'deleted', tasks: [] },
  }
  expect(() => buildYearCells(2026, days, [])).not.toThrow()
  const cell = buildYearCells(2026, days, []).find(c => c.key === '2026-06-15')!
  expect(cell.templateColor).toBeUndefined()
})

test('a fully finished day is complete', () => {
  const days: Record<string, DayPlan> = {
    '2026-06-15': {
      date: '2026-06-15',
      tasks: [
        { id: '1', title: 'Gym', done: true },
        { id: '2', title: 'Read', done: true },
      ],
    },
  }
  const cell = buildYearCells(2026, days, []).find(c => c.key === '2026-06-15')!
  expect(cell.complete).toBe(true)
})

test('an untemplated day with an unfinished task is planned but not complete', () => {
  // This is the same blind spot the month grid had: a day with no template
  // and no ring used to be indistinguishable from a genuinely empty day.
  // `planned` is what lets a caller tell the two apart even while the day
  // is not yet complete.
  const days: Record<string, DayPlan> = {
    '2026-06-15': { date: '2026-06-15', tasks: [{ id: '1', title: 'Gym', done: false }] },
  }
  const cell = buildYearCells(2026, days, []).find(c => c.key === '2026-06-15')!
  expect(cell.planned).toBe(true)
  expect(cell.complete).toBe(false)
  expect(cell.templateColor).toBeUndefined()
})

test('a day with no stored plan is not planned', () => {
  const cells = buildYearCells(2026, {}, [])
  const cell = cells.find(c => c.key === '2026-06-15')!
  expect(cell.planned).toBe(false)
})

test('a partly finished day is not complete', () => {
  const days: Record<string, DayPlan> = {
    '2026-06-15': {
      date: '2026-06-15',
      tasks: [
        { id: '1', title: 'Gym', done: true },
        { id: '2', title: 'Read', done: false },
      ],
    },
  }
  const cell = buildYearCells(2026, days, []).find(c => c.key === '2026-06-15')!
  expect(cell.complete).toBe(false)
})

test('a shift day with all core tasks done is complete even with optional tasks left undone', () => {
  const days: Record<string, DayPlan> = {
    '2026-06-15': {
      date: '2026-06-15',
      dayType: 'shift',
      tasks: [
        { id: '1', title: 'Handover', done: true, core: true },
        { id: '2', title: 'Coffee', done: false },
      ],
    },
  }
  const cell = buildYearCells(2026, days, []).find(c => c.key === '2026-06-15')!
  expect(cell.complete).toBe(true)
})

test('an empty task list is not complete, the same way it is not a failed 0/0', () => {
  const days: Record<string, DayPlan> = {
    '2026-06-15': { date: '2026-06-15', tasks: [] },
  }
  const cell = buildYearCells(2026, days, []).find(c => c.key === '2026-06-15')!
  expect(cell.complete).toBe(false)
})

test('monthLabelPositions returns twelve ascending entries starting at column 0', () => {
  const cells = buildYearCells(2026, {}, [])
  const labels = monthLabelPositions(cells)
  expect(labels).toHaveLength(12)
  expect(labels[0]).toEqual({ month: 0, weekIndex: 0 })
  for (let i = 1; i < labels.length; i++) {
    expect(labels[i].weekIndex).toBeGreaterThan(labels[i - 1].weekIndex)
  }
})

test('weekCount covers every cell, including a partial final week', () => {
  const cells = buildYearCells(2024, {}, [])
  const count = weekCount(cells)
  expect(cells.every(c => c.weekIndex < count)).toBe(true)
  expect(count).toBe(53)
})

test('weekCount of an empty cell list is zero', () => {
  expect(weekCount([])).toBe(0)
})

test('formatYearCellLabel renders a bare date for an unplanned day', () => {
  const cell = buildYearCells(2026, {}, []).find(c => c.key === '2026-06-15')!
  expect(formatYearCellLabel(cell)).toBe('June 15, 2026')
})

test('formatYearCellLabel names the template on a planned day', () => {
  const days: Record<string, DayPlan> = {
    '2026-06-15': { date: '2026-06-15', templateId: 't1', tasks: [] },
  }
  const cell = buildYearCells(2026, days, [template]).find(c => c.key === '2026-06-15')!
  expect(formatYearCellLabel(cell)).toBe('June 15, 2026, Office day')
})

test('formatYearCellLabel says completed for a finished templated day', () => {
  const days: Record<string, DayPlan> = {
    '2026-06-15': {
      date: '2026-06-15',
      templateId: 't1',
      tasks: [{ id: '1', title: 'Gym', done: true }],
    },
  }
  const cell = buildYearCells(2026, days, [template]).find(c => c.key === '2026-06-15')!
  expect(formatYearCellLabel(cell)).toBe('June 15, 2026, Office day, completed')
})

test('formatYearCellLabel says an untemplated, unfinished day has unfinished tasks', () => {
  const days: Record<string, DayPlan> = {
    '2026-06-15': { date: '2026-06-15', tasks: [{ id: '1', title: 'Gym', done: false }] },
  }
  const cell = buildYearCells(2026, days, []).find(c => c.key === '2026-06-15')!
  expect(formatYearCellLabel(cell)).toBe('June 15, 2026, has unfinished tasks')
})

test('formatYearCellLabel says a stamped, unfinished day has unfinished tasks alongside its template', () => {
  const days: Record<string, DayPlan> = {
    '2026-06-15': {
      date: '2026-06-15',
      templateId: 't1',
      tasks: [
        { id: '1', title: 'Gym', done: true },
        { id: '2', title: 'Call the plumber', done: false },
      ],
    },
  }
  const cell = buildYearCells(2026, days, [template]).find(c => c.key === '2026-06-15')!
  expect(formatYearCellLabel(cell)).toBe('June 15, 2026, Office day, has unfinished tasks')
})

test('formatYearCellLabel says completed with no template name when the day was hand-typed', () => {
  const days: Record<string, DayPlan> = {
    '2026-06-15': { date: '2026-06-15', tasks: [{ id: '1', title: 'Gym', done: true }] },
  }
  const cell = buildYearCells(2026, days, []).find(c => c.key === '2026-06-15')!
  expect(formatYearCellLabel(cell)).toBe('June 15, 2026, completed')
})
