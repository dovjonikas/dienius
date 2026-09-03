/**
 * A small iCalendar reader.
 *
 * No library, and none is wanted. RFC 5545 is enormous, almost all of it is
 * about writing calendars rather than reading one, and what this app needs
 * from somebody's work calendar is four fields: when a thing starts, when it
 * ends, what it is called, and whether it happens again. Everything else is
 * skipped rather than parsed - see `ignored` on the result, which is how the
 * UI can say "eleven events used, two skipped" instead of failing silently or
 * failing loudly.
 *
 * Nothing here throws. A feed that is not a calendar at all comes back as no
 * events with a reason, because the alternative - a parser that dies on the
 * one Tuesday somebody's employer adds an exotic property - is a feature that
 * cannot be trusted with a work calendar.
 */

import { addDays, dateKey } from './dates'

/** How far ahead a repeating event is expanded. Beyond a season is noise. */
export const ICS_HORIZON_DAYS = 120

export interface IcsEvent {
  /** Stable per event, so two fetches of the same feed do not double it up. */
  uid: string
  summary: string
  /** Date key of the day the event falls on. */
  date: string
  /** Minutes from midnight, or undefined for an all-day event. */
  startMinutes?: number
  /** Length in minutes. Undefined for all-day. */
  minutes?: number
  allDay: boolean
}

export interface IcsParseResult {
  events: IcsEvent[]
  /** Calendar name from X-WR-CALNAME, when the feed offers one. */
  name?: string
  /**
   * What was skipped and why - one line each, deduplicated.
   *
   * Reported rather than swallowed: a work calendar quietly missing every
   * event with an unusual recurrence is worse than one that says so.
   */
  ignored: string[]
}

/**
 * Unfolds the line continuations RFC 5545 requires.
 *
 * A long property is split across lines with the continuation indented by one
 * space or tab. Reading them as separate lines turns one meeting into a
 * property called " Weekly" - which is exactly the sort of quiet corruption
 * that makes people distrust a calendar import.
 */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

/** `DTSTART;TZID=Europe/Vilnius:20260903T090000` split into its three parts. */
function splitLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = indexOfValueColon(line)
  if (colon < 0) return null
  const left = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const [name, ...paramParts] = left.split(';')
  const params: Record<string, string> = {}
  for (const part of paramParts) {
    const eq = part.indexOf('=')
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1)
  }
  return { name: name.toUpperCase(), params, value }
}

/**
 * The colon that separates a property from its value, skipping any inside a
 * quoted parameter - `ATTENDEE;CN="Smith, J:r":mailto:...` is legal, and
 * splitting on the first colon would cut it in the wrong place.
 */
function indexOfValueColon(line: string): number {
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') quoted = !quoted
    else if (c === ':' && !quoted) return i
  }
  return -1
}

/**
 * A date-time, as a local date key plus minutes.
 *
 * Three forms appear in the wild: `20260903` (all day), `20260903T090000`
 * (local), and `20260903T070000Z` (UTC). The Z form is converted through the
 * viewer's own clock, because an event at 07:00Z is at 10:00 for somebody in
 * Vilnius and putting it at 07:00 would be a lie about their morning.
 *
 * A TZID naming some third zone is treated as local rather than converted.
 * Doing it properly needs the IANA database; the error is at most an hour or
 * two for somebody reading a calendar from another country, and it is
 * reported so it is not a silent one.
 */
export function parseIcsDate(value: string, params: Record<string, string> = {}): {
  date: string
  minutes?: number
  allDay: boolean
} | null {
  const v = value.trim()
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v)
  if (!m) return null
  const [, y, mo, d, hh, mm, ss, z] = m
  if (params.VALUE === 'DATE' || hh === undefined) {
    return { date: `${y}-${mo}-${d}`, allDay: true }
  }
  if (z) {
    const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss ?? '0'))
    const local = new Date(utc)
    return { date: dateKey(local), minutes: local.getHours() * 60 + local.getMinutes(), allDay: false }
  }
  return { date: `${y}-${mo}-${d}`, minutes: Number(hh) * 60 + Number(mm), allDay: false }
}

