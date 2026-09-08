import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskDetail } from './TaskDetail'
import { actions, getData, useAppData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { MAX_HIGHLIGHTS } from '../../lib/types'
import { clockTools, getClockTools } from '../../lib/clockTools'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function tasks() {
  return getData().days[DATE].tasks
}

/** Renders the sheet for the first task on the day, re-reading it each time. */
function openFirst(onClose = () => {}) {
  // Subscribed, so a write made through an action inside the sheet is on
  // screen the way it is in the app - the sheet reads the task out of the
  // store on every render rather than holding a copy.
  function Harness() {
    const data = useAppData()
    const day = data.days[DATE]
    // Gone the way it goes in the app: DayView stops drawing the sheet
    // the moment its task is no longer on the day.
    if (!day?.tasks[0]) return null
    return <TaskDetail task={day.tasks[0]} tasks={day.tasks} date={DATE} library={data.library} onClose={onClose} />
  }
  return render(<Harness />)
}

function seed(title = 'Deep work') {
  actions.addTask(DATE, title)
  return tasks()[0].id
}

// --- time ----------------------------------------------------------------

test('a time typed into the picker anchors the task', async () => {
  const user = userEvent.setup()
  seed()
  openFirst()
  await user.type(screen.getByLabelText('Task time'), '0930')
  await user.tab()
  expect(tasks()[0].time).toBe('09:30')
})

// The correction an actual day needs: it started a bit later than planned.
test('the nudges move an anchored task five minutes either way', async () => {
  const user = userEvent.setup()
  const id = seed()
  actions.setTaskTime(DATE, id, '09:00')
  const { rerender } = openFirst()

  await user.click(screen.getByRole('button', { name: '+5' }))
  expect(tasks()[0].time).toBe('09:05')

  rerender(<div />)
  openFirst()
  await user.click(screen.getAllByRole('button', { name: '−5' })[0])
  expect(tasks()[0].time).toBe('09:00')
})

test('the nudges are dead on a task with no time - there is nothing to nudge', () => {
  seed()
  openFirst()
  expect(screen.getByRole('button', { name: '+5' })).toBeDisabled()
})

// Remove, not Delete: the time is a part of the task coming off, not the task
// itself - and it is what the actions sheet has always called the same gesture.
test('a task with a time can have that time removed', async () => {
  const user = userEvent.setup()
  const id = seed()
  actions.setTaskTime(DATE, id, '09:00')
  openFirst()
  await user.click(screen.getByRole('button', { name: 'Remove time' }))
  expect(tasks()[0].time).toBeUndefined()
})

// --- title, size, note ---------------------------------------------------

test('the title is the heading and the field for it at once', async () => {
  const user = userEvent.setup()
  seed()
  openFirst()
  const title = screen.getByLabelText('Task title')
  await user.clear(title)
  await user.type(title, 'Write the report')
  await user.tab()
  expect(tasks()[0].title).toBe('Write the report')
})

test('a size typed in minutes is committed, and a note beside it', async () => {
  const user = userEvent.setup()
  seed()
  openFirst()
  await user.type(screen.getByLabelText('How long, in minutes'), '90')
  await user.tab()
  expect(tasks()[0].minutes).toBe(90)

  await user.type(screen.getByLabelText('Note'), 'the tricky bit is section 3')
  await user.tab()
  expect(tasks()[0].note).toBe('the tricky bit is section 3')
})

// --- key tasks -----------------------------------------------------------

test('the cap is stated on the control rather than discovered by being refused', async () => {
  const user = userEvent.setup()
  seed()
  openFirst()
  expect(screen.getByText(`0/${MAX_HIGHLIGHTS} used`)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Mark as key' }))
  expect(tasks()[0].highlight).toBe(true)
})

test('with the cap already spent, the control says so and cannot be pressed', () => {
  seed('First')
  actions.addTask(DATE, 'Second')
  actions.addTask(DATE, 'Third')
  actions.addTask(DATE, 'Fourth')
  tasks().slice(1).forEach(t => actions.toggleTaskHighlight(DATE, t.id))

  openFirst()
  expect(screen.getByRole('button', { name: 'Mark as key' })).toBeDisabled()
  expect(screen.getByText(/unmark another first/)).toBeInTheDocument()
})

// --- steps ---------------------------------------------------------------

test('steps are added, counted in the heading, and ticked off', async () => {
  const user = userEvent.setup()
  seed()
  openFirst()

  await user.type(screen.getByLabelText('Add a step'), 'Outline{Enter}')
  await user.type(screen.getByLabelText('Add a step'), 'Draft{Enter}')
  expect(screen.getByText('Steps 0/2')).toBeInTheDocument()

  await user.click(screen.getByRole('checkbox', { name: 'Outline' }))
  expect(tasks()[0].subtasks!.filter(s => s.done)).toHaveLength(1)
})

test('a step can be removed again', async () => {
  const user = userEvent.setup()
  const id = seed()
  actions.addSubtask(DATE, id, 'Outline')
  openFirst()
  await user.click(screen.getByRole('button', { name: 'Remove step Outline' }))
  expect(tasks()[0].subtasks).toHaveLength(0)
})

// --- repeat --------------------------------------------------------------

test('a repeat is chosen from four named shapes, not a recurrence rule', async () => {
  const user = userEvent.setup()
  seed()
  openFirst()
  // Four buttons, every answer on screen, rather than a dropdown.
  const group = screen.getByRole('group', { name: 'Repeats' })
  expect(within(group).getAllByRole('button').map(b => b.textContent)).toEqual([
    'Once',
    'Every day',
    'Weekdays',
    'Every week',
  ])
  await user.click(within(group).getByRole('button', { name: 'Weekdays' }))
  expect(tasks()[0].repeat).toBe('weekdays')
  expect(within(group).getByRole('button', { name: 'Weekdays' })).toHaveAttribute('aria-pressed', 'true')
})

// --- library binding -----------------------------------------------------

test('the library field is not offered at all while there is no library', () => {
  seed()
  openFirst()
  expect(screen.queryByLabelText('Library item')).not.toBeInTheDocument()
})

test('a task can be bound to an unfinished item, and shows how far through it is', async () => {
  const user = userEvent.setup()
  seed()
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter', unitShort: 'ch' })
  actions.addLibraryItem(list.id, 'Daring Greatly, 12')
  const itemId = getData().library[0].items[0].id
  actions.stepLibraryItem(list.id, itemId, 4, DATE)

  openFirst()
  await user.selectOptions(screen.getByLabelText('Library item'), `${list.id}:${itemId}`)
  expect(tasks()[0].libraryRef).toEqual({ listId: list.id, itemId })
  expect(screen.getByText(/ch 4\/12/)).toBeInTheDocument()
})

// --- closing -------------------------------------------------------------

test('Escape closes the sheet, and so does the scrim behind it', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  seed()
  openFirst(onClose)
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
})

test('the close button is a real, named control rather than only a gesture', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  seed()
  openFirst(onClose)
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalled()
})

