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
 *
 * Time zones are the one place a library was tempting, and the browser
 * already ships the whole IANA database behind `Intl.DateTimeFormat`. That
 * is what resolves a `TZID` here - see `wallToInstant` - so a nine o'clock in
 * New York lands at four in the afternoon for somebody in Vilnius, with the
 * daylight-saving edges handled by the same tables the clock uses.
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

// --- time zones -------------------------------------------------------------

/**
 * A clock reading: a date key and minutes from midnight, in some frame -
 * the event's own zone, UTC, or nothing in particular. The frame is carried
 * beside it rather than resolved on the spot, because a repeating event has
 * to be expanded in its own frame first: a nine o'clock New York standup is
 * nine o'clock in New York on every one of its days, and what that is in
 * Vilnius changes twice a year.
 */
interface Wall {
  date: string
  minutes: number
}

/**
 * `'UTC'` for a trailing Z, an IANA name for a TZID the browser knows, and
 * undefined for a floating time - which is read on the viewer's own clock,
 * the same as a time with no zone at all.
 */
type Zone = string | undefined

const formatters = new Map<string, Intl.DateTimeFormat | null>()

/**
 * The formatter that reads a clock in a named zone, or null when the name is
 * not one the browser knows. Cached, because a daily series over four months
 * asks the same question a hundred times, and building a formatter is the
 * expensive half of using one.
 */
function formatterFor(zone: string): Intl.DateTimeFormat | null {
  const cached = formatters.get(zone)
  if (cached !== undefined) return cached
  let formatter: Intl.DateTimeFormat | null = null
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    // A RangeError is how Intl says "no such zone". Outlook's own names -
    // "W. Europe Standard Time" - land here, and so does a typo.
    formatter = null
  }
  formatters.set(zone, formatter)
  return formatter
}

/** Whether a TZID names a zone the browser can resolve. */
export function knowsZone(zone: string): boolean {
  return formatterFor(zone) !== null
}

/** What the clock on the wall in `zone` reads at a given instant. */
function wallAt(ms: number, zone: string): { y: number; m: number; d: number; h: number; mi: number; s: number } {
  const parts = formatterFor(zone)!.formatToParts(new Date(ms))
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute'), s: get('second') }
}

/** The zone's offset from UTC at an instant, in minutes east. */
function offsetAt(ms: number, zone: string): number {
  const w = wallAt(ms, zone)
  return (Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - ms) / 60_000
}

/**
 * The instant at which a wall clock in `zone` reads `wall`.
 *
 * Intl only goes the other way - instant to clock - so this guesses the
 * instant as if the clock were UTC, asks what the offset is there, and
 * corrects. One correction is exact except within an hour of a transition,
 * where the first guess and the corrected instant can sit on different
 * sides of it; asking once more at the corrected instant settles that. A
 * time that does not exist (the hour skipped in spring) comes out an hour
 * later, which is what every calendar does with it.
 */
function wallToInstant(wall: Wall, zone: Zone): number {
  const [y, m, d] = wall.date.split('-').map(Number)
  const h = Math.floor(wall.minutes / 60)
  const mi = wall.minutes % 60
  if (zone === undefined) return new Date(y, m - 1, d, h, mi).getTime()
  const guess = Date.UTC(y, m - 1, d, h, mi)
  if (zone === 'UTC') return guess
  const first = guess - offsetAt(guess, zone) * 60_000
  const again = guess - offsetAt(first, zone) * 60_000
  return again
}

/** An instant, on the viewer's own clock. */
function localWall(ms: number): Wall {
  const local = new Date(ms)
  return { date: dateKey(local), minutes: local.getHours() * 60 + local.getMinutes() }
}

/** A wall clock in one frame, read on the viewer's clock. Identity for a floating time. */
function toLocal(wall: Wall, zone: Zone): Wall {
  if (zone === undefined) return wall
  return localWall(wallToInstant(wall, zone))
}

