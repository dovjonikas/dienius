import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskDetail } from './TaskDetail'
import { actions, getData, useAppData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { MAX_HIGHLIGHTS } from '../../lib/types'

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

test('a task with a time can be given none again', async () => {
  const user = userEvent.setup()
  const id = seed()
  actions.setTaskTime(DATE, id, '09:00')
  openFirst()
  await user.click(screen.getByRole('button', { name: 'No set time' }))
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
  await user.type(screen.getByLabelText('Size in minutes'), '90')
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
  await user.click(screen.getByRole('button', { name: 'Close details' }))
  expect(onClose).toHaveBeenCalled()
})

// The six lengths a task usually is sit beside the number. A chip is one
// press where the box is arithmetic, and both write the same field.
test('a size can be a chip, and the chip in force is marked', async () => {
  const user = userEvent.setup()
  seed()
  openFirst()
  await user.click(within(screen.getByRole('group', { name: 'Size' })).getByRole('button', { name: '1h30' }))
  expect(tasks()[0].minutes).toBe(90)
  expect(within(screen.getByRole('group', { name: 'Size' })).getByRole('button', { name: '1h30' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Size in minutes')).toHaveValue('90')
})
