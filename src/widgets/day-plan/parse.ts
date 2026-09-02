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

/**
 * A duration written at the end of the line - "30min", "45 min", "1h",
 * "1h30", "90m", "2 hours".
 *
 * Anchored to the end on purpose. A title can perfectly well contain a
 * number: "Read 20 pages" is a real task, and reading its 20 as a length
 * would be worse than not supporting durations at all. Only a trailing
 * number followed by a unit is unambiguously how long something takes, and
 * "20 pages" does not match while "20 min" does.
 */
const TRAILING_DURATION_RE = /\s+(?:(\d{1,2})\s*h(?:ou)?r?s?)?\s*(?:(\d{1,3})\s*m(?:in(?:ute)?s?)?)?$/i

export interface QuickAdd {
  title: string
  time?: string
  minutes?: number
}

/**
 * Turns one line of typed text into a task.
 *
 * Pure and total, which is what lets the quick-add field run it on every
 * keystroke and show what it understood as chips under the input - the
 * feedback exists so nobody has to press Enter to find out whether "14:00
 * Call mom 30min" was read the way they meant it.
 *
 * A leading time and a trailing duration are both optional and independent of
 * each other. Whatever is left after removing them is the title, and a line
 * that is only a time, or only a duration, is not a task at all - it has
 * nothing to call itself - so it parses to null exactly the way an empty line
 * does.
 */
export function parseQuickAdd(input: string): QuickAdd | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let rest = trimmed
  let time: string | undefined
  const timed = QUICK_ADD_RE.exec(rest)
  if (timed) {
    time = `${timed[1].padStart(2, '0')}:${timed[2]}`
    rest = timed[3]
  }

  let minutes: number | undefined
  const sized = TRAILING_DURATION_RE.exec(rest)
  // Both groups are optional, so this regex also matches the empty tail of
  // any string. Both being absent means no duration was written at all,
  // which is not the same as a duration of zero.
  if (sized && (sized[1] !== undefined || sized[2] !== undefined)) {
    const total = (sized[1] ? Number(sized[1]) * 60 : 0) + (sized[2] ? Number(sized[2]) : 0)
    if (total > 0) {
      minutes = total
      rest = rest.slice(0, sized.index)
    }
  }

  const title = rest.trim()
  if (!title) return null
  return { title, time, minutes }
}