/** `PT1H30M`, `P1D` - only the parts a meeting ever uses. */
export function parseIcsDuration(value: string): number | undefined {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/.exec(value.trim())
  if (!m) return undefined
  const [, days, hours, minutes] = m
  const total = Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0)
  return total > 0 ? total : undefined
}

interface RawEvent {
  uid?: string
  summary?: string
  start?: { date: string; minutes?: number; allDay: boolean }
  end?: { date: string; minutes?: number; allDay: boolean }
  duration?: number
  rrule?: string
  recurrenceId?: string
}

export function parseIcs(text: string, from: string, horizonDays = ICS_HORIZON_DAYS): IcsParseResult {
  const events: IcsEvent[] = []
  const ignored = new Set<string>()
  let name: string | undefined
  let current: RawEvent | null = null

  if (!/BEGIN:VCALENDAR/i.test(text)) {
    return { events: [], ignored: ['That does not look like a calendar file.'] }
  }

  for (const line of unfold(text)) {
    const parsed = splitLine(line)
    if (!parsed) continue
    const { name: prop, params, value } = parsed

    if (prop === 'BEGIN' && value.toUpperCase() === 'VEVENT') {
      current = {}
      continue
    }
    if (prop === 'END' && value.toUpperCase() === 'VEVENT') {
      if (current) emit(current, events, ignored, from, horizonDays)
      current = null
      continue
    }
    if (!current) {
      if (prop === 'X-WR-CALNAME') name = unescapeText(value)
      continue
    }

    switch (prop) {
      case 'UID':
        current.uid = value
        break
      case 'SUMMARY':
        current.summary = unescapeText(value)
        break
      case 'DTSTART':
        current.start = parseIcsDate(value, params) ?? undefined
        if (params.TZID && !/Z$/.test(value)) {
          ignored.add(`Times are read as local; this calendar states ${params.TZID}.`)
        }
        break
      case 'DTEND':
        current.end = parseIcsDate(value, params) ?? undefined
        break
      case 'DURATION':
        current.duration = parseIcsDuration(value)
        break
      case 'RRULE':
        current.rrule = value
        break
      case 'RECURRENCE-ID':
        current.recurrenceId = value
        break
      default:
        break
    }
  }

  return { events, name, ignored: [...ignored] }
}

function emit(raw: RawEvent, out: IcsEvent[], ignored: Set<string>, from: string, horizonDays: number) {
  if (!raw.start) {
    ignored.add('An event with no start was skipped.')
    return
  }
  const summary = raw.summary?.trim() || '(no title)'
  const uid = raw.uid ?? `${summary}-${raw.start.date}-${raw.start.minutes ?? 'all'}`
  const minutes = lengthOf(raw)

  const dates = raw.rrule ? expand(raw.rrule, raw.start.date, from, horizonDays, ignored) : [raw.start.date]
  const until = addDays(from, horizonDays)
  for (const date of dates) {
    // Only what is in view. A five-year-old daily standup is a real feed and
    // expanding all of it would be thousands of events nobody will look at.
    if (date < from || date > until) continue
    out.push({
      uid: dates.length > 1 ? `${uid}::${date}` : uid,
      summary,
      date,
      startMinutes: raw.start!.allDay ? undefined : raw.start!.minutes,
      minutes: raw.start!.allDay ? undefined : minutes,
      allDay: raw.start!.allDay,
    })
  }
}

/**
 * How long an event runs, from whichever of the two ways it was stated.
 *
 * An event that ends the next day is clipped to the end of its own day rather
 * than dropped: a shift from 22:00 to 06:00 is a real thing to plan around,
 * and a version of it that runs 480 minutes past midnight would draw off the
 * bottom of every view in the app.
 */
