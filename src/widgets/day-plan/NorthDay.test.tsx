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
 * North beside the day, v2.28: a small North that folds with one press, and
 * the headings as they were written, one line each, each showing a small
 * card of its lines beside it - on a resting pointer or on a press. Never the
 * picture and never the signature: the picture is met in the window after
 * sleep and on the page, the signature on the day's top in the evening and at
 * the end of the day. Beside the day where there is a rail; folded under the
 * day's top where there is not. Every line here is a generic one.
 */

const TEXT =
  'a line before any heading\n\nFIRST HEADING\na line under it\n\na second paragraph under it\nSECOND HEADING [evening]\na line under the second\n---\na signature line'

const card = () => document.querySelector('.north-heading-card')
const cardLines = () => [...(card()?.querySelectorAll('.north-paragraph') ?? [])].map(p => p.textContent)

test('in the rail, a small North that folds and the headings as written, and neither the picture nor the signature', () => {
  actions.setPicture(TEXT)
  render(<NorthDay date={DATE} />)
  const north = screen.getByRole('region', { name: 'North' })
  const label = within(north).getByRole('heading', { name: 'North' })
  expect(within(label).getByRole('button', { name: 'North' })).toHaveAttribute('aria-expanded', 'true')
  expect(within(north).getAllByRole('button').map(b => b.textContent)).toEqual(['North', 'FIRST HEADING', 'SECOND HEADING'])
  expect(screen.queryByText('a signature line')).toBeNull()
  expect(screen.queryByText('a line before any heading')).toBeNull()
  expect(north.textContent).not.toMatch(/\[evening\]/)
})

// One line each, however long: a long heading is cut with an ellipsis and
// never wraps onto a second line. jsdom has no layout, so the rule is read.
test('a heading is one line in the small type, cut with an ellipsis rather than wrapped', () => {
  const css = readFileSync(join(__dirname, '../../styles.css'), 'utf8').replace(/\r\n/g, '\n')
  const heading = css.match(/\n\.north-day-heading \{([^}]*)\}/)?.[1] ?? ''
  expect(heading).toMatch(/font-size:\s*var\(--t-sm\)/)
  expect(heading).toMatch(/white-space:\s*nowrap/)
  expect(heading).toMatch(/overflow:\s*hidden/)
  expect(heading).toMatch(/text-overflow:\s*ellipsis/)
  expect(heading).not.toMatch(/overflow-wrap/)
})

/** Says the heading's words are wider than its line, the way a cut one is. */
function cutShort(el: HTMLElement) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 400 })
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: 200 })
}

test('a heading cut short shows itself whole at the top of its card, and one that fits does not', () => {
  actions.setPicture(TEXT)
  render(<NorthDay date={DATE} />)
  const first = screen.getByRole('button', { name: 'FIRST HEADING' })
  cutShort(first)
  fireEvent.pointerEnter(first, { pointerType: 'mouse' })
  expect(card()!.querySelector('.north-heading-card-heading')).toHaveTextContent('FIRST HEADING')
  expect(cardLines()).toEqual(['a line under it', 'a second paragraph under it'])
  fireEvent.pointerLeave(first, { pointerType: 'mouse' })

  const second = screen.getByRole('button', { name: 'SECOND HEADING' })
  fireEvent.pointerEnter(second, { pointerType: 'mouse' })
  expect(card()!.querySelector('.north-heading-card-heading')).toBeNull()
  expect(cardLines()).toEqual(['a line under the second'])
})

// --- the fold, remembered on the device -------------------------------------------------

test('a press on North folds the headings away and another opens them, and this device remembers', async () => {
  const user = userEvent.setup()
  actions.setPicture(TEXT)
  const first = render(<NorthDay date={DATE} />)
  const fold = screen.getByRole('button', { name: 'North' })
  await user.click(fold)
  expect(fold).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'FIRST HEADING' })).toBeNull()
  expect(localStorage.getItem('dienius:north-fold')).toBe('folded')
  first.unmount()

  render(<NorthDay date={DATE} />)
  const again = screen.getByRole('button', { name: 'North' })
  expect(again).toHaveAttribute('aria-expanded', 'false')
  await user.click(again)
  expect(screen.getByRole('button', { name: 'FIRST HEADING' })).toBeInTheDocument()
  expect(localStorage.getItem('dienius:north-fold')).toBe('open')
  // A fact about this screen, not about the plan: nothing of it is written there.
  expect(localStorage.getItem('dienius:data') ?? '').not.toContain('north-fold')
})

