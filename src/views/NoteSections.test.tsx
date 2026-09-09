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
