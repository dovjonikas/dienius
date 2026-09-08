import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetAsideStrip } from './SetAsideStrip'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import type { Task } from '../../lib/types'

/**
 * The strip along the bottom of the day: what a replan took off, waiting.
 *
 * The owner's scenario is the whole test: replan without knowing how long,
 * something comes off, and when you get home one press puts it back where
 * there is room. Quiet while it waits, one press to open the offer, one
 * more to take it, and an undo either way.
 */

const DATE = '2026-09-16'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function dayWith(tasks: Partial<Task>[]) {
  const data = defaultData()
  data.days[DATE] = { date: DATE, tasks: tasks.map((t, i) => ({ id: `t${i + 1}`, title: `Task ${i + 1}`, done: false, ...t })) }
  actions.resetForTests(data)
}

/** Six in the evening, so there is room after it and a wall before bedtime. */
const strip = (now = 18 * 60) => render(<SetAsideStrip date={DATE} nowMinutes={now} isToday />)

test('nothing waiting draws nothing at all', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60 }])
  const { container } = strip()
  expect(container).toBeEmptyDOMElement()
})

test('a waiting block is named with the length it is waiting at', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60, setAside: true }])
  strip()
  const row = screen.getByRole('button', { name: /^Gym/ })
  expect(row).toHaveTextContent('Gym')
  expect(row).toHaveTextContent('1h')
})

test('the strip says what it is, quietly, once', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60, setAside: true }])
  strip()
  expect(screen.getByText('Set aside')).toBeInTheDocument()
})

test('one press offers a time, and nothing has moved yet', async () => {
  const user = userEvent.setup()
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60, setAside: true }])
  strip()

  await user.click(screen.getByRole('button', { name: /^Gym/ }))
  expect(screen.getByRole('status')).toHaveTextContent('18:00 - 19:00')
  expect(getData().days[DATE].tasks[0].setAside).toBe(true)
})

test('a second press takes the offer, and the block is back on the day', async () => {
  const user = userEvent.setup()
  dayWith([{ title: 'Gym', time: '09:00', minutes: 60, setAside: true }])
  strip()

  await user.click(screen.getByRole('button', { name: /^Gym/ }))
  await user.click(screen.getByRole('button', { name: 'Bring back' }))

  const task = getData().days[DATE].tasks[0]
  expect(task.setAside).toBeUndefined()
  expect(task.time).toBe('18:00')
})

test('a block with no room left today offers tomorrow instead, and says so', async () => {
  const user = userEvent.setup()
  dayWith([
    { title: 'Gym', time: '09:00', minutes: 60, setAside: true },
    { title: 'Dinner', time: '18:00', minutes: 300 },
  ])
  strip()

  await user.click(screen.getByRole('button', { name: /^Gym/ }))
  expect(screen.getByRole('status')).toHaveTextContent('Tomorrow, at the time it had')
  await user.click(screen.getByRole('button', { name: 'Bring back' }))
  expect(getData().days[DATE].tasks.map(t => t.title)).toEqual(['Dinner'])
  expect(getData().days['2026-09-17'].tasks.map(t => t.title)).toEqual(['Gym'])
})

test('closing the offer leaves it waiting', async () => {
  const user = userEvent.setup()
  dayWith([{ title: 'Gym', time: '09:00', minutes: 60, setAside: true }])
  strip()

  await user.click(screen.getByRole('button', { name: /^Gym/ }))
  await user.click(screen.getByRole('button', { name: 'Not now' }))
  expect(screen.queryByRole('status')).toBeNull()
  expect(getData().days[DATE].tasks[0].setAside).toBe(true)
})

// After midnight the day is over and there is nothing to bring anything
// back into. The strip closes without a word - no summary, no count, no
// "you left three things". CONVENTIONS section 12's tone rule.
test('a day that is not today has no strip, however much is waiting on it', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60, setAside: true }])
  const { container } = render(<SetAsideStrip date={DATE} nowMinutes={18 * 60} isToday={false} />)
  expect(container).toBeEmptyDOMElement()
})

test('a waiting block that was ticked off is not waiting for anything', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60, setAside: true, done: true }])
  const { container } = strip()
  expect(container).toBeEmptyDOMElement()
})

test('the offer never counts what was missed', async () => {
  const user = userEvent.setup()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  dayWith([{ title: 'Gym', time: '09:00', minutes: 120, setAside: true }])
  strip(22 * 60)

  await user.click(screen.getByRole('button', { name: /^Gym/ }))
  expect(screen.getByRole('status').textContent).not.toMatch(/missed|fail|behind|unfinished|only|still|but|%/i)
})
