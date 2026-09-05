import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { DayView } from './DayView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  actions.resetForTests(defaultData())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint
})

// jsdom does not implement document.elementFromPoint at all (not even as
// a stub returning null), unlike a real browser where DayView.tsx's own
// drag handling relies on it - see the comment on targetAt in
// DayView.tsx and CalendarView.tsx's own established use of the same
// technique. Assigning it directly (rather than vi.spyOn, which requires
// the property to already exist) is the standard workaround.
function mockElementFromPoint(el: Element | null) {
  document.elementFromPoint = vi.fn(() => el) as typeof document.elementFromPoint
}

function seed(tasks: Parameters<typeof actions.resetForTests>[0]['days'][string]['tasks'], timelineExpanded = false) {
  actions.resetForTests({
    ...defaultData(),
    settings: { ...defaultData().settings, timelineExpanded },
    days: { [DATE]: { date: DATE, tasks } },
  })
}

// Shift 09:00-10:00, Gym 11:00-11:30 - the same fixture the tap-a-gap
// tests already use, so "10:00" and "1h free" mean the same thing here.
const SHIFT = { id: 'shift', title: 'Shift', done: false, time: '09:00', minutes: 60 }
const GYM = { id: 'gym', title: 'Gym', done: false, time: '11:00', minutes: 30 }

test('no task row carries a drag handle any more - only the grid\'s own anchor block starts a drag', () => {
  seed([SHIFT, { id: 'guitar', title: 'Guitar', done: false, minutes: 20 }], true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(container.querySelector('[data-drag-handle]')).toBeNull()
  expect(container.querySelector('.timeline-anchor')).toBeInTheDocument()
})

test('dragging an anchor block back onto the tray un-anchors it', () => {
  seed([{ id: 'guitar', title: 'Guitar', done: false, time: '10:00', minutes: 20 }], true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)

  const block = container.querySelector('.timeline-anchor')!
  fireEvent.pointerDown(block, { pointerId: 1, clientX: 100, clientY: 100 })

  const taskList = container.querySelector('.task-list')!
  mockElementFromPoint(taskList)
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 100, clientY: 400 })

  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBeUndefined()
})

test('a bare tap on an anchor block - pointerdown and pointerup with no real movement - does not un-anchor it', () => {
  seed([{ id: 'guitar', title: 'Guitar', done: false, time: '10:00', minutes: 20 }], true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)

  const block = container.querySelector('.timeline-anchor')!
  const taskList = container.querySelector('.task-list')!
  mockElementFromPoint(taskList)
  fireEvent.pointerDown(block, { pointerId: 1, clientX: 100, clientY: 100 })
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 100, clientY: 100 })

  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBe('10:00')
})

test('pressing Escape mid-drag cancels it without changing anything', () => {
  seed([{ id: 'guitar', title: 'Guitar', done: false, time: '10:00', minutes: 20 }], true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)

  const block = container.querySelector('.timeline-anchor')!
  fireEvent.pointerDown(block, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.keyDown(document, { key: 'Escape' })

  const taskList = container.querySelector('.task-list')!
  mockElementFromPoint(taskList)
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 20, clientY: 400 })

  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBe('10:00')
})

test('a done anchor never carries the grid\'s own drag wiring', () => {
  seed([{ id: 'guitar', title: 'Guitar', done: true, time: '10:00', minutes: 20 }], true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(container.querySelector('.timeline-anchor')).not.toHaveClass('timeline-anchor-draggable')
})

test('the row\'s menu button opens the same actions menu a long press does', async () => {
  seed([SHIFT, GYM, { id: 'guitar', title: 'Guitar', done: false, minutes: 20 }], true)
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)

  fireEvent.click(screen.getByRole('button', { name: 'More actions for Guitar' }))
  expect(screen.getByRole('dialog', { name: 'Guitar' })).toBeInTheDocument()
})

test('a done task\'s menu button still opens the actions menu, offering only delete', async () => {
  seed([{ id: 'guitar', title: 'Guitar', done: true, minutes: 20 }])
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)

  fireEvent.click(screen.getByRole('button', { name: 'More actions for Guitar' }))
  const dialog = screen.getByRole('dialog', { name: 'Guitar' })
  expect(within(dialog).getByRole('button', { name: 'Delete Guitar' })).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: /free/i })).not.toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: /push/i })).not.toBeInTheDocument()
})

