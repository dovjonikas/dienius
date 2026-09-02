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
