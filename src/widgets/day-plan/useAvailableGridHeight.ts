import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Space reserved below the grid's own bottom edge at the wide breakpoint,
 * so a stretched grid never touches the browser viewport's own bottom
 * edge. Matches the 24px column gap `docs/LAYOUT-WIDE.md` section 5
 * already chose for the space between the day pane and its neighbours -
 * reused here rather than inventing a second spacing constant, so the air
 * below the grid reads as the same amount of breathing room as the air
 * beside it. Judgment, not a measurement of any one screen.
 */
const WIDE_BOTTOM_MARGIN_PX = 24

/**
 * How much vertical room is actually left, from `ref`'s own top edge down
 * to the bottom of the browser's viewport - the number `chooseWidePxPerMinute`
 * (`timelineLayout.ts`) turns into a drawing density. Returns `null` while
 * `enabled` is false (the phone never measures anything - see the report
 * this exists for) and, briefly, before the very first layout pass has run.
 *
 * `ref`'s own top edge, measured from the top of the *document* rather than
 * of the viewport. Everything that can move it - the capacity line's
 * height, whether the if-then rule renders - lives entirely above the grid
 * in `DayView.tsx`'s own markup, never below it and never inside the grid
 * itself, so nothing about the grid's own eventual height feeds back into
 * this measurement. A `useLayoutEffect` with no dependency array
 * re-measures after every render for exactly that reason - a re-render
 * already means something above the grid may have changed - and bails out
 * of scheduling a further one the moment the rounded result stops
 * changing, so this converges rather than looping.
 *
 * The viewport-relative top was not safe, and finding out cost a locked
 * renderer. It changes with the page's scroll position, and the scroll
 * position depends on the document's height, which depends on the grid's
 * height, which depends on this number: with the page scrolled down when
 * the day view mounted - the tour had just scrolled Settings to a button
 * and then switched tabs - the grid measured a negative top, claimed the
 * room it would have had a screen higher, grew, pushed the document
 * taller, moved under the scroll that was settling back, re-measured,
 * grew again. Fifty re-layouts of a full day later the tab was gone. The
 * document-relative top has no path back from the grid's own height.
 *
 * `window.innerHeight` plus `getBoundingClientRect`, not a `ResizeObserver`:
 * every case that can change how much room is available - the window
 * itself growing or shrinking, or something above the grid changing height
 * because of a prop-driven re-render - is already covered by the render-
 * triggered remeasurement above plus a plain `resize` listener for the one
 * case that is not prop-driven. `ResizeObserver` would catch the same cases
 * through a second mechanism for no real gain, and is not polyfilled in
 * this project's own jsdom test setup - see `viewport.ts`'s own guard
 * around `matchMedia` for the same reasoning applied to a different API
 * that this environment does not always have either.
 */
export function useAvailableGridHeight(ref: RefObject<HTMLElement | null>, enabled: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null)

  function measure() {
    if (!enabled) {
      setHeight(prev => (prev === null ? prev : null))
      return
    }
    const el = ref.current
    if (!el) return
    try {
      const top = el.getBoundingClientRect().top + window.scrollY
      const available = Math.max(0, Math.round(window.innerHeight - top - WIDE_BOTTOM_MARGIN_PX))
      setHeight(prev => (prev === available ? prev : available))
    } catch {
      setHeight(prev => (prev === null ? prev : null))
    }
  }

  useLayoutEffect(measure)

  useLayoutEffect(() => {
    if (!enabled) return
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return height
}