test('long-pressing a float row opens the actions menu, and the checkbox is not toggled by the click that follows', () => {
  vi.useFakeTimers()
  seed([SHIFT, GYM, { id: 'guitar', title: 'Guitar', done: false, minutes: 20 }], true)
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)

  const checkbox = screen.getByRole('checkbox', { name: 'Guitar' })
  const label = checkbox.closest('label')!
  fireEvent.pointerDown(label, { clientX: 0, clientY: 0 })
  act(() => { vi.advanceTimersByTime(500) })
  fireEvent.pointerUp(label)
  fireEvent.click(label)

  expect(screen.getByRole('dialog', { name: 'Guitar' })).toBeInTheDocument()
  expect(checkbox).not.toBeChecked()
})

test('placing a float through the actions menu works even while the grid is collapsed', () => {
  vi.useFakeTimers()
  seed([SHIFT, GYM, { id: 'guitar', title: 'Guitar', done: false, minutes: 20 }], false)
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(screen.getByRole('button', { name: 'Show timeline' })).toBeInTheDocument()

  const checkbox = screen.getByRole('checkbox', { name: 'Guitar' })
  const label = checkbox.closest('label')!
  fireEvent.pointerDown(label, { clientX: 0, clientY: 0 })
  act(() => { vi.advanceTimersByTime(500) })
  fireEvent.pointerUp(label)

  expect(screen.getByRole('dialog', { name: 'Guitar' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /1h free/i }))

  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBe('10:00')
  // Unaffected by the sheet's own action - the grid stays exactly as
  // collapsed or expanded as it was, since this path never touches it.
  expect(screen.getByRole('button', { name: 'Show timeline' })).toBeInTheDocument()
})

test('long-pressing an anchor row opens a menu offering to remove its time', () => {
  vi.useFakeTimers()
  seed([{ id: 'guitar', title: 'Guitar', done: false, time: '10:00', minutes: 20 }])
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)

  const checkbox = screen.getByRole('checkbox', { name: 'Guitar' })
  const label = checkbox.closest('label')!
  fireEvent.pointerDown(label, { clientX: 0, clientY: 0 })
  act(() => { vi.advanceTimersByTime(500) })
  fireEvent.pointerUp(label)

  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /remove time from guitar/i }))
  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBeUndefined()
})

test('a done task never opens its menu from a long press - only from the menu button', () => {
  vi.useFakeTimers()
  seed([{ id: 'guitar', title: 'Guitar', done: true, minutes: 20 }])
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)

  const checkbox = screen.getByRole('checkbox', { name: 'Guitar' })
  const label = checkbox.closest('label')!
  fireEvent.pointerDown(label, { clientX: 0, clientY: 0 })
  act(() => { vi.advanceTimersByTime(500) })
  fireEvent.pointerUp(label)

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('pushing a float through the actions menu moves it to tomorrow', () => {
  seed([{ id: 'guitar', title: 'Guitar', done: false, minutes: 20 }])
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)

  fireEvent.click(screen.getByRole('button', { name: 'More actions for Guitar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Push Guitar to tomorrow' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(getData().days[DATE]?.tasks.find(t => t.id === 'guitar')).toBeUndefined()
  expect(getData().days['2026-09-02']?.tasks.map(t => t.title)).toEqual(['Guitar'])
})

test('marking a task ongoing through the actions menu clears the do-or-delete note on the row', () => {
  seed([{ id: 'guitar', title: 'Guitar', done: false, minutes: 20, pushCount: 2 }])
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)

  expect(screen.getByText(/do it today, let it go, or mark it ongoing/i)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'More actions for Guitar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Mark Guitar as ongoing' }))

  expect(getData().days[DATE].tasks[0].unbounded).toBe(true)
  expect(screen.queryByText(/do it today, let it go, or mark it ongoing/i)).not.toBeInTheDocument()
})

test('deleting a task through the actions menu removes it', () => {
  seed([{ id: 'guitar', title: 'Guitar', done: false, minutes: 20 }])
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)

  fireEvent.click(screen.getByRole('button', { name: 'More actions for Guitar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete Guitar' }))

  expect(screen.queryByText('Guitar')).not.toBeInTheDocument()
  expect(getData().days[DATE]?.tasks ?? []).toHaveLength(0)
})
