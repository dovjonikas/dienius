import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Later } from './Later'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

/**
 * Later is the shelf for something to do that is not for any particular
 * day. Almost every test here is about what it refuses to do: it does not
 * record an age, it does not show one, it does not appear until you go
 * looking, and it never says anything about how much is in it beyond a
 * plain count.
 *
 * The one thing it does actively is be easy to pull from, and that is the
 * other half of these.
 */

test('an empty Later is not there at all - it is not a section waiting to be filled', () => {
  const { container } = render(<Later date={DATE} />)
  expect(container).toBeEmptyDOMElement()
})

test('an item carries what a task carries, minus the day', () => {
  actions.addLaterItem({ title: 'Fix the bike light', category: 'health', minutes: 45 })
  // No createdAt, and none is possible: a list that can show how long
  // something has been sitting is a list that accuses you every time you open
  // it. updatedAt is stamped by commit() for sync and is never shown.
  expect(getData().backlog[0]).toEqual({
    id: expect.any(String),
    title: 'Fix the bike light',
    category: 'health',
    minutes: 45,
    updatedAt: expect.any(String),
  })
})

// The cheap way in: a line with nothing but its words, the way something
// blurted into the field or sent from Notes arrives. Nothing is asked of it.
test('a bare line is just its words - no day, no time, no size, no colour', () => {
  actions.addLaterItem({ title: 'Book the dentist' })
  expect(getData().backlog[0]).toEqual({
    id: expect.any(String),
    title: 'Book the dentist',
    updatedAt: expect.any(String),
  })
})

test('a blank line is not added, and neither is a size of zero', () => {
  actions.addLaterItem({ title: '   ' })
  actions.addLaterItem({ title: 'Real', minutes: 0 })
  expect(getData().backlog).toHaveLength(1)
  expect(getData().backlog[0].minutes).toBeUndefined()
})

// Later is a ranking, and a thing added today does not outrank a thing
// written down last week just by being newer.
test('a new item joins the end of the list, not the front', () => {
  actions.addLaterItem({ title: 'First' })
  actions.addLaterItem({ title: 'Second' })
  expect(getData().backlog.map(i => i.title)).toEqual(['First', 'Second'])
})

test('order is the only ranking, and it can be changed', () => {
  actions.addLaterItem({ title: 'First' })
  actions.addLaterItem({ title: 'Second' })
  actions.addLaterItem({ title: 'Third' })
  const third = getData().backlog[2].id
  actions.moveLaterItem(third, 0)
  expect(getData().backlog.map(i => i.title)).toEqual(['Third', 'First', 'Second'])
})

test('moving past either end lands at that end rather than doing nothing', () => {
  actions.addLaterItem({ title: 'First' })
  actions.addLaterItem({ title: 'Second' })
  actions.moveLaterItem(getData().backlog[0].id, 99)
  expect(getData().backlog.map(i => i.title)).toEqual(['Second', 'First'])
  actions.moveLaterItem(getData().backlog[1].id, -3)
  expect(getData().backlog.map(i => i.title)).toEqual(['First', 'Second'])
})

test('the fold says how many, in nothing but a number', () => {
  actions.addLaterItem({ title: 'One' })
  actions.addLaterItem({ title: 'Two' })
  render(<Later date={DATE} />)
  const fold = screen.getByRole('button', { name: /^Later/ })
  expect(fold).toHaveTextContent('2')
  // Nothing anywhere counts, ranks or ages what is in here.
  expect(fold.textContent).not.toMatch(/old|since|waiting|overdue|days/i)
})

test('it is closed until somebody opens it, so the day view never mentions it', async () => {
  const user = userEvent.setup()
  actions.addLaterItem({ title: 'Fix the bike light' })
  const { container } = render(<Later date={DATE} />)
  expect(container.querySelector('.later-section.open')).toBeNull()
  await user.click(screen.getByRole('button', { name: /^Later/ }))
  expect(container.querySelector('.later-section.open')).not.toBeNull()
})

/**
 * Pulling one onto a day. It leaves Later in the same commit that puts the
 * task on the day - a thing that is on today and still in Later is the same
 * thing written down twice, and the second copy is the one nobody notices
 * until it is stale.
 */
