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

test('dragging a float onto a gap places it, auto-expanding a collapsed grid', () => {
  seed([SHIFT, GYM, { id: 'guitar', title: 'Guitar', done: false, minutes: 20 }])
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)

  expect(screen.getByRole('button', { name: 'Show timeline' })).toBeInTheDocument()
  const handle = container.querySelector('[data-drag-handle="guitar"]')!
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 })

  // Picked up while collapsed - the grid opens on its own so there is
  // something to drop onto, the same as tapping "Show timeline" by hand.
  expect(screen.getByRole('button', { name: 'Hide timeline' })).toBeInTheDocument()
  const gapButton = screen.getByRole('button', { name: /1h free/i })

  mockElementFromPoint(gapButton)
  fireEvent.pointerMove(document, { pointerId: 1, clientX: 20, clientY: 20 })
  expect(gapButton).toHaveClass('timeline-gap-drag-over')

  fireEvent.pointerUp(document, { pointerId: 1, clientX: 20, clientY: 20 })

  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBe('10:00')
  // Placing Guitar at the gap's own start shrinks the gap (it now starts
  // at 10:20), so the button we grabbed above is a stale, unmounted node
  // - checking the live document is what actually proves the drag-over
  // state was cleared rather than carried onto whatever gap remains.
  expect(document.querySelector('.timeline-gap-drag-over')).toBeNull()
})

test('a float too big for the gap it is dropped on is refused - state stays untouched', () => {
  seed([SHIFT, GYM, { id: 'deep-work', title: 'Deep work', done: false, minutes: 300 }], true)
  render(<DayView date={DATE} onDateChange={() => {}} />)

  const handle = document.querySelector('[data-drag-handle="deep-work"]')!
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 })
  const gapButton = screen.getByRole('button', { name: /1h free/i })
  mockElementFromPoint(gapButton)
  fireEvent.pointerMove(document, { pointerId: 1, clientX: 20, clientY: 20 })
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 20, clientY: 20 })

  expect(getData().days[DATE].tasks.find(t => t.id === 'deep-work')?.time).toBeUndefined()
})

test('dragging a float and releasing somewhere unrecognised leaves it untouched', () => {
  seed([SHIFT, GYM, { id: 'guitar', title: 'Guitar', done: false, minutes: 20 }], true)
  render(<DayView date={DATE} onDateChange={() => {}} />)

  const handle = document.querySelector('[data-drag-handle="guitar"]')!
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 })
  mockElementFromPoint(document.body)
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 500, clientY: 500 })

  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBeUndefined()
})

test('dragging an anchor block back onto the tray un-anchors it', () => {
  seed([{ id: 'guitar', title: 'Guitar', done: false, time: '10:00', minutes: 20 }], true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)

  const block = container.querySelector('.timeline-anchor')!
  fireEvent.pointerDown(block, { pointerId: 1, clientX: 100, clientY: 100 })

  const taskList = container.querySelector('.task-list')!
  mockElementFromPoint(taskList)
  fireEvent.pointerMove(document, { pointerId: 1, clientX: 100, clientY: 400 })
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 100, clientY: 400 })

  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBeUndefined()
})

test('a bare tap on an anchor block - pointerdown and pointerup with no real movement - does not un-anchor it', () => {
  seed([{ id: 'guitar', title: 'Guitar', done: false, time: '10:00', minutes: 20 }], true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)

  const block = container.querySelector('.timeline-anchor')!
  const taskList = container.querySelector('.task-list')!
  mockElementFromPoint(taskList)
  fireEvent.pointerDown(block, { pointerId: 1, clientX: 100, clientY: 100 })
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 100, clientY: 100 })

  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBe('10:00')
})

