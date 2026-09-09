import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { isRinging, resetRingingForTests, startRinging, stopRinging } from './ringing'
import type { ChimeHandle } from './chime'

/**
 * The five ways out of a sound meet here - see ringing.ts. What this checks
 * is the one rule underneath all five: at most one sound is ever tracked,
 * and a sound that cannot go on forever is not tracked at all.
 */

function handle(repeats: boolean): ChimeHandle & { stopped: number } {
  const h = { repeats, stopped: 0, stop: () => void (h.stopped += 1) }
  return h
}

beforeEach(() => resetRingingForTests())
afterEach(() => vi.restoreAllMocks())

test('nothing is ringing until something repeating starts', () => {
  expect(isRinging()).toBe(false)
  startRinging(handle(false))
  // A chime that is over in half a second needs no way out drawn for it.
  expect(isRinging()).toBe(false)
  startRinging(handle(true))
  expect(isRinging()).toBe(true)
})

test('a second sound stops the first rather than playing over it', () => {
  const first = handle(true)
  startRinging(first)
  startRinging(handle(true))
  expect(first.stopped).toBe(1)
  expect(isRinging()).toBe(true)
})

test('a one-shot sound still silences whatever was going', () => {
  const alarm = handle(true)
  startRinging(alarm)
  // Starting another timer with a soft chime has to end the old alarm too.
  startRinging(handle(false))
  expect(alarm.stopped).toBe(1)
  expect(isRinging()).toBe(false)
})

test('stopping is safe twice and leaves nothing ringing', () => {
  const alarm = handle(true)
  startRinging(alarm)
  stopRinging()
  stopRinging()
  expect(alarm.stopped).toBe(1)
  expect(isRinging()).toBe(false)
})
