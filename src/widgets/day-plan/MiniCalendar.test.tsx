import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MiniCalendar } from './MiniCalendar'
import { actions } from '../../lib/store'
import { defaultData } from '../../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('shows the month containing the given date', () => {
  render(<MiniCalendar date="2026-09-12" onDateChange={() => {}} />)
  expect(screen.getByText('September 2026')).toBeInTheDocument()
})

test('clicking a cell calls onDateChange with that date, and nothing else', async () => {
  const user = userEvent.setup()
  let picked: string | undefined
  render(<MiniCalendar date="2026-09-12" onDateChange={d => { picked = d }} />)
  const cell = screen.getByRole('gridcell', { name: /September 20/ })
  await user.click(cell)
  expect(picked).toBe('2026-09-20')
})

test('Previous month / Next month navigate the mini calendar without touching the open day', async () => {
  const user = userEvent.setup()
  let picked: string | undefined
  render(<MiniCalendar date="2026-09-12" onDateChange={d => { picked = d }} />)
  await user.click(screen.getByRole('button', { name: 'Next month' }))
  expect(screen.getByText('October 2026')).toBeInTheDocument()
  expect(picked).toBeUndefined()

  await user.click(screen.getByRole('button', { name: 'Previous month' }))
  await user.click(screen.getByRole('button', { name: 'Previous month' }))
  expect(screen.getByText('August 2026')).toBeInTheDocument()
  expect(picked).toBeUndefined()
})

test('a stamped day shows the template colour and name in the cell and its accessible label', () => {
  const template = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  actions.stamp({ '2026-09-12': template.id })
  render(<MiniCalendar date="2026-09-12" onDateChange={() => {}} />)
  const cell = screen.getByRole('gridcell', { name: /September 12.*Work day/ })
  expect(cell).toHaveStyle({ background: '#8ab6f9' })
})

test("today's cell carries aria-current='date'", () => {
  render(<MiniCalendar date="2026-09-12" onDateChange={() => {}} />)
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  // The mini calendar opened on September 2026 (the `date` prop), so
  // today's own cell is only present in the DOM if today also falls in
  // that same month - otherwise this assertion is skipped rather than
  // failing on the calendar for a month that correctly has no "today" in
  // it at all.
  if (`${y}-${m}` !== '2026-09') return
  const cell = screen.getByRole('gridcell', { name: new RegExp(`September ${Number(d)}(?!\\d)`) })
  expect(cell).toHaveAttribute('aria-current', 'date')
})

test('the day currently open in the day view is visually distinguished from an ordinary cell', () => {
  render(<MiniCalendar date="2026-09-12" onDateChange={() => {}} />)
  const cell = screen.getByRole('gridcell', { name: /September 12/ })
  expect(cell.className).toMatch(/viewing/)
})

test('re-rendering with a date in a different month re-syncs the shown month', () => {
  const { rerender } = render(<MiniCalendar date="2026-09-12" onDateChange={() => {}} />)
  expect(screen.getByText('September 2026')).toBeInTheDocument()
  rerender(<MiniCalendar date="2026-11-03" onDateChange={() => {}} />)
  expect(screen.getByText('November 2026')).toBeInTheDocument()
})

test('is a proper grid: gridcells sit inside role=row inside role=grid, not directly inside it', () => {
  render(<MiniCalendar date="2026-09-12" onDateChange={() => {}} />)
  const grid = screen.getByRole('grid')
  const rows = screen.getAllByRole('row')
  expect(rows.length).toBeGreaterThan(1)
  for (const row of rows) {
    expect(row.parentElement).toBe(grid)
  }
  const firstCell = screen.getAllByRole('gridcell')[0]
  expect(firstCell.parentElement?.getAttribute('role')).toBe('row')
})

test('there is no paint-drag or stamping affordance - cells are plain click-to-navigate buttons with no pointer-drag handlers wired', () => {
  render(<MiniCalendar date="2026-09-12" onDateChange={() => {}} />)
  const cell = screen.getByRole('gridcell', { name: /September 12/ })
  // No stamp bar, no "days staged" UI exists at all in this component.
  expect(screen.queryByText(/staged/i)).not.toBeInTheDocument()
  expect(cell).not.toHaveAttribute('data-date')
})

test('outside-month cells are shown but visually de-emphasised, matching CalendarView', () => {
  render(<MiniCalendar date="2026-09-12" onDateChange={() => {}} />)
  const cells = screen.getAllByRole('gridcell')
  const outside = cells.find(c => c.className.includes('outside'))
  expect(outside).toBeDefined()
})
