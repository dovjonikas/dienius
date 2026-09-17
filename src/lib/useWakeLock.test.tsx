import { afterEach, expect, test, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useWakeLock } from './useWakeLock'

/**
 * Cook keeps the screen awake through the Screen Wake Lock API where the
 * browser has it, and says nothing and breaks nothing where it does not. A
 * lock is let go when the page goes out of view, so it is asked for again
 * when the page comes back, and released when Cook closes.
 */

function Holder({ active }: { active: boolean }) {
  useWakeLock(active)
  return null
}

type Sentinel = { release: ReturnType<typeof vi.fn> }

/** A wake lock the page can ask for, remembering every lock it handed out. */
function fakeWakeLock(reject = false) {
  const handed: Sentinel[] = []
  const request = vi.fn((type: string) => {
    if (reject || type !== 'screen') return Promise.reject(new Error('NotAllowedError'))
    const sentinel = { release: vi.fn(() => Promise.resolve()) }
    handed.push(sentinel)
    return Promise.resolve(sentinel)
  })
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
  return { request, handed }
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  delete (navigator as { wakeLock?: unknown }).wakeLock
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

test('while it is on, the screen is kept awake, asked again when the page comes back into view, and let go when it ends', async () => {
  const { request, handed } = fakeWakeLock()
  const { rerender, unmount } = render(<Holder active />)
  await act(async () => {})
  expect(request).toHaveBeenCalledWith('screen')
  expect(handed).toHaveLength(1)

  setVisibility('hidden')
  setVisibility('visible')
  await act(async () => {})
  expect(request).toHaveBeenCalledTimes(2)

  rerender(<Holder active={false} />)
  await act(async () => {})
  expect(handed.every(lock => lock.release.mock.calls.length > 0)).toBe(true)
  unmount()
})

test('off, nothing is asked for', async () => {
  const { request } = fakeWakeLock()
  render(<Holder active={false} />)
  await act(async () => {})
  expect(request).not.toHaveBeenCalled()
})

test('a browser without the API, or one that refuses, is simply not kept awake - no error', async () => {
  expect('wakeLock' in navigator).toBe(false)
  const quiet = render(<Holder active />)
  await act(async () => {})
  quiet.unmount()

  const { request } = fakeWakeLock(true)
  const refused = render(<Holder active />)
  await act(async () => {})
  expect(request).toHaveBeenCalled()
  refused.unmount()
})
