import { beforeEach, expect, test } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