test('the day changing keeps the fold as it was', async () => {
  const user = userEvent.setup()
  actions.setPicture(TEXT)
  const { rerender } = render(<NorthDay date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'North' }))
  rerender(<NorthDay date="2026-09-06" />)
  expect(screen.getByRole('button', { name: 'North' })).toHaveAttribute('aria-expanded', 'false')
})

/**
 * The rail holds the month, the templates, North, what is next and the day's
 * numbers, and on an ordinary screen all of it fits. Where it does not - a
 * long list of headings, a short window - North is what starts folded, before
 * anything is drawn so nothing jumps: its headings are an index to a page one
 * press away, where the rest of the rail is the day itself. A choice made on
 * this device wins over that, either way.
 */
test('a rail too full for its window starts with North folded, and a choice made on this device wins', () => {
  actions.setPicture(TEXT)
  function railThatOverflows() {
    const rail = document.createElement('div')
    rail.className = 'rail'
    Object.defineProperty(rail, 'scrollHeight', { configurable: true, value: 1200 })
    Object.defineProperty(rail, 'clientHeight', { configurable: true, value: 900 })
    document.body.appendChild(rail)
    return rail
  }

  const full = render(<NorthDay date={DATE} />, { container: railThatOverflows() })
  expect(screen.getByRole('button', { name: 'North' })).toHaveAttribute('aria-expanded', 'false')
  // Not a choice: nothing is remembered for it.
  expect(localStorage.getItem('dienius:north-fold')).toBeNull()
  full.unmount()

  localStorage.setItem('dienius:north-fold', 'open')
  render(<NorthDay date={DATE} />, { container: railThatOverflows() })
  expect(screen.getByRole('button', { name: 'North' })).toHaveAttribute('aria-expanded', 'true')
})

test('a rail with room starts with North open', () => {
  actions.setPicture(TEXT)
  const rail = document.createElement('div')
  rail.className = 'rail'
  Object.defineProperty(rail, 'scrollHeight', { configurable: true, value: 900 })
  Object.defineProperty(rail, 'clientHeight', { configurable: true, value: 900 })
  document.body.appendChild(rail)
  render(<NorthDay date={DATE} />, { container: rail })
  expect(screen.getByRole('button', { name: 'North' })).toHaveAttribute('aria-expanded', 'true')
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
  expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['North', 'SECOND HEADING'])
  expect(screen.getByText('FIRST HEADING').tagName).toBe('SPAN')
})

test('a text with no heading puts nothing in the rail, and a heading is North and the list', () => {
  actions.setPicture('a line before any heading\n---\na signature line')
  const { container, rerender } = render(<NorthDay date={DATE} />)
  expect(container).toBeEmptyDOMElement()

  act(() => actions.setPicture('a line before any heading\n\nFIRST HEADING\na line under it'))
  rerender(<NorthDay date={DATE} />)
  expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['North', 'FIRST HEADING'])
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
  expect(screen.getAllByRole('button', { name: /^HEADING / })).toHaveLength(40)
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
  const { unmount } = render(<NorthDay date={DATE} folded />)
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
  unmount()
})

// Folded is where the phone starts; opened, it stays open on this device.
test('on the phone North starts folded, and once opened this device keeps it open', async () => {
  const user = userEvent.setup()
  actions.setPicture(TEXT)
  const first = render(<NorthDay date={DATE} folded />)
  await user.click(screen.getByRole('button', { name: 'North' }))
  expect(localStorage.getItem('dienius:north-fold')).toBe('open')
  first.unmount()

  render(<NorthDay date={DATE} folded />)
  expect(screen.getByRole('button', { name: 'North' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('button', { name: 'FIRST HEADING' })).toBeInTheDocument()
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
