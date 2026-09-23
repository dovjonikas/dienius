import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthView } from './NorthView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { getUndo } from '../../lib/undo'

/**
 * A whole North text put in the place of the one here - the owner's brief of
 * 2026-09-22, part 4. What it will make is said as it is typed, and nothing
 * is replaced before the press. Every line here is invented.
 */

const TEXT = ['A first line of the picture.', '', 'WHAT MATTERS [morning]', 'A line under it.', '', 'THE EVENING [evening]', 'Another.', '', 'A THIRD', 'And a third.', '', '---', 'Signed.'].join('\n')

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  actions.setPicture('THE OLD ONE\nA line that was here.')
})

test('Replace text says how many headings it found, which are for the morning and the evening, and replaces on the press', async () => {
  const user = userEvent.setup()
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Replace text' }))

  const field = screen.getByRole('textbox', { name: 'The whole text' })
  const found = () => within(screen.getByRole('list', { name: 'What it will make' })).getAllByRole('listitem').map(li => li.textContent)
  expect(found()[0]).toBe('No headings yet - the whole text would read as one.')
  // Nothing is replaced while it is typed.
  await user.type(field, 'SOMETHING [morning]')
  expect(getData().picture?.text).toBe('THE OLD ONE\nA line that was here.')

  await user.clear(field)
  await user.click(field)
  await user.paste(TEXT)
  expect(found()).toEqual([
    '3 headings: WHAT MATTERS, THE EVENING, A THIRD',
    'For the morning: WHAT MATTERS',
    'For the evening: THE EVENING',
    '1 paragraph before the first heading, and a signature at the foot',
  ])

  await user.click(screen.getByRole('button', { name: 'Replace what is here' }))
  expect(getData().picture?.text).toBe(TEXT)
  expect(getUndo()?.label).toBe('North replaced')
  // Back on the page, reading the new text.
  expect(screen.getByRole('heading', { name: 'WHAT MATTERS' })).toBeInTheDocument()
})

test('Cancel leaves the text as it was, and Replace waits for a text', async () => {
  const user = userEvent.setup()
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Replace text' }))
  expect(screen.getByRole('button', { name: 'Replace what is here' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(getData().picture?.text).toBe('THE OLD ONE\nA line that was here.')
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
})

test('with no text yet there is nothing to replace, and Write is the one press', () => {
  actions.setPicture('')
  render(<NorthView />)
  expect(screen.queryByRole('button', { name: 'Replace text' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Write' })).toBeInTheDocument()
})
