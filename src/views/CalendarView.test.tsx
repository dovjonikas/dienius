import { beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarView } from './CalendarView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { addDays, formatDayTitle, todayKey, weekOf } from '../lib/dates'
import { SLOWDOWN_LIMIT, STRESS_TIMEOUT_MS, measureSlowdown, timed } from '../test/stress'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

// A `getByRole` name query computes the accessible name of every button in
// the document to find one. That walk was written out of these tests when the
// calendar still had a year view of 365 cells and the query went over the 5s
// timeout under full parallelism; the year view is gone, but a grid of
// forty-two cells plus a bar is still a walk that buys nothing here. The nav
// arrows are addressed by `button[aria-label=...]` instead: one attribute
// selector against the DOM. It still asserts both halves of what the role
// query did - that the thing is a button, and what it is called - and
// everything else is still found through `getByRole`, because there the
// roles are the point.
function navButton(container: HTMLElement, label: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`button[aria-label="${label}"]`)
}

// The bar's arrows turn whatever is on screen: a month in Month, a week in
// Week (called "Earlier days" on a narrow screen, which is what jsdom is).
// Switching the segment swaps them, and switching back restores them - the
// half of the old three-mode test that still holds now that there are two.
test('switching between Month and Week swaps the arrows in the bar, and back', async () => {
  const user = userEvent.setup()
  const { container } = render(<CalendarView onOpenDay={() => {}} />)
  const modes = screen.getByRole('group', { name: 'Calendar view' })
  expect(navButton(container, 'Previous month')).not.toBeNull()
  await user.click(within(modes).getByRole('button', { name: 'Week' }))
  expect(navButton(container, 'Previous month')).toBeNull()
  expect(navButton(container, 'Earlier days') ?? navButton(container, 'Previous week')).not.toBeNull()
  await user.click(within(modes).getByRole('button', { name: 'Month' }))
  expect(navButton(container, 'Previous month')).not.toBeNull()
  expect(navButton(container, 'Earlier days') ?? navButton(container, 'Previous week')).toBeNull()
})

