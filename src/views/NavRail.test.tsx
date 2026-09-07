import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NavRail, NAV_ITEMS, SETTINGS_ITEM } from './NavRail'
import { SHORTCUTS } from '../lib/shortcuts'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.railPinned
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * A mouse event as a browser would deliver it, with a place. React derives
 * enter and leave from over and out, so those are the two that are sent.
 */
function mouse(target: Element, type: string, init: PointerEventInit = {}) {
  act(() => {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', ...init }))
  })
}

/** A mouse coming in at the rail's edge and moving a little, then the dwell. */
function arriveAndMove(rail: Element) {
  mouse(rail, 'pointerover', { clientX: 12, clientY: 300 })
  mouse(rail, 'pointermove', { clientX: 20, clientY: 310 })
}

function renderRail(props: Partial<React.ComponentProps<typeof NavRail>> = {}) {
  const onNavigate = vi.fn()

  const view = render(
    <NavRail
      view="day"
      isWide
      onNavigate={onNavigate}
      {...props}
    />,
  )
  return { ...view, onNavigate }
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

// The pen stood here for two versions, because Scratch had no visible way
// in on a desktop. It has one in the header now, beside the journal, so the
// rail is the six views and the two things under them and nothing else.
test('the rail is the six views, Settings and the pin - no pen among them', () => {
  renderRail()
  expect(screen.queryByRole('button', { name: 'Scratch' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
})

/**
 * The rail opens on intent and on nothing else - DECISIONS, "The rail opens
 * on intent only". The owner watched it open by itself every time another
 * window took the focus and gave it back: the browser re-fires focus on the
 * item last pressed, and a focus used to mean a keyboard had reached the
 * rail. A boundary event under a cursor that has not moved is the same
 * shape of false signal. So a pointer has to come in and move, and be there
 * 150ms later; a Tab has to be the thing that brought the focus; and the
 * window changing hands opens nothing. Hovering still draws the open rail
 * over the content and only pinning reserves the column, which is why the
 * pinned state is on the root element where the layout can read it.
 */
test('a mouse that comes in and moves opens it after the dwell, and leaving puts it back', () => {
  vi.useFakeTimers()
  const { container } = renderRail()
  const rail = container.querySelector('.nav-rail')!

  arriveAndMove(rail)
  act(() => {
    vi.advanceTimersByTime(140)
  })
  expect(rail, 'before the dwell').not.toHaveClass('is-open')
  act(() => {
    vi.advanceTimersByTime(10)
  })
  expect(rail, 'after the dwell').toHaveClass('is-open')

  mouse(rail, 'pointerout', { relatedTarget: document.body })
  expect(rail).not.toHaveClass('is-open')
})

test('a mouse that arrives and stays still never opens it', () => {
  vi.useFakeTimers()
  const { container } = renderRail()
  const rail = container.querySelector('.nav-rail')!

  mouse(rail, 'pointerover', { clientX: 12, clientY: 300 })
  // The browser's own idea of a move under a cursor that has not gone
  // anywhere: the same place again.
  mouse(rail, 'pointermove', { clientX: 12, clientY: 300 })
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  expect(rail).not.toHaveClass('is-open')
})

test('a mouse crossing it on the way somewhere else never opens it', () => {
  vi.useFakeTimers()
  const { container } = renderRail()
  const rail = container.querySelector('.nav-rail')!

  arriveAndMove(rail)
  act(() => {
    vi.advanceTimersByTime(100)
  })
  mouse(rail, 'pointerout', { relatedTarget: document.body })
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  expect(rail).not.toHaveClass('is-open')
})

test('the window coming back does not open it, even with focus on the item last pressed', async () => {
  const user = userEvent.setup()
  const { container } = renderRail()
  const rail = container.querySelector('.nav-rail')!
  const calendar = screen.getByRole('button', { name: 'Calendar' })

  await user.click(calendar)
  expect(calendar).toHaveFocus()
  await user.unhover(rail)
  expect(rail).not.toHaveClass('is-open')

  // What a browser does when another window takes the focus and gives it
  // back: blur on the active element, then focus on it again, no key pressed.
  fireEvent.blur(calendar)
  fireEvent.focus(calendar)
  expect(rail).not.toHaveClass('is-open')
})

test('the window losing focus closes it, and getting it back does not reopen it', () => {
  vi.useFakeTimers()
  const { container } = renderRail()
  const rail = container.querySelector('.nav-rail')!

  arriveAndMove(rail)
  act(() => {
    vi.advanceTimersByTime(150)
  })
  expect(rail).toHaveClass('is-open')

  act(() => {
    window.dispatchEvent(new Event('blur'))
  })
  expect(rail).not.toHaveClass('is-open')

  // The cursor is still over the rail's edge when the window returns, and
  // the browser says so again without it having moved.
  act(() => {
    window.dispatchEvent(new Event('focus'))
  })
  mouse(rail, 'pointerover', { clientX: 20, clientY: 310 })
  mouse(rail, 'pointermove', { clientX: 20, clientY: 310 })
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  expect(rail).not.toHaveClass('is-open')
})

// Escape on an overlay hands focus back to whatever opened it, and where
// that is a rail button the rail must not read it as somebody arriving.
// That is a sheet closing, not a reach for the navigation.
test('focus handed back to a rail button after Escape does not open it', () => {
  const { container } = renderRail()
  const rail = container.querySelector('.nav-rail')!
  const settings = screen.getByRole('button', { name: 'Settings' })

  fireEvent.keyDown(document.body, { key: 'Escape' })
  fireEvent.keyUp(document.body, { key: 'Escape' })
  fireEvent.focus(settings)
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
