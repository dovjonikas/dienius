import { expect, test } from 'vitest'
import { placeDayCard } from './dayCardPlacement'

/**
 * Where the day card goes - views/dayCardPlacement.ts.
 *
 * Two promises, and they are the two the tour's own placement does not make:
 * the card touches the cell it belongs to, so there is no open ground for a
 * pointer to cross, and it stays inside the month grid, so it never hangs
 * into the stamp bar or off the bottom of the screen. jsdom has no layout,
 * which is why this is arithmetic outside the component.
 */

const GRID = { x: 0, y: 0, w: 700, h: 600 }
const CARD = { w: 240, h: 200 }

test('under a cell with room, the card starts exactly where the cell ends', () => {
  const cell = { x: 0, y: 0, w: 100, h: 100 }
  const at = placeDayCard(cell, CARD, GRID)
  expect(at.side).toBe('below')
  expect(at.top).toBe(cell.y + cell.h)
  expect(at.left).toBe(cell.x)
})

test('a cell in the last row takes the card above it, touching from the other side', () => {
  const cell = { x: 0, y: 500, w: 100, h: 100 }
  const at = placeDayCard(cell, CARD, GRID)
  expect(at.side).toBe('above')
  expect(at.top + CARD.h).toBe(cell.y)
})

test('a cell in the last column keeps the whole card inside the grid', () => {
  const cell = { x: 600, y: 0, w: 100, h: 100 }
  const at = placeDayCard(cell, CARD, GRID)
  expect(at.top).toBe(cell.y + cell.h)
  expect(at.left + CARD.w).toBe(GRID.x + GRID.w)
  expect(at.left).toBeGreaterThanOrEqual(GRID.x)
})

test('with no room under or over it, the card goes beside the cell', () => {
  const cell = { x: 0, y: 220, w: 100, h: 100 }
  const short = { x: 0, y: 0, w: 700, h: 420 }
  const at = placeDayCard(cell, { w: 240, h: 300 }, short)
  expect(at.side).toBe('right')
  expect(at.left).toBe(cell.x + cell.w)
})

/**
 * The last resort, and it is a decision rather than an accident: when no
 * side has room the card is clamped into the grid and ends up over its own
 * cell. That is the one thing on the screen it is allowed to cover, because
 * the card is the longer copy of what the cell says.
 */
test('a card bigger than the room anywhere is clamped into the grid rather than hung off it', () => {
  const tiny = { x: 0, y: 0, w: 300, h: 200 }
  const cell = { x: 100, y: 50, w: 100, h: 100 }
  const at = placeDayCard(cell, { w: 240, h: 300 }, tiny)
  expect(at.left).toBeGreaterThanOrEqual(tiny.x)
  expect(at.left + 240).toBeLessThanOrEqual(tiny.x + tiny.w)
  expect(at.top).toBe(tiny.y)
})

test('when none of the four sides fits, the side with the most room wins', () => {
  const tiny = { x: 0, y: 0, w: 300, h: 200 }
  const cell = { x: 100, y: 50, w: 100, h: 100 }
  // Below and above have 50 each; the right has 100 and the left has 100,
  // and the first of the largest is the one taken.
  expect(placeDayCard(cell, { w: 240, h: 300 }, tiny).side).toBe('right')
})

/**
 * The phone. A month grid there is 358 by 284 and a day card is 320 by
 * something over 400, so "inside the grid" cannot hold on the vertical axis
 * - and the axis it cannot hold on is the one where breaking it puts the
 * card past the bottom of the screen, which is the failing this whole card
 * replaced. The window takes over on that axis and only that one.
 */
test('where the grid is shorter than the card, the window is the bound instead', () => {
  const grid = { x: 16, y: 293, w: 358, h: 284 }
  const screen = { x: 0, y: 0, w: 390, h: 844 }
  const cell = { x: 68, y: 374, w: 48, h: 48 }
  const at = placeDayCard(cell, { w: 320, h: 470 }, grid, screen)

  expect(at.top + 470).toBeLessThanOrEqual(screen.h)
  expect(at.top).toBeGreaterThanOrEqual(0)
  // The horizontal axis still fits inside the grid, so it is still the bound.
  expect(at.left).toBeGreaterThanOrEqual(grid.x)
  expect(at.left + 320).toBeLessThanOrEqual(grid.x + grid.w)
})

test('with no window given, the grid is the only bound - which is the desktop', () => {
  const cell = { x: 0, y: 0, w: 100, h: 100 }
  expect(placeDayCard(cell, CARD, GRID)).toEqual(placeDayCard(cell, CARD, GRID, GRID))
})
