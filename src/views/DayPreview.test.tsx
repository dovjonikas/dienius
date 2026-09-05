import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayPreview } from './DayPreview'
import { actions } from '../lib/store'
import { defaultData } from '../lib/storage'

const DATE = '2026-09-07'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
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

/**
 * A month cell holds three lines and a day has ten. Everything past the third
 * used to be reachable only by opening the day, which means leaving the
 * month, which means losing the thing somebody came to the month for.
 */

test('it names the day, its template, and every task in the day\'s own order', () => {
  seed()
  render(<DayPreview date={DATE} onOpenDay={() => {}} />)

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
  const { container } = render(<DayPreview date={DATE} onOpenDay={() => {}} />)

  expect(screen.getByText('1 of 3 done')).toBeInTheDocument()
  expect(container.textContent).not.toMatch(/missed|behind|failed|incomplete|overdue|left|remaining/i)
})

test('a day nobody has planned says so, rather than showing a zero', () => {
  render(<DayPreview date={DATE} onOpenDay={() => {}} />)
  expect(screen.getByText('Nothing on this day yet.')).toBeInTheDocument()
  expect(screen.queryByText(/of 0 done/)).toBeNull()
})

test('opening the day is one press', async () => {
  const user = userEvent.setup()
  const onOpenDay = vi.fn()
  seed()
  render(<DayPreview date={DATE} onOpenDay={onOpenDay} />)

  await user.click(screen.getByRole('button', { name: 'Open day' }))
  expect(onOpenDay).toHaveBeenCalledTimes(1)
})

// Two actions and no more. Stamp is offered only where stamping is already
// what the pointer is doing; a preview that grows a third action is a menu,
// and a menu that appears because a cursor stopped moving is a menu nobody
// asked for.
test('stamping is offered only when a template is in hand', async () => {
  const user = userEvent.setup()
  const onStamp = vi.fn()
  seed()

  const { unmount } = render(<DayPreview date={DATE} onOpenDay={() => {}} />)
  expect(screen.queryByRole('button', { name: 'Stamp' })).toBeNull()
  unmount()

  render(<DayPreview date={DATE} onOpenDay={() => {}} onStamp={onStamp} />)
  await user.click(screen.getByRole('button', { name: 'Stamp' }))
  expect(onStamp).toHaveBeenCalledTimes(1)
})
