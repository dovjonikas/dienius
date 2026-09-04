import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YesterdayBanner } from './YesterdayBanner'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { addDays, todayKey } from '../../lib/dates'

const TODAY = todayKey()
const YESTERDAY = addDays(TODAY, -1)

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * What yesterday left is said once and moved in one press - never on its
 * own. These hold the banner's three states: the fact, the confirmation
 * after the press, and nothing at all once it has been seen.
 */

test('yesterday with nothing unfinished is not mentioned', () => {
  actions.addTask(YESTERDAY, 'Done thing')
  actions.toggleTask(YESTERDAY, getData().days[YESTERDAY].tasks[0].id)
  const { container } = render(<YesterdayBanner date={TODAY} />)
  expect(container).toBeEmptyDOMElement()
})

test('what is left is counted, and only on today', () => {
  actions.addTask(YESTERDAY, 'Call the bank')
  actions.addTask(YESTERDAY, 'Reply to Ana')
  render(<YesterdayBanner date={TODAY} />)
  expect(screen.getByRole('status')).toHaveTextContent('Yesterday: 2 unfinished')

  const { container } = render(<YesterdayBanner date={addDays(TODAY, 1)} />)
  expect(container).toBeEmptyDOMElement()
})

// The push moves the tasks off yesterday, so the moment it works there is
// nothing unfinished there any more - and an early return on that emptiness
// used to fire before the confirmation could render. The banner vanished on
// the press, and "Moved 2 to today." was only ever reachable when something
// had stayed behind. The rollover e2e test found it in v1.11.
test('after the press the banner says what moved, then closes for the day', async () => {
  actions.addTask(YESTERDAY, 'Call the bank')
  actions.addTask(YESTERDAY, 'Reply to Ana')
  render(<YesterdayBanner date={TODAY} />)

  await userEvent.click(screen.getByRole('button', { name: 'Push to today' }))
  expect(screen.getByRole('status')).toHaveTextContent('Moved 2 to today.')
  expect(getData().days[TODAY].tasks.map(t => t.title)).toEqual(['Call the bank', 'Reply to Ana'])
  expect(getData().days[YESTERDAY].tasks).toHaveLength(0)

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('status')).toBeNull()
})

test('a task at the push bound stays, and the banner says so rather than moving it', async () => {
  actions.addTask(YESTERDAY, 'Stuck')
  actions.addTask(YESTERDAY, 'Free')
  const stuck = getData().days[YESTERDAY].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      [YESTERDAY]: {
        ...getData().days[YESTERDAY],
        tasks: getData().days[YESTERDAY].tasks.map(t => (t.id === stuck ? { ...t, pushCount: 2 } : t)),
      },
    },
  })
  render(<YesterdayBanner date={TODAY} />)
  expect(screen.getByRole('status')).toHaveTextContent('Yesterday: 2 unfinished - 1 can still move')

  await userEvent.click(screen.getByRole('button', { name: 'Push to today' }))
  expect(screen.getByRole('status')).toHaveTextContent('Moved 1 to today. 1 stayed - already pushed as far as it goes.')
})

test('dismissing is remembered for the rest of the day, on this device', () => {
  actions.addTask(YESTERDAY, 'Call the bank')
  localStorage.setItem('dienius:yesterday-dismissed', TODAY)
  const { container } = render(<YesterdayBanner date={TODAY} />)
  expect(container).toBeEmptyDOMElement()
})
