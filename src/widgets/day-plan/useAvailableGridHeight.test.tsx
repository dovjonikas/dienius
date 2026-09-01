import { afterEach, expect, test, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { useAvailableGridHeight } from './useAvailableGridHeight'

const ORIGINAL_INNER_HEIGHT = window.innerHeight

afterEach(() => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: ORIGINAL_INNER_HEIGHT })
  vi.restoreAllMocks()
})

function setInnerHeight(value: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value })
}

function setTop(el: HTMLElement, top: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: top,
    toJSON: () => ({}),
  } as DOMRect)
}

// A harness that renders the hook against a real element ref, since the
// hook needs an actual mounted DOM node to measure - renderHook's own
// element has nothing attached to a ref unless the test wires one up.
function Harness({ enabled, onHeight }: { enabled: boolean; onHeight: (h: number | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const height = useAvailableGridHeight(ref, enabled)
  onHeight(height)
  return <div ref={ref} data-testid="measured" />
}

test('returns null while disabled, and never measures anything', () => {
  setInnerHeight(1000)
  const heights: (number | null)[] = []
  const { getByTestId } = render(<Harness enabled={false} onHeight={h => heights.push(h)} />)
  setTop(getByTestId('measured'), 100)
  expect(heights[heights.length - 1]).toBeNull()
})

test('measures window.innerHeight minus the element\'s own top minus the fixed bottom margin, once enabled', () => {
  setInnerHeight(1000)
  let latest: number | null = null
  function Wrapped() {
    const ref = useRef<HTMLDivElement>(null)
    const height = useAvailableGridHeight(ref, true)
    latest = height
    return <div ref={ref} style={{ top: 0 }} />
  }
  render(<Wrapped />)
  // jsdom's own getBoundingClientRect always reports 0 - top is 0 here, so
  // the result is innerHeight minus only the fixed bottom margin.
  expect(latest).toBe(1000 - 24)
})

test('re-measures on a window resize event while enabled', () => {
  setInnerHeight(1000)
  let latest: number | null = null
  function Wrapped() {
    const ref = useRef<HTMLDivElement>(null)
    const height = useAvailableGridHeight(ref, true)
    latest = height
    return <div ref={ref} />
  }
  render(<Wrapped />)
  expect(latest).toBe(1000 - 24)

  act(() => {
    setInnerHeight(1500)
    window.dispatchEvent(new Event('resize'))
  })
  expect(latest).toBe(1500 - 24)
})

test('stops listening for resize once disabled, and reports null again', () => {
  setInnerHeight(1000)
  let latest: number | null = null
  function Wrapped({ enabled }: { enabled: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const height = useAvailableGridHeight(ref, enabled)
    latest = height
    return <div ref={ref} />
  }
  const { rerender } = render(<Wrapped enabled />)
  expect(latest).toBe(1000 - 24)

  rerender(<Wrapped enabled={false} />)
  expect(latest).toBeNull()

  act(() => {
    setInnerHeight(2000)
    window.dispatchEvent(new Event('resize'))
  })
  // Disabled - a resize event must not revive a measurement.
  expect(latest).toBeNull()
})

test('removes its resize listener on unmount', () => {
  setInnerHeight(1000)
  const addSpy = vi.spyOn(window, 'addEventListener')
  const removeSpy = vi.spyOn(window, 'removeEventListener')
  function Wrapped() {
    const ref = useRef<HTMLDivElement>(null)
    useAvailableGridHeight(ref, true)
    return <div ref={ref} />
  }
  const { unmount } = render(<Wrapped />)
  const resizeAdds = addSpy.mock.calls.filter(c => c[0] === 'resize').length
  expect(resizeAdds).toBeGreaterThan(0)
  unmount()
  const resizeRemoves = removeSpy.mock.calls.filter(c => c[0] === 'resize').length
  expect(resizeRemoves).toBe(resizeAdds)
})
