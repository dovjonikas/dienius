import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tour } from './Tour'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { todayKey } from '../../lib/dates'
import { getTourState, readProgress, resetTourForTests, startTour } from '../../lib/tourState'
import { setTourSandboxForTests } from '../../lib/tourMode'
import { clockTools } from '../../lib/clockTools'
import { DESKTOP_STEPS } from '../../lib/tour'

const TODAY = todayKey()

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  resetTourForTests()
  setTourSandboxForTests(false)
  clockTools.endFocus()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function renderTour() {
  const onNavigate = vi.fn()
  render(<Tour onNavigate={onNavigate} />)
  return { onNavigate }
}

/**
 * The engine walks a data array and asks a predicate whether each step is
 * done. These tests drive it with real store actions, because that is the
 * contract: a step ends when the thing it asked for actually happens, and
 * never on a button.
 */

test('nothing is on screen until a tour is started', () => {
  renderTour()
  expect(screen.queryByRole('dialog', { name: 'Tour' })).toBeNull()
})

test('the welcome step has Start and Skip, and Start moves to the first real step', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  startTour('desktop')
  renderTour()
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent(DESKTOP_STEPS[0].title)
  await user.click(screen.getByRole('button', { name: 'Start' }))
  expect(getTourState().step).toBe(1)
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Stamp a day')
})

test('the engine switches the shell to the tab a step lives on', () => {
  const { onNavigate } = renderTour()
  act(() => startTour('desktop', 6))
  expect(onNavigate).toHaveBeenLastCalledWith('library')
})

test('a step ends when its action happens in the store, shows a tick, then moves on', () => {
  renderTour()
  act(() => startTour('desktop', 2)) // "Add your own"
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Add your own')

  act(() => actions.addTask(TODAY, 'Lunch', '12:00'))
  expect(screen.getByRole('dialog', { name: 'Tour' }).querySelector('.tour-tick.is-on')).not.toBeNull()
  expect(getTourState().step).toBe(2)

  act(() => vi.advanceTimersByTime(700))
  expect(getTourState().step).toBe(3)
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Make it key')
})

// A task added before the step began must not end it - the snapshot the
// predicate compares against is taken when the step starts, not when the
// tour does.
test('what was there before a step began does not count toward it', () => {
  actions.addTask(TODAY, 'Earlier')
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => vi.advanceTimersByTime(700))
  expect(getTourState().step).toBe(2)
})

test('starting Focus ends the focus step', () => {
  actions.addTask(TODAY, 'Lunch', '12:00')
  const id = getData().days[TODAY].tasks[0].id
  renderTour()
  act(() => startTour('desktop', 4))
  act(() => clockTools.startFocus(TODAY, id))
  act(() => vi.advanceTimersByTime(700))
  expect(getTourState().step).toBe(5)
})

test('whatever the tour makes is flagged, and Start clean removes exactly that', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  actions.addTask(TODAY, 'Mine')
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => actions.addTask(TODAY, 'Lunch', '12:00'))
  const tasks = getData().days[TODAY].tasks
  expect(tasks.find(t => t.title === 'Mine')?.tourCreated).toBeUndefined()
  expect(tasks.find(t => t.title === 'Lunch')?.tourCreated).toBe(true)

  act(() => startTour('desktop', DESKTOP_STEPS.length - 1))
  await user.click(screen.getByRole('button', { name: 'Start clean' }))
  expect(getData().days[TODAY].tasks.map(t => t.title)).toEqual(['Mine'])
  expect(getTourState().active).toBe(false)
  expect(readProgress()).toEqual({ done: true })
})

test('Keep what I built leaves everything and takes the flags off', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => actions.addTask(TODAY, 'Lunch', '12:00'))
  act(() => startTour('desktop', DESKTOP_STEPS.length - 1))
  await user.click(screen.getByRole('button', { name: 'Keep what I built' }))
  const lunch = getData().days[TODAY].tasks.find(t => t.title === 'Lunch')
  expect(lunch).toBeDefined()
  expect(lunch?.tourCreated).toBeUndefined()
  expect(getTourState().active).toBe(false)
})

test('Skip is on every step but the last, and ends the tour keeping what was made', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => actions.addTask(TODAY, 'Lunch', '12:00'))
  await user.click(screen.getByRole('button', { name: 'Skip' }))
  expect(getTourState().active).toBe(false)
  expect(getData().days[TODAY].tasks).toHaveLength(1)
  expect(getData().days[TODAY].tasks[0].tourCreated).toBeUndefined()
})

test('the last step has no Skip, only the choice', () => {
  renderTour()
  act(() => startTour('desktop', DESKTOP_STEPS.length - 1))
  expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Keep what I built' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Start clean' })).toBeInTheDocument()
})

// A phone that locks half way through must not lose the tour, and must not
// resume it on top of whatever the person opened the app to do next.
test('a tour left half way is offered again, not resumed on its own', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  localStorage.setItem('dienius:tour-progress', JSON.stringify({ step: 4 }))
  renderTour()
  expect(screen.queryByRole('dialog', { name: 'Tour' })).toBeNull()
  expect(screen.getByText('Pick the tour up where you left it?')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  expect(getTourState()).toMatchObject({ active: true, step: 4 })
})

test('declining the offer ends the tour for good', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  localStorage.setItem('dienius:tour-progress', JSON.stringify({ step: 4 }))
  renderTour()
  await user.click(screen.getByRole('button', { name: 'No thanks' }))
  expect(screen.queryByText('Pick the tour up where you left it?')).toBeNull()
  expect(readProgress()).toEqual({ done: true })
})

test('a finished tour is not offered again', () => {
  localStorage.setItem('dienius:tour-progress', JSON.stringify({ done: true }))
  renderTour()
  expect(screen.queryByText('Pick the tour up where you left it?')).toBeNull()
})

// The sandbox: a replay from Settings. It starts by itself and ends by
// throwing the sandbox away, whatever was built in it.
test('in the sandbox the tour starts on its own and the last step is a single Done', () => {
  setTourSandboxForTests(true)
  renderTour()
  expect(getTourState().active).toBe(true)
  act(() => startTour('desktop', DESKTOP_STEPS.length - 1))
  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Keep what I built' })).toBeNull()
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Nothing here is kept')
})

test('the step text carries the current clock time where it asks for a task now', () => {
  vi.setSystemTime(new Date(2026, 8, 3, 9, 5))
  renderTour()
  act(() => startTour('desktop', 2))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Type 09:05 Walk 30 min')
})