/** The date a wall clock in `zone` shows at an instant - for UNTIL, which is stated in UTC. */
function dateInZone(ms: number, zone: Zone): string {
  if (zone === undefined) return dateKey(new Date(ms))
  if (zone === 'UTC') return isoDate(new Date(ms))
  const w = wallAt(ms, zone)
  return `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** A date-time as written, before any zone is applied. */
interface RawDate {
  wall: Wall
  allDay: boolean
  /** Whether the value itself said Z. */
  utc: boolean
}

function readRawDate(value: string, params: Record<string, string>): RawDate | null {
  const v = value.trim()
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v)
  if (!m) return null
  const [, y, mo, d, hh, mm, , z] = m
  const date = `${y}-${mo}-${d}`
  if (params.VALUE === 'DATE' || hh === undefined) {
    return { wall: { date, minutes: 0 }, allDay: true, utc: false }
  }
  return { wall: { date, minutes: Number(hh) * 60 + Number(mm) }, allDay: false, utc: z === 'Z' }
}

/**
 * A date-time, as a local date key plus minutes.
 *
 * Three forms appear in the wild: `20260903` (all day), `20260903T090000`
 * (local), and `20260903T070000Z` (UTC). The Z form is converted through the
 * viewer's own clock, because an event at 07:00Z is at 10:00 for somebody in
 * Vilnius and putting it at 07:00 would be a lie about their morning. A
 * `TZID` the browser knows is converted the same way; one it does not know
 * is read as local, and `parseIcs` says so.
 */
export function parseIcsDate(value: string, params: Record<string, string> = {}): {
  date: string
  minutes?: number
  allDay: boolean
} | null {
  const raw = readRawDate(value, params)
  if (!raw) return null
  if (raw.allDay) return { date: raw.wall.date, allDay: true }
  const zone = zoneFor(raw, params)
  const local = toLocal(raw.wall, zone)
  return { date: local.date, minutes: local.minutes, allDay: false }
}

/** The frame a date-time was written in: Z wins, then a TZID the browser knows, else floating. */
function zoneFor(raw: RawDate, params: Record<string, string>): Zone {
  if (raw.utc) return 'UTC'
  const tzid = params.TZID
  if (tzid && knowsZone(tzid)) return tzid
  return undefined
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
  start?: RawDate & { zone: Zone }
  end?: RawDate & { zone: Zone }
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
        current.start = readDated(value, params, ignored)
        break
      case 'DTEND':
        current.end = readDated(value, params, ignored)
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

/** A date-time with its frame, and a line in `ignored` when the frame named is one the browser cannot resolve. */
function readDated(value: string, params: Record<string, string>, ignored: Set<string>): (RawDate & { zone: Zone }) | undefined {
  const raw = readRawDate(value, params)
  if (!raw) return undefined
  const zone = zoneFor(raw, params)
  if (params.TZID && !raw.utc && !raw.allDay && zone === undefined) {
    ignored.add(`Times are read as local; this calendar states a time zone the browser does not know, ${params.TZID}.`)
  }
  return { ...raw, zone }
}

function emit(raw: RawEvent, out: IcsEvent[], ignored: Set<string>, from: string, horizonDays: number) {
  if (!raw.start) {
    ignored.add('An event with no start was skipped.')
    return
  }
  const summary = raw.summary?.trim() || '(no title)'
  const start = raw.start
  const uid = raw.uid ?? `${summary}-${start.wall.date}-${start.allDay ? 'all' : start.wall.minutes}`
  const minutes = lengthOf(raw)
  const until = addDays(from, horizonDays)

  // Expanded in the event's own frame, then each occurrence read on the
  // viewer's clock - see Wall. The frame's dates can sit a day either side
  // of the viewer's, so the walk is asked for a day more on both ends and
  // the local date is what is checked against the window.
  const dates = raw.rrule
    ? expand(raw.rrule, start.wall.date, addDays(from, -1), horizonDays + 2, start.zone, ignored)
    : [start.wall.date]
  for (const date of dates) {
    const local = start.allDay ? { date, minutes: 0 } : toLocal({ date, minutes: start.wall.minutes }, start.zone)
    // Only what is in view. A five-year-old daily standup is a real feed and
    // expanding all of it would be thousands of events nobody will look at.
    if (local.date < from || local.date > until) continue
    out.push({
      uid: raw.rrule ? `${uid}::${date}` : uid,
      summary,
      date: local.date,
      startMinutes: start.allDay ? undefined : local.minutes,
      minutes: start.allDay ? undefined : minutes,
      allDay: start.allDay,
    })
  }
}

/**
 * How long an event runs, from whichever of the two ways it was stated.
 *
 * Start and end are compared as instants, so an end written in a different
 * frame from its start still gives the right length. An event that ends the
 * next day is clipped to the end of its own day rather than dropped: a shift
 * from 22:00 to 06:00 is a real thing to plan around, and a version of it
 * that runs 480 minutes past midnight would draw off the bottom of every
 * view in the app.
 */
function lengthOf(raw: RawEvent): number | undefined {
  if (raw.duration !== undefined) return raw.duration
  if (!raw.start || raw.start.allDay) return undefined
  if (!raw.end || raw.end.allDay) return undefined
  const startAt = wallToInstant(raw.start.wall, raw.start.zone)
  const endAt = wallToInstant(raw.end.wall, raw.end.zone)
  const length = Math.round((endAt - startAt) / 60_000)
  if (length <= 0) return undefined
  const startLocal = localWall(startAt)
  const endLocal = localWall(endAt)
  if (endLocal.date !== startLocal.date) return 24 * 60 - startLocal.minutes
  return length
}

/**
 * Daily, weekly, the plain monthly and the plain yearly, and nothing else.
 *
 * Daily and weekly are what a work calendar is made of - a standup, a Friday
 * review, a fortnightly one-to-one. Monthly and yearly are read in the one
 * shape each that cannot land on the wrong day: the same day of the month
 * (a single BYMONTHDAY, or DTSTART's own day), and the same date each year.
 * A month without that day - the 31st of April - has no occurrence, which is
 * what the RFC says and what every calendar does. Everything else a monthly
 * or yearly rule can say - BYSETPOS, an ordinal BYDAY, several BY* parts at
 * once, a negative day - is named in `ignored` rather than guessed at,
 * because a meeting shown on the wrong day is worse than one not shown at
 * all.
 *
 * `zone` is the frame the dates are walked in, and only matters for UNTIL,
 * which is stated in UTC and has to be read as a date in that frame before
 * it can be compared.
 */
function expand(
  rrule: string,
  start: string,
  from: string,
  horizonDays: number,
  zone: Zone,
  ignored: Set<string>,
): string[] {
  const parts: Record<string, string> = {}
  for (const piece of rrule.split(';')) {
    const eq = piece.indexOf('=')
    if (eq > 0) parts[piece.slice(0, eq).toUpperCase()] = piece.slice(eq + 1)
  }

  const freq = (parts.FREQ ?? '').toUpperCase()
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') {
    ignored.add(`Only daily, weekly, monthly and yearly repeats are read; a ${freq.toLowerCase() || 'complex'} one was skipped.`)
    return []
  }

  const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1)
  const count = parts.COUNT ? Number(parts.COUNT) : undefined
  const until = untilDate(parts.UNTIL, zone)
  const horizonEnd = addDays(from, horizonDays)

  if (freq === 'MONTHLY' || freq === 'YEARLY') {
    return expandCalendar(freq, parts, start, from, horizonEnd, interval, count, until, ignored)
  }

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
 * The monthly and yearly walks - a month or a year at a time from DTSTART,
 * the same day each step, skipping the steps that do not have that day.
 */
function expandCalendar(
  freq: 'MONTHLY' | 'YEARLY',
  parts: Record<string, string>,
  start: string,
  from: string,
  horizonEnd: string,
  interval: number,
  count: number | undefined,
  until: string | undefined,
  ignored: Set<string>,
): string[] {
  const [startYear, startMonth, startDay] = start.split('-').map(Number)
  const shape = freq === 'MONTHLY' ? monthlyShape(parts, startDay) : yearlyShape(parts, startMonth, startDay)
  if (!shape) {
    const word = freq === 'MONTHLY' ? 'monthly' : 'yearly'
    ignored.add(`Only the plain ${word} repeat is read - the same ${freq === 'MONTHLY' ? 'day each month' : 'date each year'}; one with a day rule was skipped.`)
    return []
  }

  const dates: string[] = []
  let emitted = 0
  for (let step = 0; ; step += interval) {
    const year = freq === 'MONTHLY' ? startYear + Math.floor((startMonth - 1 + step) / 12) : startYear + step
    const month = freq === 'MONTHLY' ? ((startMonth - 1 + step) % 12) + 1 : shape.month
    const first = key(year, month, 1)
    if (first > horizonEnd) break
    if (emitted > MAX_OCCURRENCES) break
    if (shape.day > daysInMonth(year, month)) continue
    const date = key(year, month, shape.day)
    if (date < start) continue
    if (until && date > until) break
    if (count !== undefined && emitted >= count) break
    emitted++
    if (date >= from && date <= horizonEnd) dates.push(date)
  }
  return dates
}

/** The one monthly shape read: a single positive day of the month. */
function monthlyShape(parts: Record<string, string>, startDay: number): { month: number; day: number } | null {
  if (parts.BYDAY || parts.BYSETPOS || parts.BYMONTH || parts.BYYEARDAY || parts.BYWEEKNO) return null
  if (!parts.BYMONTHDAY) return { month: 0, day: startDay }
  const day = Number(parts.BYMONTHDAY)
  if (!Number.isInteger(day) || day < 1 || day > 31) return null
  return { month: 0, day }
}

/**
 * The one yearly shape read: the same date each year. BYMONTH and
 * BYMONTHDAY are accepted when they only restate DTSTART, which is how
 * some writers spell a birthday.
 */
function yearlyShape(parts: Record<string, string>, startMonth: number, startDay: number): { month: number; day: number } | null {
  if (parts.BYDAY || parts.BYSETPOS || parts.BYYEARDAY || parts.BYWEEKNO) return null
  if (parts.BYMONTH && Number(parts.BYMONTH) !== startMonth) return null
  if (parts.BYMONTHDAY && Number(parts.BYMONTHDAY) !== startDay) return null
  return { month: startMonth, day: startDay }
}

/**
 * UNTIL as a date in the walk's own frame. The RFC wants it in UTC for a
 * zoned event, so 22:00Z on the 3rd is still the 3rd in New York and already
 * the 4th in Vilnius; a bare date or a floating time is taken as written.
 */
function untilDate(value: string | undefined, zone: Zone): string | undefined {
  if (!value) return undefined
  const raw = readRawDate(value, {})
  if (!raw) return undefined
  if (raw.allDay || !raw.utc) return raw.wall.date
  return dateInZone(wallToInstant(raw.wall, 'UTC'), zone)
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

function key(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
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
