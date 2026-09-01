import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useLongPress } from './useLongPress'

function Probe({ onLongPress, onClick }: { onLongPress: () => void; onClick: () => void }) {
  const handlers = useLongPress(onLongPress)
  return (
    <button type="button" onClick={onClick} {...handlers}>
      target
    </button>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('holding past the delay fires the long-press callback', () => {
  const onLongPress = vi.fn()
  render(<Probe onLongPress={onLongPress} onClick={() => {}} />)
  fireEvent.pointerDown(screen.getByText('target'), { clientX: 0, clientY: 0 })
  vi.advanceTimersByTime(500)
  expect(onLongPress).toHaveBeenCalledTimes(1)
})

test('releasing before the delay never fires the long-press callback', () => {
  const onLongPress = vi.fn()
  render(<Probe onLongPress={onLongPress} onClick={() => {}} />)
  const target = screen.getByText('target')
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0 })
  vi.advanceTimersByTime(400)
  fireEvent.pointerUp(target)
  vi.advanceTimersByTime(200)
  expect(onLongPress).not.toHaveBeenCalled()
})

test('a normal short tap still fires its own click handler untouched', () => {
  const onLongPress = vi.fn()
  const onClick = vi.fn()
  render(<Probe onLongPress={onLongPress} onClick={onClick} />)
  const target = screen.getByText('target')
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0 })
  fireEvent.pointerUp(target)
  fireEvent.click(target)
  expect(onClick).toHaveBeenCalledTimes(1)
  expect(onLongPress).not.toHaveBeenCalled()
})

test('the click that follows a fired long press is suppressed, not passed to onClick', () => {
  const onLongPress = vi.fn()
  const onClick = vi.fn()
  render(<Probe onLongPress={onLongPress} onClick={onClick} />)
  const target = screen.getByText('target')
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0 })
  vi.advanceTimersByTime(500)
  fireEvent.pointerUp(target)
  fireEvent.click(target)
  expect(onLongPress).toHaveBeenCalledTimes(1)
  expect(onClick).not.toHaveBeenCalled()
})

test('the click after that suppressed one behaves normally again', () => {
  const onLongPress = vi.fn()
  const onClick = vi.fn()
  render(<Probe onLongPress={onLongPress} onClick={onClick} />)
  const target = screen.getByText('target')
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0 })
  vi.advanceTimersByTime(500)
  fireEvent.pointerUp(target)
  fireEvent.click(target)

  fireEvent.pointerDown(target, { clientX: 0, clientY: 0 })
  fireEvent.pointerUp(target)
  fireEvent.click(target)
  expect(onClick).toHaveBeenCalledTimes(1)
})

test('moving the pointer past the threshold before the delay cancels the long press - this is what tells a scroll apart from a hold', () => {
  const onLongPress = vi.fn()
  render(<Probe onLongPress={onLongPress} onClick={() => {}} />)
  const target = screen.getByText('target')
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0 })
  fireEvent.pointerMove(target, { clientX: 0, clientY: 40 })
  vi.advanceTimersByTime(500)
  expect(onLongPress).not.toHaveBeenCalled()
})

test('a small jitter under the threshold does not cancel the long press', () => {
  const onLongPress = vi.fn()
  render(<Probe onLongPress={onLongPress} onClick={() => {}} />)
  const target = screen.getByText('target')
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0 })
  fireEvent.pointerMove(target, { clientX: 2, clientY: 2 })
  vi.advanceTimersByTime(500)
  expect(onLongPress).toHaveBeenCalledTimes(1)
})

test('a pointercancel (the browser hijacking the gesture into a scroll) cancels the long press', () => {
  const onLongPress = vi.fn()
  render(<Probe onLongPress={onLongPress} onClick={() => {}} />)
  const target = screen.getByText('target')
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0 })
  fireEvent.pointerCancel(target)
  vi.advanceTimersByTime(500)
  expect(onLongPress).not.toHaveBeenCalled()
})

test('a second, unrelated tap after a cancelled long press still works normally', () => {
  const onLongPress = vi.fn()
  const onClick = vi.fn()
  render(<Probe onLongPress={onLongPress} onClick={onClick} />)
  const target = screen.getByText('target')
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0 })
  fireEvent.pointerCancel(target)
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0 })
  fireEvent.pointerUp(target)
  fireEvent.click(target)
  expect(onClick).toHaveBeenCalledTimes(1)
})
