import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteSections } from './NoteSections'

// The headings are on the card; the text is one press away. A note with no
// "## " line behaves exactly as it did.

beforeEach(() => {
  localStorage.clear()
})

const THREE = [
  'Pick one.',
  '## Chicken and rice',
  '200 g rice',
  '300 g chicken',
  '## Soup',
  'Whatever is in the fridge.',
  '## Eggs',
  'Four, and the bread.',
].join('\n')

test('each section is a button, and the intro sits above them', () => {
  render(<NoteSections note={THREE} expanded label="Meal" />)
  expect(screen.getByText('Pick one.')).toBeInTheDocument()
  for (const title of ['Chicken and rice', 'Soup', 'Eggs']) {
    expect(screen.getByRole('button', { name: `${title}, on Meal` })).toBeInTheDocument()
  }
  // The button says the heading and nothing under it.
  expect(screen.queryByText('300 g chicken')).not.toBeInTheDocument()
})

test('a press opens that one, and the others are still a press away', async () => {
  const user = userEvent.setup()
  render(<NoteSections note={THREE} label="Meal" />)

  await user.click(screen.getByRole('button', { name: 'Soup, on Meal' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('heading', { name: 'Soup' })).toBeInTheDocument()
  expect(within(dialog).getByText('Whatever is in the fridge.')).toBeInTheDocument()

  // Switched without closing.
  await user.click(within(dialog).getByRole('button', { name: 'Eggs' }))
  expect(within(screen.getByRole('dialog')).getByText('Four, and the bread.')).toBeInTheDocument()
})

test('Escape closes it and gives focus back to the button it came from', async () => {
  const user = userEvent.setup()
  render(<NoteSections note={THREE} label="Meal" />)
  const opener = screen.getByRole('button', { name: 'Soup, on Meal' })

  await user.click(opener)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await user.keyboard('{Escape}')

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

test('the close button shuts it too', async () => {
  const user = userEvent.setup()
  render(<NoteSections note={THREE} label="Meal" />)
  await user.click(screen.getByRole('button', { name: 'Chicken and rice, on Meal' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('past four sections the rest go behind a count that opens on them', async () => {
  const user = userEvent.setup()
  const six = ['## One', 'a', '## Two', 'b', '## Three', 'c', '## Four', 'd', '## Five', 'e', '## Six', 'f'].join('\n')
  render(<NoteSections note={six} label="Meal" />)

  expect(screen.getAllByRole('button')).toHaveLength(5)
  const more = screen.getByRole('button', { name: '2 more on Meal' })
  await user.click(more)
  // It opens on the first of the ones it stands for, so the count is a way
  // in rather than a dead end.
  expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Five' })).toBeInTheDocument()
})

test('a note with no heading is the intro alone, and only when asked for', () => {
  const { rerender } = render(<NoteSections note="Rice and chicken" label="Meal" />)
  expect(screen.queryByText('Rice and chicken')).not.toBeInTheDocument()

  rerender(<NoteSections note="Rice and chicken" open label="Meal" />)
  expect(screen.getByText('Rice and chicken')).toBeInTheDocument()
})

test('a block that says so shows its intro without a press', () => {
  render(<NoteSections note="Rice and chicken" expanded label="Meal" />)
  expect(screen.getByText('Rice and chicken')).toBeInTheDocument()
})

test('the section buttons show whatever the expand toggle says', () => {
  // Headings are choices, not text to be revealed - they are on the card
  // either way.
  render(<NoteSections note={THREE} label="Meal" />)
  expect(screen.getByRole('button', { name: 'Soup, on Meal' })).toBeInTheDocument()
  expect(screen.queryByText('Pick one.')).not.toBeInTheDocument()
})

test('a note with nothing in it renders nothing at all', () => {
  const { container } = render(<NoteSections note={undefined} label="Meal" />)
  expect(container).toBeEmptyDOMElement()
})

test('a heading with nothing under it says so rather than opening empty', async () => {
  const user = userEvent.setup()
  render(<NoteSections note={'## Empty\n## Full\nsomething'} label="Meal" />)
  await user.click(screen.getByRole('button', { name: 'Empty, on Meal' }))
  expect(within(screen.getByRole('dialog')).getByText('Nothing written under this one.')).toBeInTheDocument()
})

// A long note open on the card, from v2.14. Four lines and a way in, so a
// forty-line recipe costs the card the same as a four-line one.

const FORTY = Array.from({ length: 40 }, (_, i) => `Step ${i + 1}`).join('\n')

test('an open intro is cut to four lines, with Read under it', () => {
  render(<NoteSections note={FORTY} expanded label="Meal" />)
  expect(screen.getByText('Step 4')).toBeInTheDocument()
  expect(screen.queryByText('Step 5')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Read the whole note on Meal' })).toBeInTheDocument()
})

test('a short intro is not cut, and has nothing to press', () => {
  render(<NoteSections note={'One\nTwo\nThree\nFour'} expanded label="Meal" />)
  expect(screen.getByText('Four')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Read the whole note/ })).not.toBeInTheDocument()
})

test('Read opens the whole note, with the choices beside it', async () => {
  const user = userEvent.setup()
  render(<NoteSections note={`${FORTY}\n## Soup\nWhatever is in the fridge.`} expanded label="Meal" />)

  await user.click(screen.getByRole('button', { name: 'Read the whole note on Meal' }))
  const dialog = screen.getByRole('dialog', { name: 'The note on Meal' })
  // All forty, not the four the card had room for.
  expect(within(dialog).getByText('Step 40')).toBeInTheDocument()

  // And the section is a press away from it, in the same reader.
  await user.click(within(dialog).getByRole('button', { name: 'Soup' }))
  expect(screen.getByRole('dialog', { name: 'Soup, on Meal' })).toBeInTheDocument()
  expect(screen.getByText('Whatever is in the fridge.')).toBeInTheDocument()
})

test('a choice opened from the card still lands on that choice, not the intro', async () => {
  const user = userEvent.setup()
  render(<NoteSections note={`${FORTY}\n## Soup\nIn the fridge.\n## Eggs\nAnd bread.`} expanded label="Meal" />)

  await user.click(screen.getByRole('button', { name: 'Eggs, on Meal' }))
  expect(screen.getByRole('dialog', { name: 'Eggs, on Meal' })).toBeInTheDocument()
})

test('the note mark and an open intro are never both on the row', () => {
  // The mark reveals what is already showing, which is the same fact twice -
  // CONVENTIONS 23. TaskRow has read it that way since v2.13 and this holds
  // the reading it depends on: an expanded note draws its intro with no
  // press, so there is nothing for the mark to do.
  const { rerender } = render(<NoteSections note="Rice and chicken" expanded label="Meal" />)
  expect(screen.getByText('Rice and chicken')).toBeInTheDocument()

  rerender(<NoteSections note="Rice and chicken" label="Meal" />)
  expect(screen.queryByText('Rice and chicken')).not.toBeInTheDocument()
})
