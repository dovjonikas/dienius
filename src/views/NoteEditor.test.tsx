import { useState } from 'react'
import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteEditor } from './NoteEditor'

// The editor's whole job in v2.14 is to say what the parser already does.
// Everything below is a thing somebody can see without pressing anything,
// or a press that writes what the sentence describes.

/** The editor with a note of its own, the way both real callers hold one. */
function Editing({ start = '' }: { start?: string }) {
  const [note, setNote] = useState(start)
  return <NoteEditor value={note} label="Lunch" ariaLabel="Note on Lunch" onChange={setNote} />
}

test('an empty editor shows the rule before anything is typed', () => {
  render(<Editing />)
  const box = screen.getByLabelText('Note on Lunch')
  // The example is the placeholder, and it carries a heading of its own.
  expect(box).toHaveAttribute('placeholder', expect.stringContaining('## '))
  expect(screen.getByText('A line that starts with ## becomes a choice on the card.')).toBeInTheDocument()
})

test('nothing is previewed until there is a heading to preview', async () => {
  const user = userEvent.setup()
  render(<Editing />)
  const box = screen.getByLabelText('Note on Lunch')

  await user.type(box, 'Rice and chicken')
  expect(screen.queryByRole('button', { name: /, on Lunch$/ })).not.toBeInTheDocument()

  await user.type(box, '{Enter}{Enter}## Soup')
  expect(screen.getByRole('button', { name: 'Soup, on Lunch' })).toBeInTheDocument()
})

test('a third heading draws a third button while it is being typed', async () => {
  const user = userEvent.setup()
  render(<Editing start={'Pick one.\n\n## Soup\n\n## Eggs'} />)
  expect(screen.getAllByRole('button', { name: /, on Lunch$/ })).toHaveLength(2)

  await user.type(screen.getByLabelText('Note on Lunch'), '{Enter}{Enter}## Toast')
  const choices = screen.getAllByRole('button', { name: /, on Lunch$/ })
  expect(choices).toHaveLength(3)
  expect(choices[2]).toHaveTextContent('Toast')
})

test('the button writes the heading and leaves the caret ready to type it', async () => {
  const user = userEvent.setup()
  render(<Editing start="Rice and chicken" />)
  const box = screen.getByLabelText('Note on Lunch') as HTMLTextAreaElement

  await user.click(screen.getByRole('button', { name: 'Start a choice in the Lunch note' }))
  expect(box).toHaveValue('Rice and chicken\n\n## ')
  expect(box).toHaveFocus()

  // Typing straight afterwards has to land in the heading, with no press in
  // between - that is the whole point of the button.
  await user.keyboard('Soup')
  expect(box).toHaveValue('Rice and chicken\n\n## Soup')
  expect(screen.getByRole('button', { name: 'Soup, on Lunch' })).toBeInTheDocument()
})

test('two presses in a row do not walk the note down the page', async () => {
  const user = userEvent.setup()
  render(<Editing start="Rice" />)
  const add = screen.getByRole('button', { name: 'Start a choice in the Lunch note' })

  await user.click(add)
  await user.click(add)
  expect(screen.getByLabelText('Note on Lunch')).toHaveValue('Rice\n\n## ')
})

test('a heading in the preview opens the same reader the card opens', async () => {
  const user = userEvent.setup()
  render(<Editing start={'## Soup\nWhatever is in the fridge.'} />)

  await user.click(screen.getByRole('button', { name: 'Soup, on Lunch' }))
  expect(screen.getByRole('dialog', { name: 'Soup, on Lunch' })).toBeInTheDocument()
  expect(screen.getByText('Whatever is in the fridge.')).toBeInTheDocument()
})

test('a heading can be started and typed with no pointer at all', async () => {
  const user = userEvent.setup()
  render(<Editing start={'Pick one.\n\nRice and chicken'} />)
  const box = screen.getByLabelText('Note on Lunch') as HTMLTextAreaElement

  // Standing at the start of the line already written, then reaching the
  // button with Tab - which takes the focus out of the box on the way.
  box.focus()
  box.setSelectionRange(11, 11)
  await user.tab()
  expect(screen.getByRole('button', { name: 'Start a choice in the Lunch note' })).toHaveFocus()

  await user.keyboard('{Enter}')
  expect(box).toHaveValue('Pick one.\n\n## Rice and chicken')
  expect(box).toHaveFocus()
})
