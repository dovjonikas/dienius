import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayCard } from './DayCard'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { getUndo, resetUndoForTests, runUndo } from '../lib/undo'

const DATE = '2026-09-07'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  resetUndoForTests()
})

function seed() {
  actions.resetForTests({
    ...defaultData(),
    templates: [{ id: 'tpl', name: 'Working day', color: '#a7c4f5', blocks: [] }],
    days: {
      [DATE]: {
        date: DATE,
        templateId: 'tpl',
        tasks: [
          { id: 'a', title: 'Job hunt', time: '09:00', done: true, highlight: true },
          { id: 'b', title: 'Deep work block', time: '11:00', done: false },
          { id: 'c', title: 'Read a chapter', done: false },
        ],
      },
    },
  })
}

function card(extra: Partial<Parameters<typeof DayCard>[0]> = {}) {
  return (
    <DayCard
      date={DATE}
      onClose={() => {}}
      onOpenDay={() => {}}
      onOpenNotes={() => {}}
      onOpenJournal={() => {}}
      {...extra}
    />
  )
}

/**
 * A month cell holds three lines and a day has ten. Everything past the third
 * used to be reachable only by opening the day, which means leaving the
 * month, which means losing the thing somebody came to the month for.
 *
 * Until v2.8 the rest of it appeared on hover and left again the moment the
 * pointer moved toward it, so nothing on it could be reached. It opens on a
 * press now and stays open, which is what the rest of these are about.
 */

test('it names the day, its template, and every task in the day\'s own order', () => {
  seed()
  render(card())

  expect(screen.getByText('Monday, September 7')).toBeInTheDocument()
  expect(screen.getByText('Working day')).toBeInTheDocument()
  const items = screen.getAllByRole('listitem')
  expect(items.map(li => within(li).getByText(/Job hunt|Deep work block|Read a chapter/).textContent)).toEqual([
    'Job hunt',
    'Deep work block',
    'Read a chapter',
  ])
})

/**
 * Two facts, and neither is a verdict. "6 of 9" is a fact about a list; "3
 * missed" is a report card, and this app does not hand those out - the same
 * rule the evening close and the day stats already keep.
 */
test('it says how much happened and how much moved on, and never what was missed', () => {
  seed()
  const { container } = render(card())

  expect(screen.getByText('1 of 3 done')).toBeInTheDocument()
  expect(container.textContent).not.toMatch(/missed|behind|failed|incomplete|overdue|left|remaining/i)
})

test('a day nobody has planned says so, rather than showing a zero', () => {
  render(card())
  expect(screen.getByText('Nothing on this day.')).toBeInTheDocument()
  expect(screen.queryByText(/of 0 done/)).toBeNull()
})

test('opening the day is one press', async () => {
  const user = userEvent.setup()
  const onOpenDay = vi.fn()
  seed()
  render(card({ onOpenDay }))

  await user.click(screen.getByRole('button', { name: 'Open day' }))
  expect(onOpenDay).toHaveBeenCalledTimes(1)
})

/**
 * The whole reason a card that stays open is worth having: what it shows can
 * be acted on. A tick here is the same store write the day's own list makes,
 * so the day is ticked - not a copy of it.
 */
test('ticking a task in the card ticks it on the day', async () => {
  const user = userEvent.setup()
  seed()
  render(card())

  await user.click(screen.getByRole('checkbox', { name: 'Deep work block' }))
  expect(getData().days[DATE].tasks.find(t => t.id === 'b')!.done).toBe(true)
})

test('saying something came up is offered where the caller says so, and is one press', async () => {
  const user = userEvent.setup()
  const onInterrupt = vi.fn()
  seed()

  const { unmount } = render(card())
  expect(screen.queryByRole('button', { name: 'Something came up' })).toBeNull()
  unmount()

  render(card({ onInterrupt }))
  await user.click(screen.getByRole('button', { name: 'Something came up' }))
  expect(onInterrupt).toHaveBeenCalledTimes(1)
})

/**
 * Three ways out and no fourth. The hover this replaced closed itself on the
 * way to being used; this one closes only when somebody says so.
 */
test('its own Close, Escape and a press outside it each close the card', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  seed()

  const { unmount } = render(card({ onClose }))
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  unmount()

  const escape = vi.fn()
  const one = render(card({ onClose: escape }))
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(escape).toHaveBeenCalledTimes(1)
  one.unmount()

  const outside = vi.fn()
  render(card({ onClose: outside }))
  fireEvent.pointerDown(document.body)
  expect(outside).toHaveBeenCalledTimes(1)
})

/**
 * Clearing a day is the expensive one on this card, so it asks in one
 * sentence that says how much and which day - "Clear this day?" over seven
 * columns does not say which - and it asks in the card rather than in a
 * sheet over the month.
 */
test('clearing asks once, naming the count and the day, and Cancel leaves the day alone', async () => {
  const user = userEvent.setup()
  seed()
  render(card())

  await user.click(screen.getByRole('button', { name: 'Clear this day' }))
  expect(screen.getByText('Clear 3 tasks from Monday?')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(getData().days[DATE].tasks).toHaveLength(3)
  expect(screen.getByRole('button', { name: 'Clear this day' })).toBeInTheDocument()
})

test('the second press empties the day and offers the undo, which puts it back', async () => {
  const user = userEvent.setup()
  seed()
  render(card())

  await user.click(screen.getByRole('button', { name: 'Clear this day' }))
  await user.click(screen.getByRole('button', { name: 'Clear' }))
  expect(getData().days[DATE].tasks).toEqual([])
  expect(getUndo()?.label).toBe('Monday cleared')

  runUndo()
  expect(getData().days[DATE].tasks).toHaveLength(3)
})

test('a day with nothing on it is not offered a way to clear it', () => {
  render(card())
  expect(screen.queryByRole('button', { name: 'Clear this day' })).toBeNull()
})

/**
 * Both doors are about this day, not about the general view - which is the
 * whole of what the owner asked for: a mark on a day you can press to see
 * what is written there.
 */
test('Notes and Journal each open at the day the card is about', async () => {
  const user = userEvent.setup()
  const onOpenNotes = vi.fn()
  const onOpenJournal = vi.fn()
  seed()
  render(card({ onOpenNotes, onOpenJournal }))

  await user.click(screen.getByRole('button', { name: 'Notes' }))
  await user.click(screen.getByRole('button', { name: 'Journal' }))
  expect(onOpenNotes).toHaveBeenCalledTimes(1)
  expect(onOpenJournal).toHaveBeenCalledTimes(1)
})
