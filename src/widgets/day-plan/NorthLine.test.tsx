import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthLine } from './NorthLine'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

/**
 * The line under the day's title, and the two things it now does.
 *
 * Pressing it opens the North window. Hovering or focusing it peeks at the
 * why and the identity in place. Those used to be one gesture - a press
 * expanded the panel - and the tests below that assert the panel's `hidden`
 * attribute rather than an `aria-expanded` state are the record of that
 * split: the line is not a disclosure any more, so it must not claim to be
 * one. Four tests changed here in v2.0 for that reason, and one was deleted
 * outright: "a touch does not open it on the way to the tap that opens it"
 * defended a machine that only existed because a tap fired both a focus and
 * a click into the same toggle. There is no toggle left for them to fight
 * over.
 *
 * The attribute matters and eyeballing it does not: an author `display: flex`
 * beats the UA `[hidden]` rule, so a panel can be marked hidden and still be
 * on screen. These assert the attribute and the stylesheet's own
 * `.north-line-more[hidden]` rule covers the rest.
 */

test('pressing the line opens North', async () => {
  const user = userEvent.setup()
  const onOpenNorth = vi.fn()
  actions.addGoal({ title: 'Ship the thing', why: 'Because renting is not owning.' }, DATE)
  render(<NorthLine date={DATE} onOpenNorth={onOpenNorth} />)

  await user.click(screen.getByRole('button', { name: 'Ship the thing' }))
  expect(onOpenNorth).toHaveBeenCalledTimes(1)
})

test('a tap opens North too - a finger has no hover to peek with', async () => {
  const user = userEvent.setup()
  const onOpenNorth = vi.fn()
  actions.addGoal({ title: 'Ship the thing', why: 'Because renting is not owning.' }, DATE)
  render(<NorthLine date={DATE} onOpenNorth={onOpenNorth} />)

  await user.pointer({ keys: '[TouchA]', target: screen.getByRole('button', { name: 'Ship the thing' }) })
  expect(onOpenNorth).toHaveBeenCalledTimes(1)
})

// The bubble took over from the browser's own tooltip in v2.6, which had
// carried the key and landed on the words; so a goal with nothing behind it
// still has the one line the tooltip used to say, and nothing else.
test('a goal with nothing behind it peeks at the key alone', async () => {
  const user = userEvent.setup()
  actions.addGoal({ title: 'Ship the thing' }, DATE)
  const { container } = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)

  await user.hover(screen.getByRole('button', { name: 'Ship the thing' }))
  const panel = container.querySelector('.north-line-more')!
  expect(panel).not.toHaveAttribute('hidden')
  expect(panel.textContent).toBe('North · 6')
  expect(screen.getByRole('button', { name: 'Ship the thing' })).not.toHaveAttribute('title')
})

// The line never moves: the peek is positioned under it, not laid out after
// it. jsdom has no layout, so the stylesheet is read as text - the same way
// gridAreas.test.ts holds the grid's names.
test('the peek hangs under the line rather than sitting in the flow', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8').replace(/\r\n/g, '\n')
  const rule = css.match(/\.north-line-more \{[^}]*\}/)?.[0] ?? ''
  expect(rule).toMatch(/position: absolute/)
  expect(css).toMatch(/\.north-line \{[^}]*position: relative/)
  expect(css).toMatch(/\.north-line \{[^}]*height: calc/)
})

// Only for a mouse. On a touch device the browser sends a pointerenter just
// before the click, and a peek that opened on it would flash a panel open for
// the length of a tap that is on its way somewhere else.
test('a mouse hovering peeks at the why, and leaving puts it away', async () => {
  const user = userEvent.setup()
  actions.addGoal({ title: 'Ship the thing', identity: 'Someone who finishes.' }, DATE)
  const { container } = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  const panel = container.querySelector('.north-line-more')!
  const title = screen.getByRole('button', { name: 'Ship the thing' })

  expect(panel).toHaveAttribute('hidden')
  await user.hover(title)
  expect(panel).not.toHaveAttribute('hidden')

  await user.unhover(title)
  expect(panel).toHaveAttribute('hidden')
})

test('a touch does not peek on its way to the press', () => {
  actions.addGoal({ title: 'Ship the thing', why: 'Because.' }, DATE)
  const { container } = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)

  screen
    .getByRole('button', { name: 'Ship the thing' })
    .dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, pointerType: 'touch' }))
  expect(container.querySelector('.north-line-more')).toHaveAttribute('hidden')
})

// A keyboard reaches the same peek by the same state, so there is nothing
// extra to maintain - and a focused line that stayed shut would hide the why
// from the one person who cannot hover to see it.
test('focus peeks and blur puts it away, so a keyboard sees what a mouse does', async () => {
  const user = userEvent.setup()
  actions.addGoal({ title: 'Ship the thing', why: 'Because.' }, DATE)
  const { container } = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  const panel = container.querySelector('.north-line-more')!

  await user.tab()
  expect(screen.getByRole('button', { name: 'Ship the thing' })).toHaveFocus()
  expect(panel).not.toHaveAttribute('hidden')

  await user.tab()
  expect(panel).toHaveAttribute('hidden')
})

test('nothing renders at all when there are no goals - an empty line is not a placeholder', () => {
  const { container } = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})