test('an anchor dropped on a gap (not the tray) is refused - re-timing is not what this drag does', () => {
  seed([SHIFT, GYM], true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)

  const block = container.querySelector('.timeline-anchor')!
  fireEvent.pointerDown(block, { pointerId: 1, clientX: 0, clientY: 0 })
  const gapButton = screen.getByRole('button', { name: /1h free/i })
  mockElementFromPoint(gapButton)
  fireEvent.pointerMove(document, { pointerId: 1, clientX: 30, clientY: 30 })
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 30, clientY: 30 })

  expect(getData().days[DATE].tasks.find(t => t.id === 'shift')?.time).toBe('09:00')
})

test('pressing Escape mid-drag cancels it without changing anything', () => {
  seed([SHIFT, GYM, { id: 'guitar', title: 'Guitar', done: false, minutes: 20 }], true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)

  const handle = container.querySelector('[data-drag-handle="guitar"]')!
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.keyDown(document, { key: 'Escape' })

  const gapButton = screen.getByRole('button', { name: /1h free/i })
  mockElementFromPoint(gapButton)
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 20, clientY: 20 })

  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBeUndefined()
})

test('with no anchors at all, a float still has a drag handle but nothing to drop onto - picking it up changes nothing', () => {
  seed([{ id: 'guitar', title: 'Guitar', done: false, minutes: 20 }])
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)

  expect(screen.queryByRole('button', { name: /show timeline/i })).not.toBeInTheDocument()
  const handle = container.querySelector('[data-drag-handle="guitar"]')!
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 })
  mockElementFromPoint(null)
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 999, clientY: 999 })

  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBeUndefined()
})

test('a done task never carries a drag handle', () => {
  seed([{ id: 'guitar', title: 'Guitar', done: true, minutes: 20 }])
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('[data-drag-handle="guitar"]')).toBeNull()
})

test('long-pressing a float row opens the actions menu, and the checkbox is not toggled by the click that follows', () => {
  vi.useFakeTimers()
  seed([SHIFT, GYM, { id: 'guitar', title: 'Guitar', done: false, minutes: 20 }], true)
  render(<DayView date={DATE} onDateChange={() => {}} />)

  const checkbox = screen.getByRole('checkbox', { name: 'Guitar' })
  const label = checkbox.closest('label')!
  fireEvent.pointerDown(label, { clientX: 0, clientY: 0 })
  act(() => { vi.advanceTimersByTime(500) })
  fireEvent.pointerUp(label)
  fireEvent.click(label)

  expect(screen.getByRole('dialog', { name: 'Guitar' })).toBeInTheDocument()
  expect(checkbox).not.toBeChecked()
})

test('placing a float through the long-press menu works even while the grid is collapsed', () => {
  vi.useFakeTimers()
  seed([SHIFT, GYM, { id: 'guitar', title: 'Guitar', done: false, minutes: 20 }], false)
  render(<DayView date={DATE} onDateChange={() => {}} />)
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
  render(<DayView date={DATE} onDateChange={() => {}} />)

  const checkbox = screen.getByRole('checkbox', { name: 'Guitar' })
  const label = checkbox.closest('label')!
  fireEvent.pointerDown(label, { clientX: 0, clientY: 0 })
  act(() => { vi.advanceTimersByTime(500) })
  fireEvent.pointerUp(label)

  // Guitar's always-visible "Remove time" row control already carries the
  // same accessible name, so this one is scoped to the dialog specifically.
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /remove time from guitar/i }))
  expect(getData().days[DATE].tasks.find(t => t.id === 'guitar')?.time).toBeUndefined()
})

test('a done task never opens the long-press menu', () => {
  vi.useFakeTimers()
  seed([{ id: 'guitar', title: 'Guitar', done: true, minutes: 20 }])
  render(<DayView date={DATE} onDateChange={() => {}} />)

  const checkbox = screen.getByRole('checkbox', { name: 'Guitar' })
  const label = checkbox.closest('label')!
  fireEvent.pointerDown(label, { clientX: 0, clientY: 0 })
  act(() => { vi.advanceTimersByTime(500) })
  fireEvent.pointerUp(label)

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
