import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FocusBar } from './FocusBar'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { clockTools, getClockTools } from '../../lib/clockTools'
import { todayKey } from '../../lib/dates'

const DATE = todayKey()

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  clockTools.resetForTests()
})

function seedTask(title = 'Deep work'): string {
  actions.addTask(DATE, title)
  return getData().days[DATE].tasks[0].id
}

// Focus is a state the app is in, not a screen it goes to - see FocusBar's
// own comment. That is why the bar is part of the shell and why it is
// nothing at all when no session is running.

test('nothing is rendered while no session is running', () => {
  const { container } = render(<FocusBar onExpand={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})

test('a running session names the task it is on', () => {
  const id = seedTask()
  clockTools.startFocus(DATE, id)
  render(<FocusBar onExpand={() => {}} />)
  expect(screen.getByText('Deep work')).toBeInTheDocument()
})

// Rotating shifts, stage 4: a session on last night's shift counts on that
// date's clock, so half past one reads the hours left, not a day and a half.
test("a session on last night's shift still counts down after midnight", () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 17, 1, 30))
  actions.resetForTests({
    ...defaultData(),
    days: { '2026-09-16': { date: '2026-09-16', tasks: [{ id: 'night', title: 'Night shift', done: false, time: '22:00', minutes: 480 }] } },
  })
  clockTools.startFocus('2026-09-16', 'night')
  render(<FocusBar onExpand={() => {}} />)
  expect(screen.getByText('4h 30 min left')).toBeInTheDocument()
  vi.useRealTimers()
})

test('leaving the bar ends the session rather than hiding it', async () => {
  const user = userEvent.setup()
  const id = seedTask()
  clockTools.startFocus(DATE, id)
  render(<FocusBar onExpand={() => {}} />)

  await user.click(screen.getByRole('button', { name: 'Leave focus' }))
  expect(getClockTools().focus ?? undefined).toBeUndefined()
})

// A session pointing at a task that no longer exists - deleted, or its day
// wiped by an import - has to end itself, not leave a bar with nothing
// behind it.
test('a session whose task was deleted ends itself', () => {
  const id = seedTask()
  clockTools.startFocus(DATE, id)
  actions.deleteTask(DATE, id)

  const { container } = render(<FocusBar onExpand={() => {}} />)
  expect(container).toBeEmptyDOMElement()
  expect(getClockTools().focus ?? undefined).toBeUndefined()
})

test('the full-screen version is offered rather than being the default', async () => {
  const user = userEvent.setup()
  const onExpand = vi.fn()
  const id = seedTask()
  clockTools.startFocus(DATE, id)
  render(<FocusBar onExpand={onExpand} />)

  await user.click(screen.getByRole('button', { name: 'Expand' }))
  expect(onExpand).toHaveBeenCalled()
})
