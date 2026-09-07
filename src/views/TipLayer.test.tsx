import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { TIP_DELAY, TipLayer } from './TipLayer'

/**
 * The one tooltip, and the three things it promises.
 *
 * A mouse resting on a control gets its words after a moment and loses them
 * on leaving; a keyboard arriving gets them at once; and the words are read
 * off the control when they are due, not when the pointer arrived, so a
 * control that stopped carrying them in between shows nothing. The layout
 * itself - under the control, never on it - is a stylesheet fact jsdom
 * cannot see and the desktop walk holds.
 */

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function Host({ tip }: { tip?: string }) {
  return (
    <>
      <TipLayer />
      <button type="button" data-tip={tip} aria-label="Leave focus">
        x
      </button>
    </>
  )
}

test('a mouse resting on a control gets its words after a moment, and loses them on leaving', () => {
  render(<Host tip="Leave focus" />)
  const button = screen.getByRole('button', { name: 'Leave focus' })

  fireEvent.pointerOver(button, { pointerType: 'mouse' })
  expect(screen.queryByRole('tooltip')).toBeNull()
  act(() => {
    vi.advanceTimersByTime(TIP_DELAY)
  })
  expect(screen.getByRole('tooltip')).toHaveTextContent('Leave focus')

  fireEvent.pointerOut(button, { pointerType: 'mouse', relatedTarget: document.body })
  expect(screen.queryByRole('tooltip')).toBeNull()
})

test('a finger gets nothing: a tap is the control, not a question about it', () => {
  render(<Host tip="Leave focus" />)
  fireEvent.pointerOver(screen.getByRole('button'), { pointerType: 'touch' })
  act(() => {
    vi.advanceTimersByTime(TIP_DELAY)
  })
  expect(screen.queryByRole('tooltip')).toBeNull()
})

test('a keyboard arriving gets the words at once, and Escape puts them away', () => {
  render(<Host tip="Leave focus" />)
  const button = screen.getByRole('button')
  fireEvent.keyDown(document.body, { key: 'Tab' })
  fireEvent.focusIn(button)
  expect(screen.getByRole('tooltip')).toHaveTextContent('Leave focus')

  fireEvent.keyDown(button, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).toBeNull()
})

test('a focus that came from a press shows nothing - the press was the point', () => {
  render(<Host tip="Leave focus" />)
  const button = screen.getByRole('button')
  fireEvent.pointerDown(button, { pointerType: 'mouse' })
  fireEvent.focusIn(button)
  expect(screen.queryByRole('tooltip')).toBeNull()
})

test('the words are read when they are due, so a control that dropped them in between shows nothing', () => {
  const { rerender } = render(<Host tip="Templates · 3" />)
  const button = screen.getByRole('button')
  fireEvent.pointerOver(button, { pointerType: 'mouse' })
  // The rail opened its labels while the pointer rested.
  rerender(<Host />)
  act(() => {
    vi.advanceTimersByTime(TIP_DELAY)
  })
  expect(screen.queryByRole('tooltip')).toBeNull()
})
