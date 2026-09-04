import { useLayoutEffect, useState, type RefObject } from 'react'

/** Where a scroller is: whether anything is above the visible box, or below it. */
export interface ScrollEdges {
  above: boolean
  below: boolean
}

/**
 * Whether a scrolling box has content out of sight above or below it.
 *
 * It exists because a list that scrolls and does not say so is a list that
 * ends, as far as anybody looking at it is concerned. On Windows Chrome a
 * `scrollbar-width: thin` scroller draws nothing at all until the pointer is
 * over it, so on the evening of a full day the task column showed four cards
 * of seven with no mark of any kind that the other three were there.
 *
 * The first attempt at saying so was pure CSS - the classic pair of gradients
 * with `background-attachment: local` and `scroll`, which needs no JavaScript
 * and is the right answer for a scroller whose children are transparent.
 * These children are not: a task card paints `--surface` edge to edge, so the
 * shades sat behind the cards and showed only in the eight pixels between
 * them. What fades opaque children is a mask, and a mask cannot be told to
 * appear only while there is something to fade - hence this.
 *
 * Measured in a layout effect after every render, because the thing that
 * changes it is almost always a render: a task ticked, a card added, the
 * column resized by a notice appearing above it. Plus a scroll listener,
 * which is the one case no render accompanies. It reads two numbers and sets
 * two booleans; nothing here writes to layout, so it cannot feed back into
 * itself the way `useAvailableGridHeight` once did.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({ above: false, below: false })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    function measure() {
      const node = ref.current
      if (!node) return
      // A pixel of slack at each end: a scroller sitting at its own bottom
      // can report a fractional remainder on a fractional device pixel
      // ratio, and a shade that flickers on and off at rest is worse than
      // no shade at all.
      const above = node.scrollTop > 1
      const below = node.scrollTop + node.clientHeight < node.scrollHeight - 1
      setEdges(prev => (prev.above === above && prev.below === below ? prev : { above, below }))
    }

    measure()
    el.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      el.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  })

  return edges
}

/**
 * The class name a scroller wears for what is out of sight, or undefined when
 * nothing is. Kept beside the hook so the two names are decided in one place
 * and the stylesheet has exactly two selectors to match.
 */
export function scrollEdgeClass({ above, below }: ScrollEdges): string | undefined {
  if (above && below) return 'has-more-both'
  if (above) return 'has-more-above'
  if (below) return 'has-more-below'
  return undefined
}
