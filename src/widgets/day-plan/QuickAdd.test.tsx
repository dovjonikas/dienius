import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickAdd } from './QuickAdd'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { todayKey } from '../../lib/dates'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  actions.resetForTests(defaultData())
})

afterEach(() => {
  vi.useRealTimers()
})

function tasksOn(date: string) {
  return getData().days[date]?.tasks ?? []
}

/**
 * The whole reason this control exists: getting a task onto the day at a
 * real time, for a real length, without typing either of them.
 *
 * Everything below is a version of that promise or of its escape hatch. The
 * escape hatch matters as much as the promise does - a default that cannot
 * be overruled in one gesture is worse than no default, because the day it
 * is wrong is the day somebody stops trusting the whole field.
 */

test('a title and Enter is enough: the task lands at a time, for a length', async () => {
  const user = userEvent.setup()
  render(<QuickAdd date={DATE} tasks={[]} />)

  await user.type(screen.getByPlaceholderText(/Add a task/), 'Call mom{Enter}')

  // 07:00 is where the default waking window opens, and this day is not
  // today, so nothing has been and gone yet.
  expect(tasksOn(DATE)).toMatchObject([{ title: 'Call mom', time: '07:00', minutes: 30 }])
})

test('the time the control is showing is the time you get', async () => {
  const user = userEvent.setup()
  render(<QuickAdd date={DATE} tasks={[]} />)

  const shown = screen.getByRole('button', { expanded: false, name: /next free slot/i }).textContent
  await user.type(screen.getByPlaceholderText(/Add a task/), 'Call mom{Enter}')

  expect(tasksOn(DATE)[0].time).toBe(shown)
})

test('the arrows move the suggestion a quarter of an hour at a time', async () => {
  const user = userEvent.setup()
  render(<QuickAdd date={DATE} tasks={[]} />)

  await user.click(screen.getByRole('button', { name: /quarter of an hour later/i }))
  await user.click(screen.getByRole('button', { name: /quarter of an hour later/i }))
  await user.type(screen.getByPlaceholderText(/Add a task/), 'Call mom{Enter}')

  expect(tasksOn(DATE)[0].time).toBe('07:30')
})

test('the suggestion goes round whatever is already on the day', async () => {
  const user = userEvent.setup()
  const tasks = [{ id: 'a', title: 'Standup', done: false, time: '07:00', minutes: 60 }]
  render(<QuickAdd date={DATE} tasks={tasks} />)

  await user.type(screen.getByPlaceholderText(/Add a task/), 'Call mom{Enter}')

  expect(tasksOn(DATE)[0].time).toBe('08:00')
})

test('a full day offers no time rather than a squeezed-in one', async () => {
  const user = userEvent.setup()
  const tasks = [{ id: 'a', title: 'Shift', done: false, time: '07:00', minutes: 16 * 60 }]
  render(<QuickAdd date={DATE} tasks={tasks} />)

  expect(screen.getByRole('button', { expanded: false, name: /nothing free left/i })).toBeInTheDocument()
  await user.type(screen.getByPlaceholderText(/Add a task/), 'Call mom{Enter}')

  expect(tasksOn(DATE)[0].time).toBeUndefined()
  expect(tasksOn(DATE)[0].minutes).toBe(30)
})

test('No time is a choice, not only what is left when nothing fits', async () => {
  const user = userEvent.setup()
  render(<QuickAdd date={DATE} tasks={[]} />)

  await user.click(screen.getByRole('button', { expanded: false, name: /next free slot/i }))
  await user.click(screen.getByRole('button', { name: 'No time' }))
  await user.type(screen.getByPlaceholderText(/Add a task/), 'Call mom{Enter}')

  expect(tasksOn(DATE)[0].time).toBeUndefined()
})

/**
 * The power path. Typing the time and the length inside the sentence has
 * worked since v1.0 and still does; what is new is that the controls redraw
 * to show what was understood, so the parse is visible before Enter rather
 * than only afterwards in the chips.
 */

test('a time typed into the line overrules the suggestion, and the control says so', async () => {
  const user = userEvent.setup()
  render(<QuickAdd date={DATE} tasks={[]} />)

  await user.type(screen.getByPlaceholderText(/Add a task/), '14:00 Call mom 45min')
  expect(screen.getByRole('button', { name: /read from what you typed/i })).toHaveTextContent('14:00')
  expect(screen.getByRole('button', { name: /45 min long/i })).toBeInTheDocument()

  await user.keyboard('{Enter}')
  expect(tasksOn(DATE)).toMatchObject([{ title: 'Call mom', time: '14:00', minutes: 45 }])
})

test('an arrow pushed against a typed time rewrites the words, so there is one truth on screen', async () => {
  const user = userEvent.setup()
  render(<QuickAdd date={DATE} tasks={[]} />)

  const field = screen.getByPlaceholderText(/Add a task/)
  await user.type(field, '14:00 Call mom')
  await user.click(screen.getByRole('button', { name: /quarter of an hour later/i }))

  expect(field).toHaveValue('14:15 Call mom')
})

