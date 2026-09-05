import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

test('a goal with nothing behind it has no panel to peek at', async () => {
  const user = userEvent.setup()
  actions.addGoal({ title: 'Ship the thing' }, DATE)
  const { container } = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)

  await user.hover(screen.getByRole('button', { name: 'Ship the thing' }))
  expect(container.querySelector('.north-line-more')).toBeNull()
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