test('the month grid wraps each week in a row, so gridcells never sit directly inside the grid', () => {
  // role="grid" requires role="row" children wrapping the row="gridcell"
  // buttons - this is a genuine two-dimensional calendar (weeks as visual
  // rows, weekdays as visual columns, and the same axes for keyboard
  // navigation), so the fix here is to complete the structure rather than
  // drop the role.
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

/**
 * The card that used to appear on hover and leave again the moment the
 * pointer travelled toward it - so nothing on it could be reached. It opens
 * on a press now, and opening the day itself is one of the things on it.
 * Rewritten from "clicking a day outside stamp mode opens it", which
 * asserted the old contract.
 */
test('pressing a day opens its card, and the card is where the day itself is opened from', async () => {
  const user = userEvent.setup()
  let opened = ''
  render(<CalendarView onOpenDay={d => (opened = d)} />)
  const cell = screen.getAllByRole('gridcell')[10]
  const date = cell.getAttribute('data-date') as string

  await user.click(cell)
  expect(opened).toBe('')
  const card = screen.getByRole('dialog')
  expect(card).toBeInTheDocument()

  await user.click(within(card).getByRole('button', { name: 'Open day' }))
  expect(opened).toBe(date)
})

test('the card stays open until it is closed, and Escape closes it', async () => {
  const user = userEvent.setup()
  render(<CalendarView onOpenDay={() => {}} />)
  const cells = screen.getAllByRole('gridcell')

  await user.click(cells[10])
  // Nothing about moving the pointer away closes it any more.
  fireEvent.pointerLeave(cells[10])
  fireEvent.pointerEnter(cells[20])
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
})

// Enter on a focused cell is the same press, so the grid's one tab stop and
// its arrow keys still reach everything - lib/gridKeys.ts.
test('Enter on the focused cell opens that cell\'s card', async () => {
  const user = userEvent.setup()
  render(<CalendarView onOpenDay={() => {}} />)
  const cell = screen.getAllByRole('gridcell')[10]
  const date = cell.getAttribute('data-date') as string

  cell.focus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('dialog', { name: formatDayTitle(date) })).toBeInTheDocument()
})

test('a template in hand keeps the card away, because every cell is a brush', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Work day', color: '#a7c4f5', blocks: [] })
  render(<CalendarView onOpenDay={() => {}} />)

  await user.click(screen.getByRole('button', { name: 'Work day' }))
  await user.click(screen.getAllByRole('gridcell')[10])
  expect(screen.queryByRole('dialog')).toBeNull()
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

/**
 * A mark in the corner of a day that has writing on it, and nothing else:
 * the owner's third point, "if we write notes on a day, in the calendar we
 * should also see a mark for a note or a journal and be able to press it and
 * see what is written". Two marks, so the two doors on the card are told
 * apart; no number and no colour that means a value, because a mark that
 * graded the writing would be the report card the journal exists not to be.
 */
test('a day with a journal line and a day with a note each carry their own mark', () => {
  render(<CalendarView onOpenDay={() => {}} />)
  const cells = screen.getAllByRole('gridcell')
  // A note is dated the day it is written on, so today is the honest day to
  // write one for - see lib/scratch.ts.
  const noted = todayKey()
  const written = cells.map(c => c.getAttribute('data-date') as string).find(d => d !== noted) as string

  expect(cells[0].querySelector('.cell-written')).toBeNull()

  act(() => {
    actions.setJournal(written, 'It rained all afternoon.')
    actions.addScratch('The number is 8812')
  })

  const cell = (date: string) => screen.getAllByRole('gridcell').find(c => c.getAttribute('data-date') === date)!
  expect(cell(written).querySelector('.cell-written-journal')).not.toBeNull()
  expect(cell(written).querySelector('.cell-written-note')).toBeNull()
  expect(cell(noted).querySelector('.cell-written-note')).not.toBeNull()
  expect(cell(noted).querySelector('.cell-written-journal')).toBeNull()
})

// A dot says nothing to somebody who is not looking at one, and the month
// grid is one tab stop walked with the arrow keys.
test('the marks are in the cell\'s name too, so a keyboard hears them', () => {
  render(<CalendarView onOpenDay={() => {}} />)
  const date = todayKey()

  act(() => {
    actions.setJournal(date, 'A good one.')
    actions.addScratch('Ring the dentist')
  })

  const cell = screen.getAllByRole('gridcell').find(c => c.getAttribute('data-date') === date)!
  expect(cell.getAttribute('aria-label')).toMatch(/journal written/)
  expect(cell.getAttribute('aria-label')).toMatch(/note written/)
  expect(cell.getAttribute('aria-label')).not.toMatch(/\d+ notes?/)
})

test('the card opens Notes and Journal at the day it is about', async () => {
  const user = userEvent.setup()
  const notes: string[] = []
  const journal: string[] = []
  render(
    <CalendarView
      onOpenDay={() => {}}
      onOpenNotes={d => notes.push(d)}
      onOpenJournal={d => journal.push(d)}
    />,
  )
  const cell = screen.getAllByRole('gridcell')[10]
  const date = cell.getAttribute('data-date') as string

  await user.click(cell)
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Notes' }))
  await user.click(cell)
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Journal' }))

  expect(notes).toEqual([date])
  expect(journal).toEqual([date])
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
  expect(screen.queryByText('Stamp')).not.toBeInTheDocument()
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

// Next week rather than a week written out as dates. Since v2.8 the button
// stamps from the day it is pressed on and never behind it, so a week spelled
// in literal dates is a week it correctly refuses the moment those dates go
// by - see views/week/weekStamp.ts.
const NEXT_WEEK = weekOf(addDays(todayKey(), 7))

test('Stamp week fills every day the weekday plan names', async () => {
  wideScreen(true)
  const template = actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [{ time: '09:00', title: 'Standup' }] })
  for (const weekday of [1, 2, 3, 4, 5]) actions.setWeekdayTemplate(weekday, template.id)
  const { user } = await openWeek(NEXT_WEEK[0])

  await user.click(screen.getByRole('button', { name: 'Stamp week' }))

  expect(NEXT_WEEK.filter(d => getData().days[d]?.templateId === template.id)).toHaveLength(5)
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
  actions.stamp({ [NEXT_WEEK[0]]: rest.id })
  const { user } = await openWeek(NEXT_WEEK[0])

  await user.click(screen.getByRole('button', { name: 'Stamp week' }))
  expect(getData().days[NEXT_WEEK[0]].templateId).toBe(rest.id)
  expect(getData().days[NEXT_WEEK[1]].templateId).toBe(work.id)
})

/**
 * The rule the button keeps since v2.8, from the owner's own case: a week
 * template put in mid-week starts at the day it is put in. A week wholly
 * behind you has nothing it could honestly fill, so it offers nothing.
 */
test('a week wholly in the past has no Stamp week button at all', async () => {
  wideScreen(true)
  const template = actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [] })
  for (const weekday of [1, 2, 3, 4, 5]) actions.setWeekdayTemplate(weekday, template.id)
  await openWeek(addDays(todayKey(), -14))
  expect(screen.queryByRole('button', { name: 'Stamp week' })).toBeNull()
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

/**
 * Walking the grid with the arrows and pressing Enter on a second cell builds
 * a new card. Without that, an armed "Clear 9 tasks from Wednesday?" would be
 * carried onto Thursday and the next press would empty a day nobody asked
 * about.
 */
test('a question armed on one day does not travel to the next one', async () => {
  const user = userEvent.setup()
  render(<CalendarView onOpenDay={() => {}} />)
  const cells = screen.getAllByRole('gridcell')
  const first = cells[10].getAttribute('data-date') as string

  act(() => {
    actions.addTask(first, 'Finish the report')
  })
  await user.click(screen.getAllByRole('gridcell')[10])
  await user.click(screen.getByRole('button', { name: 'Clear this day' }))
  expect(screen.getByText(/^Clear 1 task from /)).toBeInTheDocument()

  cells[10].focus()
  await user.keyboard('{ArrowRight}{Enter}')
  expect(screen.queryByText(/^Clear /)).toBeNull()
  expect(getData().days[first].tasks).toHaveLength(1)
})
