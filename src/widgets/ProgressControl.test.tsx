import { beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgressChip, ProgressControl } from './ProgressControl'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { todayKey } from '../lib/dates'

/**
 * Where a number is put in, in both the places it is wanted.
 *
 * The number used to be a sentence everywhere except one field in the
 * library, so recording a page meant a screen and a scroll away from the task
 * that made you want to. And in every track but one the only way in was a
 * plus button - on a list counted in pages, in a book of 264.
 */

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  cleanup()
})

function book(track?: 'pages') {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter', unitShort: 'ch' })
  actions.addLibraryItem(list.id, 'Daring Greatly, 12 chapters')
  const item = getData().library[0].items[0]
  if (track) actions.updateLibraryItem(list.id, item.id, { track })
  actions.stepLibraryItem(list.id, item.id, 4, todayKey())
  const fresh = getData().library[0]
  return { list: fresh, item: fresh.items[0] }
}

const progress = () => getData().library[0].items[0].progress

test('the number is typed, in a track that also steps one at a time', async () => {
  // The reported case. A plus and a minus are right for a chapter and absurd
  // for page two hundred and thirteen, and the two are the same control.
  const user = userEvent.setup()
  const { list, item } = book()
  render(<ProgressControl list={list} item={item} />)

  expect(screen.getByRole('button', { name: /One more chapter/ })).toBeInTheDocument()
  const field = screen.getByLabelText('How far through Daring Greatly')
  await user.clear(field)
  await user.type(field, '9')
  await user.tab()
  expect(progress()).toBe(9)
})

test('what it is counted out of is said beside the box, not inside it', () => {
  const { list, item } = book()
  render(<ProgressControl list={list} item={item} />)
  expect(screen.getByText(/of 12 chapters/)).toBeInTheDocument()
  expect(screen.getByLabelText('How far through Daring Greatly')).toHaveValue('4')
})

test('the word comes from the track rather than from the list it sits in', () => {
  // A list counted in chapters can hold a book tracked by page number, and
  // "of 12 chapters" on a 12-page track is the list answering a question
  // about the item.
  const { list, item } = book('pages')
  render(<ProgressControl list={list} item={item} />)
  expect(screen.getByText(/of 12 pages/)).toBeInTheDocument()
})

test('nonsense typed into it leaves the number where it was', async () => {
  const user = userEvent.setup()
  const { list, item } = book()
  render(<ProgressControl list={list} item={item} />)
  const field = screen.getByLabelText('How far through Daring Greatly')
  await user.clear(field)
  await user.type(field, 'soon')
  await user.tab()
  expect(progress()).toBe(4)
  expect(field).toHaveValue('4')
})

// --- the mark on the day's own card -------------------------------------

test('the mark on a card is a press, and opens where it stands', async () => {
  const user = userEvent.setup()
  const { list, item } = book()
  render(<ProgressChip list={list} item={item} />)

  await user.click(screen.getByRole('button', { name: /Press to change it/ }))
  const field = screen.getByLabelText('How far through Daring Greatly')
  // Cleared first, because a click here puts a caret in rather than keeping
  // the selection the box opens with. In a browser it opens with the number
  // selected and typing replaces it, which is the point of it being fast;
  // what this holds is that what is typed is what is stored.
  await user.clear(field)
  await user.type(field, '9{Enter}')
  expect(progress()).toBe(9)
})

test('escape leaves the number exactly as it was', async () => {
  const user = userEvent.setup()
  const { list, item } = book()
  render(<ProgressChip list={list} item={item} />)

  await user.click(screen.getByRole('button', { name: /Press to change it/ }))
  const field = screen.getByLabelText('How far through Daring Greatly')
  await user.clear(field)
  await user.type(field, '9{Escape}')
  expect(progress()).toBe(4)
  expect(screen.getByRole('button', { name: /Press to change it/ })).toBeInTheDocument()
})

test('the press does not reach the card underneath', async () => {
  // A card already means something when it is pressed, and this means the
  // other thing - the same rule LinkOut follows.
  const user = userEvent.setup()
  const { list, item } = book()
  const cardPressed = vi.fn()
  render(
    <div onClick={cardPressed}>
      <ProgressChip list={list} item={item} />
    </div>,
  )

  await user.click(screen.getByRole('button', { name: /Press to change it/ }))
  expect(cardPressed).not.toHaveBeenCalled()
})

test('on a finger the same press opens the task instead of a field', async () => {
  // Not a preference: a field under 16px makes iOS Safari zoom the page when
  // it takes focus, and a 16px box in a card's meta line is half the row.
  // The sheet already holds this control at a size a finger can use.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('coarse'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  const user = userEvent.setup()
  const { list, item } = book()
  const opened = vi.fn()
  render(<ProgressChip list={list} item={item} onOpenDetails={opened} />)

  await user.click(screen.getByRole('button', { name: /Press to change it/ }))
  expect(opened).toHaveBeenCalled()
  expect(screen.queryByLabelText('How far through Daring Greatly')).not.toBeInTheDocument()
  vi.unstubAllGlobals()
})