function lengthOf(raw: RawEvent): number | undefined {
  if (raw.duration !== undefined) return raw.duration
  if (!raw.start || raw.start.minutes === undefined) return undefined
  if (!raw.end || raw.end.minutes === undefined) return undefined
  if (raw.end.date !== raw.start.date) return 24 * 60 - raw.start.minutes
  const length = raw.end.minutes - raw.start.minutes
  return length > 0 ? length : undefined
}

/**
 * Daily and weekly recurrence, and nothing else.
 *
 * Those two are what a work calendar is made of - a standup, a Friday review,
 * a fortnightly one-to-one. Monthly and yearly rules are named in `ignored`
 * rather than guessed at: BYSETPOS, BYDAY with an ordinal and the month-end
 * cases are where a naive expansion puts a meeting on the wrong day, and a
 * meeting shown on the wrong day is worse than one not shown at all.
 */
function expand(rrule: string, start: string, from: string, horizonDays: number, ignored: Set<string>): string[] {
  const parts: Record<string, string> = {}
  for (const piece of rrule.split(';')) {
    const eq = piece.indexOf('=')
    if (eq > 0) parts[piece.slice(0, eq).toUpperCase()] = piece.slice(eq + 1)
  }

  const freq = (parts.FREQ ?? '').toUpperCase()
  if (freq !== 'DAILY' && freq !== 'WEEKLY') {
    ignored.add(`Only daily and weekly repeats are read; a ${freq.toLowerCase() || 'complex'} one was skipped.`)
    return []
  }

  const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1)
  const count = parts.COUNT ? Number(parts.COUNT) : undefined
  const untilParsed = parts.UNTIL ? parseIcsDate(parts.UNTIL) : null
  const until = untilParsed?.date
  const horizonEnd = addDays(from, horizonDays)

  const byDay = parts.BYDAY
    ? parts.BYDAY.split(',').map(d => d.trim().toUpperCase()).filter(d => WEEKDAY_CODES.includes(d))
    : []
  if (parts.BYDAY && byDay.length === 0) {
    ignored.add('A repeat with an unusual day rule was skipped.')
    return []
  }

  // A weekly rule with no BYDAY means the weekday DTSTART falls on. Reading
  // it as "every day" is a five-minute bug that puts a Tuesday review on every
  // day of the week.
  const days = byDay.length > 0 ? byDay : [WEEKDAY_CODES[weekdayIndex(start)]]

  const dates: string[] = []
  // Occurrences, not days. A standup that has run daily since 2020 is a real
  // feed; walking a day at a time from DTSTART would spend six years of steps
  // before reaching anything anybody can see, and stopping the walk early
  // would silently drop the series entirely. COUNT still counts from the true
  // first occurrence, which is why this walks them all rather than jumping
  // straight to the horizon.
  let emitted = 0
  outer: for (let week = 0; ; week += interval) {
    const weekStart = freq === 'DAILY' ? addDays(start, week) : addDays(mondayOf(start), week * 7)
    if (weekStart > horizonEnd) break
    if (emitted > MAX_OCCURRENCES) break

    const candidates = freq === 'DAILY' ? [weekStart] : days.map(code => addDays(weekStart, (WEEKDAY_CODES.indexOf(code) + 6) % 7))
    for (const date of candidates.sort()) {
      if (date < start) continue
      if (until && date > until) break outer
      if (count !== undefined && emitted >= count) break outer
      emitted++
      if (date >= from && date <= horizonEnd) dates.push(date)
    }
  }
  return dates
}

/**
 * A hard stop on how many occurrences are ever walked.
 *
 * COUNT and UNTIL come from a file somebody else wrote. A COUNT of a million,
 * or an UNTIL that fails to parse, must not become an unbounded loop inside a
 * render - twenty thousand is far past any real calendar and still finishes in
 * a few milliseconds.
 */
const MAX_OCCURRENCES = 20_000

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function weekdayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

function mondayOf(key: string): string {
  const offset = (weekdayIndex(key) + 6) % 7
  return addDays(key, -offset)
}

/** RFC 5545 escapes commas, semicolons and newlines inside text values. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}