test('a duration chip tapped against a typed duration rewrites the words too', async () => {
  const user = userEvent.setup()
  render(<QuickAdd date={DATE} tasks={[]} />)

  const field = screen.getByPlaceholderText(/Add a task/)
  await user.type(field, 'Call mom 45min')
  await user.click(screen.getByRole('button', { name: /45 min long/i }))
  await user.click(screen.getByRole('button', { name: '15min' }))

  expect(field).toHaveValue('Call mom 15min')
})

/**
 * The length, and the one thing about it worth storing: which one you keep
 * choosing. A run of tasks typed in one sitting is usually a run of
 * similarly-sized tasks, and re-picking 45m five times is the papercut this
 * whole control exists to remove.
 */

test('the last length chosen is the one the next task starts from', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<QuickAdd date={DATE} tasks={[]} />)

  await user.click(screen.getByRole('button', { name: /30 min long/i }))
  await user.click(screen.getByRole('button', { name: '45min' }))
  await user.type(screen.getByPlaceholderText(/Add a task/), 'Call mom{Enter}')
  expect(tasksOn(DATE)[0].minutes).toBe(45)

  // A fresh mount, as after a reload: the choice is remembered, not held in
  // this component's own state.
  unmount()
  render(<QuickAdd date={DATE} tasks={[]} />)
  await user.type(screen.getByPlaceholderText(/Add a task/), 'Water the plants{Enter}')
  expect(tasksOn(DATE)[1].minutes).toBe(45)
})

test('a longer suggestion needs a longer gap, so the two controls answer together', async () => {
  const user = userEvent.setup()
  const tasks = [
    { id: 'a', title: 'Standup', done: false, time: '07:00', minutes: 30 },
    { id: 'b', title: 'Review', done: false, time: '08:00', minutes: 60 },
  ]
  render(<QuickAdd date={DATE} tasks={tasks} />)

  // Half an hour fits between the two; an hour does not, so the time moves.
  expect(screen.getByRole('button', { expanded: false, name: /07:30/ })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /30 min long/i }))
  await user.click(screen.getByRole('button', { name: '1h' }))
  expect(screen.getByRole('button', { expanded: false, name: /09:00/ })).toBeInTheDocument()
})

/** After an add, the next thing typed lands after the thing just added. */
test('adding twice in a row does not stack both tasks on the same minute', async () => {
  const user = userEvent.setup()
  function Harness() {
    const tasks = tasksOn(DATE)
    return <QuickAdd date={DATE} tasks={tasks} />
  }
  const { rerender } = render(<Harness />)

  await user.type(screen.getByPlaceholderText(/Add a task/), 'Call mom{Enter}')
  rerender(<Harness />)
  await user.type(screen.getByPlaceholderText(/Add a task/), 'Water the plants{Enter}')

  expect(tasksOn(DATE).map(t => t.time)).toEqual(['07:00', '07:30'])
})

/**
 * Today is the one day where "now" has an honest position, and it is the day
 * this field is used on. A suggestion in the past is not a suggestion.
 */
test('on today the suggestion is now itself, so the task is the running one', () => {
  // fireEvent rather than userEvent here alone: userEvent schedules its own
  // timers between keystrokes, and with the clock frozen those never fire, so
  // the typing never finishes. Nothing about this test needs a real key
  // sequence - it is asserting the arithmetic that runs at 14:07.
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${todayKey()}T14:07:00`))
  render(<QuickAdd date={todayKey()} tasks={[]} />)

  const field = screen.getByPlaceholderText(/Add a task/)
  fireEvent.change(field, { target: { value: 'Call mom' } })
  fireEvent.keyDown(field, { key: 'Enter' })

  expect(tasksOn(todayKey())[0].time).toBe('14:07')
})

/** An inbox line has no day, so it has no hour and no length to argue about. */
test('switching to Inbox takes both controls away rather than greying them out', async () => {
  const user = userEvent.setup()
  render(<QuickAdd date={DATE} tasks={[]} />)

  await user.click(screen.getByRole('button', { name: 'Inbox' }))

  expect(screen.queryByRole('button', { name: /next free slot/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /min long/i })).not.toBeInTheDocument()

  await user.type(screen.getByPlaceholderText(/Catch a thought/), '14:00 Call mom 45min{Enter}')
  // Exactly as typed: an inbox item is not a task yet, and a time inside it
  // is part of the note somebody wrote to themselves.
  expect(getData().inbox).toMatchObject([{ text: '14:00 Call mom 45min' }])
  expect(tasksOn(DATE)).toHaveLength(0)
})

test('two presses of an arrow inside one frame move two quarters, not one', async () => {
  const user = userEvent.setup()
  render(<QuickAdd date={DATE} tasks={[]} />)

  // Found in a browser, not by this suite: stepping from the value in the
  // current render's closure meant the second press of a double tap read the
  // same time the first one did and was swallowed.
  const up = screen.getByRole('button', { name: /quarter of an hour later/i })
  up.click()
  up.click()
  await user.type(screen.getByPlaceholderText(/Add a task/), 'Call mom{Enter}')

  expect(tasksOn(DATE)[0].time).toBe('07:30')
})
