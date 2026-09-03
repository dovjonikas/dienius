/**
 * Where the tour card goes, given where the hole is.
 *
 * A pure function and its own module for the reason every other piece of
 * geometry in this codebase is: jsdom has no layout, so this cannot be tested
 * through the component. It is also the rule that was wrong for two versions
 * and nobody noticed - the card was placed below the hole when there was room
 * and above it otherwise, with no thought given to left and right at all, so
 * a wide, short target near the bottom of the screen got a card sitting on
 * top of the very control it was describing.
 *
 * **The card never covers the hole.** That is the whole contract. Everything
 * else here - which of the four sides, how it is clamped - is in service of
 * it, and when no side has room the card goes wherever the most space is
 * rather than wherever the first rule matched.
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

/**
 * - `centre` - a wide screen with nothing to point at: the welcome and the
 *   goodbye, which are about the app rather than about a control.
 * - `bottom` / `top` - a phone, where the card spans the width and sits
 *   against one edge. Which edge is the only choice worth making there;
 *   anything cleverer fights the on-screen keyboard.
 * - `anchored` - a wide screen with a target: beside it, on the side with
 *   room.
 */
export type CardPlacement =
  | { kind: 'centre' }
  | { kind: 'bottom' }
  | { kind: 'top' }
  | { kind: 'anchored'; left: number; top: number }

/** Breathing room between the card and the hole, and between the card and the screen edge. */
export const CARD_GAP = 12

function clamp(value: number, low: number, high: number): number {
  // high can be below low on a screen too small for the card at all, and a
  // Math.min/Math.max pair in the wrong order would then push the card off the
  // far edge. Low wins: better clipped at the bottom right than at the top left,
  // where the close and skip controls live.
  return Math.max(low, Math.min(value, Math.max(low, high)))
}

export function placeCard(hole: Rect | null, card: Size, viewport: Size, wide: boolean): CardPlacement {
  if (!hole) return wide ? { kind: 'centre' } : { kind: 'bottom' }

  if (!wide) {
    const bottomZoneTop = viewport.h - card.h - CARD_GAP
    const topZoneBottom = card.h + CARD_GAP
    if (hole.y + hole.h <= bottomZoneTop) return { kind: 'bottom' }
    if (hole.y >= topZoneBottom) return { kind: 'top' }
    // A hole taller than the screen minus the card twice over. Nothing here
    // avoids it, so the card takes the bottom, where a thumb already is.
    return { kind: 'bottom' }
  }

  const belowTop = hole.y + hole.h + CARD_GAP
  const aboveTop = hole.y - CARD_GAP - card.h
  const rightLeft = hole.x + hole.w + CARD_GAP
  const leftLeft = hole.x - CARD_GAP - card.w

  // Below first, then above, then the sides. Below is where the eye goes after
  // reading a control, and a card there does not push the layout around in the
  // reader's peripheral vision the way one to the left of a left-hand control
  // does.
  const sides = [
    { fits: belowTop + card.h <= viewport.h - CARD_GAP, room: viewport.h - (hole.y + hole.h), left: hole.x, top: belowTop },
    { fits: aboveTop >= CARD_GAP, room: hole.y, left: hole.x, top: aboveTop },
    { fits: rightLeft + card.w <= viewport.w - CARD_GAP, room: viewport.w - (hole.x + hole.w), left: rightLeft, top: hole.y },
    { fits: leftLeft >= CARD_GAP, room: hole.x, left: leftLeft, top: hole.y },
  ]

  const chosen = sides.find(side => side.fits) ?? sides.reduce((best, side) => (side.room > best.room ? side : best))
  return {
    kind: 'anchored',
    left: clamp(chosen.left, CARD_GAP, viewport.w - card.w - CARD_GAP),
    top: clamp(chosen.top, CARD_GAP, viewport.h - card.h - CARD_GAP),
  }
}
