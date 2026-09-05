import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { shadesAround, Tour } from './Tour'
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
      <input data-quick-add="" aria-label="Add a task" />
      <button type="button" data-tour="library-new" />
      {data.library.length > 0 && <input data-tour="library-add" aria-label="Add to Books" />}
      <button type="button" data-tour="goal-add" />
      {data.goals.length > 0 && <div data-tour="north-line">{data.goals[0].title}</div>}
      {ids.map(id => (
        <div key={id} data-task-id={id}>
          <button type="button" data-tour="task-menu" />
          <button type="button" data-tour="focus" />
          <span data-tour="task-check" />
          <input type="checkbox" aria-label={`Task ${id}`} onChange={() => actions.toggleTask(TODAY, id)} />
        </div>
      ))}
    </div>
  )
}

/** A sheet the last step led into, of the kind the engine has to see past. */
function OpenSheet({ children }: { children?: ReactNode }) {
  return (
    <div role="dialog" data-tour-modal="">
      <button type="button" aria-label="Close details" data-tour-modal-close="" />
      {children}
    </div>
  )
}

/**
 * jsdom lays nothing out, so `offsetParent` - which the engine reads to tell
 * a control that is in the document from one that is drawn - is null on
 * everything. Every stand-in is treated as laid out; the one that must not
 * be is hidden with the attribute the engine understands.
 */
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return (this as HTMLElement).hidden ? null : document.body
    },
  })
})

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

/**
 * Rewritten in the walk-through wave. The step used to move on 1.2 seconds
 * after the tick with nothing said, which the owner watched read as the
 * tour skipping by itself: the thing happened on the other side of the
 * page and the card had already changed subject. Every step now names what
 * happened, holds the line long enough to read it, and offers Next to
 * anybody faster than that.
 */
test('a step ends when its action happens in the store, shows a tick and says what happened, then moves on', () => {
  renderTour()
  act(() => startTour('desktop', 2)) // "Add your own"
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Add your own')

  act(() => actions.addTask(TODAY, 'Lunch', '12:00'))
  const card = screen.getByRole('dialog', { name: 'Tour' })
  expect(card.querySelector('.tour-tick.is-on')).not.toBeNull()
  expect(card).toHaveTextContent('Walk is on the day')
  expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  expect(getTourState().step).toBe(2)

  // Still there after the old delay - a line takes longer to read than a tick takes to see.
  act(() => vi.advanceTimersByTime(1300))
  expect(getTourState().step).toBe(2)
  act(() => vi.advanceTimersByTime(2200))
  expect(getTourState().step).toBe(3)
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Make it key')
})

test('Next during a caption moves on at once', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => actions.addTask(TODAY, 'Lunch', '12:00'))
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(getTourState().step).toBe(3)
})

// A task added before the step began must not end it - the snapshot the
// predicate compares against is taken when the step starts, not when the
// tour does.
test('what was there before a step began does not count toward it', () => {
  actions.addTask(TODAY, 'Earlier')
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => vi.advanceTimersByTime(3500))
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
  // While the caption is up the one button is Next; Skip is back on the
  // step after.
  await user.click(screen.getByRole('button', { name: 'Next' }))
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
  const card = screen.getByRole('dialog', { name: 'Tour' })
  expect(card).toHaveTextContent('Type Walk in the box')
  expect(card).toHaveTextContent('The time is already picked')
})

// --- the three guards against a step that never ends -------------------------
//
// Every step here waits for a real action, which is what makes it a tour of
// the app rather than a slideshow about it, and is also the one way it can
// trap somebody. A control moved behind a menu, a viewport where the thing is
// off screen, a predicate watching for a write the feature stopped making:
// each leaves a person pressing at a spotlight that never clears. Nobody works
// out that the tour is broken. They close the app.

/**
 * Rewritten in the walk-through wave. The step used to move on by itself
 * twelve seconds after admitting its target was missing, with a line in
 * the console - and to the person it was the tour skipping a step at
 * random, because nobody reads the console. It says so on the card now,
 * offers the way through, and stays until somebody takes it.
 */
test('a step whose target never appears says so, offers the way through, and never moves on by itself', () => {
  renderTourWithNoTargets()
  act(() => startTour('desktop', 3))
  expect(getTourState().step).toBe(3)

  act(() => vi.advanceTimersByTime(3000))
  expect(getTourState().step).toBe(3)
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('not on this screen')
  expect(screen.getByRole('button', { name: 'Do it for me' })).toBeInTheDocument()

  act(() => vi.advanceTimersByTime(30_000))
  expect(getTourState().step).toBe(3)
})

// Found at eleven at night: the Focus step points at a button that only
// exists on the running card, and past bedtime there is no running card.
// The card explains that rather than showing the generic line.
test('the focus step explains why there is no Focus button when nothing is running', () => {
  renderTourWithNoTargets()
  act(() => startTour('desktop', 4))
  act(() => vi.advanceTimersByTime(3000))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Nothing is running this minute')
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
  act(() => vi.advanceTimersByTime(3500))
  expect(getTourState().step).toBe(3)
})

