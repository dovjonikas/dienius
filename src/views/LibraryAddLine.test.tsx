import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryAddLine } from './LibraryAddLine'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import type { LibraryList } from '../lib/types'

/**
 * The library's add line, built the way quick-add is: the words, and two
 * controls that already hold an answer. Every test here is one version of
 * the same rule - the words and the controls are one truth - or of the
 * memory that makes the second book cheaper than the first.
 */

let books: LibraryList

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  books = actions.addLibraryList({ name: 'Books', unit: 'chapter', unitShort: 'ch' })
})

function items() {
  return getData().library[0].items
}

test('a title and Enter adds an item counted in the list unit, with no total', async () => {
  const user = userEvent.setup()
  render(<LibraryAddLine list={books} />)
  await user.type(screen.getByLabelText('Add to Books'), 'The Odyssey{Enter}')
  expect(items()).toMatchObject([{ title: 'The Odyssey' }])
  expect(items()[0].total).toBeUndefined()
  expect(items()[0].track).toBeUndefined()
})

test('the count control is the total, and the arrows step it', async () => {
  const user = userEvent.setup()
  render(<LibraryAddLine list={books} />)
  await user.type(screen.getByLabelText('How many chapters'), '12')
  await user.tab()
  await user.click(screen.getByRole('button', { name: 'How many chapters up' }))
  await user.type(screen.getByLabelText('Add to Books'), 'Dune{Enter}')
  expect(items()).toMatchObject([{ title: 'Dune', total: 13 }])
})

test('a line that carries its own shape wins, and the controls redraw to show it', async () => {
  const user = userEvent.setup()
  render(<LibraryAddLine list={books} />)
  await user.type(screen.getByLabelText('Add to Books'), 'Dune, 412 pages')
  expect(screen.getByRole('button', { name: /Counted in pages/ })).toBeInTheDocument()
  expect(screen.getByLabelText('How many pages')).toHaveValue('412')
  await user.keyboard('{Enter}')
  expect(items()).toMatchObject([{ title: 'Dune', track: 'pages', total: 412 }])
})

test('a chip pressed against a line that carries a shape rewrites the words, so there is one truth', async () => {
  const user = userEvent.setup()
  render(<LibraryAddLine list={books} />)
  await user.type(screen.getByLabelText('Add to Books'), 'Past Lives, 20 chapters')
  await user.click(screen.getByRole('button', { name: /Counted in chapters/ }))
  await user.click(within(screen.getByRole('group', { name: 'How it is counted' })).getByRole('button', { name: 'a film' }))
  expect(screen.getByLabelText('Add to Books')).toHaveValue('Past Lives, movie')
  // A film has no count, so the count control is gone.
  expect(screen.queryByLabelText(/How many/)).toBeNull()
})

test('an arrow pressed against a counted line rewrites the number in the words', async () => {
  const user = userEvent.setup()
  render(<LibraryAddLine list={books} />)
  await user.type(screen.getByLabelText('Add to Books'), 'Dune, 20 chapters')
  await user.click(screen.getByRole('button', { name: 'How many chapters up' }))
  expect(screen.getByLabelText('Add to Books')).toHaveValue('Dune, 21 chapters')
})

test('a series asks for seasons and episodes, and the item starts on season one', async () => {
  const user = userEvent.setup()
  render(<LibraryAddLine list={books} />)
  await user.click(screen.getByRole('button', { name: /Counted in chapters/ }))
  await user.click(within(screen.getByRole('group', { name: 'How it is counted' })).getByRole('button', { name: 'seasons and episodes' }))
  await user.type(screen.getByLabelText('How many seasons'), '3')
  await user.tab()
  await user.type(screen.getByLabelText('Episodes in the season'), '10')
  await user.tab()
  await user.type(screen.getByLabelText('Add to Books'), 'The Bear{Enter}')
  expect(items()).toMatchObject([{ title: 'The Bear', track: 'series', seasons: 3, total: 10, season: 1 }])
})

test('the shape chosen last is remembered per list on this device, the count is not', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<LibraryAddLine list={books} />)
  await user.click(screen.getByRole('button', { name: /Counted in chapters/ }))
  await user.click(within(screen.getByRole('group', { name: 'How it is counted' })).getByRole('button', { name: 'pages' }))
  await user.type(screen.getByLabelText('How many pages'), '300')
  await user.tab()
  await user.type(screen.getByLabelText('Add to Books'), 'One{Enter}')
  unmount()

  render(<LibraryAddLine list={books} />)
  expect(screen.getByRole('button', { name: /Counted in pages/ })).toBeInTheDocument()
  expect(screen.getByLabelText('How many pages')).toHaveValue('')

  const watching = actions.addLibraryList({ name: 'Watching', unit: 'episode' })
  render(<LibraryAddLine list={watching} />)
  expect(screen.getByRole('button', { name: /Counted in episodes/ })).toBeInTheDocument()
})

test('a Watching list offers films and series first', async () => {
  const user = userEvent.setup()
  const watching = actions.addLibraryList({ name: 'Watching', unit: 'episode' })
  render(<LibraryAddLine list={watching} />)
  await user.click(screen.getByRole('button', { name: /Counted in episodes/ }))
  const chips = screen.getByRole('group', { name: 'How it is counted' })
  expect(chips.querySelectorAll('button')[0].textContent).toBe('a film')
  expect(chips.querySelectorAll('button')[1].textContent).toBe('seasons and episodes')
})