test('one press puts an item on the day, at a free slot, with everything it carried', async () => {
  const user = userEvent.setup()
  actions.addLaterItem({ title: 'Fix the bike light', category: 'health', minutes: 45 })
  render(<Later date={DATE} />)
  await user.click(screen.getByRole('button', { name: /^Later/ }))
  const pull = screen.getByRole('button', { name: /Put "Fix the bike light" on this day/ })
  // The button says where the item is going, in the words a person would use.
  expect(pull).toHaveTextContent('Onto this day')
  await user.click(pull)

  expect(getData().backlog).toHaveLength(0)
  expect(getData().days[DATE].tasks).toMatchObject([
    { title: 'Fix the bike light', category: 'health', minutes: 45, time: '07:00' },
  ])
})

test('it goes round what is already on the day rather than on top of it', async () => {
  const user = userEvent.setup()
  actions.addTask(DATE, 'Standup', '07:00')
  actions.setTaskMinutes(DATE, getData().days[DATE].tasks[0].id, 60)
  actions.addLaterItem({ title: 'Fix the bike light', minutes: 45 })
  render(<Later date={DATE} />)
  await user.click(screen.getByRole('button', { name: /^Later/ }))
  await user.click(screen.getByRole('button', { name: /Put "Fix the bike light" on this day/ }))

  expect(getData().days[DATE].tasks.at(-1)).toMatchObject({ title: 'Fix the bike light', time: '08:00' })
})

test('an item can go on as a float when there is nothing free to put it in', () => {
  actions.addLaterItem({ title: 'Fix the bike light' })
  actions.scheduleLaterItem(getData().backlog[0].id, DATE)
  expect(getData().days[DATE].tasks[0].time).toBeUndefined()
})

test('scheduling something that is not there changes nothing', () => {
  expect(actions.scheduleLaterItem('nope', DATE)).toBe(false)
  expect(getData().days[DATE]).toBeUndefined()
})

test('deleting takes a confirming second tap - a stray tap cannot lose a line', async () => {
  const user = userEvent.setup()
  actions.addLaterItem({ title: 'Fix the bike light' })
  render(<Later date={DATE} />)
  await user.click(screen.getByRole('button', { name: /^Later/ }))

  await user.click(screen.getByRole('button', { name: 'Delete "Fix the bike light"' }))
  expect(getData().backlog).toHaveLength(1)
  // Armed, the cross becomes a question, so the second press knows what it is.
  const armed = screen.getByRole('button', { name: 'Confirm delete "Fix the bike light"' })
  expect(armed).toHaveTextContent('Delete?')
  await user.click(armed)
  expect(getData().backlog).toHaveLength(0)
})

test('the armed delete disarms itself when it loses focus', async () => {
  const user = userEvent.setup()
  actions.addLaterItem({ title: 'Fix the bike light' })
  render(<Later date={DATE} />)
  await user.click(screen.getByRole('button', { name: /^Later/ }))

  await user.click(screen.getByRole('button', { name: 'Delete "Fix the bike light"' }))
  await user.tab()
  expect(screen.getByRole('button', { name: 'Delete "Fix the bike light"' })).toBeInTheDocument()
  expect(getData().backlog).toHaveLength(1)
})

test('the row offers reordering to a keyboard as well as a finger', async () => {
  const user = userEvent.setup()
  actions.addLaterItem({ title: 'First' })
  actions.addLaterItem({ title: 'Second' })
  render(<Later date={DATE} />)
  await user.click(screen.getByRole('button', { name: /^Later/ }))

  const second = screen.getByRole('button', { name: /Reorder Second, position 2 of 2/ })
  second.focus()
  await user.keyboard('{ArrowUp}')
  expect(getData().backlog.map(i => i.title)).toEqual(['Second', 'First'])
})

test('a category and a size are shown on the row when they are there, and nothing when they are not', async () => {
  const user = userEvent.setup()
  actions.addLaterItem({ title: 'Sized', category: 'health', minutes: 45 })
  actions.addLaterItem({ title: 'Bare' })
  const { container } = render(<Later date={DATE} />)
  await user.click(screen.getByRole('button', { name: /^Later/ }))

  const rows = container.querySelectorAll('.later-item')
  expect(within(rows[0] as HTMLElement).getByText('45 min')).toBeInTheDocument()
  expect(within(rows[0] as HTMLElement).getByText('Health')).toBeInTheDocument()
  expect((rows[1] as HTMLElement).querySelector('.later-item-meta')?.textContent).toBe('')
})