// One a day, rotating. What matters is that a given date always lands on the
// same one, so that opening the app twice in a morning is not two different
// reminders.
test('the same date always shows the same goal', () => {
  actions.addGoal({ title: 'First' }, DATE)
  actions.addGoal({ title: 'Second' }, DATE)
  expect(getData().goals).toHaveLength(2)

  const first = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  const shown = first.container.querySelector('.north-line-title')!.textContent
  first.unmount()

  const second = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(second.container.querySelector('.north-line-title')).toHaveTextContent(shown!)
})

test('a peek does not survive the day changing under it', async () => {
  const user = userEvent.setup()
  actions.addGoal({ title: 'Ship the thing', why: 'Because.' }, DATE)
  const { container, rerender } = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)

  await user.hover(screen.getByRole('button', { name: 'Ship the thing' }))
  expect(container.querySelector('.north-line-more')).not.toHaveAttribute('hidden')

  rerender(<NorthLine date="2026-09-02" onOpenNorth={() => {}} />)
  expect(container.querySelector('.north-line-more')).toHaveAttribute('hidden')
})

// --- the text's line, since v2.26 ------------------------------------------------------

/**
 * Where North has a text, the day's top is one line of it - a line from
 * under a heading, picked by lib/northLine.ts - and the signature under it,
 * and a press opens North. The goal's name is only for a North with nothing
 * for the day. Generic lines only.
 */
const TEXT = [
  'An introduction line.',
  'FIRST HEADING',
  'first plain line',
  'second plain line',
  'WAKING HEADING [morning]',
  'a morning line',
  'LATER HEADING [evening]',
  'an evening line',
  '---',
  'A signature line.',
].join('\n')

/** The device's clock at a local hour on the day of `DATE`. */
function clockAt(hour: number, minute = 0) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 1, hour, minute))
}

afterEach(() => {
  vi.useRealTimers()
})

test("with a text, the day's top is a line from under a heading and the signature under it, and no goal", () => {
  clockAt(12)
  actions.addGoal({ title: 'A goal title' }, DATE)
  actions.setPicture(TEXT)
  render(<NorthLine date={DATE} onOpenNorth={() => {}} />)

  const button = screen.getByRole('button')
  expect(['first plain line', 'second plain line']).toContain(button.querySelector('.north-line-words')!.textContent)
  expect(button.querySelector('.north-line-signature')).toHaveTextContent('A signature line.')
  expect(screen.queryByText('A goal title')).toBeNull()
  expect(screen.queryByText(/HEADING/)).toBeNull()
  expect(screen.queryByText('An introduction line.')).toBeNull()
  expect(document.body.textContent).not.toMatch(/\[(morning|evening)\]/i)
})

test('a press on the line opens North', async () => {
  clockAt(12)
  const user = userEvent.setup()
  const onOpenNorth = vi.fn()
  actions.setPicture(TEXT)
  render(<NorthLine date={DATE} onOpenNorth={onOpenNorth} />)
  await user.click(screen.getByRole('button'))
  expect(onOpenNorth).toHaveBeenCalledTimes(1)
})

test('the same date shows the same line, and the next date the other one', () => {
  clockAt(12)
  actions.setPicture(TEXT)
  const words = (date: string) => {
    const { container, unmount } = render(<NorthLine date={date} onOpenNorth={() => {}} />)
    const text = container.querySelector('.north-line-words')!.textContent
    unmount()
    return text
  }
  expect(words('2026-09-05')).toBe(words('2026-09-05'))
  expect(words('2026-09-06')).not.toBe(words('2026-09-05'))
})

test("in the three hours after waking today shows the morning's line, and from 21:00 the evening's", () => {
  actions.setPicture(TEXT)
  localStorage.setItem('dienius:north-woke', String(new Date(2026, 8, 1, 7, 0).getTime()))

  clockAt(9, 30)
  const morning = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(morning.container.querySelector('.north-line-words')).toHaveTextContent('a morning line')
  morning.unmount()

  clockAt(10, 30)
  const later = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(['first plain line', 'second plain line']).toContain(later.container.querySelector('.north-line-words')!.textContent)
  later.unmount()

  clockAt(21, 5)
  const evening = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(evening.container.querySelector('.north-line-words')).toHaveTextContent('an evening line')
  evening.unmount()

  // Another day, looked at from this morning, shows its line for the day.
  clockAt(9, 30)
  const tomorrow = render(<NorthLine date="2026-09-02" onOpenNorth={() => {}} />)
  expect(['first plain line', 'second plain line']).toContain(tomorrow.container.querySelector('.north-line-words')!.textContent)
})

test('at an hour whose lines are all under the other tag, the signature stands alone', () => {
  clockAt(12)
  actions.setPicture('WAKING HEADING [morning]\na morning line\n---\nA signature line.')
  const { container } = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(container.querySelector('.north-line-words')).toBeNull()
  expect(screen.getByRole('button')).toHaveTextContent('A signature line.')
})

test("a text with nothing for the day, or North's text switched off the day, leaves the goal's line", () => {
  clockAt(12)
  actions.addGoal({ title: 'A goal title' }, DATE)
  actions.setPicture('An introduction line, and nothing else.')
  const { rerender } = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(screen.getByRole('button', { name: 'A goal title' })).toBeInTheDocument()

  act(() => {
    actions.setPicture(TEXT)
    actions.setNorthSettings({ ...getData().settings.north, stripOnDay: false })
  })
  rerender(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(screen.getByRole('button', { name: 'A goal title' })).toBeInTheDocument()
  expect(screen.queryByText('A signature line.')).toBeNull()
})
