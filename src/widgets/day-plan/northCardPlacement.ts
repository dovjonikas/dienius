/**
 * Where the card of a North heading's lines goes, given the heading.
 *
 * A pure function in its own module for the reason the day card's placement
 * is one: jsdom has no layout, so the arithmetic is tested as arithmetic.
 *
 * - **Beside the heading, in the rail.** The card stands to the right of the
 *   rail's heading, over the day, its first line level with the heading's
 *   words - the rail is a narrow column and the lines are sentences, so the
 *   room is beside it, and the day under the card moves by nothing.
 * - **Under it, where there is no room beside.** On a phone the headings are
 *   a list across the whole screen, and the card opens under the heading it
 *   belongs to - above it, where the screen ends first.
 * - **Inside the window.** Never past an edge, with a gutter's room to spare.
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

export interface NorthCardSpot {
  left: number
  top: number
  side: 'right' | 'below' | 'above'
}

/** The room kept between the card and the heading, and between the card and the window's edge. */
export const NORTH_CARD_GAP = 12
export const NORTH_CARD_MARGIN = 16

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, Math.max(low, high)))
}

/**
 * The card's top left corner, in the heading's own coordinates. `inset` is
 * how far the card's first line sits under its top edge, so that beside the
 * heading the two are level.
 */
export function placeNorthCard(heading: Rect, card: Size, screen: Size, inset = 0): NorthCardSpot {
  const right = heading.x + heading.w + NORTH_CARD_GAP
  if (right + card.w <= screen.w - NORTH_CARD_MARGIN) {
    return {
      left: right,
      top: clamp(heading.y - inset, NORTH_CARD_MARGIN, screen.h - NORTH_CARD_MARGIN - card.h),
      side: 'right',
    }
  }
  const left = clamp(heading.x, NORTH_CARD_MARGIN, screen.w - NORTH_CARD_MARGIN - card.w)
  const below = heading.y + heading.h + NORTH_CARD_GAP / 2
  if (below + card.h <= screen.h - NORTH_CARD_MARGIN) return { left, top: below, side: 'below' }
  const above = heading.y - NORTH_CARD_GAP / 2 - card.h
  if (above >= NORTH_CARD_MARGIN) return { left, top: above, side: 'above' }
  return { left, top: clamp(below, NORTH_CARD_MARGIN, screen.h - NORTH_CARD_MARGIN - card.h), side: 'below' }
}
