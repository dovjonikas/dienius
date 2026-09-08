/**
 * Where the day card goes, given the cell it belongs to.
 *
 * A pure function and its own module for the reason every other piece of
 * geometry in this codebase is: jsdom has no layout, so this cannot be
 * tested through the component.
 *
 * Not `views/tour/cardPlacement.ts`, which answers a question that looks the
 * same and is not. That one keeps a card *off* the hole it points at, with
 * twelve pixels of air, clamped to the window; this one has to do the
 * opposite of the first two and use different bounds for the third:
 *
 * - **It touches its cell.** The gap is what killed the hover preview: a
 *   card the pointer had to cross open ground to reach was a card that
 *   closed on the way. Under the cell means the card's top edge is the
 *   cell's bottom edge, and nothing in between.
 * - **It never leaves the grid.** The window is not the bound - a card
 *   hanging past the last row into the stamp bar reads as belonging to
 *   nothing. The month's own square is the surface it lives on.
 * - **Except where the grid is smaller than the card**, which is a phone:
 *   358 by 284 pixels of month cannot hold a day. There the window is the
 *   bound on that axis, because "inside the grid" is how a card is kept
 *   reachable and a card past the bottom of the screen is not reachable at
 *   all - which is the whole failing this replaced.
 * - **And when there is no room anywhere, it covers its own cell.** The
 *   clamp is the last word, because the one thing on screen the card is
 *   allowed to hide is the three lines it is a longer copy of.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Size {
  w: number
  h: number
}

/** The card's top left corner, in the same coordinates the rects came in. */
export interface CardSpot {
  left: number
  top: number
  /** Which side of the cell it took, for the arrow and for a test to read. */
  side: 'below' | 'above' | 'right' | 'left'
}

function clamp(value: number, low: number, high: number): number {
  // Low wins when the card is bigger than the bounds, the same order the
  // tour's clamp keeps: the top left corner is where a card is read from.
  return Math.max(low, Math.min(value, Math.max(low, high)))
}

/**
 * The box the card is held inside: the grid on each axis it fits on, and the
 * window on any axis it does not. `screen` is the window in the same
 * coordinates the rects came in, which for a `getBoundingClientRect` caller
 * is `{ x: 0, y: 0, w: innerWidth, h: innerHeight }`.
 */
function boundsFor(card: Size, grid: Rect, screen: Rect): Rect {
  const wide = card.w <= grid.w
  const tall = card.h <= grid.h
  return {
    x: wide ? grid.x : screen.x,
    w: wide ? grid.w : screen.w,
    y: tall ? grid.y : screen.y,
    h: tall ? grid.h : screen.h,
  }
}

export function placeDayCard(cell: Rect, card: Size, grid: Rect, screen: Rect = grid): CardSpot {
  const box = boundsFor(card, grid, screen)
  const right = box.x + box.w
  const bottom = box.y + box.h

  // Below first, then above, then the sides. Below is where a list of a
  // day's hours wants to be read from, and the two sides are what a cell in
  // the last row of the month is left with.
  const sides = [
    { side: 'below' as const, fits: cell.y + cell.h + card.h <= bottom, room: bottom - (cell.y + cell.h), left: cell.x, top: cell.y + cell.h },
    { side: 'above' as const, fits: cell.y - card.h >= box.y, room: cell.y - box.y, left: cell.x, top: cell.y - card.h },
    { side: 'right' as const, fits: cell.x + cell.w + card.w <= right, room: right - (cell.x + cell.w), left: cell.x + cell.w, top: cell.y },
    { side: 'left' as const, fits: cell.x - card.w >= box.x, room: cell.x - box.x, left: cell.x - card.w, top: cell.y },
  ]

  const chosen = sides.find(s => s.fits) ?? sides.reduce((best, s) => (s.room > best.room ? s : best))
  return {
    side: chosen.side,
    left: clamp(chosen.left, box.x, right - card.w),
    top: clamp(chosen.top, box.y, bottom - card.h),
  }
}
