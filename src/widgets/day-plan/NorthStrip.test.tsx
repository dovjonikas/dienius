import { beforeEach, expect, test } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthStrip } from './NorthStrip'
import { actions } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const DATE = '2026-09-05'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

/**
 * North's headings in a row under the day's title, each opening what is
 * under it. Every line here is a generic one - the app carries nobody's
 * text and neither does this file.
 */

test('with no text, or a text with no heading, there is no row at all', () => {
  const { container, rerender } = render(<NorthStrip date={DATE} />)
  expect(container).toBeEmptyDOMElement()
  act(() => actions.setPicture('First line here\n\nSecond line here'))
  rerender(<NorthStrip date={DATE} />)
  expect(container).toBeEmptyDOMElement()
})

test('the headings stand in a row; a press opens what is under one, and a second press closes it', async () => {
  const user = userEvent.setup()
  actions.setPicture('First line here\n\nFIRST SECTION\nline under it\n\nSECOND SECTION\nsecond line under it')
  render(<NorthStrip date={DATE} />)

  const row = screen.getByRole('group', { name: 'North' })
  expect(within(row).getAllByRole('button').map(b => b.textContent)).toEqual(['FIRST SECTION', 'SECOND SECTION'])
  // The free lines are the page's; the row is an index of the text, not the text.
  expect(screen.queryByText('First line here')).toBeNull()

  const first = screen.getByRole('button', { name: 'FIRST SECTION' })
  expect(first).toHaveAttribute('aria-expanded', 'false')
  await user.click(first)
  expect(first).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('line under it')).toBeInTheDocument()

  // Another heading takes the bubble over.
  await user.click(screen.getByRole('button', { name: 'SECOND SECTION' }))
  expect(first).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText('second line under it')).toBeInTheDocument()
  expect(screen.queryByText('line under it')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'SECOND SECTION' }))
  expect(screen.queryByText('second line under it')).toBeNull()
})

// A heading owns everything to the next heading - lib/northSections.ts - so
// a paragraph after a blank line under it opens with it, and is never read
// as a word in the row.
test('a heading opens everything under it to the next heading, a second paragraph included', async () => {
  const user = userEvent.setup()
  actions.setPicture('FIRST HEADING\na line under it\n\na second paragraph under it\nSECOND HEADING\na line under the second')
  render(<NorthStrip date={DATE} />)
  const row = screen.getByRole('group', { name: 'North' })
  expect(within(row).getAllByRole('button').map(b => b.textContent)).toEqual(['FIRST HEADING', 'SECOND HEADING'])

  await user.click(screen.getByRole('button', { name: 'FIRST HEADING' }))
  expect(screen.getByText('a line under it')).toBeInTheDocument()
  expect(screen.getByText('a second paragraph under it')).toBeInTheDocument()
  expect(screen.queryByText('a line under the second')).toBeNull()
})

// As many headings as the text has: the row counts nothing and caps nothing.
test('every heading stands in the row, however many the text has', () => {
  actions.setPicture(Array.from({ length: 40 }, (_, i) => `HEADING ${i + 1}\na line under heading ${i + 1}`).join('\n\n'))
  render(<NorthStrip date={DATE} />)
  expect(within(screen.getByRole('group', { name: 'North' })).getAllByRole('button')).toHaveLength(40)
})

test('Escape closes it, and a press elsewhere leaves it as it is', async () => {
  const user = userEvent.setup()
  actions.setPicture('FIRST SECTION\nline under it')
  render(
    <div>
      <NorthStrip date={DATE} />
      <button type="button">Elsewhere</button>
    </div>,
  )
  await user.click(screen.getByRole('button', { name: 'FIRST SECTION' }))
  expect(screen.getByText('line under it')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(screen.queryByText('line under it')).toBeNull()

  // In the flow of the page, it stays until it is pressed again.
  await user.click(screen.getByRole('button', { name: 'FIRST SECTION' }))
  await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
  expect(screen.getByText('line under it')).toBeInTheDocument()
})

test('a heading with nothing under it is a word in the row and not a control', () => {
  actions.setPicture('FIRST SECTION\n\nSECOND SECTION\nline under it')
  render(<NorthStrip date={DATE} />)
  expect(screen.queryByRole('button', { name: 'FIRST SECTION' })).toBeNull()
  expect(screen.getByText('FIRST SECTION')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'SECOND SECTION' })).toBeInTheDocument()
})

test('switched off in Settings, the row is gone', () => {
  actions.setPicture('FIRST SECTION\nline under it')
  actions.setNorthSettings({ afterASlowDay: true, stripOnDay: false })
  const { container } = render(<NorthStrip date={DATE} />)
  expect(container).toBeEmptyDOMElement()
})

test('the day changing under it closes what was open', async () => {
  const user = userEvent.setup()
  actions.setPicture('FIRST SECTION\nline under it')
  const { rerender } = render(<NorthStrip date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'FIRST SECTION' }))
  expect(screen.getByText('line under it')).toBeInTheDocument()
  rerender(<NorthStrip date="2026-09-06" />)
  expect(screen.queryByText('line under it')).toBeNull()
})
