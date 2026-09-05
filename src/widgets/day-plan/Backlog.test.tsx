import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Backlog } from './Backlog'
import { Inbox } from './Inbox'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

/**
 * The backlog is the shelf for something you have decided to do that is not
 * for any particular day. Almost every test here is about what it refuses to
 * do: it does not record an age, it does not show one, it does not appear
 * until you go looking, and it never says anything about how much is in it
 * beyond a plain count.
 *
 * The one thing it does actively is be easy to pull from, and that is the
 * other half of these.
 */

test('an empty backlog is not there at all - it is not a section waiting to be filled', () => {
  const { container } = render(<Backlog date={DATE} />)
  expect(container).toBeEmptyDOMElement()
})

test('an item carries what a task carries, minus the day', () => {
  actions.addBacklogItem({ title: 'Fix the bike light', category: 'health', minutes: 45 })
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

test('a blank line is not added, and neither is a size of zero', () => {
  actions.addBacklogItem({ title: '   ' })
  actions.addBacklogItem({ title: 'Real', minutes: 0 })
  expect(getData().backlog).toHaveLength(1)
  expect(getData().backlog[0].minutes).toBeUndefined()
})

// The inbox is newest-first because it is read from the top. A backlog is a
// ranking, and a thing added today does not outrank a thing decided last week
// just by being newer.
test('a new item joins the end of the list, not the front', () => {
  actions.addBacklogItem({ title: 'First' })
  actions.addBacklogItem({ title: 'Second' })
  expect(getData().backlog.map(i => i.title)).toEqual(['First', 'Second'])
})

test('order is the only ranking, and it can be changed', () => {
  actions.addBacklogItem({ title: 'First' })
  actions.addBacklogItem({ title: 'Second' })
  actions.addBacklogItem({ title: 'Third' })
  const third = getData().backlog[2].id
  actions.moveBacklogItem(third, 0)
  expect(getData().backlog.map(i => i.title)).toEqual(['Third', 'First', 'Second'])
})

test('moving past either end lands at that end rather than doing nothing', () => {
  actions.addBacklogItem({ title: 'First' })
  actions.addBacklogItem({ title: 'Second' })
  actions.moveBacklogItem(getData().backlog[0].id, 99)
  expect(getData().backlog.map(i => i.title)).toEqual(['Second', 'First'])
  actions.moveBacklogItem(getData().backlog[1].id, -3)
  expect(getData().backlog.map(i => i.title)).toEqual(['First', 'Second'])
})

test('the fold says how many, in nothing but a number', () => {
  actions.addBacklogItem({ title: 'One' })
  actions.addBacklogItem({ title: 'Two' })
  render(<Backlog date={DATE} />)
  const fold = screen.getByRole('button', { name: /^Backlog/ })
  expect(fold).toHaveTextContent('2')
  // Nothing anywhere counts, ranks or ages what is in here.
  expect(fold.textContent).not.toMatch(/old|since|waiting|overdue|days/i)
})

test('it is closed until somebody opens it, so the day view never mentions it', async () => {
  const user = userEvent.setup()
  actions.addBacklogItem({ title: 'Fix the bike light' })
  const { container } = render(<Backlog date={DATE} />)
  expect(container.querySelector('.backlog-section.open')).toBeNull()
  await user.click(screen.getByRole('button', { name: /^Backlog/ }))
  expect(container.querySelector('.backlog-section.open')).not.toBeNull()
})

/**
 * Pulling one onto a day. It leaves the backlog in the same commit that puts
 * the task on the day - a thing that is on today and still in the backlog is
 * the same thing written down twice, and the second copy is the one nobody
 * notices until it is stale.
 */
test('one press puts an item on the day, at a free slot, with everything it carried', async () => {
  const user = userEvent.setup()
  actions.addBacklogItem({ title: 'Fix the bike light', category: 'health', minutes: 45 })
  render(<Backlog date={DATE} />)
  await user.click(screen.getByRole('button', { name: /^Backlog/ }))
  await user.click(screen.getByRole('button', { name: /Put "Fix the bike light" on this day/ }))

  expect(getData().backlog).toHaveLength(0)
  expect(getData().days[DATE].tasks).toMatchObject([
    { title: 'Fix the bike light', category: 'health', minutes: 45, time: '07:00' },
  ])
})

test('it goes round what is already on the day rather than on top of it', () => {
  actions.addTask(DATE, 'Standup', '07:00')
  actions.setTaskMinutes(DATE, getData().days[DATE].tasks[0].id, 60)
  actions.addBacklogItem({ title: 'Fix the bike light', minutes: 45 })
  const item = getData().backlog[0].id

  actions.scheduleBacklogItem(item, DATE, '08:00')
  expect(getData().days[DATE].tasks.at(-1)).toMatchObject({ title: 'Fix the bike light', time: '08:00' })
})

test('an item can go on as a float when there is nothing free to put it in', () => {
  actions.addBacklogItem({ title: 'Fix the bike light' })
  actions.scheduleBacklogItem(getData().backlog[0].id, DATE)
  expect(getData().days[DATE].tasks[0].time).toBeUndefined()
})

test('scheduling something that is not there changes nothing', () => {
  expect(actions.scheduleBacklogItem('nope', DATE)).toBe(false)
  expect(getData().days[DATE]).toBeUndefined()
})

test('deleting takes a confirming second tap', async () => {
  const user = userEvent.setup()
  actions.addBacklogItem({ title: 'Fix the bike light' })
  render(<Backlog date={DATE} />)
  await user.click(screen.getByRole('button', { name: /^Backlog/ }))

  await user.click(screen.getByRole('button', { name: /^Delete/ }))
  expect(getData().backlog).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: /^Confirm delete/ }))
  expect(getData().backlog).toHaveLength(0)
})

