import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NavRail, NAV_ITEMS, SETTINGS_ITEM } from './NavRail'
import { SHORTCUTS } from '../lib/shortcuts'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.railPinned
})

function renderRail(props: Partial<React.ComponentProps<typeof NavRail>> = {}) {
  const onNavigate = vi.fn()
  const onOpenScratch = vi.fn()
  const view = render(
    <NavRail
      view="day"
      isWide
      scratchOpen={false}
      onNavigate={onNavigate}
      onOpenScratch={onOpenScratch}
      {...props}
    />,
  )
  return { ...view, onNavigate, onOpenScratch }
}

/**
 * The rail replaced seven text tabs across the top of every screen. What has
 * to survive that is not the look of it: it is that every view still has a
 * control somebody can see, on both platforms, and that the control says
 * which key does the same thing - CONVENTIONS sections 17 and 18.
 */

test('every view has a visible control, named, with its key in the tooltip', () => {
  renderRail()
  const nav = screen.getByRole('navigation', { name: 'Views' })

  for (const item of [...NAV_ITEMS, SETTINGS_ITEM]) {
    const button = within(nav).getByRole('button', { name: item.label })
    expect(button, item.label).toHaveAttribute('title', `${item.label} - ${item.key === ',' ? 'comma' : item.key}`)
  }
})

/**
 * The tooltip is where a shortcut is actually learned - on the control it
 * belongs to, at the moment somebody is already reaching for it. That only
 * works while the two agree, and there is nothing in a string that stops it
 * drifting from the handler, so this is the thing that stops it.
 */
test('the key each item names is the key that actually reaches it', () => {
  for (const item of [...NAV_ITEMS, SETTINGS_ITEM]) {
    const shortcut = SHORTCUTS.find(s => s.key === item.key)
    expect(shortcut, `no shortcut for ${item.label}`).toBeTruthy()
    expect(shortcut!.description.toLowerCase(), item.label).toContain(item.label.toLowerCase())
  }
})

test('pressing an item asks the shell for that view', async () => {
  const user = userEvent.setup()
  const { onNavigate } = renderRail()
  await user.click(screen.getByRole('button', { name: 'North' }))
  expect(onNavigate).toHaveBeenCalledWith('north')
})

test('the view you are on carries the mark, and nothing else does', () => {
  renderRail({ view: 'review' })
  expect(screen.getByRole('button', { name: 'Review' })).toHaveAttribute('aria-current', 'page')
  for (const label of ['Today', 'Calendar', 'North', 'Settings']) {
    expect(screen.getByRole('button', { name: label }), label).not.toHaveAttribute('aria-current')
  }
})

// Scratch is a layer over whatever is showing rather than a seventh view, so
// it never claims to be the page you are on - it only shows as pressed.
test('Scratch is lit while it is open but never marked as the current view', () => {
  renderRail({ scratchOpen: true })
  const pen = screen.getByRole('button', { name: 'Scratch' })
  expect(pen).toHaveClass('is-active')
  expect(pen).not.toHaveAttribute('aria-current')
})

/**
 * The rail opens two ways and only one of them moves the page. Hovering draws
 * the open rail over the content; pinning reserves the column, and that is
 * why the pinned state is on the root element where the layout can read it.
 */
test('a mouse resting on it opens it, and leaving puts it back', async () => {
  const user = userEvent.setup()
  const { container } = renderRail()
  const rail = container.querySelector('.nav-rail')!

  await user.hover(rail)
  expect(rail).toHaveClass('is-open')
  await user.unhover(rail)
  expect(rail).not.toHaveClass('is-open')
})

// A finger arriving at the rail is a finger on its way to pressing something
// in it, and widening under it would move the target out from under the press.
test('a touch arriving at it does not widen it', () => {
  const { container } = renderRail()
  const rail = container.querySelector('.nav-rail')!
  rail.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' }))
  expect(rail).not.toHaveClass('is-open')
})

test('the pin holds it open, is remembered, and tells the layout to reserve the column', async () => {
  const user = userEvent.setup()
  const { container, unmount } = renderRail()
  const rail = container.querySelector('.nav-rail')!

  await user.click(screen.getByRole('button', { name: 'Keep the sidebar open' }))
  expect(rail).toHaveClass('is-open')
  expect(document.documentElement.dataset.railPinned).toBe('true')

  unmount()
  renderRail()
  expect(screen.getByRole('button', { name: 'Unpin the sidebar' })).toHaveAttribute('aria-pressed', 'true')
})

/**
 * On a phone it is a bar along the bottom, and there is no column to reserve
 * whatever the pin says - the flag drives a padding on the layout, and a
 * phone that reserved 176px down its left side would have 214px of screen
 * left to plan a day in.
 */
test('a pinned rail reserves nothing once it is a bar along the bottom', async () => {
  const user = userEvent.setup()
  const { unmount } = renderRail()
  await user.click(screen.getByRole('button', { name: 'Keep the sidebar open' }))
  unmount()

  renderRail({ isWide: false })
  expect(document.documentElement.dataset.railPinned).toBeUndefined()
})

test('there is no pin to press on a phone - the bar has no other width', () => {
  renderRail({ isWide: false })
  expect(screen.queryByRole('button', { name: /sidebar/ })).toBeNull()
})

// A keyboard cannot hover, and a tab stop on an unlabelled square is the
// worst of both.
test('reaching it with a keyboard shows the labels too', async () => {
  const user = userEvent.setup()
  const { container } = renderRail()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Today' })).toHaveFocus()
  expect(container.querySelector('.nav-rail')).toHaveClass('is-open')
})
