import { beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarView } from './CalendarView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { todayKey } from '../lib/dates'
import { SLOWDOWN_LIMIT, STRESS_TIMEOUT_MS, measureSlowdown, timed } from '../test/stress'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

// The year view renders 365 cells, and a `getByRole` name query computes the
// accessible name of every one of them. Dropping userEvent's inter-event
// delay bought this test time once already; as the suite grew it went back
// over the 5s timeout under full parallelism, which is a sign the query
// itself is wrong rather than that the budget is tight.
//
// Both nav arrows are addressed by `button[aria-label=...]` instead: one
// attribute selector against the DOM rather than a walk that builds an
// accessible name for several hundred buttons to find one. It still asserts
// both halves of what the old query did - that the thing is a button, and
// what it is called - and the mode switcher is still clicked through
// `getByRole`, scoped to its own group, because that part is genuinely about
// roles and costs nothing. Same coverage, none of the walk.
function navButton(container: HTMLElement, label: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`button[aria-label="${label}"]`)
}

test('switching to the year view shows the year strip and hides the month grid', async () => {
  const user = userEvent.setup({ delay: null })
  const { container } = render(<CalendarView onOpenDay={() => {}} />)
  const modes = screen.getByRole('group', { name: 'Calendar view' })
  expect(navButton(container, 'Previous month')).toBeInTheDocument()

  await user.click(within(modes).getByRole('button', { name: 'Year' }))
  expect(navButton(container, 'Previous month')).not.toBeInTheDocument()
  expect(navButton(container, 'Previous year')).toBeInTheDocument()

  await user.click(within(modes).getByRole('button', { name: 'Month' }))
  expect(navButton(container, 'Previous month')).toBeInTheDocument()
  expect(navButton(container, 'Previous year')).not.toBeInTheDocument()
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
  // A whole number of weeks, and only the weeks the month is in - see
  // monthGrid. It was a flat 42 until v2.0, which drew a whole extra week of
  // the next month under every five-week month.
  expect(gridcells.length % 7).toBe(0)
  expect(gridcells).toHaveLength((rows.length - 1) * 7)
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

// --- stress test: the month grid with roughly two years of stamped days ----

/**
 * A ratio, not a millisecond budget - CONVENTIONS.md section 3, and see
 * src/test/stress.ts. The month grid draws its own 42 cells whatever else is
 * in the store, so an empty store is the honest baseline here: what is being
 * asked is whether two years of stamped days change the cost of drawing
 * those same 42 cells, and the answer should be "barely".
 */
function stampTwoYears() {
  const work = actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [] })
  const rest = actions.addTemplate({ name: 'Rest', color: '#cde39e', blocks: [] })
  const stamps: Record<string, string> = {}
  let d = new Date(2024, 0, 1)
  for (let i = 0; i < 700; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    stamps[key] = i % 2 === 0 ? work.id : rest.id
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  }
  actions.stamp(stamps)
}

test('two years of stamped days barely change what the month grid costs to draw', () => {
  const result = measureSlowdown(() => {}, stampTwoYears, () =>
    timed(() => render(<CalendarView onOpenDay={() => {}} />)),
  )
  expect(result.ratio).toBeLessThan(SLOWDOWN_LIMIT)

  // And it drew the right thing: whole weeks covering the month, regardless
  // of how much data exists elsewhere in the year.
  actions.resetForTests(defaultData())
  stampTwoYears()
  render(<CalendarView onOpenDay={() => {}} />)
  const cells = screen.getAllByRole('gridcell')
  expect(cells.length % 7).toBe(0)
  expect(cells.length).toBeGreaterThanOrEqual(28)
  expect(cells.length).toBeLessThanOrEqual(42)
}, STRESS_TIMEOUT_MS)

// --- the week's bar --------------------------------------------------------
//
// The week's arrows, Today and Stamp week sit in the calendar bar, on the
// same row as the mode toggle, rather than in a row of their own inside the
// week: on a phone that row cost a fifth of the grid it was steering. So the
// tests that press them render the calendar and switch to Week, the way a
// person reaches them.

