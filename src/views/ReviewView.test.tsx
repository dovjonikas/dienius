import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  const lines = screen.getAllByRole('listitem').map(li => li.textContent)
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
