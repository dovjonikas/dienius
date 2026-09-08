import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkOut } from './LinkOut'

/**
 * The door itself. Three things are held here, and all three are the kind
 * that break silently: the new tab, the two rel words that come with it, and
 * the promise that pressing this is not pressing the card under it.
 */

test('it opens in a new tab, and cannot reach back into this one', () => {
  render(<LinkOut link="https://example.com/spanish" title="Spanish" />)
  const link = screen.getByRole('link')
  expect(link).toHaveAttribute('href', 'https://example.com/spanish')
  expect(link).toHaveAttribute('target', '_blank')
  // noopener stops the page it opens reaching back through window.opener;
  // noreferrer stops this app telling somebody's server what the owner is
  // doing at nine on a Tuesday.
  expect(link.getAttribute('rel')).toContain('noopener')
  expect(link.getAttribute('rel')).toContain('noreferrer')
})

test('the address is in the bubble, which the app draws under the control', () => {
  render(<LinkOut link="http://192.168.1.4/spanish/easy" title="Spanish" />)
  // data-tip is the app's one tooltip - see TipLayer, which places it below
  // its host and never on it.
  expect(screen.getByRole('link')).toHaveAttribute('data-tip', '192.168.1.4/spanish/easy')
})

test('the name says where it goes as well as what it is', () => {
  render(<LinkOut link="http://localhost:8080/easy" title="Easy lessons" />)
  expect(screen.getByRole('link', { name: 'Open Easy lessons at localhost:8080/easy in a new tab' })).toBeInTheDocument()
})

test('a machine of your own and the open internet get different icons', () => {
  const { container: own } = render(<LinkOut link="http://localhost:8080" title="Home" />)
  const { container: out } = render(<LinkOut link="https://example.com" title="Away" />)
  expect(own.querySelector('.link-out')).toHaveAttribute('data-link-kind', 'own')
  expect(out.querySelector('.link-out')).toHaveAttribute('data-link-kind', 'external')
  // Two drawings, not one drawing in two colours: the shape is what a person
  // reads at 20px, and colour alone is a fact only some people get.
  expect(own.querySelector('svg')?.innerHTML).not.toBe(out.querySelector('svg')?.innerHTML)
})

/**
 * The rule the owner asked for in one line: the link never changes what
 * pressing the card does. It sits inside rows whose own press opens a task,
 * a book or a day, and a control whose meaning depends on where in it the
 * pointer landed is worse than no control.
 */
test('pressing it does not press the card it is sitting in', async () => {
  const user = userEvent.setup()
  const cardPressed = vi.fn()
  render(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div onClick={cardPressed} onPointerDown={cardPressed}>
      <LinkOut link="https://example.com" title="Spanish" />
    </div>,
  )
  await user.click(screen.getByRole('link'))
  expect(cardPressed).not.toHaveBeenCalled()
})
