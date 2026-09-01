// What counts as a valid hour and a valid minute in a colon-separated
// 24-hour clock time - shared between the two places the app parses one
// from free-typed text. Kept as source fragments rather than a single
// compiled RegExp so each caller can wrap them in its own anchors and
// trailing groups (quick-add needs a title after the time; a bare time
// field does not) without maintaining two separate definitions of what a
// valid hour or minute looks like.
const HOUR_SOURCE = '(?:[01]?\\d|2[0-3])'
const MINUTE_SOURCE = '(?:[0-5]\\d)'

/**
 * A colon-separated clock time on its own, nothing before or after it -
 * "9:30" or "09:30", never "930" or "25:00". Exported for
 * `parseTimeInput` in capacity.ts, the only other place a time is typed as
 * free text (the template block editor); that function also accepts a
 * few bare-digit shorthands this regex intentionally does not, which is
 * why it normalises through this shared definition rather than duplicating
 * it with the extra cases folded in.
 */
export const TIME_RE = new RegExp(`^(${HOUR_SOURCE}):(${MINUTE_SOURCE})$`)

const QUICK_ADD_RE = new RegExp(`^(${HOUR_SOURCE}):(${MINUTE_SOURCE})\\s+(.+)$`)

export function parseQuickAdd(input: string): { title: string; time?: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = QUICK_ADD_RE.exec(trimmed)
  if (match) {
    return { time: `${match[1].padStart(2, '0')}:${match[2]}`, title: match[3] }
  }
  return { title: trimmed }
}
