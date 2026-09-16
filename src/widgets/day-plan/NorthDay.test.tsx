import { beforeEach, expect, test } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthDay } from './NorthDay'
import { actions } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const DATE = '2026-09-05'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

/**
 * North on the day: the signature as one quiet line and the headings as a
 * quiet list, each opening what it holds, and never the introduction - that
 * is met in the window after sleep and on the page. Beside the day where
 * there is a rail; folded to one line with the signature where there is
 * not. Every line here is a generic one.
 */

const TEXT = 'a line before any heading\n\nFIRST HEADING\na line under it\n\na second paragraph under it\nSECOND HEADING\na line under the second\n---\na signature line'

test('the signature and the headings stand on the day, and the introduction never does', () => {
  actions.setPicture(TEXT)
  render(<NorthDay date={DATE} />)
  const north = screen.getByRole('region', { name: 'North' })
  expect(within(north).getByText('a signature line')).toBeInTheDocument()
  expect(within(north).getAllByRole('button').map(b => b.textContent)).toEqual(['FIRST HEADING', 'SECOND HEADING'])
  expect(screen.queryByText('a line before any heading')).toBeNull()
})

test('a press opens every paragraph a heading holds, and a second press closes them', async () => {
  const user = userEvent.setup()
  actions.setPicture(TEXT)
  render(<NorthDay date={DATE} />)
  const first = screen.getByRole('button', { name: 'FIRST HEADING' })
  expect(first).toHaveAttribute('aria-expanded', 'false')
  await user.click(first)
  expect(first).toHaveAttribute('aria-expanded', 'true')
  const body = document.getElementById(first.getAttribute('aria-controls') ?? '')
  expect([...(body?.querySelectorAll('.north-paragraph') ?? [])].map(p => p.textContent)).toEqual([
    'a line under it',
    'a second paragraph under it',
  ])
  await user.click(first)
  expect(first).toHaveAttribute('aria-expanded', 'false')
})

test('a signature with no heading is the one line, and a heading with no signature is the list alone', () => {
  actions.setPicture('a line before any heading\n---\na signature line')
  const { rerender } = render(<NorthDay date={DATE} />)
  expect(screen.getByText('a signature line')).toBeInTheDocument()
  expect(screen.queryByRole('button')).toBeNull()

  act(() => actions.setPicture('a line before any heading\n\nFIRST HEADING\na line under it'))
  rerender(<NorthDay date={DATE} />)
  expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['FIRST HEADING'])
  expect(screen.queryByText('a line before any heading')).toBeNull()
})

test('no text, or a text that is all introduction, puts nothing on the day', () => {
  const { container, rerender } = render(<NorthDay date={DATE} />)
  expect(container).toBeEmptyDOMElement()
  act(() => actions.setPicture('a first line\n\na second line'))
  rerender(<NorthDay date={DATE} />)
  expect(container).toBeEmptyDOMElement()
})

test('switched off in Settings, nothing of North is on the day', () => {
  actions.setPicture(TEXT)
  actions.setNorthSettings({ afterASlowDay: true, stripOnDay: false })
  const { container } = render(<NorthDay date={DATE} folded />)
  expect(container).toBeEmptyDOMElement()
})

// As many headings as the text has: nothing on the day counts or caps them.
test('every heading stands in the list, however many the text has', () => {
  actions.setPicture(Array.from({ length: 40 }, (_, i) => `HEADING ${i + 1}\na line under heading ${i + 1}`).join('\n\n'))
  render(<NorthDay date={DATE} />)
  expect(screen.getAllByRole('button')).toHaveLength(40)
})

test('the day changing under it closes what was open', async () => {
  const user = userEvent.setup()
  actions.setPicture(TEXT)
  const { rerender } = render(<NorthDay date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'FIRST HEADING' }))
  expect(screen.getByRole('button', { name: 'FIRST HEADING' })).toHaveAttribute('aria-expanded', 'true')
  rerender(<NorthDay date="2026-09-06" />)
  expect(screen.getByRole('button', { name: 'FIRST HEADING' })).toHaveAttribute('aria-expanded', 'false')
})

// --- folded, where there is no rail ------------------------------------------------

/**
 * On the phone, and in a window too narrow for the rail, North on the day
 * is one line under the day's title: the signature, and a press on it opens
 * the headings under it; a second press folds them again. Without a
 * signature the line says North.
 */
test('folded, it is one line with the signature, and a press opens the headings under it', async () => {
  const user = userEvent.setup()
  actions.setPicture(TEXT)
  render(<NorthDay date={DATE} folded />)
  const line = screen.getByRole('button', { name: 'a signature line' })
  expect(line).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'FIRST HEADING' })).toBeNull()

  await user.click(line)
  expect(line).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('button', { name: 'FIRST HEADING' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'FIRST HEADING' }))
  expect(screen.getByText('a line under it')).toBeInTheDocument()

  await user.click(line)
  expect(screen.queryByRole('button', { name: 'FIRST HEADING' })).toBeNull()
  expect(screen.queryByText('a line before any heading')).toBeNull()
})

test('folded with no signature the line says North, and with no heading it is only the signature', () => {
  actions.setPicture('FIRST HEADING\na line under it')
  const { rerender } = render(<NorthDay date={DATE} folded />)
  expect(screen.getByRole('button', { name: 'North' })).toHaveAttribute('aria-expanded', 'false')

  act(() => actions.setPicture('a line before any heading\n---\na signature line'))
  rerender(<NorthDay date={DATE} folded />)
  expect(screen.getByText('a signature line')).toBeInTheDocument()
  expect(screen.queryByRole('button')).toBeNull()
})
