import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tour } from './Tour'
import { actions, getData, useAppData } from '../../lib/store'
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

/**
 * Stand-ins for the controls the steps point at.
 *
 * The engine skips a step whose target is nowhere in the document, which is
 * the right rule and would otherwise make every test here skip straight to
 * the end - the real controls live in the day view, the library and settings,
 * none of which are mounted for a test about the engine's state machine.
 * That the real names exist in the real source is a different test, in
 * tour.test.ts, and it reads the files rather than rendering them.
 *
 * The empty data-task-id is not a mistake: the task-scoped selectors resolve
 * their task placeholder to an empty string until the tour has made a task,
 * and a step pointing at a task that does not exist yet is a real state the
 * engine passes through.
 */
function TourTargets() {
  const data = useAppData()
  const ids = ['', ...(data.days[TODAY]?.tasks ?? []).map(t => t.id)]
  return (
    <div>
      <button type="button" data-tour="starter-working-day" />
      <input data-quick-add="" />
      <button type="button" data-tour="library-new" />
      <button type="button" data-tour="goal-add" />
      {ids.map(id => (
        <div key={id} data-task-id={id}>
          <button type="button" data-tour="task-menu" />
          <button type="button" data-tour="focus" />
          <button type="button" data-tour="task-check" />
        </div>
      ))}
    </div>
  )
}

function renderTour() {
  const onNavigate = vi.fn()
  render(
    <>
      <TourTargets />
      <Tour onNavigate={onNavigate} />
    </>,
  )
  return { onNavigate }
}

/** No stand-ins at all - the state a step reaches when its control is not on this screen. */
function renderTourWithNoTargets() {
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

  act(() => vi.advanceTimersByTime(1300))
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
  act(() => vi.advanceTimersByTime(1300))
  expect(getTourState().step).toBe(2)
})

/**
 * Rewritten in the hardening wave. Starting Focus used to advance on its own
 * after a beat; it is now one of the two steps that names what just happened
 * and waits, because a focus bar appearing along the bottom of the screen is
 * a thing to look at, and the eye cannot travel there and back inside a tick.
 */
test('starting Focus ends the focus step, names the result, and waits', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  actions.addTask(TODAY, 'Lunch', '12:00')
  const id = getData().days[TODAY].tasks[0].id
  renderTour()
  act(() => startTour('desktop', 4))
  act(() => clockTools.startFocus(TODAY, id))
  act(() => vi.advanceTimersByTime(5000))
  expect(getTourState().step).toBe(4)
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('That bar along the bottom is Focus')
  await user.click(screen.getByRole('button', { name: 'Next' }))
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

/**
 * Rewritten with the quick-add wave. The step used to dictate the whole line
 * - "Type 09:05 Walk 30 min" - because a clock time typed into the words was
 * the only way to make the new task the running one, which the Focus step two
 * on depends on. Quick-add now opens holding that time by itself, so the step
 * teaches the shorter thing it actually promises, and the substitution it used
 * is left in the engine for the next step that needs it.
 */
test('the step that asks for a task says the time is already picked', () => {
  vi.setSystemTime(new Date(2026, 8, 3, 9, 5))
  renderTour()
  act(() => startTour('desktop', 2))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Type Walk in the box, then Enter')
})

// --- the three guards against a step that never ends -------------------------
//
// Every step here waits for a real action, which is what makes it a tour of
// the app rather than a slideshow about it, and is also the one way it can
// trap somebody. A control moved behind a menu, a viewport where the thing is
// off screen, a predicate watching for a write the feature stopped making:
// each leaves a person pressing at a spotlight that never clears. Nobody works
// out that the tour is broken. They close the app.

test('a step whose target never appears offers the way through, then moves on by itself', () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  renderTourWithNoTargets()
  act(() => startTour('desktop', 3))
  expect(getTourState().step).toBe(3)

  // The offer comes long before the giving up. Found at eleven at night: the
  // Focus step points at a button that only exists on the running card, and
  // past bedtime there is no running card, so skipping straight past meant
  // never seeing Focus and never being told why.
  act(() => vi.advanceTimersByTime(3000))
  expect(getTourState().step).toBe(3)
  expect(screen.getByRole('button', { name: 'Do it for me' })).toBeInTheDocument()

  act(() => vi.advanceTimersByTime(10_000))
  expect(getTourState().step).toBe(4)
  expect(info).toHaveBeenCalledWith(expect.stringContaining('no target on this screen'))
})