function wideScreen(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

async function openWeek(date = '2026-09-02') {
  const user = userEvent.setup({ delay: null })
  const onDateChange = vi.fn()
  const result = render(<CalendarView onOpenDay={() => {}} date={date} onDateChange={onDateChange} />)
  const modes = screen.getByRole('group', { name: 'Calendar view' })
  await user.click(within(modes).getByRole('button', { name: 'Week' }))
  return { ...result, user, onDateChange }
}

test('Stamp week fills every day the weekday plan names', async () => {
  wideScreen(true)
  const template = actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [{ time: '09:00', title: 'Standup' }] })
  for (const weekday of [1, 2, 3, 4, 5]) actions.setWeekdayTemplate(weekday, template.id)
  const { user } = await openWeek()

  await user.click(screen.getByRole('button', { name: 'Stamp week' }))

  const week = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']
  expect(week.filter(d => getData().days[d]?.templateId === template.id)).toHaveLength(5)
})

/**
 * A one-press button has to be safe to press by accident, and stamping over a
 * week somebody has already arranged by hand is not a convenience, it is a
 * loss.
 */
test('Stamp week leaves a day that already has a template alone', async () => {
  wideScreen(true)
  const work = actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [{ time: '09:00', title: 'Standup' }] })
  const rest = actions.addTemplate({ name: 'Rest', color: '#cde39e', blocks: [] })
  for (const weekday of [1, 2, 3, 4, 5]) actions.setWeekdayTemplate(weekday, work.id)
  actions.stamp({ '2026-08-31': rest.id })
  const { user } = await openWeek()

  await user.click(screen.getByRole('button', { name: 'Stamp week' }))
  expect(getData().days['2026-08-31'].templateId).toBe(rest.id)
  expect(getData().days['2026-09-01'].templateId).toBe(work.id)
})

test('with no weekday plan at all there is no Stamp week button to wonder about', async () => {
  wideScreen(true)
  actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [] })
  await openWeek()
  expect(screen.queryByRole('button', { name: 'Stamp week' })).toBeNull()
})

// A phone shows three days. "Stamp week" above three days is a promise about
// four days you cannot see, so the button waits for a screen that shows them.
test('a narrow screen has no Stamp week button, and its title names the three days it shows', async () => {
  wideScreen(false)
  const template = actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [] })
  for (const weekday of [1, 2, 3, 4, 5]) actions.setWeekdayTemplate(weekday, template.id)
  await openWeek()
  expect(screen.queryByRole('button', { name: 'Stamp week' })).toBeNull()
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('1 - 3 Sep 2026')
})

test('the arrows move a whole week at a time, and the title names the week', async () => {
  wideScreen(true)
  const { user, onDateChange, container } = await openWeek()
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('31 August - 6 September 2026')
  await user.click(navButton(container, 'Next week')!)
  expect(onDateChange).toHaveBeenCalledWith('2026-09-09')
})

test('the arrows step three days at a time on a narrow screen', async () => {
  wideScreen(false)
  const { user, onDateChange, container } = await openWeek()
  await user.click(navButton(container, 'Later days')!)
  expect(onDateChange).toHaveBeenCalledWith('2026-09-05')
})

test('Today brings the week back to today', async () => {
  wideScreen(true)
  const { user, onDateChange } = await openWeek('2025-01-01')
  await user.click(screen.getByRole('button', { name: 'Today' }))
  expect(onDateChange).toHaveBeenCalledWith(todayKey())
})
/**
 * One tab stop per grid, and the arrows do the rest. Forty-two stops sat
 * between the calendar bar and everything under the grid until v2.1.
 */
test('the month grid is one tab stop, and the arrows walk it across a month boundary', async () => {
  const user = userEvent.setup()
  render(<CalendarView onOpenDay={() => {}} date={todayKey()} onDateChange={() => {}} />)
  const cells = screen.getAllByRole('gridcell')
  expect(cells.filter(c => c.getAttribute('tabindex') === '0')).toHaveLength(1)
  const stop = cells.find(c => c.getAttribute('tabindex') === '0')!
  stop.focus()
  const from = stop.getAttribute('data-date')!
  await user.keyboard('{ArrowRight}')
  const next = document.activeElement?.getAttribute('data-date')
  expect(next).not.toBe(from)
  expect(next! > from).toBe(true)
})
