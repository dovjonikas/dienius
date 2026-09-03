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
