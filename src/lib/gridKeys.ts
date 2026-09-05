import { addDays } from './dates'
import type { MonthCell } from './dates'

/**
 * Keyboard movement in a seven-column month grid.
 *
 * A month grid is thirty-five or forty-two buttons, and as thirty-five tab
 * stops it stood between the navigation rail and the day's own controls on
 * every Tab through the day view: the quick-add field was the sixtieth
 * stop. The pattern a grid wants is one stop and the arrow keys - the
 * roving tabindex - and these two functions are the whole of the arithmetic
 * for it, kept out of the components because jsdom cannot see focus move
 * across a real layout but can check a date.
 */

/** Where an arrow key goes from a date, or null for a key that is not one. */
export function dateFromArrow(key: string, date: string): string | null {
  switch (key) {
    case 'ArrowLeft':
      return addDays(date, -1)
    case 'ArrowRight':
      return addDays(date, 1)
    case 'ArrowUp':
      return addDays(date, -7)
    case 'ArrowDown':
      return addDays(date, 7)
    default:
      return null
  }
}

/**
 * The one cell Tab lands on: the first of the preferred dates that is in
 * the grid - the day being viewed, then today - and failing both the first
 * day of the month, so a month browsed to from elsewhere still has a way in.
 */
export function tabStopFor(cells: MonthCell[], preferred: (string | null | undefined)[]): string {
  const keys = new Set(cells.map(c => c.key))
  for (const date of preferred) {
    if (date && keys.has(date)) return date
  }
  return cells.find(c => c.inMonth)?.key ?? cells[0]?.key ?? ''
}
