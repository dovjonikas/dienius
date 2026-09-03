import { describe, expect, it } from 'vitest'
import { CARD_GAP, placeCard, type Rect } from './cardPlacement'

const CARD = { w: 300, h: 160 }
const DESKTOP = { w: 1440, h: 900 }
const PHONE = { w: 390, h: 844 }

function overlaps(card: { left: number; top: number }, hole: Rect): boolean {
  return (
    card.left < hole.x + hole.w &&
    card.left + CARD.w > hole.x &&
    card.top < hole.y + hole.h &&
    card.top + CARD.h > hole.y
  )
}

/**
 * The one contract: the card never covers the hole. Everything else in
 * cardPlacement.ts - which of the four sides, how the result is clamped -
 * exists to keep it, and a card sitting on top of the control it is
 * describing is the single worst thing a spotlight can do, because the person
 * is now reading instructions for something they cannot see.
 */
describe('where the tour card goes', () => {
  it('sits below a target near the top, where the eye goes next', () => {
    const hole: Rect = { x: 100, y: 80, w: 200, h: 40 }
    const placement = placeCard(hole, CARD, DESKTOP, true)
    expect(placement).toMatchObject({ kind: 'anchored', top: 132 })
    expect(overlaps(placement as { left: number; top: number }, hole)).toBe(false)
  })

  it('goes above a target too low for a card underneath it', () => {
    const hole: Rect = { x: 100, y: 800, w: 200, h: 60 }
    const placement = placeCard(hole, CARD, DESKTOP, true) as { kind: string; left: number; top: number }
    expect(placement.top).toBeLessThan(hole.y)
    expect(overlaps(placement, hole)).toBe(false)
  })

  it('goes beside a target that fills the height, rather than on top of it', () => {
    // The template rail: a tall, narrow column down the left of the day view.
    // Neither above nor below has room, and the old rule had no third answer.
    const hole: Rect = { x: 16, y: 20, w: 180, h: 860 }
    const placement = placeCard(hole, CARD, DESKTOP, true) as { kind: string; left: number; top: number }
    expect(placement.left).toBeGreaterThanOrEqual(hole.x + hole.w)
    expect(overlaps(placement, hole)).toBe(false)
  })

  it('goes to the left of a target against the right edge', () => {
    const hole: Rect = { x: 1200, y: 20, w: 220, h: 860 }
    const placement = placeCard(hole, CARD, DESKTOP, true) as { kind: string; left: number; top: number }
    expect(placement.left + CARD.w).toBeLessThanOrEqual(hole.x)
    expect(overlaps(placement, hole)).toBe(false)
  })

  it('stays on screen when the target is against an edge', () => {
    const hole: Rect = { x: 1380, y: 860, w: 60, h: 40 }
    const placement = placeCard(hole, CARD, DESKTOP, true) as { kind: string; left: number; top: number }
    expect(placement.left).toBeGreaterThanOrEqual(CARD_GAP)
    expect(placement.left + CARD.w).toBeLessThanOrEqual(DESKTOP.w - CARD_GAP)
    expect(placement.top).toBeGreaterThanOrEqual(CARD_GAP)
    expect(placement.top + CARD.h).toBeLessThanOrEqual(DESKTOP.h - CARD_GAP)
  })

  it('centres itself on a wide screen when there is nothing to point at', () => {
    expect(placeCard(null, CARD, DESKTOP, true)).toEqual({ kind: 'centre' })
  })
})

/**
 * A phone card spans the width and takes one edge or the other. Which edge is
 * the only choice worth making there - anything cleverer fights the on-screen
 * keyboard, which moves the whole viewport rather than the card.
 */
describe('where the tour card goes on a phone', () => {
  it('takes the bottom, where a thumb already is', () => {
    expect(placeCard({ x: 16, y: 200, w: 358, h: 44 }, CARD, PHONE, false)).toEqual({ kind: 'bottom' })
  })

  it('moves to the top rather than cover a target down at the bottom', () => {
    // The floating scratch button, the rollover row: the bottom of a phone
    // screen is full of controls, and this is where the card covered them.
    expect(placeCard({ x: 16, y: 760, w: 358, h: 60 }, CARD, PHONE, false)).toEqual({ kind: 'top' })
  })

  it('takes the bottom when there is nothing to point at', () => {
    expect(placeCard(null, CARD, PHONE, false)).toEqual({ kind: 'bottom' })
  })

  it('takes the bottom when a target is so tall that no edge is clear of it', () => {
    // Honest rather than clever: nothing avoids a hole this size, so the card
    // goes where it is easiest to reach.
    expect(placeCard({ x: 0, y: 0, w: 390, h: 844 }, CARD, PHONE, false)).toEqual({ kind: 'bottom' })
  })
})
