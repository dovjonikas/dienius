import { beforeEach, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
 * North beside the day: a small North, the headings as they were written,
 * each showing a small card of its lines beside it - on a resting pointer or
 * on a press - and the signature under them. Never the introduction: that is
 * met in the window after sleep and on the page. Beside the day where there
 * is a rail; folded under the day's top where there is not. Every line here
 * is a generic one.
 */

const TEXT =
  'a line before any heading\n\nFIRST HEADING\na line under it\n\na second paragraph under it\nSECOND HEADING [evening]\na line under the second\n---\na signature line'

const card = () => document.querySelector('.north-heading-card')
const cardLines = () => [...(card()?.querySelectorAll('.north-paragraph') ?? [])].map(p => p.textContent)

test('a small North, the headings as written and the signature under them stand on the day, and the introduction never does', () => {
  actions.setPicture(TEXT)
  render(<NorthDay date={DATE} />)
  const north = screen.getByRole('region', { name: 'North' })
  expect(within(north).getByRole('heading', { name: 'North' })).toBeInTheDocument()
  expect(within(north).getAllByRole('button').map(b => b.textContent)).toEqual(['FIRST HEADING', 'SECOND HEADING'])
  expect(within(north).getByText('a signature line')).toBeInTheDocument()
  // The signature closes the section, after the headings.
  const signature = within(north).getByText('a signature line')
  expect(within(north).getAllByRole('button')[1].compareDocumentPosition(signature) & 4).toBe(4)
  expect(screen.queryByText('a line before any heading')).toBeNull()
  expect(north.textContent).not.toMatch(/\[evening\]/)
})

test("a resting pointer shows a heading's lines on a card, and leaving takes them away", () => {
  actions.setPicture(TEXT)
  render(<NorthDay date={DATE} />)
  const first = screen.getByRole('button', { name: 'FIRST HEADING' })
  expect(card()).toBeNull()

  fireEvent.pointerEnter(first, { pointerType: 'mouse' })
  expect(cardLines()).toEqual(['a line under it', 'a second paragraph under it'])
  expect(first).toHaveAttribute('aria-expanded', 'true')
  expect(first).toHaveAttribute('aria-describedby', card()!.id)

  fireEvent.pointerLeave(first, { pointerType: 'mouse' })
  expect(card()).toBeNull()
})

test('a press shows the card and keeps it, and a second press, a press elsewhere or Escape puts it away', async () => {
  const user = userEvent.setup()
  actions.setPicture(TEXT)
  render(
    <>
      <NorthDay date={DATE} />
      <p>elsewhere</p>
    </>,
  )
  const first = screen.getByRole('button', { name: 'FIRST HEADING' })
  await user.click(first)
  expect(cardLines()).toEqual(['a line under it', 'a second paragraph under it'])
  await user.click(first)
  expect(card()).toBeNull()

  await user.click(first)
  expect(card()).not.toBeNull()
  await user.click(screen.getByText('elsewhere'))
  expect(card()).toBeNull()

  await user.click(first)
  expect(card()).not.toBeNull()
  await user.keyboard('{Escape}')
  expect(card()).toBeNull()
})

test('the card is a layer out of the flow that takes no press, so nothing under it moves', () => {
  const css = readFileSync(join(__dirname, '../../styles.css'), 'utf8').replace(/\r\n/g, '\n')
  const rule = css.match(/\n\.north-heading-card \{([^}]*)\}/)?.[1] ?? ''
  expect(rule).toMatch(/position:\s*fixed/)
  expect(rule).toMatch(/pointer-events:\s*none/)
  expect(rule).toMatch(/background:\s*var\(--surface-raised\)/)
  // And a heading is written as typed: nothing in the stylesheet tracks it.
  const heading = css.match(/\n\.north-day-heading \{([^}]*)\}/)?.[1] ?? ''
  expect(heading).not.toMatch(/letter-spacing|text-transform/)
})

test('a heading with nothing under it is words and not a control', () => {
  actions.setPicture('FIRST HEADING\nSECOND HEADING\na line under the second')
  render(<NorthDay date={DATE} />)
  expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['SECOND HEADING'])
  expect(screen.getByText('FIRST HEADING').tagName).toBe('SPAN')
})

