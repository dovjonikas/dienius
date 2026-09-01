import { beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarView } from './CalendarView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('switching to the year view shows the year strip and hides the month grid', async () => {
  const user = userEvent.setup()
  render(<CalendarView onOpenDay={() => {}} />)
  expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Year' }))
  expect(screen.queryByRole('button', { name: 'Previous month' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous year' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Month' }))
  expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Previous year' })).not.toBeInTheDocument()
})

test('the month grid wraps each week in a row, so gridcells never sit directly inside the grid', () => {
  // role="grid" requires role="row" children wrapping the row="gridcell"
  // buttons - this is a genuine two-dimensional calendar (weeks as visual
  // rows, weekdays as visual columns, and the same axes for keyboard
  // navigation), unlike the year strip, so the fix here is to complete the
  // structure rather than drop it.
  render(<CalendarView onOpenDay={() => {}} />)
  const grid = screen.getByRole('grid')
  const rows = screen.getAllByRole('row')
  expect(rows.length).toBeGreaterThan(1)
  for (const row of rows) {
    expect(grid).toContainElement(row)
  }
  const gridcells = screen.getAllByRole('gridcell')
  expect(gridcells).toHaveLength(42)
  for (const cell of gridcells) {
    expect(cell.closest('[role="row"]')).not.toBeNull()
  }
  // The header row names each weekday as a column header, not a bare cell.
  expect(screen.getAllByRole('columnheader')).toHaveLength(7)
})

test('each day cell announces its full date, not just the bare day number', () => {
  render(<CalendarView onOpenDay={() => {}} />)
  const gridcells = screen.getAllByRole('gridcell')
  // Every cell's accessible name is a real date, e.g. "Wednesday, June 3" -
  // not the bare "3" a sighted user sees, which is meaningless out of the
  // visual grid a screen reader user is not looking at.
  for (const cell of gridcells) {
    expect(cell.getAttribute('aria-label')).toMatch(/^\w+day, \w+ \d{1,2}/)
  }
})

