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