test('a signature with no heading is North and the signature, and a heading with no signature is North and the list', () => {
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

test('the day changing under it puts away a card that was out', async () => {
  const user = userEvent.setup()
  actions.setPicture(TEXT)
  const { rerender } = render(<NorthDay date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'FIRST HEADING' }))
  expect(card()).not.toBeNull()
  rerender(<NorthDay date="2026-09-06" />)
  expect(card()).toBeNull()
  expect(screen.getByRole('button', { name: 'FIRST HEADING' })).toHaveAttribute('aria-expanded', 'false')
})

// --- folded, where there is no rail ------------------------------------------------

/**
 * On the phone, and in a window too narrow for the rail, North on the day is
 * the word North under the day's top, and a press on it opens the headings
 * under it; a press on a heading opens its card. The signature is the day's
 * own line's to say (NorthLine).
 */
test('folded, it is one line that says North, a press opens the headings, and a press on one its card', async () => {
  const user = userEvent.setup()
  actions.setPicture(TEXT)
  render(<NorthDay date={DATE} folded />)
  expect(screen.queryByText('a signature line')).toBeNull()
  const line = screen.getByRole('button', { name: 'North' })
  expect(line).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'FIRST HEADING' })).toBeNull()

  await user.click(line)
  expect(line).toHaveAttribute('aria-expanded', 'true')
  await user.click(screen.getByRole('button', { name: 'FIRST HEADING' }))
  expect(cardLines()).toEqual(['a line under it', 'a second paragraph under it'])

  await user.click(line)
  expect(screen.queryByRole('button', { name: 'FIRST HEADING' })).toBeNull()
  expect(card()).toBeNull()
  expect(screen.queryByText('a line before any heading')).toBeNull()
})

/**
 * A word in the secondary ink does not say it opens. The fold carries the
 * caret the app draws on every other thing that folds, turned by its state,
 * and hidden from a screen reader, which hears the button's expanded state.
 * And on the phone the day's North - its line and the fold - ends with a
 * step of air under it, so what follows reads as the next thing on the day
 * rather than as what the word North labels.
 */
test('folded, North carries the turning caret of everything that folds, and the day leaves a step of air under it', async () => {
  const user = userEvent.setup()
  actions.setPicture(TEXT)
  const { container } = render(<NorthDay date={DATE} folded />)
  const line = screen.getByRole('button', { name: 'North' })
  const caret = line.querySelector('.north-day-caret')
  expect(caret).toHaveAttribute('aria-hidden', 'true')
  await user.click(line)
  expect(line.querySelector('.north-day-caret')).not.toBeNull()
  expect(container.querySelectorAll('.north-day-caret')).toHaveLength(1)

  const css = readFileSync(join(__dirname, '../../styles.css'), 'utf8').replace(/\r\n/g, '\n')
  const turned = css.match(/\n([^{}\n]*\[aria-expanded='true'\] \.clock-sound-caret[^{}]*)\{([^}]*)\}/)
  expect(turned?.[1]).toContain(".north-day-line[aria-expanded='true'] .north-day-caret")
  const drawn = css.match(/\n([^{}\n]*\.clock-sound-caret,?[^{}]*)\{([^}]*border-right[^}]*)\}/)
  expect(drawn?.[1]).toContain('.north-day-caret')
  const air = css.match(/\n\.day-header > \.north-day\.is-folded,\n\.day-header > \.north-line:last-child \{([^}]*)\}/)
  expect(air?.[1]).toMatch(/margin-bottom:\s*var\(--s4\)/)
})

test('folded with no heading there is nothing to open, and nothing is drawn', () => {
  actions.setPicture('FIRST HEADING\na line under it')
  const { container, rerender } = render(<NorthDay date={DATE} folded />)
  expect(screen.getByRole('button', { name: 'North' })).toHaveAttribute('aria-expanded', 'false')

  act(() => actions.setPicture('a line before any heading\n---\na signature line'))
  rerender(<NorthDay date={DATE} folded />)
  expect(container).toBeEmptyDOMElement()
})
