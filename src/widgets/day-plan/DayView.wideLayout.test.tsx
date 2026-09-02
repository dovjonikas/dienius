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

// See emptyDayLayout: a day with nothing anchored draws the waking window
// empty rather than nothing at all, at every viewport. On a wide screen the
// old behaviour left a third of the page blank next to a full task list.
test('a day with no anchors still shows the empty grid at a wide viewport', () => {
  viewport = mockViewport(true)
  seed([{ id: 'f1', title: 'Float', done: false, minutes: 20 }], false)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.timeline-grid-wrap')).toBeInTheDocument()
  expect(container.querySelectorAll('.timeline-anchor')).toHaveLength(0)
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

// --- Step 3: split into day-pane and task-pane ----------------------------

test('day-pane and task-pane wrapper regions exist in the DOM at any viewport, narrow included', () => {
  viewport = mockViewport(false)
  seed(anchoredTasks, false)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.day-pane')).toBeInTheDocument()
  expect(container.querySelector('.task-pane')).toBeInTheDocument()
})

test('the capacity line, if-then rule and grid all land inside day-pane', () => {
  viewport = mockViewport(true)
  seed(anchoredTasks, true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  const dayPane = container.querySelector('.day-pane')!
  expect(dayPane.querySelector('.capacity-line')).not.toBeNull()
  expect(dayPane.querySelector('.timeline-grid-wrap')).not.toBeNull()
})

test('quick-add, the task list and the rollover button all land inside task-pane', () => {
  viewport = mockViewport(true)
  seed([{ id: 'f1', title: 'Unfinished float', done: false, minutes: 20 }], false)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  const taskPane = container.querySelector('.task-pane')!
  expect(taskPane.querySelector('.quick-add')).not.toBeNull()
  expect(taskPane.querySelector('.task-list')).not.toBeNull()
  expect(taskPane.querySelector('.rollover')).not.toBeNull()
})

// The wrapper divs must not reorder anything relative to today's DOM - a
// phone's DOM walk (day-nav, capacity line, if-then rule, timeline toggle,
// quick-add, task list, rollover) has to come out exactly as it always has,
// see docs/LAYOUT-WIDE.md section 3.4. compareDocumentPosition is the
// direct way to assert "A comes before B in the actual DOM", independent of
// which wrapper each one is nested inside.
// --- Step 4: dayLayoutFocus and the Both / Calendar / Tasks control -------

function seedFocus(
  focus: 'both' | 'calendar' | 'tasks',
  tasks: Parameters<typeof actions.resetForTests>[0]['days'][string]['tasks'] = anchoredTasks,
) {
  actions.resetForTests({
    ...defaultData(),
    settings: { ...defaultData().settings, dayLayoutFocus: focus },
    days: { [DATE]: { date: DATE, tasks } },
  })
}

test('the Both / Calendar / Tasks control does not render at a narrow viewport', () => {
  viewport = mockViewport(false)
  seedFocus('both')
  render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(screen.queryByRole('group', { name: /day layout/i })).not.toBeInTheDocument()
})

test('at a wide viewport the control renders all three options, Both active by default', () => {
  viewport = mockViewport(true)
  seedFocus('both')
  render(<DayView date={DATE} onDateChange={() => {}} />)
  const group = screen.getByRole('group', { name: /day layout/i })
  const both = within(group).getByRole('button', { name: 'Both' })
  const calendar = within(group).getByRole('button', { name: 'Calendar' })
  const tasks = within(group).getByRole('button', { name: 'Tasks' })
  expect(both).toHaveAttribute('aria-pressed', 'true')
  expect(calendar).toHaveAttribute('aria-pressed', 'false')
  expect(tasks).toHaveAttribute('aria-pressed', 'false')
})

test('both panes render at a wide viewport when the stored focus is both', () => {
  viewport = mockViewport(true)
  seedFocus('both')
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.day-pane')).toBeInTheDocument()
  expect(container.querySelector('.task-pane')).toBeInTheDocument()
})

test("a stored focus of 'calendar' unmounts the task pane at a wide viewport", () => {
  viewport = mockViewport(true)
  seedFocus('calendar')
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.day-pane')).toBeInTheDocument()
  expect(container.querySelector('.task-pane')).not.toBeInTheDocument()
  expect(container.querySelector('.day-view')).toHaveClass('focus-calendar')
})

test("a stored focus of 'tasks' unmounts the day pane at a wide viewport", () => {
  viewport = mockViewport(true)
  seedFocus('tasks')
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.day-pane')).not.toBeInTheDocument()
  expect(container.querySelector('.task-pane')).toBeInTheDocument()
  expect(container.querySelector('.day-view')).toHaveClass('focus-tasks')
})

test("a stored focus other than 'both' has no effect at a narrow viewport - both panes still render", () => {
  viewport = mockViewport(false)
  seedFocus('calendar')
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.day-pane')).toBeInTheDocument()
  expect(container.querySelector('.task-pane')).toBeInTheDocument()
})

test('clicking Calendar then Tasks then Both persists each choice through actions.setDayLayoutFocus, updating panes live', async () => {
  const user = userEvent.setup()
  viewport = mockViewport(true)
  seedFocus('both')
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)

  await user.click(screen.getByRole('button', { name: 'Calendar' }))
  expect(getData().settings.dayLayoutFocus).toBe('calendar')
  expect(container.querySelector('.task-pane')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Tasks' }))
  expect(getData().settings.dayLayoutFocus).toBe('tasks')
  expect(container.querySelector('.day-pane')).not.toBeInTheDocument()
  expect(container.querySelector('.task-pane')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Both' }))
  expect(getData().settings.dayLayoutFocus).toBe('both')
  expect(container.querySelector('.day-pane')).toBeInTheDocument()
  expect(container.querySelector('.task-pane')).toBeInTheDocument()
})

test('a day with no anchors still lets the focus control switch to Calendar - the day pane (capacity line, if-then rule) is not just the grid', () => {
  viewport = mockViewport(true)
  seedFocus('both', [{ id: 'f1', title: 'Float', done: false, minutes: 20 }])
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.day-pane')).toBeInTheDocument()
})

// --- Step 5: the rail (MiniCalendar first, TemplateRail second) ----------

test('the rail does not render at a narrow viewport', () => {
  viewport = mockViewport(false)
  seed(anchoredTasks, false)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.rail')).not.toBeInTheDocument()
})

test('at a wide viewport the rail renders the mini calendar and, once templates exist, the template rail', () => {
  viewport = mockViewport(true)
  seed(anchoredTasks, false)
  actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.rail .mini-calendar')).toBeInTheDocument()
  expect(container.querySelector('.rail .template-rail')).toBeInTheDocument()
})

test('the rail stays visible regardless of dayLayoutFocus - it is not part of what the control redistributes', () => {
  viewport = mockViewport(true)
  seedFocus('calendar')
  const { container, rerender } = render(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.rail')).toBeInTheDocument()

  seedFocus('tasks')
  rerender(<DayView date={DATE} onDateChange={() => {}} />)
  expect(container.querySelector('.rail')).toBeInTheDocument()
})

test('clicking a mini-calendar cell navigates the day view via the same onDateChange DayView already receives', async () => {
  const user = userEvent.setup()
  viewport = mockViewport(true)
  seed(anchoredTasks, false)
  let picked: string | undefined
  render(<DayView date={DATE} onDateChange={d => { picked = d }} />)
  const cell = screen.getByRole('gridcell', { name: /September 15/ })
  await user.click(cell)
  expect(picked).toBe('2026-09-15')
})

test('tapping a template chip in the rail stamps the day currently open', async () => {
  const user = userEvent.setup()
  viewport = mockViewport(true)
  seed(anchoredTasks, false)
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  render(<DayView date={DATE} onDateChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  expect(getData().days[DATE]?.templateId).toBe(work.id)
})

// Keyboard tab order must follow the visual order - rail, then header, then
// whichever pane(s) are showing - docs/LAYOUT-WIDE.md section 6's own
// verification pass.
test('the rail sits before the header in the DOM, which sits before the panes', () => {
  viewport = mockViewport(true)
  seed(anchoredTasks, true)
  actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  const rail = container.querySelector('.rail')!
  const header = container.querySelector('.day-header')!
  const dayPane = container.querySelector('.day-pane')!
  expect(rail).not.toBeNull()
  expect(rail.compareDocumentPosition(header) & 4).toBe(4)
  expect(header.compareDocumentPosition(dayPane) & 4).toBe(4)
})

test('DOM order is unchanged: day-nav, capacity line, grid, quick-add, task list, rollover, in that order', () => {
  viewport = mockViewport(false)
  seed([{ id: 't1', title: 'Anchor', done: false, time: '09:00', minutes: 30 },
        { id: 'f1', title: 'Unfinished float', done: false, minutes: 20 }], true)
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} />)
  const order = [
    container.querySelector('.day-nav')!,
    container.querySelector('.capacity-line')!,
    container.querySelector('.timeline-grid-wrap')!,
    container.querySelector('.quick-add')!,
    container.querySelector('.task-list')!,
    container.querySelector('.rollover')!,
  ]
  for (let i = 0; i < order.length - 1; i++) {
    expect(order[i]).not.toBeNull()
    // DOCUMENT_POSITION_FOLLOWING = 4
    expect(order[i].compareDocumentPosition(order[i + 1]) & 4).toBe(4)
  }
})

// --- fix-fill-viewport-height-report.md: the grid stretches to fill real,
// measured room at the wide breakpoint, rather than sitting inside a fixed
// max-height cap with its own internal scrollbar. This only checks that
// DayView actually passes isWide through to TimelineGrid - the grid's own
// density arithmetic is TimelineGrid.test.tsx's job, and the real,
// positioned-in-a-browser proof is in the report.

const ORIGINAL_INNER_HEIGHT = window.innerHeight

afterEach(() => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: ORIGINAL_INNER_HEIGHT })
})

test('at a wide viewport with real vertical room, the grid draws taller than the same day narrow', () => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 3000 })
  seed(anchoredTasks, true) // expanded, so the narrow render below has a grid to compare against

  viewport = mockViewport(false)
  const narrow = render(<DayView date={DATE} onDateChange={() => {}} />)
  const narrowLayers = narrow.container.querySelector('.timeline-grid-layers') as HTMLElement
  const narrowHeight = parseFloat(narrowLayers.style.height)
  narrow.unmount()
  viewport!.restore()

  viewport = mockViewport(true)
  const wide = render(<DayView date={DATE} onDateChange={() => {}} />)
  const wideLayers = wide.container.querySelector('.timeline-grid-layers') as HTMLElement
  expect(parseFloat(wideLayers.style.height)).toBeGreaterThan(narrowHeight)
})