test('clicking a day outside stamp mode opens it', async () => {
  const user = userEvent.setup()
  let opened = ''
  render(<CalendarView onOpenDay={d => (opened = d)} />)
  await user.click(screen.getAllByRole('gridcell')[10])
  expect(opened).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('stamping a day stages it and save commits it', async () => {
  const user = userEvent.setup()
  const t = actions.addTemplate({
    name: 'Work day',
    color: '#a7c4f5',
    blocks: [{ time: '09:00', title: 'Gym' }],
  })
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  await user.click(screen.getAllByRole('gridcell')[10])
  expect(getData().days).toEqual({})
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const stamped = Object.values(getData().days)
  expect(stamped).toHaveLength(1)
  expect(stamped[0].templateId).toBe(t.id)
  expect(stamped[0].tasks[0].title).toBe('Gym')
})

test('clicking a stamped day again stages removal', async () => {
  const user = userEvent.setup()
  const t = actions.addTemplate({ name: 'Work day', color: '#a7c4f5', blocks: [] })
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  const cell = screen.getAllByRole('gridcell')[10]
  await user.click(cell)
  await user.click(cell)
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const days = Object.values(getData().days)
  expect(days.every(d => d.templateId !== t.id)).toBe(true)
})

test('dragging across cells stamps the whole swept range and save commits all of them', async () => {
  const user = userEvent.setup()
  const t = actions.addTemplate({
    name: 'Work day',
    color: '#a7c4f5',
    blocks: [{ time: '09:00', title: 'Gym' }],
  })
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  const cells = screen.getAllByRole('gridcell')
  const dates = [10, 11, 12].map(i => cells[i].getAttribute('data-date'))

  fireEvent.pointerDown(cells[10], { pointerId: 1 })
  fireEvent.pointerEnter(cells[11], { pointerId: 1 })
  fireEvent.pointerEnter(cells[12], { pointerId: 1 })
  fireEvent.pointerUp(cells[12], { pointerId: 1 })

  expect(getData().days).toEqual({})
  await user.click(screen.getByRole('button', { name: 'Save' }))

  for (const date of dates) {
    expect(getData().days[date as string].templateId).toBe(t.id)
    expect(getData().days[date as string].tasks[0].title).toBe('Gym')
  }
})

test('dragging from an already-stamped day erases the whole swept range', async () => {
  const user = userEvent.setup()
  const t = actions.addTemplate({ name: 'Work day', color: '#a7c4f5', blocks: [] })
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  const cells = screen.getAllByRole('gridcell')
  const [d10, d11, d12] = [10, 11, 12].map(i => cells[i].getAttribute('data-date') as string)

  // Stamp and save two adjacent days, leaving a third bare.
  fireEvent.pointerDown(cells[10], { pointerId: 1 })
  fireEvent.pointerEnter(cells[11], { pointerId: 1 })
  fireEvent.pointerUp(cells[11], { pointerId: 1 })
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().days[d10].templateId).toBe(t.id)
  expect(getData().days[d11].templateId).toBe(t.id)
  expect(getData().days[d12]).toBeUndefined()

  // Re-enter stamp mode and drag starting from an already-stamped day, sweeping
  // through the bare day and on to the other stamped day.
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  fireEvent.pointerDown(cells[11], { pointerId: 1 })
  fireEvent.pointerEnter(cells[12], { pointerId: 1 })
  fireEvent.pointerEnter(cells[10], { pointerId: 1 })
  fireEvent.pointerUp(cells[10], { pointerId: 1 })
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const days = getData().days
  expect(days[d10]?.templateId).not.toBe(t.id)
  expect(days[d11]?.templateId).not.toBe(t.id)
  // The mode is fixed once, from the cell the drag started on. If each cell
  // toggled independently instead, the bare day (unstamped before the drag)
  // would have ended up stamped rather than staying clear.
  expect(days[d12]?.templateId).not.toBe(t.id)
})

test('cancel discards staged changes completely, leaving the store untouched', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Work day', color: '#a7c4f5', blocks: [] })
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  const cells = screen.getAllByRole('gridcell')

  fireEvent.pointerDown(cells[10], { pointerId: 1 })
  fireEvent.pointerEnter(cells[11], { pointerId: 1 })
  fireEvent.pointerUp(cells[11], { pointerId: 1 })

  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(getData().days).toEqual({})
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
})

test('a day with an unfinished task and no template is visibly different from an empty day', () => {
  // This is the bug as the owner found it: push a task to tomorrow, then
  // look at the calendar. A cell built only from templateId cannot tell an
  // untemplated day that holds a real task apart from one that holds
  // nothing at all.
  render(<CalendarView onOpenDay={() => {}} />)
  const cells = screen.getAllByRole('gridcell')
  const target = cells[10]
  const date = target.getAttribute('data-date') as string
  const empty = cells[11]

  expect(target.className).not.toContain('cell-has-tasks')

  act(() => {
    actions.addTask(date, 'Finish the report')
  })

  const updated = screen.getAllByRole('gridcell').find(c => c.getAttribute('data-date') === date)!
  expect(updated).toHaveClass('cell-has-tasks')
  expect(updated).not.toHaveClass('cell-tasks-done')
  expect(updated).not.toHaveClass('cell-has-template')
  expect(updated.getAttribute('aria-label')).toMatch(/unfinished/i)
  // The neighboring, genuinely empty day still reads as empty.
  expect(empty).not.toHaveClass('cell-has-tasks')
})

test('a day with only completed tasks and no template reads as done, not as unfinished', () => {
  render(<CalendarView onOpenDay={() => {}} />)
  const cells = screen.getAllByRole('gridcell')
  const date = cells[10].getAttribute('data-date') as string

  act(() => {
    actions.addTask(date, 'Water the plants')
  })
  const taskId = getData().days[date].tasks[0].id
  act(() => {
    actions.toggleTask(date, taskId)
  })

  const updated = screen.getAllByRole('gridcell').find(c => c.getAttribute('data-date') === date)!
  expect(updated).toHaveClass('cell-has-tasks')
  expect(updated).toHaveClass('cell-tasks-done')
  expect(updated.getAttribute('aria-label')).not.toMatch(/unfinished/i)
  expect(updated.getAttribute('aria-label')).toMatch(/complet/i)
})

