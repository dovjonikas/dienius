import { useEffect, useState } from 'react'

/**
 * The wide-layout breakpoint - docs/LAYOUT-WIDE.md section 5. Below this,
 * the day view is the same single column it has always been; at or above
 * it, DayView.tsx switches to the rail/day-pane/task-pane layout. Judgment,
 * not a measurement of any one screen - see the doc for the arithmetic
 * (rail + day pane + task pane + gaps + padding) that landed on this
 * number.
 */
export const WIDE_BREAKPOINT_PX = 1024

function mediaQuery(): string {
  return `(min-width: ${WIDE_BREAKPOINT_PX}px)`
}

// matchMedia can throw or be absent in the same odd environments
// systemPrefersDark() already guards against (see useSystemPrefersDark.ts) -
// jsdom in this project's own test setup is one of them. A viewport that
// cannot be measured is treated as narrow, the same safe default the phone
// layout already assumes.
function isWideNow(): boolean {
  try {
    return window.matchMedia(mediaQuery()).matches
  } catch {
    return false
  }
}

/**
 * Whether the viewport is at or above the wide-layout breakpoint, live -
 * the same matchMedia-plus-listener shape App.tsx's own system-theme
 * watcher uses (and useSystemPrefersDark.ts mirrors), including the
 * try/catch guard. This is a device fact, not a stored preference: nothing
 * about the result is ever written to settings, and resizing across the
 * breakpoint changes only which markup is mounted, never any persisted
 * choice - see docs/LAYOUT-WIDE.md section 5 on `timelineExpanded` staying
 * untouched by viewport width.
 */
/**
 * Whether the primary pointer is a finger, live. The 44px floors on the
 * timeline's gaps and unsized anchors are touch targets - a thumb has to
 * land on them - and on a mouse they are only height: a nine-block day
 * with eight short gaps between the blocks spent 350px on targets nobody
 * would ever miss, and that was the difference between fitting a 900px
 * window and scrolling. Unmeasurable is treated as coarse, because the
 * wrong answer on a phone is a target too small to hit and the wrong
 * answer on a desktop is a little air.
 */
export function usePointerCoarse(): boolean {
  const [coarse, setCoarse] = useState(isCoarseNow)

  useEffect(() => {
    try {
      const query = window.matchMedia(COARSE_QUERY)
      const update = () => setCoarse(query.matches)
      update()
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    } catch {
      return undefined
    }
  }, [])

  return coarse
}

const COARSE_QUERY = '(pointer: coarse)'

function isCoarseNow(): boolean {
  try {
    return window.matchMedia(COARSE_QUERY).matches
  } catch {
    return true
  }
}

export function useIsWide(): boolean {
  const [wide, setWide] = useState(isWideNow)

  useEffect(() => {
    try {
      const query = window.matchMedia(mediaQuery())
      const update = () => setWide(query.matches)
      update()
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    } catch {
      return undefined
    }
  }, [])

  return wide
}

/**
 * A viewport short enough that a month cell holds two lines rather than
 * three - the height at which a 1366x768 laptop lands, which is the smallest
 * screen the zero-scroll rule names.
 *
 * The number is a fact about the month grid: six rows plus a header plus the
 * stamp bar plus the shell's own chrome, divided into whatever is left, comes
 * out around 97px a cell on a 768px screen and around 130px on a 1080px one.
 * Three 13px lines and a day number need the second of those.
 */
export const TALL_VIEWPORT_PX = 820

const TALL_QUERY = `(min-height: ${TALL_VIEWPORT_PX}px)`

function isTallNow(): boolean {
  try {
    return window.matchMedia(TALL_QUERY).matches
  } catch {
    return false
  }
}

/**
 * How many of a day's tasks a month cell names.
 *
 * In JavaScript rather than in the stylesheet, and that is the whole point:
 * the cell also says how many did *not* fit, and a line hidden by CSS is a
 * line the "+2" beside it has already counted. Two lines and "+2" over a day
 * with five things on it is the cell lying about the one number it is there
 * to be honest about.
 */
export function useCellLines(): number {
  const [tall, setTall] = useState(isTallNow)

  useEffect(() => {
    try {
      const query = window.matchMedia(TALL_QUERY)
      const update = () => setTall(query.matches)
      update()
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    } catch {
      return undefined
    }
  }, [])

  return tall ? 3 : 2
}