/**
 * Ticking off is the one step where the real control is worth going through:
 * the checkbox is what plays the row's finishing animation and folds it into
 * Done, and the caption says that is what happened. So "do it for me" clicks
 * the box when it is on the page, and only falls back to the store action
 * when it is not.
 */
test('Do it for me on the tick-off step clicks the real checkbox', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => actions.addTask(TODAY, 'Walk', '12:00'))
  const id = getData().days[TODAY].tasks[0].id
  act(() => startTour('desktop', 5))
  act(() => vi.advanceTimersByTime(20_500))
  await user.click(screen.getByRole('button', { name: 'Do it for me' }))
  expect(screen.getByRole('checkbox', { name: `Task ${id}` })).toBeChecked()
  expect(getData().days[TODAY].tasks[0].done).toBe(true)
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Walk moved into Done')
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

// --- the three standing rules about the target -------------------------------
//
// Each one is the fix for something the owner watched go wrong on a walk
// through: a ring around a button nobody could see, a card saying "type
// Walk" to somebody who had typed it and was waiting, and an instruction to
// click a checkbox that a detail panel was covering.

test('the thing being pointed at carries the class that makes it visible, and loses it when the step moves on', () => {
  renderTour()
  act(() => startTour('desktop', 1))
  act(() => vi.advanceTimersByTime(250))
  const starter = document.querySelector('[data-tour="starter-working-day"]')!
  expect(starter.classList.contains('is-tour-target')).toBe(true)

  act(() => startTour('desktop', 2))
  act(() => vi.advanceTimersByTime(250))
  expect(starter.classList.contains('is-tour-target')).toBe(false)
  expect(document.querySelector('[data-quick-add]')!.classList.contains('is-tour-target')).toBe(true)
})

test('a box changes its line to "press Enter" the moment something is typed in it', async () => {
  // The keystroke is heard through an input listener that asks for a
  // measure on the next frame. jsdom's frames run on real time, which the
  // fake clock does not advance, so a frame here is a zero-length fake
  // timer - the point is that the line changes on the keystroke and not on
  // the next poll. Not synchronous: the coalescing guard keeps the handle
  // it is given, and a callback that ran before the handle was stored
  // would leave the guard shut for good.
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    setTimeout(() => fn(0), 0)
    return 1
  })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => vi.advanceTimersByTime(250))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Type Walk in the box')

  await user.type(screen.getByRole('textbox', { name: 'Add a task' }), 'W')
  act(() => vi.advanceTimersByTime(50))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Now press Enter.')

  await user.clear(screen.getByRole('textbox', { name: 'Add a task' }))
  act(() => vi.advanceTimersByTime(50))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Type Walk in the box')
  vi.unstubAllGlobals()
})

test('a later target brings its own line with it', () => {
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => actions.addTask(TODAY, 'Walk', '12:00'))
  act(() => startTour('desktop', 3)) // "Make it key": the dots, then Details, then Key
  act(() => vi.advanceTimersByTime(250))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Click the dots on the Walk card')

  // The menu opens: its Details row is now the last target present, and the
  // line follows the person into it.
  const menu = document.createElement('div')
  menu.innerHTML = '<button type="button" data-tour="task-details">Details</button>'
  act(() => {
    document.body.appendChild(menu)
    vi.advanceTimersByTime(250)
  })
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Click Details.')
  expect(menu.firstElementChild!.classList.contains('is-tour-target')).toBe(true)
  menu.remove()
})

test('a sheet left open over the step gets its close button pointed at, and the card says so', () => {
  const onNavigate = vi.fn()
  const { rerender } = render(
    <>
      <TourTargets />
      <OpenSheet />
      <Tour onNavigate={onNavigate} />
    </>,
  )
  act(() => startTour('desktop', 2))
  act(() => vi.advanceTimersByTime(250))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Close this panel first.')
  expect(screen.getByRole('button', { name: 'Close details' }).classList.contains('is-tour-target')).toBe(true)

  // A sheet that holds the step's own control is not in the way - the key
  // step walks into one on purpose.
  act(() => actions.addTask(TODAY, 'Walk', '12:00'))
  rerender(
    <>
      <TourTargets />
      <OpenSheet>
        <button type="button" data-tour="key">Mark as key</button>
      </OpenSheet>
      <Tour onNavigate={onNavigate} />
    </>,
  )
  act(() => startTour('desktop', 3))
  act(() => vi.advanceTimersByTime(250))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Click Mark as key.')
  expect(screen.getByRole('button', { name: 'Mark as key' }).classList.contains('is-tour-target')).toBe(true)
})

/**
 * The goal is written in Settings and lives under the day's title. The
 * caption takes the person there and points at the line, because "it never
 * shows progress" said over a form is a claim, and said over the line it
 * turned into is a fact they can see.
 */
test('writing a goal ends the north step, and the caption moves to the day and points at the North line', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { onNavigate } = renderTour()
  act(() => startTour('desktop', 7))
  expect(onNavigate).toHaveBeenLastCalledWith('settings')
  act(() => actions.addGoal({ title: 'Be someone who finishes things' }, TODAY))
  act(() => vi.advanceTimersByTime(250))
  expect(onNavigate).toHaveBeenLastCalledWith('day')
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('It sits under the day now')
  expect(document.querySelector('[data-tour="north-line"]')!.classList.contains('is-tour-target')).toBe(true)
  act(() => vi.advanceTimersByTime(10_000))
  expect(getTourState().step).toBe(7)
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(getTourState().step).toBe(8)
})

