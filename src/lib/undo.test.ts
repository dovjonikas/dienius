import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { UNDO_MS, dismissUndo, getUndo, offerUndo, resetUndoForTests, runUndo, subscribeUndo } from './undo'

beforeEach(() => {
  resetUndoForTests()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('nothing is armed until something arms it', () => {
  expect(getUndo()).toBeNull()
})

test('an offer holds its label and its restore until it is run', () => {
  const restore = vi.fn()
  offerUndo('Groceries deleted', restore)
  expect(getUndo()?.label).toBe('Groceries deleted')
  expect(restore).not.toHaveBeenCalled()

  runUndo()
  expect(restore).toHaveBeenCalledTimes(1)
  expect(getUndo()).toBeNull()
})

test('an offer expires on its own rather than waiting to be closed', () => {
  const restore = vi.fn()
  offerUndo('Something', restore)
  vi.advanceTimersByTime(UNDO_MS + 1)
  expect(getUndo()).toBeNull()
  expect(restore).not.toHaveBeenCalled()
})

// The newest mistake is the one somebody is looking at. Stacking two bars
// would cover the thing they just changed.
test('a second offer replaces the first, and the first never runs', () => {
  const first = vi.fn()
  const second = vi.fn()
  offerUndo('First', first)
  offerUndo('Second', second)
  expect(getUndo()?.label).toBe('Second')

  runUndo()
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
})

// A replaced offer's timer has to go with it, or the second offer vanishes
// early - at whatever was left of the first one's five seconds.
test('replacing an offer restarts the countdown rather than inheriting it', () => {
  offerUndo('First', vi.fn())
  vi.advanceTimersByTime(UNDO_MS - 100)
  offerUndo('Second', vi.fn())
  vi.advanceTimersByTime(200)
  expect(getUndo()?.label).toBe('Second')
})

test('dismissing clears the offer without running it', () => {
  const restore = vi.fn()
  offerUndo('Something', restore)
  dismissUndo()
  expect(getUndo()).toBeNull()
  expect(restore).not.toHaveBeenCalled()
})

test('running with nothing armed does nothing rather than throwing', () => {
  expect(() => runUndo()).not.toThrow()
})

test('subscribers hear an offer arrive, expire and be dismissed', () => {
  const heard = vi.fn()
  const unsubscribe = subscribeUndo(heard)

  offerUndo('One', vi.fn())
  expect(heard).toHaveBeenCalledTimes(1)

  vi.advanceTimersByTime(UNDO_MS + 1)
  expect(heard).toHaveBeenCalledTimes(2)

  offerUndo('Two', vi.fn())
  dismissUndo()
  expect(heard).toHaveBeenCalledTimes(4)

  unsubscribe()
  offerUndo('Three', vi.fn())
  expect(heard).toHaveBeenCalledTimes(4)
})