test('a step with nothing to point at is not skipped - the two ends have no target by design', () => {
  renderTourWithNoTargets()
  act(() => startTour('desktop', 0))
  act(() => vi.advanceTimersByTime(6000))
  expect(getTourState().step).toBe(0)
  expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
})

test('after twenty seconds of nothing the card offers a way through', () => {
  renderTour()
  act(() => startTour('desktop', 2))
  expect(screen.queryByRole('button', { name: 'Do it for me' })).toBeNull()
  act(() => vi.advanceTimersByTime(20_500))
  expect(screen.getByRole('button', { name: 'Do it for me' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Skip this step' })).toBeInTheDocument()
})

test('Do it for me does the real thing, so the next step arrives in the state it expects', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => vi.advanceTimersByTime(20_500))
  await user.click(screen.getByRole('button', { name: 'Do it for me' }))

  // A real task, at a real time, for a real length - not a pretend tick. The
  // next step names Walk, and the one after that needs it to be the running
  // task, both of which only hold if this actually added it.
  const added = getData().days[TODAY].tasks.at(-1)
  expect(added).toMatchObject({ title: 'Walk', minutes: 30 })
  expect(added?.time).toBeTruthy()
  act(() => vi.advanceTimersByTime(1300))
  expect(getTourState().step).toBe(3)
})

test('Skip this step moves on without doing anything to the plan', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => vi.advanceTimersByTime(20_500))
  await user.click(screen.getByRole('button', { name: 'Skip this step' }))
  expect(getTourState().step).toBe(3)
  expect(getData().days[TODAY]?.tasks ?? []).toHaveLength(0)
})

test('the two ends are never offered a way through - there is nothing to be stuck on', () => {
  renderTour()
  act(() => startTour('desktop', DESKTOP_STEPS.length - 1))
  act(() => vi.advanceTimersByTime(21_000))
  expect(screen.queryByRole('button', { name: 'Do it for me' })).toBeNull()
})

/**
 * The stamp step is the other one that names its own outcome: one click turns
 * an empty column into a whole day, which is the moment this app makes its
 * case, and it used to be a flicker on the way to the next spotlight.
 */
test('stamping names what landed on the screen and waits for Next', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderTour()
  act(() => startTour('desktop', 1))
  act(() => {
    const template = actions.addTemplate({ name: 'Working day', color: '#6c8cff', blocks: [] })
    actions.stamp({ [TODAY]: template.id })
  })
  act(() => vi.advanceTimersByTime(5000))
  expect(getTourState().step).toBe(1)
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Your whole day, from one click')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(getTourState().step).toBe(2)
})

/**
 * Found by walking the tour in a browser, where it locked the renderer solid
 * inside a second and the tab had to be killed.
 *
 * Measuring the target *writes*: it moves the hole, which is an inline style
 * on an element inside document.body, which is a mutation, which the observer
 * watching for layout changes hears, which measures again. Everything that
 * asks for a re-measure is coalesced into one per animation frame now, and
 * the overlay's own churn is ignored outright.
 */
test('the watcher that keeps the hole on its target does not feed itself', () => {
  let fire: MutationCallback | null = null
  let watched: Node | null = null
  class Recorder {
    constructor(fn: MutationCallback) {
      fire = fn
    }
    observe(node: Node) {
      watched = node
    }
    disconnect() {}
    takeRecords(): MutationRecord[] {
      return []
    }
  }
  vi.stubGlobal('MutationObserver', Recorder)
  // Returns a real-looking handle: the coalescing guard keeps the id it was
  // given and skips while it is truthy, so a stub returning undefined would
  // let every mutation through and hide the very thing being tested.
  let handle = 0
  const frames = vi.fn(() => ++handle)
  vi.stubGlobal('requestAnimationFrame', frames)

  renderTour()
  act(() => startTour('desktop', 1))
  expect(watched).toBe(document.body)

  const record = (target: Element) => [{ target, type: 'attributes' } as unknown as MutationRecord]
  // The overlay moving its own ring is not news about the target, and acting
  // on it is what fed the loop.
  const card = document.querySelector('.tour-card')!
  act(() => fire!(record(card), null as unknown as MutationObserver))
  expect(frames).not.toHaveBeenCalled()

  // Anything else on the page still gets a measure - one, on a frame, however
  // many mutations arrived.
  act(() => fire!(record(document.body), null as unknown as MutationObserver))
  act(() => fire!(record(document.body), null as unknown as MutationObserver))
  expect(frames).toHaveBeenCalledTimes(1)
  vi.unstubAllGlobals()
})
