import { beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewView } from './ReviewView'
import { actions } from '../lib/store'
import { defaultData } from '../lib/storage'
import { addDays, formatWeekTitle, todayKey, weekOf } from '../lib/dates'
import type { DayPlan, Task, Template } from '../lib/types'

const TODAY = todayKey()

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return writeText
}

/**
 * The journal for the stretch being reviewed, as markdown, for somewhere
 * else. The week and the month each copy their own dates under their own
 * heading; with nothing written the button is there, greyed, and does
 * nothing - a control that only appears once the feature has been used is
 * a control nobody finds.
 */
test('the week being reviewed copies as markdown under its own heading', async () => {
  const user = userEvent.setup()
  const writeText = stubClipboard()
  actions.addTask(TODAY, 'One')
  actions.setJournal(TODAY, 'Ship the pricing page\nStart with the walk')
  render(<ReviewView />)

  await user.click(screen.getByRole('button', { name: 'Copy week journal' }))
  expect(writeText).toHaveBeenCalledTimes(1)
  const text = writeText.mock.calls[0][0] as string
  expect(text.startsWith(`# Journal, ${formatWeekTitle(weekOf(TODAY))}`)).toBe(true)
  expect(text).toContain('Ship the pricing page\nStart with the walk')
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
})

test('the month copies the month, named as the month', async () => {
  const user = userEvent.setup()
  const writeText = stubClipboard()
  actions.addTask(TODAY, 'One')
  actions.setJournal(TODAY, 'Dad called')
  render(<ReviewView />)

  await user.click(screen.getByRole('button', { name: 'Month' }))
  await user.click(screen.getByRole('button', { name: 'Copy month journal' }))
  const text = writeText.mock.calls[0][0] as string
  // In the app's own locale, the way every date it prints is - the review
  // used to spell this one from the machine's, which named a week
  // "07 - 09-13" on a Lithuanian desktop.
  const month = new Date(`${TODAY}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  expect(text.startsWith(`# Journal, ${month}`)).toBe(true)
  expect(text).toContain('Dad called')
})

test('with nothing written the button is greyed and says why, and never says what was skipped', () => {
  actions.addTask(TODAY, 'One')
  render(<ReviewView />)
  const button = screen.getByRole('button', { name: 'Copy week journal' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('data-tip', 'No journal lines in this week')
  expect(document.body.textContent).not.toMatch(/skipped|missed|streak/i)
})

/**
 * Where the plan and the week disagreed - lib/planReading.ts, drawn on the
 * week only. A finished week reads one line of counts per template block,
 * largest disagreement first, and copies the same lines as markdown; a
 * month, or a week with no past day stamped from a template, draws nothing
 * of it - not even the heading.
 */
const LAST_WEEK = weekOf(addDays(TODAY, -7))

const work: Template = {
  id: 't1',
  name: 'Work day',
  color: '#8ab6f9',
  blocks: [
    { id: 'b1', time: '09:00', title: 'Deep work', minutes: 120 },
    { id: 'b2', time: '12:30', title: 'Lunch', minutes: 45 },
    { id: 'b3', title: 'Something outside' },
  ],
}

function stamped(blockId: string, over: Partial<Task> = {}): Task {
  const block = work.blocks.find(b => b.id === blockId)!
  return {
    id: `${blockId}-${over.time ?? 'x'}-${String(over.done)}-${String(over.setAside)}`,
    title: block.title,
    time: block.time,
    done: false,
    fromTemplate: true,
    origin: { type: 'template', sourceId: 't1', blockId },
    ...over,
  }
}

/** Monday to Wednesday of last week, so the reading has three past days whatever today is. */
function seedLastWeek() {
  const days: Record<string, DayPlan> = {
    [LAST_WEEK[0]]: {
      date: LAST_WEEK[0],
      templateId: 't1',
      tasks: [stamped('b1', { done: true }), stamped('b2', { done: true }), stamped('b3', { done: true })],
    },
    [LAST_WEEK[1]]: { date: LAST_WEEK[1], templateId: 't1', tasks: [stamped('b1', { done: true }), stamped('b2', { setAside: true })] },
    [LAST_WEEK[2]]: {
      date: LAST_WEEK[2],
      templateId: 't1',
      tasks: [stamped('b1', { time: '10:00', done: true }), stamped('b2', { done: true })],
    },
  }
  actions.resetForTests({ ...defaultData(), templates: [work], days })
}

test('the week reads where the plan and the week disagreed, one line per block, and copies it as markdown', async () => {
  const user = userEvent.setup()
  const writeText = stubClipboard()
  seedLastWeek()
  render(<ReviewView />)

  await user.click(screen.getByRole('button', { name: 'The week before' }))
  expect(screen.getByRole('heading', { name: 'Where the plan and the week disagreed' })).toBeInTheDocument()
  // The reading's own lines: the counts under it have lines of their own.
  const reading = screen.getByRole('heading', { name: 'Where the plan and the week disagreed' }).closest('.review-block') as HTMLElement
  const lines = within(reading).getAllByRole('listitem').map(li => li.textContent)
  expect(lines).toEqual([
    'Something outside - happened 1 of 3 days, not done twice',
    'Deep work 09:00 - happened at its time 2 of 3 days, moved later once (+1h)',
    'Lunch 12:30 - happened at its time 2 of 3 days, set aside once',
  ])
  // One template on the week, so no heading names it.
  expect(screen.queryByRole('heading', { name: 'Work day' })).not.toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/missed|failed|behind|only|should|incomplete|overdue|skipped|streak/i)

  await user.click(screen.getByRole('button', { name: 'Copy' }))
  expect(writeText).toHaveBeenCalledTimes(1)
  expect(writeText.mock.calls[0][0]).toBe(
    [
      `# Where the plan and the week disagreed, ${formatWeekTitle(LAST_WEEK)}`,
      '',
      '## Work day',
      '',
      '- Something outside - happened 1 of 3 days, not done twice',
      '- Deep work 09:00 - happened at its time 2 of 3 days, moved later once (+1h)',
      '- Lunch 12:30 - happened at its time 2 of 3 days, set aside once',
      '',
    ].join('\n'),
  )
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
})

test('the reading is not drawn on a month, nor on a week with nothing to say', async () => {
  const user = userEvent.setup()
  seedLastWeek()
  // This week has a day with a task and no template: something planned, nothing to read.
  actions.addTask(TODAY, 'One')
  render(<ReviewView />)

  expect(screen.queryByRole('heading', { name: 'Where the plan and the week disagreed' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Month' }))
  expect(screen.queryByRole('heading', { name: 'Where the plan and the week disagreed' })).not.toBeInTheDocument()
})

/**
 * How many times each repeating block happened, lately - lib/blockCounts.ts.
 * A row per block with how many of the last seven and the last thirty days
 * it happened on, and nothing but the number in either: no percentage, no
 * target, no colour, no word about it. The two windows are named once, over
 * their columns, rather than in a phrase repeated on every line. Drawn on
 * the week and the month alike, since the windows run back from today.
 */
test('each repeating block has a row with how many of the last 7 and 30 days it happened on, and only the numbers', async () => {
  const user = userEvent.setup()
  const days: Record<string, DayPlan> = {}
  for (const [back, tasks] of [
    [1, [stamped('b1', { done: true }), stamped('b2')]],
    [3, [stamped('b1', { done: true })]],
    [10, [stamped('b1', { done: true }), stamped('b2', { done: true })]],
  ] as [number, Task[]][]) {
    const date = addDays(TODAY, -back)
    days[date] = { date, templateId: 't1', tasks }
  }
  actions.resetForTests({ ...defaultData(), templates: [work], days })
  render(<ReviewView />)

  const table = screen.getByRole('table', { name: 'How many times' })
  expect(cellsOf(table)).toEqual([
    ['Block', 'Last 7 days', 'Last 30 days'],
    ['Deep work 09:00', '2', '3'],
    ['Lunch 12:30', '0', '1'],
    ['Something outside', '0', '0'],
  ])
  expect(within(table).getByRole('rowheader', { name: 'Deep work 09:00' })).toBeInTheDocument()
  for (const cell of within(table).getAllByRole('cell')) expect(cell.textContent).toMatch(/^[0-9]+$/)
  expect(table.textContent).not.toMatch(/%|streak|missed|target|goal/i)
  expect(table.querySelector('progress, meter, [style*="color"]')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Month' }))
  expect(screen.getByRole('table', { name: 'How many times' })).toBeInTheDocument()
})

test('blocks from two templates stand under each template’s name, and the windows are still named once', () => {
  const rest: Template = { id: 't2', name: 'Rest day', color: '#a7c4f5', blocks: [{ id: 'r1', time: '10:00', title: 'Long walk' }] }
  const one = addDays(TODAY, -1)
  const two = addDays(TODAY, -2)
  const walk: Task = { id: 'r', title: 'Long walk', time: '10:00', done: true, origin: { type: 'template', sourceId: 't2', blockId: 'r1' } }
  actions.resetForTests({
    ...defaultData(),
    templates: [work, rest],
    days: {
      [one]: { date: one, templateId: 't2', tasks: [walk] },
      [two]: { date: two, templateId: 't1', tasks: [stamped('b1', { done: true })] },
    },
  })
  render(<ReviewView />)

  const table = screen.getByRole('table', { name: 'How many times' })
  expect(cellsOf(table)).toEqual([
    ['Block', 'Last 7 days', 'Last 30 days'],
    ['Work day'],
    ['Deep work 09:00', '1', '1'],
    ['Lunch 12:30', '0', '0'],
    ['Something outside', '0', '0'],
    ['Rest day'],
    ['Long walk 10:00', '1', '1'],
  ])
  expect(within(table).getAllByRole('columnheader', { name: /^Last/ })).toHaveLength(2)
})

test('with no block on any of the last thirty days there is no count section at all', () => {
  actions.addTask(TODAY, 'One')
  render(<ReviewView />)
  expect(screen.queryByRole('heading', { name: 'How many times' })).not.toBeInTheDocument()
})

/**
 * Nothing new is kept for the counts. Drawing them writes nothing, a tick is
 * all it takes to move one, and what the tick saves is the plan with that one
 * task done - no count in it, and nothing written beside it.
 */
test('the counts are read from the days each time they are drawn, and nothing about them is saved', () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  try {
    const tasks = [stamped('b1'), stamped('b2')]
    const day: DayPlan = { date: TODAY, templateId: 't1', tasks }
    const plan = { ...defaultData(), templates: [work], days: { [TODAY]: day } }
    // Written down before anything is drawn, so a count slipped into the plan
    // while drawing cannot also slip into what it is compared with.
    const ticked = JSON.stringify({ ...plan, days: { [TODAY]: { ...day, tasks: [{ ...tasks[0], done: true }, tasks[1]] } } })
    actions.resetForTests(plan)
    render(<ReviewView />)

    const table = screen.getByRole('table', { name: 'How many times' })
    expect(cellsOf(table)[1]).toEqual(['Deep work 09:00', '0', '0'])
    expect(setItem).not.toHaveBeenCalled()

    act(() => actions.toggleTask(TODAY, tasks[0].id))
    expect(cellsOf(table)[1]).toEqual(['Deep work 09:00', '1', '1'])
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(withoutStamps(setItem.mock.calls[0][1])).toEqual(withoutStamps(ticked))
  } finally {
    setItem.mockRestore()
  }
})

/** A table's rows, each as the words in its cells. */
function cellsOf(table: HTMLElement): string[][] {
  return within(table)
    .getAllByRole('row')
    .map(row => Array.from(row.children, cell => cell.textContent ?? ''))
}

/** A saved plan read back without the stamps sync writes on every change. */
function withoutStamps(json: string): unknown {
  return JSON.parse(json, (key, value) =>
    key === 'updatedAt' || key === 'settingsUpdatedAt' || key === 'tombstones' ? undefined : value,
  )
}

/**
 * A month goes back and forth by whole months. Forward added thirty-one days
 * to the anchor, and back leaves the anchor on the last day of the month
 * before - so from August's last day forward landed on the first of October
 * and September was skipped. Found in the audit for rotating shifts, which
 * looked at every date step in the app.
 */
test('a month back and then forward is the month it started on, whatever the months are called', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 8, 17, 12, 0))
  try {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ReviewView />)
    await user.click(screen.getByRole('button', { name: 'Month' }))
    const range = () => document.querySelector('.review-range')?.textContent
    expect(range()).toBe('September 2026')

    await user.click(screen.getByRole('button', { name: 'The month before' }))
    expect(range()).toBe('August 2026')
    await user.click(screen.getByRole('button', { name: 'The month before' }))
    expect(range()).toBe('July 2026')
    await user.click(screen.getByRole('button', { name: 'The month after' }))
    expect(range()).toBe('August 2026')
    await user.click(screen.getByRole('button', { name: 'The month after' }))
    expect(range()).toBe('September 2026')
  } finally {
    vi.useRealTimers()
  }
})

/**
 * The counts run back from today, not over the stretch on screen, so a week
 * with nothing in it yet - a Monday morning - still has them. The week's empty
 * line used to take the whole page, and every Monday the last seven and thirty
 * days went with it. Found when the suite ran on a Monday.
 */
test('on a week with nothing planned yet, the counts of the last 7 and 30 days still stand', () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  // A Monday, with the days worth counting in the week before it.
  vi.setSystemTime(new Date(2026, 8, 21, 12, 0))
  try {
    const days: Record<string, DayPlan> = {}
    for (const date of ['2026-09-20', '2026-09-18']) days[date] = { date, templateId: 't1', tasks: [stamped('b1', { done: true })] }
    actions.resetForTests({ ...defaultData(), templates: [work], days })
    render(<ReviewView />)

    expect(screen.getByText(/Nothing was planned this week/)).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'How many times' })
    expect(within(table).getByRole('rowheader', { name: 'Deep work 09:00' })).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})
