import { beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
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

/**
 * The four tests below were rewritten with Library v2. Their controls did not
 * disappear - they moved into the panel a row opens, which is the whole point
 * of that version: thirteen books with four buttons each is a screen nobody
 * can read. What each one promises is unchanged, so each now opens the row
 * first and then asserts exactly what it asserted before.
 */
async function openDetail(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${title},`) }))
}

test('progress reads in the list own unit and corrects by hand in both directions', async () => {
  const user = userEvent.setup()
  seed()
  render(<LibraryView />)
  expect(screen.getByText('ch 0/12')).toBeInTheDocument()

  await openDetail(user, 'Daring Greatly')
  await user.click(screen.getByRole('button', { name: 'One more chapter of Daring Greatly' }))
  await user.click(screen.getByRole('button', { name: 'One more chapter of Daring Greatly' }))
  expect(screen.getAllByText('ch 2/12').length).toBeGreaterThan(0)

  await user.click(screen.getByRole('button', { name: 'One fewer chapter of Daring Greatly' }))
  expect(screen.getAllByText('ch 1/12').length).toBeGreaterThan(0)
})

test('an item at zero cannot be stepped below it', async () => {
  const user = userEvent.setup()
  seed()
  render(<LibraryView />)
  await openDetail(user, 'Daring Greatly')
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

  await openDetail(user, 'Daring Greatly')
  await user.click(screen.getByRole('button', { name: 'Onto today' }))

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

  await openDetail(user, 'Daring Greatly')
  await user.click(screen.getByRole('button', { name: 'Onto today' }))

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

// --- Library v2: one loud thing per list, everything else quiet ------------
//
// The version before this drew every item the same size with four buttons on
// each, which is fine for a list of three and unreadable for the thirteen
// this shelf actually holds.

test('the item you are on gets a card with its pace note; the rest get a line', async () => {
  const user = userEvent.setup()
  const list = seed()
  const first = getData().library[0].items[0].id
  actions.updateLibraryItem(list.id, first, { pace: 'one chapter a day' })
  actions.addLibraryItem(list.id, 'Sapiens, 20')
  const { container } = render(<LibraryView />)

  const rows = container.querySelectorAll('.library-item')
  expect(rows[0].className).toContain('is-active')
  expect(rows[1].className).not.toContain('is-active')
  // The note is on the card and nowhere else - on a quiet row it would be a
  // second line of prose on every line of a list of thirteen.
  expect(screen.getByText('one chapter a day')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /^Sapiens,/ }))
  expect(container.querySelectorAll('.library-detail')).toHaveLength(1)
})

test('a list folds away and stays folded', async () => {
  const user = userEvent.setup()
  seed()
  const { unmount } = render(<LibraryView />)
  expect(screen.getByText('Daring Greatly')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Books 1 going/ }))
  expect(screen.queryByText('Daring Greatly')).not.toBeInTheDocument()

  // A fresh mount, as after a reload. Folding is what is worth remembering;
  // a list nobody folded opens open.
  unmount()
  render(<LibraryView />)
  expect(screen.queryByText('Daring Greatly')).not.toBeInTheDocument()
})

test('the chip row appears once there are enough lists to get lost among, and opens one', async () => {
  const user = userEvent.setup()
  seed()
  render(<LibraryView />)
  expect(screen.queryByRole('navigation', { name: 'Jump to a list' })).not.toBeInTheDocument()
  cleanup()

  actions.addLibraryList({ name: 'Watching', unit: 'episode' })
  render(<LibraryView />)
  const chips = screen.getByRole('navigation', { name: 'Jump to a list' })
  expect(within(chips).getByRole('button', { name: /Books/ })).toHaveTextContent('1 going')

  // Folded, then opened by its chip.
  await user.click(screen.getAllByRole('button', { name: /Books 1 going, counted in chapters/ })[0])
  expect(screen.queryByText('Daring Greatly')).not.toBeInTheDocument()
  await user.click(within(chips).getByRole('button', { name: /Books/ }))
  expect(screen.getByText('Daring Greatly')).toBeInTheDocument()
})

test('a page-counted book is typed to, not stepped', async () => {
  const user = userEvent.setup()
  const list = seed()
  const item = actions.addLibraryItem(list.id, 'The War of Art, 139 pages')!
  actions.deleteLibraryItem(list.id, getData().library[0].items[0].id)
  render(<LibraryView />)

  await user.click(screen.getByRole('button', { name: /^The War of Art,/ }))
  // No + and - at all: nobody presses + fifty-four times.
  expect(screen.queryByRole('button', { name: /One more/ })).not.toBeInTheDocument()

  const field = screen.getByRole('textbox', { name: 'Page you are on in The War of Art' })
  await user.clear(field)
  await user.type(field, '68')
  await user.tab()
  expect(getData().library[0].items.find(i => i.id === item.id)?.progress).toBe(68)
  expect(screen.getAllByText('p. 68/139').length).toBeGreaterThan(0)
})

test('a film is watched or not, with nothing to count', async () => {
  const user = userEvent.setup()
  const list = actions.addLibraryList({ name: 'Watching', unit: 'episode' })
  actions.addLibraryItem(list.id, 'Interstellar, movie')
  render(<LibraryView />)

  expect(screen.getAllByText('not yet').length).toBeGreaterThan(0)
  await user.click(screen.getByRole('button', { name: /^Interstellar,/ }))
  expect(screen.queryByRole('button', { name: /One more/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Watched it' }))
  expect(getData().library[0].items[0].finished).toBeTruthy()
})

test('a series offers the next season at the end of one, and never before', async () => {
  const user = userEvent.setup()
  const list = actions.addLibraryList({ name: 'Watching', unit: 'episode' })
  const item = actions.addLibraryItem(list.id, 'Invincible, 3 seasons')!
  actions.updateLibraryItem(list.id, item.id, { total: 8 })
  render(<LibraryView />)

  await user.click(screen.getByRole('button', { name: /^Invincible,/ }))
  expect(screen.queryByRole('button', { name: /Start season/ })).not.toBeInTheDocument()

  act(() => actions.setLibraryItemProgress(list.id, item.id, 8, todayKey()))
  expect(await screen.findByRole('button', { name: 'Start season 2' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Start season 2' }))
  expect(getData().library[0].items[0]).toMatchObject({ season: 2, progress: 0 })
})

test('a new list can be one tap from a preset', async () => {
  const user = userEvent.setup()
  seed()
  render(<LibraryView />)
  await user.click(screen.getByRole('button', { name: 'New list' }))
  await user.click(screen.getByRole('button', { name: /Guitar/ }))
  expect(getData().library.map(l => l.name)).toEqual(['Books', 'Guitar'])
  expect(getData().library[1].unit).toBe('song')
})

test('add to template builds the block and binds it, and refuses a second for the same list', async () => {
  const user = userEvent.setup()
  const list = seed()
  const template = actions.addTemplate({ name: 'Weekday', color: '#6c8cff', blocks: [] })
  render(<LibraryView />)

  await user.click(screen.getByRole('button', { name: /^Daring Greatly,/ }))
  await user.click(screen.getByRole('button', { name: 'Add to template' }))
  await user.type(screen.getByRole('textbox', { name: 'At' }), '21:00')
  await user.click(screen.getByRole('button', { name: 'Add block' }))

  expect(getData().templates[0].blocks).toMatchObject([
    { title: 'Books session', time: '21:00', minutes: 30, libraryListId: list.id },
  ])

  // A second one for the same list is offered as a change, never added.
  await user.click(screen.getByRole('button', { name: 'Add to template' }))
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  expect(screen.getByText(/already has a Books block/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Change that one' }))
  expect(getData().templates.find(t => t.id === template.id)!.blocks).toHaveLength(1)
})