/**
 * The third answer to an inbox line, and the one that was missing. "Yes, but
 * not now" had nowhere to go, so the line stayed in the inbox and got re-read
 * every morning.
 */
test('an inbox line can be sent to the backlog, and leaves the inbox when it goes', async () => {
  const user = userEvent.setup()
  actions.addInboxItem('Look into a bike service')
  render(<Inbox date={DATE} />)
  await user.click(screen.getByRole('button', { name: /^Inbox/ }))
  await user.click(screen.getByRole('button', { name: /Send "Look into a bike service" to the backlog/ }))

  expect(getData().inbox).toHaveLength(0)
  expect(getData().backlog.map(i => i.title)).toEqual(['Look into a bike service'])
})

test('the row offers reordering to a keyboard as well as a finger', async () => {
  const user = userEvent.setup()
  actions.addBacklogItem({ title: 'First' })
  actions.addBacklogItem({ title: 'Second' })
  render(<Backlog date={DATE} />)
  await user.click(screen.getByRole('button', { name: /^Backlog/ }))

  const second = screen.getByRole('button', { name: /Reorder Second, position 2 of 2/ })
  second.focus()
  await user.keyboard('{ArrowUp}')
  expect(getData().backlog.map(i => i.title)).toEqual(['Second', 'First'])
})

test('a category and a size are shown on the row when they are there, and nothing when they are not', async () => {
  const user = userEvent.setup()
  actions.addBacklogItem({ title: 'Sized', category: 'health', minutes: 45 })
  actions.addBacklogItem({ title: 'Bare' })
  const { container } = render(<Backlog date={DATE} />)
  await user.click(screen.getByRole('button', { name: /^Backlog/ }))

  const rows = container.querySelectorAll('.backlog-item')
  expect(within(rows[0] as HTMLElement).getByText('45 min')).toBeInTheDocument()
  expect(within(rows[0] as HTMLElement).getByText('Health')).toBeInTheDocument()
  expect((rows[1] as HTMLElement).querySelector('.backlog-item-meta')?.textContent).toBe('')
})
