import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryView } from './LibraryView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { getUndo } from '../lib/undo'

/**
 * A whole shelf pasted at once - the owner's brief of 2026-09-22, part 4: the
 * page under Paste many, what it says each row will do, and one Save. Every
 * title and name here is invented.
 */

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  actions.addLibraryItemsMany(getData().library[0].id, [{ title: 'A long walk' }])
})

async function open(user: ReturnType<typeof userEvent.setup>) {
  render(<LibraryView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Paste many' }))
  return screen.getByRole('textbox', { name: 'Books' })
}

test('the rows say the list, the author and whether each is new or writes over one, and Save writes them in order', async () => {
  const user = userEvent.setup()
  const field = await open(user)
  await user.click(field)
  await user.paste(['A long walk - A Walker', 'A new one - A Name', 'SIDE', 'A short one - Another Name'].join('\n'))

  const rows = within(screen.getByRole('list', { name: 'What Save will do' })).getAllByRole('listitem')
  expect(rows.map(r => r.textContent)).toEqual([
    'A long walkUpdates the one in the listA WalkerBooks',
    'A new oneNewA NameBooks',
    'A short oneNewAnother NameSide',
  ])
  expect(screen.getByText('2 new, 1 updated')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Save' }))
  const [books, side] = getData().library
  expect(books.items.map(i => [i.title, i.author])).toEqual([
    ['A long walk', 'A Walker'],
    ['A new one', 'A Name'],
  ])
  expect(side.name).toBe('Side')
  expect(side.items.map(i => i.title)).toEqual(['A short one'])
  expect(getUndo()?.label).toBe('Library saved: 1 list made, 2 added, 1 updated')
  // Back on the lists.
  expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeInTheDocument()
})

test('a row left out with its box is not saved, and Cancel saves nothing', async () => {
  const user = userEvent.setup()
  const field = await open(user)
  await user.click(field)
  await user.paste(['A new one - A Name', 'Another new one'].join('\n'))
  await user.click(screen.getByRole('checkbox', { name: 'Save Another new one' }))
  expect(screen.getByText('1 new')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().library[0].items.map(i => i.title)).toEqual(['A long walk', 'A new one'])

  await user.click(screen.getByRole('button', { name: 'Paste many' }))
  await user.click(screen.getByRole('textbox', { name: 'Books' }))
  await user.paste('Something else')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(getData().library[0].items).toHaveLength(2)
})

test('with no list yet, Paste many is on the page and the shelf makes its lists', async () => {
  const user = userEvent.setup()
  actions.resetForTests(defaultData())
  render(<LibraryView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Paste many' }))
  await user.click(screen.getByRole('textbox', { name: 'Books' }))
  await user.paste(['MAIN', 'A long walk - A Walker', 'SIDE', 'A short one'].join('\n'))
  expect(screen.getByText('2 new')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().library.map(l => [l.name, l.items.map(i => i.title)])).toEqual([
    ['Main', ['A long walk']],
    ['Side', ['A short one']],
  ])
  expect(getUndo()?.label).toBe('Library saved: 2 lists made, 2 added')
})

test('the author shows on the row, and can be changed in the item\'s own fields', async () => {
  const user = userEvent.setup()
  const list = getData().library[0]
  actions.updateLibraryItem(list.id, list.items[0].id, { author: 'A Walker' })
  render(<LibraryView onOpenDay={() => {}} />)
  expect(screen.getByText('A Walker')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /^A long walk/ }))
  const author = screen.getByRole('textbox', { name: 'Author' })
  await user.clear(author)
  await user.type(author, 'Another Walker')
  await user.tab()
  expect(getData().library[0].items[0].author).toBe('Another Walker')
})
