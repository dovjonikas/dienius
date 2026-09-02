import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryView } from './LibraryView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { todayKey } from '../lib/dates'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function seed() {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter', unitShort: 'ch' })
  actions.addLibraryItem(list.id, 'Daring Greatly, 12 chapters')
  return list
}

// --- the empty state -----------------------------------------------------
//
// Nothing is created until somebody asks, the same rule Templates follows.

test('an empty library offers starters and has made none of them', () => {
  render(<LibraryView />)
  expect(screen.getByRole('button', { name: 'Start a Books list' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Start a Watching list' })).toBeInTheDocument()
  expect(getData().library).toEqual([])
})

test('tapping a starter creates that list, counted in its own unit', async () => {
  const user = userEvent.setup()
  render(<LibraryView />)
  await user.click(screen.getByRole('button', { name: 'Start a Books list' }))
  expect(getData().library[0]).toMatchObject({ name: 'Books', unit: 'chapter', unitShort: 'ch' })
  expect(screen.getByText(/counted in chapters/)).toBeInTheDocument()
})

test('a list of a kind nobody shipped can be built by hand', async () => {
  const user = userEvent.setup()
  render(<LibraryView />)
  await user.click(screen.getByRole('button', { name: 'Something else' }))
  await user.type(screen.getByLabelText('List name'), 'Courses')
  await user.type(screen.getByLabelText('One of them is a'), 'lesson')
  await user.type(screen.getByLabelText('Short form'), 'ls')
  await user.click(screen.getByRole('button', { name: 'Create list' }))
  expect(getData().library[0]).toMatchObject({ name: 'Courses', unit: 'lesson', unitShort: 'ls' })
})

test('a list with no name or no unit cannot be created', async () => {
  const user = userEvent.setup()
  render(<LibraryView />)
  await user.click(screen.getByRole('button', { name: 'Something else' }))
  await user.type(screen.getByLabelText('List name'), 'Courses')
  expect(screen.getByRole('button', { name: 'Create list' })).toBeDisabled()
})

// --- items ---------------------------------------------------------------

test('one typed line adds an item with its total', async () => {
  const user = userEvent.setup()
  seed()
  render(<LibraryView />)
  await user.type(screen.getByLabelText('Add to Books'), 'The Odyssey, 24 chapters{Enter}')
  expect(getData().library[0].items.map(i => [i.title, i.total])).toEqual([
    ['Daring Greatly', 12],
    ['The Odyssey', 24],
  ])
})

test('progress reads in the list own unit and corrects by hand in both directions', async () => {
  const user = userEvent.setup()
  seed()
  render(<LibraryView />)
  expect(screen.getByText('ch 0/12')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'One more chapter of Daring Greatly' }))
  await user.click(screen.getByRole('button', { name: 'One more chapter of Daring Greatly' }))
  expect(screen.getByText('ch 2/12')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'One fewer chapter of Daring Greatly' }))
  expect(screen.getByText('ch 1/12')).toBeInTheDocument()
})

test('an item at zero cannot be stepped below it', () => {
  seed()
  render(<LibraryView />)
  expect(screen.getByRole('button', { name: 'One fewer chapter of Daring Greatly' })).toBeDisabled()
})

// A list read forty books from should open on the four you have not.
test('finished work collapses behind one line and can be reopened', async () => {
  const user = userEvent.setup()
  const list = seed()
  actions.stepLibraryItem(list.id, getData().library[0].items[0].id, 12, todayKey())
  render(<LibraryView />)

  expect(screen.queryByText('Daring Greatly')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Finished (1)' }))
  expect(screen.getByText('Daring Greatly')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Reopen' }))
  expect(getData().library[0].items[0].finished).toBeUndefined()
})

// --- schedule ------------------------------------------------------------

test('an item goes onto today in two taps, and opens that day', async () => {
  const user = userEvent.setup()
  const onOpenDay = vi.fn()
  seed()
  render(<LibraryView onOpenDay={onOpenDay} />)

  await user.click(screen.getByRole('button', { name: 'Schedule Daring Greatly' }))
  await user.click(screen.getByRole('button', { name: 'Today' }))

  const task = getData().days[todayKey()].tasks[0]
  expect(task.title).toBe('Daring Greatly')
  expect(task.libraryRef).toBeTruthy()
  expect(onOpenDay).toHaveBeenCalledWith(todayKey())
})

test('scheduling the same item onto the same day again says so rather than doubling it', async () => {
  const user = userEvent.setup()
  const list = seed()
  actions.scheduleLibraryItem(todayKey(), list.id, getData().library[0].items[0].id)
  render(<LibraryView />)

  await user.click(screen.getByRole('button', { name: 'Schedule Daring Greatly' }))
  await user.click(screen.getByRole('button', { name: 'Today' }))

  expect(screen.getByText('Already on today')).toBeInTheDocument()
  expect(getData().days[todayKey()].tasks).toHaveLength(1)
})

// --- reorder -------------------------------------------------------------
//
// A drag-only list is one a keyboard cannot arrange at all, and the order
// here is what "next" means - see currentItem.

test('the arrow keys move an item a place at a time', async () => {
  const user = userEvent.setup()
  const list = seed()
  actions.addLibraryItem(list.id, 'The Odyssey, 24')
  render(<LibraryView />)

  const grip = screen.getByRole('button', { name: 'Reorder The Odyssey, position 2' })
  grip.focus()
  await user.keyboard('{ArrowUp}')

  expect(getData().library[0].items.map(i => i.title)).toEqual(['The Odyssey', 'Daring Greatly'])
})

test('the first item cannot be nudged off the top of the list', async () => {
  const user = userEvent.setup()
  seed()
  render(<LibraryView />)
  const grip = screen.getByRole('button', { name: 'Reorder Daring Greatly, position 1' })
  grip.focus()
  await user.keyboard('{ArrowUp}')
  expect(getData().library[0].items.map(i => i.title)).toEqual(['Daring Greatly'])
})

// --- list settings -------------------------------------------------------

test('a list unit can be renamed and every count follows it', async () => {
  const user = userEvent.setup()
  seed()
  render(<LibraryView />)
  await user.click(screen.getByRole('button', { name: 'Settings for Books' }))
  const unit = screen.getByLabelText('Unit')
  await user.clear(unit)
  await user.type(unit, 'part')
  expect(screen.getByText(/counted in parts/)).toBeInTheDocument()
})

test('deleting a list takes two taps, not one', async () => {
  const user = userEvent.setup()
  seed()
  render(<LibraryView />)
  await user.click(screen.getByRole('button', { name: 'Settings for Books' }))
  await user.click(screen.getByRole('button', { name: 'Delete list' }))
  expect(getData().library).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Delete, really' }))
  expect(getData().library).toHaveLength(0)
})
