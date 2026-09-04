import { expect, test } from 'vitest'
import { useRef } from 'react'
import { render, screen } from '@testing-library/react'
import { scrollEdgeClass, useScrollEdges } from './useScrollEdges'

/**
 * What a scroller says about itself.
 *
 * jsdom has no layout, so `scrollHeight` and `clientHeight` are zero on
 * everything and the hook can only be exercised by giving a node real
 * numbers. That is the honest way round: the arithmetic is four comparisons
 * and belongs in a test, while whether the mask looks right belongs in the
 * browser - `npm run sweep` and the shot in the v2.0 polish commit.
 */

function Probe({ scrollTop, clientHeight, scrollHeight }: { scrollTop: number; clientHeight: number; scrollHeight: number }) {
  const ref = useRef<HTMLDivElement>(null)
  if (ref.current) {
    Object.defineProperty(ref.current, 'scrollTop', { value: scrollTop, configurable: true })
    Object.defineProperty(ref.current, 'clientHeight', { value: clientHeight, configurable: true })
    Object.defineProperty(ref.current, 'scrollHeight', { value: scrollHeight, configurable: true })
  }
  const edges = useScrollEdges(ref)
  return (
    <div ref={ref} data-testid="scroller" className={scrollEdgeClass(edges) ?? 'nothing-hidden'}>
      content
    </div>
  )
}

function classOf(props: { scrollTop: number; clientHeight: number; scrollHeight: number }) {
  const { rerender } = render(<Probe {...props} />)
  // Twice: the first render has no node to measure yet, which is the same
  // order a real mount goes in.
  rerender(<Probe {...props} />)
  return screen.getByTestId('scroller').className
}

test('a list that fits says nothing about itself', () => {
  expect(classOf({ scrollTop: 0, clientHeight: 300, scrollHeight: 300 })).toBe('nothing-hidden')
})

test('a list at its top with more below fades only its bottom', () => {
  expect(classOf({ scrollTop: 0, clientHeight: 300, scrollHeight: 500 })).toBe('has-more-below')
})

test('a list scrolled to its end fades only its top', () => {
  expect(classOf({ scrollTop: 200, clientHeight: 300, scrollHeight: 500 })).toBe('has-more-above')
})

test('a list in the middle of itself fades both ends', () => {
  expect(classOf({ scrollTop: 100, clientHeight: 300, scrollHeight: 500 })).toBe('has-more-both')
})

// A scroller sitting at its own bottom can report a fractional remainder on
// a fractional device pixel ratio, and a shade that flickers on and off at
// rest is worse than no shade at all.
test('a fraction of a pixel left over is not content', () => {
  expect(classOf({ scrollTop: 0.4, clientHeight: 300, scrollHeight: 300.6 })).toBe('nothing-hidden')
})