test('a stamped day with an extra hand-added unfinished task still reads as unfinished', () => {
  const t = actions.addTemplate({
    name: 'Work day',
    color: '#a7c4f5',
    blocks: [{ time: '09:00', title: 'Gym' }],
  })
  render(<CalendarView onOpenDay={() => {}} />)
  const cells = screen.getAllByRole('gridcell')
  const date = cells[10].getAttribute('data-date') as string

  act(() => {
    actions.stamp({ [date]: t.id })
  })
  const gymId = getData().days[date].tasks[0].id
  act(() => {
    actions.toggleTask(date, gymId)
    actions.addTask(date, 'Call the plumber')
  })

  const updated = screen.getAllByRole('gridcell').find(c => c.getAttribute('data-date') === date)!
  expect(updated).toHaveClass('cell-has-template')
  expect(updated).toHaveClass('cell-has-tasks')
  expect(updated).not.toHaveClass('cell-tasks-done')
  expect(updated.getAttribute('aria-label')).toMatch(/unfinished/i)
})

test('a day whose template was deleted still shows its remaining tasks', () => {
  const t = actions.addTemplate({ name: 'Work day', color: '#a7c4f5', blocks: [{ title: 'Gym' }] })
  render(<CalendarView onOpenDay={() => {}} />)
  const cells = screen.getAllByRole('gridcell')
  const date = cells[10].getAttribute('data-date') as string

  act(() => {
    actions.stamp({ [date]: t.id })
    actions.deleteTemplate(t.id)
  })

  const updated = screen.getAllByRole('gridcell').find(c => c.getAttribute('data-date') === date)!
  expect(updated).not.toHaveClass('cell-has-template')
  expect(updated).toHaveClass('cell-has-tasks')
  expect(updated.getAttribute('aria-label')).toMatch(/unfinished/i)
})

test('staged changes survive navigating to another month and back, and save applies them to the right date', async () => {
  const user = userEvent.setup()
  const t = actions.addTemplate({
    name: 'Work day',
    color: '#a7c4f5',
    blocks: [{ time: '09:00', title: 'Gym' }],
  })
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  const cell = screen.getAllByRole('gridcell')[10]
  const date = cell.getAttribute('data-date') as string

  fireEvent.pointerDown(cell, { pointerId: 1 })
  fireEvent.pointerUp(cell, { pointerId: 1 })

  await user.click(screen.getByRole('button', { name: 'Next month' }))
  // The staged day is not on screen in the new month, but the save bar stays
  // and still explains what it is about to commit.
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  expect(screen.getByText('1 day staged')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Previous month' }))
  const restored = screen.getAllByRole('gridcell').find(c => c.getAttribute('data-date') === date)
  expect(restored).toHaveClass('staged')

  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().days[date].templateId).toBe(t.id)
  expect(getData().days[date].tasks[0].title).toBe('Gym')
})

test('with no templates saved, the calendar explains why there is nothing to stamp instead of just omitting the stamp bar', () => {
  render(<CalendarView onOpenDay={() => {}} />)
  expect(screen.queryByText('Stamp:')).not.toBeInTheDocument()
  expect(screen.getByText(/no templates yet/i)).toBeInTheDocument()
})

test('the calendar empty-templates message offers a way to go build one', async () => {
  const user = userEvent.setup()
  const onOpenTemplates = vi.fn()
  render(<CalendarView onOpenDay={() => {}} onOpenTemplates={onOpenTemplates} />)
  await user.click(screen.getByRole('button', { name: /create a template/i }))
  expect(onOpenTemplates).toHaveBeenCalledTimes(1)
})

test('once a template exists, the calendar empty-templates message is gone', () => {
  actions.addTemplate({ name: 'Work day', color: '#a7c4f5', blocks: [] })
  render(<CalendarView onOpenDay={() => {}} />)
  expect(screen.queryByText(/no templates yet/i)).not.toBeInTheDocument()
})