/**
 * Found on the first full walk after the captions were added: the moment
 * the library step ended, the shell went to the day view instead of
 * Settings, and the goal step sat on the wrong tab saying its control was
 * not on the screen. For one render after a step advances the tick state
 * is still the last step's and the step is already the next one, and the
 * next one's relocation fired on the stale tick.
 */
test('a caption that relocates belongs to its own step, and never fires as the step before it ends', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { onNavigate } = renderTour()
  act(() => startTour('desktop', 6))
  let list!: ReturnType<typeof actions.addLibraryList>
  act(() => {
    list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  })
  act(() => actions.addLibraryItem(list.id, 'Dune, 20 chapters'))
  await user.click(screen.getByRole('button', { name: 'Next' }))
  act(() => vi.advanceTimersByTime(250))
  expect(getTourState().step).toBe(7)
  expect(onNavigate).toHaveBeenLastCalledWith('settings')
})

/**
 * Seen on the light-theme walk: the ticked row folded into Done, the
 * checkbox it pointed at was no longer drawn, and the ring stayed where the
 * row had been - around the card that moved up into the gap - for the whole
 * caption. A target that goes away after the step has ended is not missing;
 * the ring goes with it and the caption stands on its own.
 */
test('when the ticked row folds away the ring goes with it, and the caption stands alone', () => {
  renderTour()
  act(() => startTour('desktop', 2))
  act(() => actions.addTask(TODAY, 'Walk', '12:00'))
  const id = getData().days[TODAY].tasks[0].id
  act(() => startTour('desktop', 5))
  act(() => vi.advanceTimersByTime(250))
  const box = document.querySelector(`[data-task-id="${id}"] [data-tour="task-check"]`) as HTMLElement
  expect(box.classList.contains('is-tour-target')).toBe(true)
  expect(document.querySelector('.tour-ring')).not.toBeNull()

  act(() => actions.toggleTask(TODAY, id))
  // Folded away: still in the document, no longer laid out.
  box.hidden = true
  act(() => vi.advanceTimersByTime(250))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Walk moved into Done')
  expect(document.querySelector('.tour-ring')).toBeNull()
  expect(box.classList.contains('is-tour-target')).toBe(false)
  expect(screen.queryByRole('button', { name: 'Do it for me' })).toBeNull()
})

/**
 * The library step ends on a book, not on a list. Starting a list used to
 * end it, before the person had seen the field - the tick landed on an
 * empty heading and the card moved on.
 */
test('the library step waits for something in the list, and points at the field once the list exists', () => {
  renderTour()
  act(() => startTour('desktop', 6))
  act(() => vi.advanceTimersByTime(250))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Click New list')

  let list!: ReturnType<typeof actions.addLibraryList>
  act(() => {
    list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  })
  act(() => vi.advanceTimersByTime(250))
  expect(getTourState().step).toBe(6)
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('Type: Dune, 20 chapters')
  expect(screen.getByRole('textbox', { name: 'Add to Books' }).classList.contains('is-tour-target')).toBe(true)

  act(() => actions.addLibraryItem(list.id, 'Dune, 20 chapters'))
  expect(screen.getByRole('dialog', { name: 'Tour' })).toHaveTextContent('A session can now land on any day')
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

// --- the scrim ---------------------------------------------------------------

/**
 * The scrim is four solid rectangles around the hole rather than one
 * full-window path with a hole in it, because a path was re-rasterised
 * across the whole window on every move. What has to hold is that the four
 * cover everything but the hole, exactly, with no seam and no overlap.
 */
test('the four shades tile the window around the hole and leave the hole itself clear', () => {
  const shades = shadesAround({ x: 100, y: 50, w: 200, h: 40 }, 1000, 600)
  expect(shades).toEqual([
    { x: 0, y: 0, w: 1000, h: 50 },
    { x: 0, y: 90, w: 1000, h: 510 },
    { x: 0, y: 50, w: 100, h: 40 },
    { x: 300, y: 50, w: 700, h: 40 },
  ])
  const area = shades.reduce((sum, s) => sum + s.w * s.h, 0)
  expect(area).toBe(1000 * 600 - 200 * 40)
})

test('with no hole yet the whole window is one shade', () => {
  expect(shadesAround(null, 800, 500)).toEqual([{ x: 0, y: 0, w: 800, h: 500 }])
})

test('a hole partly off the window is clipped to it rather than producing a negative shade', () => {
  const shades = shadesAround({ x: -20, y: 580, w: 100, h: 60 }, 800, 600)
  for (const s of shades) {
    expect(s.w).toBeGreaterThanOrEqual(0)
    expect(s.h).toBeGreaterThanOrEqual(0)
  }
  const area = shades.reduce((sum, s) => sum + s.w * s.h, 0)
  expect(area).toBe(800 * 600 - 80 * 20)
})
