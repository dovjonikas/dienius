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
 *
 * Two alternatives rather than two independent optional groups. The old
 * shape - `(hours)? (minutes)?`, both optional - could not read "1h30" at
 * all despite this comment having claimed it could since v1.0: the minutes
 * group insisted on its own "m", so after "1h" the trailing "30" matched
 * nothing and the whole regex failed. Written this way the minute unit is
 * optional *only* when an hour has already been read, which is the one case
 * where a bare number is unambiguous - "1h30" can only be thirty minutes,
 * while a bare "30" on the end of a line is still not a duration and still
 * does not match.
 *
 * Group 1 is the hours, group 2 the minutes written after them, group 3 a
 * minutes-only duration. At least one is always present when this matches:
 * unlike the old shape, it cannot match the empty tail of any string.
 */
const TRAILING_DURATION_RE =
  /\s+(?:(\d{1,2})\s*h(?:ou)?r?s?\s*(?:(\d{1,3})\s*(?:m(?:in(?:ute)?s?)?)?)?|(\d{1,3})\s*m(?:in(?:ute)?s?)?)$/i

/** The leading time on its own, with whatever whitespace surrounds it - see `replaceLeadingTime`. */
const LEADING_TIME_RE = new RegExp(`^(\\s*)(?:${HOUR_SOURCE}):(?:${MINUTE_SOURCE})(\\s+)`)

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
  if (sized) {
    const total = durationFromMatch(sized)
    // Zero is not a duration, it is the absence of one - the same reading
    // `parseMinutesInput` gives an empty size field. "Walk 0min" keeps its
    // words and gets no size rather than a size of nothing.
    if (total > 0) {
      minutes = total
      rest = rest.slice(0, sized.index)
    }
  }

  const title = rest.trim()
  if (!title) return null
  return { title, time, minutes }
}

function durationFromMatch(match: RegExpExecArray): number {
  const hours = match[1] !== undefined ? Number(match[1]) : 0
  const minutes = match[2] !== undefined ? Number(match[2]) : match[3] !== undefined ? Number(match[3]) : 0
  return hours * 60 + minutes
}

/**
 * A duration written the shortest way this same file can read back - "45min",
 * "1h", "1h30".
 *
 * It exists because quick-add's two controls and its text are one thing, not
 * two: pressing 45m on a line that already says "Walk 30min" has to change
 * the words, not silently disagree with them. Whatever this writes is fed
 * straight back through `parseQuickAdd` on the next keystroke, so a form it
 * cannot read would leave the field saying one thing and the chips another.
 * `formatDuration` in capacity.ts is the version for *reading* - "45 min",
 * with the space - and is not interchangeable with this one.
 */
export function durationToText(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${remainder}min`
  if (remainder === 0) return `${hours}h`
  return `${hours}h${remainder}`
}

/**
 * Swaps the clock time at the front of a quick-add line for another one,
 * leaving the spacing and everything after it exactly as typed. A line with
 * no leading time comes back untouched - the caller has a picked time of its
 * own for that case and must not have one written into the words behind
 * somebody's back.
 */
export function replaceLeadingTime(input: string, time: string): string {
  const match = LEADING_TIME_RE.exec(input)
  if (!match) return input
  return `${match[1]}${time}${match[2]}${input.slice(match[0].length)}`
}

/**
 * Swaps the duration at the end of a quick-add line for another one, in the
 * short form `durationToText` writes. Same contract as `replaceLeadingTime`:
 * a line with no duration in it comes back untouched, because the duration
 * chips hold their own value for that case.
 *
 * Trailing whitespace is preserved rather than trimmed. Somebody who has
 * typed a space and is about to type the next word should not have the
 * cursor jump back a character because a chip was tapped.
 *
 * The leading time is set aside before the tail is matched, exactly as
 * `parseQuickAdd` sets it aside. Without that the two disagree on a line
 * like "09:30 30min", where the parser sees a task called "30min" with no
 * duration and a tail match run over the whole line would see a duration and
 * no task.
 */
export function replaceTrailingDuration(input: string, minutes: number): string {
  const leading = LEADING_TIME_RE.exec(input)
  const head = leading ? leading[0] : ''
  const body = input.slice(head.length).replace(/\s+$/, '')
  const tail = input.slice(head.length + body.length)
  const match = TRAILING_DURATION_RE.exec(body)
  if (!match || durationFromMatch(match) <= 0) return input
  return `${head}${body.slice(0, match.index)} ${durationToText(minutes)}${tail}`
}
