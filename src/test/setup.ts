import '@testing-library/jest-dom/vitest'

/**
 * jsdom has no layout, and two of the things this app does about layout are
 * calls it simply does not implement. Both are no-ops that cannot be observed
 * from a test - jsdom would not scroll or resize anything anyway - so they are
 * stubbed here rather than guarded at every call site, where a `?.` around a
 * real browser API reads as if the API might be missing in a browser too.
 *
 * `scrollIntoView` is called by the command palette (keeping the selected row
 * in view) and by the tour (bringing a target on screen before measuring it).
 * `ResizeObserver` is what the tour watches its target with.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

/**
 * A state update outside act() fails the test it happened in.
 *
 * React says so on console.error, and the runner's default reporter keeps a
 * passing test's console to itself - so forty-seven of these had piled up
 * unseen by v2.21, each a render nobody had waited for, and a real one (a
 * component updating after its test was over, which is a leak) would have
 * been the forty-eighth line nobody read. They were cleared one by one, and
 * this is what keeps the count at zero: the warning is caught here and
 * raised again when the test ends, where it fails in red rather than
 * scrolling past in grey.
 */
const NOT_IN_ACT = 'not wrapped in act('
let updatesOutsideAct: string[] = []
const consoleError = console.error
console.error = (...args: unknown[]) => {
  const first = typeof args[0] === 'string' ? args[0] : ''
  if (first.includes(NOT_IN_ACT)) updatesOutsideAct.push(first.split('\n')[0])
  consoleError(...args)
}
beforeEach(() => {
  updatesOutsideAct = []
})
afterEach(() => {
  if (updatesOutsideAct.length === 0) return
  const seen = updatesOutsideAct
  updatesOutsideAct = []
  throw new Error(`${seen.length} state update(s) outside act() during this test:\n  ${seen.join('\n  ')}`)
})