// The six lengths a task usually is sit beside the number. A chip is one
// press where the box is arithmetic, and both write the same field.
test('a size can be a chip, and the chip in force is marked', async () => {
  const user = userEvent.setup()
  seed()
  openFirst()
  await user.click(within(screen.getByRole('group', { name: 'How long' })).getByRole('button', { name: '1h30' }))
  expect(tasks()[0].minutes).toBe(90)
  expect(within(screen.getByRole('group', { name: 'How long' })).getByRole('button', { name: '1h30' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('How long, in minutes')).toHaveValue('90')
})

// --- the footer: the way out, and the way to be rid of it ------------------
//
// Outside the scrolling body, so both are on screen whatever the sheet
// holds. The sheet saves as it goes, so Done is not Save: it is the button
// that says the person is finished here, which a sheet with no ending made
// people look for. Delete used to be a Remove section at the bottom of a
// body that scrolled, and only for a repeating task; a plain task's delete
// was two menus away.

test('Done closes the sheet, and everything typed is already kept', async () => {
  const user = userEvent.setup()
  seed()
  const onClose = vi.fn()
  openFirst(onClose)
  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(onClose).toHaveBeenCalled()
})

test("a plain task can be deleted from its own sheet, through the day's own undo-carrying delete", async () => {
  const user = userEvent.setup()
  const id = seed()
  const onDelete = vi.fn()
  function Harness() {
    const data = useAppData()
    const day = data.days[DATE]
    return (
      <TaskDetail task={day.tasks[0]} tasks={day.tasks} date={DATE} library={data.library} onClose={() => {}} onDelete={onDelete} />
    )
  }
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Delete' }))
  expect(onDelete).toHaveBeenCalledWith(id)
})

test("a repeating task's delete says which days it leaves, and the sheet closes after it", async () => {
  const user = userEvent.setup()
  const id = seed('Standup')
  actions.setTaskRepeat(DATE, id, 'weekdays', 'series')
  const onClose = vi.fn()
  openFirst(onClose)
  expect(screen.getByRole('button', { name: 'Delete from every day' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Just this day' }))
  await user.click(screen.getByRole('button', { name: 'Delete from this day' }))
  expect(onClose).toHaveBeenCalled()
})

// The stepper said "120" and a hint beside it said "2h", and the owner read
// the same size twice. The unit is in the stepper now, once; the chips
// beside it are the six lengths, which is a different thing.
test('the size is stated once: a number with its unit, and the chips', () => {
  const id = seed()
  actions.setTaskMinutes(DATE, id, 120)
  openFirst()
  expect(screen.getByLabelText('How long, in minutes')).toHaveValue('120')
  expect(screen.queryByText('2h', { selector: '.task-detail-hint' })).toBeNull()
  expect(screen.getByText('min', { selector: '.time-stepper-unit' })).toBeInTheDocument()
})

// --- a step with a length, and its timer ---------------------------------
//
// The 07:30 ritual - water, ten minutes of meditation, gratitude, a page of
// Pressfield - is one block with steps, and a step that takes a while has a
// timer on it: one tap starts the existing timer for that long, and the
// step is ticked when it rings out.

test('a step with a length carries a timer, and a tap starts it for that long, for that step', async () => {
  const user = userEvent.setup()
  clockTools.resetForTests()
  const id = seed('Morning ritual')
  actions.addSubtask(DATE, id, 'Water')
  actions.addSubtask(DATE, id, 'Meditation 10 min')
  openFirst()

  expect(screen.queryByRole('button', { name: /timer for Water/ })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Start a 10 min timer for Meditation' }))

  const timer = getClockTools().timer
  expect(timer?.durationMs).toBe(10 * 60_000)
  const sub = getData().days[DATE].tasks[0].subtasks!.find(s => s.title === 'Meditation')!
  expect(timer?.step).toEqual({ date: DATE, taskId: id, subtaskId: sub.id })
})
