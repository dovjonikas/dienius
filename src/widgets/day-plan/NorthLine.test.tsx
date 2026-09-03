import { beforeEach, expect, test } from 'vitest'
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
 * The line under the day's title, and the one interaction it has.
 *
 * Two things are being pinned here. The first is that it opens: the expansion
 * used to be styled but untested, and an author `display: flex` beats the UA
 * `[hidden]` rule, so a panel can be marked hidden and still be on screen -
 * these assert the attribute, and the stylesheet's own
 * `.north-line-more[hidden]` rule covers the rest.
 *
 * The second is that a goal with nothing behind it is not a control at all.
 * Half the point of this line is that it does not look pressable; a title with
 * no why and no identity that still expands into an empty box would be the
 * worst of both.
 */

test('a goal with nothing behind it says so by not being expandable', async () => {
  const user = userEvent.setup()
  actions.addGoal({ title: 'Ship the thing' }, DATE)
  render(<NorthLine date={DATE} />)

  const title = screen.getByRole('button', { name: 'Ship the thing' })
  expect(title).not.toHaveAttribute('aria-expanded')

  await user.click(title)
  expect(title).not.toHaveAttribute('aria-expanded')
})

test('a tap opens the why, and a second tap closes it again', async () => {
  const user = userEvent.setup()
  actions.addGoal({ title: 'Ship the thing', why: 'Because renting is not owning.' }, DATE)
  render(<NorthLine date={DATE} />)

  const title = screen.getByRole('button', { name: 'Ship the thing' })
  expect(title).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText('Because renting is not owning.').closest('div')).toHaveAttribute('hidden')

  await user.pointer({ keys: '[TouchA]', target: title })
  expect(title).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('Because renting is not owning.').closest('div')).not.toHaveAttribute('hidden')

  await user.pointer({ keys: '[TouchA]', target: title })
  expect(title).toHaveAttribute('aria-expanded', 'false')
})

// Hover and tap are the same gesture on this one element - see the comment in
// NorthLine.tsx. Only for a mouse, though: on a touch device the browser sends
// a pointerenter just before the click, and honouring it would open the panel
// and then immediately have the click close it again.
test('a mouse hovering opens it, and leaving closes it', async () => {
  const user = userEvent.setup()
  actions.addGoal({ title: 'Ship the thing', identity: 'Someone who finishes.' }, DATE)
  render(<NorthLine date={DATE} />)

  const title = screen.getByRole('button', { name: 'Ship the thing' })
  await user.hover(title)
  expect(title).toHaveAttribute('aria-expanded', 'true')

  await user.unhover(title)
  expect(title).toHaveAttribute('aria-expanded', 'false')
})

/**
 * A mouse opens this by arriving. Clicking it as well used to toggle, which
 * meant a mouse user who hovered and then clicked - the ordinary way somebody
 * investigates a line of text that turned out to be pressable - watched the
 * panel collapse under a cursor that was still sitting on it.
 */
test('clicking with a mouse does not shut what hovering just opened', async () => {
  const user = userEvent.setup()
  actions.addGoal({ title: 'Ship the thing', why: 'Because.' }, DATE)
  render(<NorthLine date={DATE} />)

  const title = screen.getByRole('button', { name: 'Ship the thing' })
  await user.click(title)
  expect(title).toHaveAttribute('aria-expanded', 'true')
})

test('a touch does not open it on the way to the tap that opens it', async () => {
  actions.addGoal({ title: 'Ship the thing', why: 'Because.' }, DATE)
  render(<NorthLine date={DATE} />)

  const title = screen.getByRole('button', { name: 'Ship the thing' })
  title.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, pointerType: 'touch' }))
  expect(title).toHaveAttribute('aria-expanded', 'false')
})

// Keyboard reaches the same panel by the same state, so there is nothing extra
// to maintain - and a focused line that stayed shut would hide the why from
// the one person who cannot hover to see it.
test('focus opens it and blur closes it, so a keyboard sees what a mouse does', async () => {
  const user = userEvent.setup()
  actions.addGoal({ title: 'Ship the thing', why: 'Because.' }, DATE)
  render(<NorthLine date={DATE} />)

  await user.tab()
  const title = screen.getByRole('button', { name: 'Ship the thing' })
  expect(title).toHaveFocus()
  expect(title).toHaveAttribute('aria-expanded', 'true')

  await user.tab()
  expect(title).toHaveAttribute('aria-expanded', 'false')
})

test('nothing renders at all when there are no goals - an empty line is not a placeholder', () => {
  const { container } = render(<NorthLine date={DATE} />)
  expect(container).toBeEmptyDOMElement()
})

// One a day, rotating. What matters is that a given date always lands on the
// same one, so that opening the app twice in a morning is not two different
// reminders.
test('the same date always shows the same goal', () => {
  actions.addGoal({ title: 'First' }, DATE)
  actions.addGoal({ title: 'Second' }, DATE)
  expect(getData().goals).toHaveLength(2)

  const first = render(<NorthLine date={DATE} />)
  const shown = first.container.querySelector('.north-line-title')!.textContent
  first.unmount()

  const second = render(<NorthLine date={DATE} />)
  expect(second.container.querySelector('.north-line-title')).toHaveTextContent(shown!)
})

test('an expansion does not survive the day changing under it', async () => {
  const user = userEvent.setup()
  actions.addGoal({ title: 'Ship the thing', why: 'Because.' }, DATE)
  const { rerender } = render(<NorthLine date={DATE} />)

  await user.pointer({ keys: '[TouchA]', target: screen.getByRole('button', { name: 'Ship the thing' }) })
  expect(screen.getByRole('button', { name: 'Ship the thing' })).toHaveAttribute('aria-expanded', 'true')

  rerender(<NorthLine date="2026-09-02" />)
  expect(screen.getByRole('button', { name: 'Ship the thing' })).toHaveAttribute('aria-expanded', 'false')
})
