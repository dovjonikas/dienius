import { afterEach, expect, test } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { WIDE_BREAKPOINT_PX, useIsWide } from './viewport'

type Listener = () => void

function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches
  const listeners = new Set<Listener>()
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return {
    setMatches(next: boolean) {
      matches = next
      listeners.forEach(cb => cb())
    },
    listenerCount: () => listeners.size,
    restore() {
      window.matchMedia = original
    },
  }
}

let mock: ReturnType<typeof installMatchMedia> | undefined

afterEach(() => {
  mock?.restore()
  mock = undefined
})

test('WIDE_BREAKPOINT_PX is 1024, matching docs/LAYOUT-WIDE.md section 5', () => {
  expect(WIDE_BREAKPOINT_PX).toBe(1024)
})

test('reports wide when the breakpoint media query already matches on mount', () => {
  mock = installMatchMedia(true)
  const { result } = renderHook(() => useIsWide())
  expect(result.current).toBe(true)
})

test('reports narrow when the breakpoint media query does not match on mount', () => {
  mock = installMatchMedia(false)
  const { result } = renderHook(() => useIsWide())
  expect(result.current).toBe(false)
})

test('updates live when the media query change event fires, both directions', () => {
  mock = installMatchMedia(false)
  const { result } = renderHook(() => useIsWide())
  expect(result.current).toBe(false)

  act(() => mock!.setMatches(true))
  expect(result.current).toBe(true)

  act(() => mock!.setMatches(false))
  expect(result.current).toBe(false)
})

test('removes its change listener on unmount', () => {
  mock = installMatchMedia(false)
  const { unmount } = renderHook(() => useIsWide())
  expect(mock.listenerCount()).toBe(1)
  unmount()
  expect(mock.listenerCount()).toBe(0)
})

test('falls back to narrow when matchMedia throws or is absent, matching jsdom in this test env', () => {
  // No mock installed - this project's own jsdom setup has no real
  // matchMedia (see App.test.tsx's own comment on systemPrefersDark), so
  // this exercises the actual try/catch guard, not a simulation of it.
  const { result } = renderHook(() => useIsWide())
  expect(result.current).toBe(false)
})

test('does not throw when matchMedia is undefined entirely', () => {
  const original = window.matchMedia
  // @ts-expect-error - deliberately simulating an environment with no
  // matchMedia at all, not just one that throws.
  delete window.matchMedia
  try {
    const { result } = renderHook(() => useIsWide())
    expect(result.current).toBe(false)
  } finally {
    window.matchMedia = original
  }
})
