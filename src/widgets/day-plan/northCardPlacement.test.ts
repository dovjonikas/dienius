import { expect, test } from 'vitest'
import { NORTH_CARD_GAP, NORTH_CARD_MARGIN, placeNorthCard } from './northCardPlacement'

/**
 * A North heading's card stands beside the heading in the rail, level with
 * it, and under it where there is no room beside - above it where the screen
 * ends first - and never past the window's edge.
 */

const DESKTOP = { w: 1366, h: 768 }
const PHONE = { w: 390, h: 844 }

test('in the rail it stands beside the heading, level with its words', () => {
  const heading = { x: 64, y: 520, w: 240, h: 28 }
  const spot = placeNorthCard(heading, { w: 320, h: 120 }, DESKTOP, 12)
  expect(spot.side).toBe('right')
  expect(spot.left).toBe(64 + 240 + NORTH_CARD_GAP)
  expect(spot.top).toBe(520 - 12)
})

test('beside a heading low in the rail it rises to stay inside the window', () => {
  const heading = { x: 64, y: 700, w: 240, h: 28 }
  const spot = placeNorthCard(heading, { w: 320, h: 200 }, DESKTOP, 12)
  expect(spot.side).toBe('right')
  expect(spot.top + 200).toBeLessThanOrEqual(DESKTOP.h - NORTH_CARD_MARGIN)
})

test('on a phone, with no room beside, it opens under the heading and inside the screen', () => {
  const heading = { x: 16, y: 300, w: 358, h: 44 }
  const spot = placeNorthCard(heading, { w: 340, h: 160 }, PHONE, 12)
  expect(spot.side).toBe('below')
  expect(spot.top).toBe(300 + 44 + NORTH_CARD_GAP / 2)
  expect(spot.left).toBeGreaterThanOrEqual(NORTH_CARD_MARGIN)
  expect(spot.left + 340).toBeLessThanOrEqual(PHONE.w - NORTH_CARD_MARGIN)
})

test('where the screen ends under the heading, it opens above it', () => {
  const heading = { x: 16, y: 760, w: 358, h: 44 }
  const spot = placeNorthCard(heading, { w: 340, h: 160 }, PHONE, 12)
  expect(spot.side).toBe('above')
  expect(spot.top + 160).toBe(760 - NORTH_CARD_GAP / 2)
})
