import { afterEach, beforeEach, expect, test } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayView } from './DayView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const DATE = '2026-09-01'

type Listener = () => void

// Mocks the exact media query useIsWide() (src/lib/viewport.ts) queries -
// `(min-width: 1024px)` - so these tests control the wide/narrow reading
// directly rather than actually resizing jsdom's window, which has no real
// layout engine to respond to a resize with. See viewport.test.ts for the
// same helper shape used to test the hook itself in isolation; this one
// additionally exposes fireChange so a test can simulate a live resize
// crossing the breakpoint mid-render.
function mockViewport(initialWide: boolean) {
  let matches = initialWide
  const listeners = new Set<Listener>()
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return {
    setWide(next: boolean) {
      matches = next
      listeners.forEach(cb => cb())
    },
    restore() {
      window.matchMedia = original
    },
  }
}

let viewport: ReturnType<typeof mockViewport> | undefined

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  actions.resetForTests(defaultData())
})

afterEach(() => {
  viewport?.restore()
  viewport = undefined
})

function seed(tasks: Parameters<typeof actions.resetForTests>[0]['days'][string]['tasks'], timelineExpanded = false) {
  actions.resetForTests({
    ...defaultData(),
    settings: { ...defaultData().settings, timelineExpanded },
    days: { [DATE]: { date: DATE, tasks } },
  })
}

const anchoredTasks = [
  { id: 't1', title: 'Shift', done: false, time: '09:00', minutes: 60 },
]

// --- Step 2: auto-show the grid at wide widths, still one column ---------

test('at a wide viewport, the timeline grid renders even though timelineExpanded is false', () => {
  viewport = mockViewport(true)
  seed(anchoredTasks, false)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.timeline-grid-wrap')).toBeInTheDocument()
})

test('at a wide viewport, the Show timeline / Hide timeline toggle does not render', () => {
  viewport = mockViewport(true)
  seed(anchoredTasks, false)
  render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(screen.queryByRole('button', { name: /show timeline|hide timeline/i })).not.toBeInTheDocument()
})

test('at a narrow viewport, the toggle still renders and the grid still stays gated behind timelineExpanded', () => {
  viewport = mockViewport(false)
  seed(anchoredTasks, false)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(screen.getByRole('button', { name: 'Show timeline' })).toBeInTheDocument()
  expect(container.querySelector('.timeline-grid-wrap')).not.toBeInTheDocument()
})

test('a day with no anchors shows no grid at a wide viewport either', () => {
  viewport = mockViewport(true)
  seed([{ id: 'f1', title: 'Float', done: false, minutes: 20 }], false)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.timeline-grid-wrap')).not.toBeInTheDocument()
})

test('resizing wide does not write timelineExpanded to true - the stored phone choice is untouched', () => {
  viewport = mockViewport(true)
  seed(anchoredTasks, false)
  render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(getData().settings.timelineExpanded).toBe(false)
})

test('resizing back below the breakpoint after auto-showing wide restores the phone default (grid hidden again, toggle back)', () => {
  viewport = mockViewport(true)
  seed(anchoredTasks, false)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.timeline-grid-wrap')).toBeInTheDocument()

  act(() => viewport!.setWide(false))

  expect(container.querySelector('.timeline-grid-wrap')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Show timeline' })).toBeInTheDocument()
  expect(getData().settings.timelineExpanded).toBe(false)
})

test('a phone choice of expanded=true survives being viewed wide and then narrow again', () => {
  viewport = mockViewport(true)
  seed(anchoredTasks, true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.timeline-grid-wrap')).toBeInTheDocument()

  act(() => viewport!.setWide(false))

  expect(container.querySelector('.timeline-grid-wrap')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hide timeline' })).toBeInTheDocument()
})

// Selecting a task ("where does this fit") opens the grid as a side effect
// on a phone - see toggleSelect's own comment in DayView.tsx - but at a
// wide viewport the grid is already on screen, so this must not write
// timelineExpanded at all. Writing true here would be silently clobbering
// whatever the phone's own choice was the next time this same person opens
// the app narrow.
test('selecting a task at a wide viewport does not persist timelineExpanded, since the grid is already showing', async () => {
  const user = userEvent.setup()
  viewport = mockViewport(true)
  seed([{ id: 'f1', title: 'Float task', done: false, minutes: 20 }, ...anchoredTasks], false)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  const taskList = within(container.querySelector('.task-list')!)
  await user.click(taskList.getByRole('button', { name: 'Float task' }))
  expect(getData().settings.timelineExpanded).toBe(false)
})
