import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YearStrip } from './YearStrip'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  vi.setSystemTime(new Date(2026, 5, 15)) // June 15th, 2026
})

afterEach(() => {
  vi.useRealTimers()
})

test('renders a grid labeled with the current year by default', () => {
  render(<YearStrip onOpenDay={() => {}} />)
  expect(screen.getByRole('heading', { name: '2026' })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Days of 2026' })).toBeInTheDocument()
})

test('clicking a day cell opens that day', async () => {
  const user = userEvent.setup()
  let opened = ''
  render(<YearStrip onOpenDay={d => (opened = d)} />)
  const grid = screen.getByRole('group', { name: 'Days of 2026' })
  const cell = within(grid).getByRole('button', { name: 'June 15, 2026' })
  await user.click(cell)
  expect(opened).toBe('2026-06-15')
})

test('only one cell is a tab stop; the rest are reachable by arrow keys', () => {
  render(<YearStrip onOpenDay={() => {}} />)
  const grid = screen.getByRole('group', { name: 'Days of 2026' })
  const cells = within(grid).getAllByRole('button')
  const tabbable = cells.filter(c => c.getAttribute('tabindex') === '0')
  expect(tabbable).toHaveLength(1)
  // Today, since the strip opened on the current year.
  expect(tabbable[0]).toHaveAttribute('aria-label', 'June 15, 2026')
})

// A year is 365 buttons. A `getByRole` name query computes the accessible name
// for every one of them, and this test re-queries after each of four keystrokes,
// which is what pushed it past the 5s timeout under full-suite load. Selecting
// by `data-date` reads one attribute instead of walking the tree, and the
// accessible names themselves are already covered by the tests above.
function cellAt(grid: HTMLElement, date: string): HTMLElement {
  const cell = grid.querySelector<HTMLElement>(`[data-date="${date}"]`)
  if (!cell) throw new Error(`no year cell for ${date}`)
  return cell
}

test('arrow keys move the roving tab stop and DOM focus one day at a time', async () => {
  const user = userEvent.setup({ delay: null })
  render(<YearStrip onOpenDay={() => {}} />)
  const grid = screen.getByRole('group', { name: 'Days of 2026' })
  cellAt(grid, '2026-06-15').focus()
  await user.keyboard('{ArrowRight}')
  expect(cellAt(grid, '2026-06-16')).toHaveFocus()
  await user.keyboard('{ArrowDown}')
  expect(cellAt(grid, '2026-06-23')).toHaveFocus()
  await user.keyboard('{ArrowLeft}')
  expect(cellAt(grid, '2026-06-22')).toHaveFocus()
  await user.keyboard('{ArrowUp}')
  expect(cellAt(grid, '2026-06-15')).toHaveFocus()
})

test('Home and End jump to the first and last day of the year', async () => {
  const user = userEvent.setup({ delay: null })
  render(<YearStrip onOpenDay={() => {}} />)
  const grid = screen.getByRole('group', { name: 'Days of 2026' })
  within(grid).getByRole('button', { name: 'June 15, 2026' }).focus()
  await user.keyboard('{Home}')
  expect(within(grid).getByRole('button', { name: 'January 1, 2026' })).toHaveFocus()
  await user.keyboard('{End}')
  expect(within(grid).getByRole('button', { name: 'December 31, 2026' })).toHaveFocus()
})

test('arrow keys do not cross into a year that is not rendered', async () => {
  const user = userEvent.setup()
  render(<YearStrip onOpenDay={() => {}} />)
  const grid = screen.getByRole('group', { name: 'Days of 2026' })
  within(grid).getByRole('button', { name: 'December 31, 2026' }).focus()
  await user.keyboard('{ArrowRight}')
  // Still on the same cell - there is no January 1st, 2027 cell to move to.
  expect(within(grid).getByRole('button', { name: 'December 31, 2026' })).toHaveFocus()
})

test('previous and next year move the strip, resetting to January 1st for a non-current year', async () => {
  const user = userEvent.setup()
  render(<YearStrip onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Previous year' }))
  expect(screen.getByRole('heading', { name: '2025' })).toBeInTheDocument()
  const grid = screen.getByRole('group', { name: 'Days of 2025' })
  const cells = within(grid).getAllByRole('button')
  const tabbable = cells.find(c => c.getAttribute('tabindex') === '0')
  expect(tabbable).toHaveAttribute('aria-label', 'January 1, 2025')
})

test('a stamped, fully finished day is colored and marked complete', () => {
  const t = actions.addTemplate({ name: 'Office day', color: '#a7c4f5', blocks: [] })
  actions.stamp({ '2026-06-10': t.id })
  actions.addTask('2026-06-10', 'Standup')
  const taskId = getData().days['2026-06-10'].tasks[0].id
  actions.toggleTask('2026-06-10', taskId)

  render(<YearStrip onOpenDay={() => {}} />)
  const grid = screen.getByRole('group', { name: 'Days of 2026' })
  const cell = within(grid).getByRole('button', { name: 'June 10, 2026, Office day, completed' })
  expect(cell).toHaveStyle({ background: '#a7c4f5' })
  expect(cell).toHaveClass('year-cell-complete')
})

test('an untemplated day with an unfinished task is marked as planned, not left looking empty', () => {
  // The same bug the month grid had: a day with an unfinished task and no
  // template used to render exactly like a day with nothing on it at all.
  act(() => {
    actions.addTask('2026-06-15', 'Water the plants')
  })
  render(<YearStrip onOpenDay={() => {}} />)
  const grid = screen.getByRole('group', { name: 'Days of 2026' })
  const cell = within(grid).getByRole('button', { name: 'June 15, 2026, has unfinished tasks' })
  expect(cell).toHaveClass('year-cell-planned')
  expect(cell).not.toHaveClass('year-cell-complete')
  expect(cell.style.background).toBe('')

  const empty = within(grid).getByRole('button', { name: 'June 16, 2026' })
  expect(empty).not.toHaveClass('year-cell-planned')
})

test('an unplanned day renders with no template color and no completion mark', () => {
  render(<YearStrip onOpenDay={() => {}} />)
  const grid = screen.getByRole('group', { name: 'Days of 2026' })
  const cell = within(grid).getByRole('button', { name: 'June 15, 2026' })
  expect(cell).not.toHaveClass('year-cell-complete')
  expect(cell.style.background).toBe('')
})

test('lists the distinct templates used this year as a named legend, not color alone', () => {
  const office = actions.addTemplate({ name: 'Office day', color: '#a7c4f5', blocks: [] })
  const rest = actions.addTemplate({ name: 'Rest day', color: '#a7e3bd', blocks: [] })
  actions.stamp({ '2026-06-10': office.id, '2026-06-13': rest.id, '2026-06-20': office.id })
  render(<YearStrip onOpenDay={() => {}} />)
  expect(screen.getByText('Office day')).toBeInTheDocument()
  expect(screen.getByText('Rest day')).toBeInTheDocument()
})

test('a year with nothing stamped shows no template legend', () => {
  render(<YearStrip onOpenDay={() => {}} />)
  expect(screen.queryByText(/day$/)).not.toBeInTheDocument()
})

test('never claims grid semantics it does not honor', () => {
  // role="grid" requires role="row" children wrapping the cells; this
  // layout has no grouping that is honest about both the visual axes
  // (weeks as columns, weekdays as rows) and the calendar-relative
  // keyboard scheme (right/left move by day, up/down move by week) at
  // once, so it deliberately claims neither role. Pinned here so a future
  // change cannot silently reintroduce a role="grid" that role="row"
  // never follows.
  const { container } = render(<YearStrip onOpenDay={() => {}} />)
  expect(container.querySelector('[role="grid"]')).toBeNull()
  expect(container.querySelector('[role="row"]')).toBeNull()
  expect(container.querySelector('[role="gridcell"]')).toBeNull()

  const group = screen.getByRole('group', { name: 'Days of 2026' })
  expect(group).toHaveAttribute('aria-describedby', 'year-strip-legend')
  // Cells inside are plain buttons, not gridcells.
  const buttons = within(group).getAllByRole('button')
  expect(buttons.length).toBeGreaterThan(300)
})

test('carries no aggregate numbers anywhere in its own text', () => {
  const { container } = render(<YearStrip onOpenDay={() => {}} />)
  const text = container.textContent ?? ''
  expect(text).not.toMatch(/%/)
  expect(text).not.toMatch(/\btotal\b/i)
  expect(text).not.toMatch(/\baverage\b/i)
  expect(text).not.toMatch(/\bstreak\b/i)
  expect(text).not.toMatch(/\bbest\b/i)
})
