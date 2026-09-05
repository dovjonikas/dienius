import { addDays } from '../../lib/dates'
import { weekdayOf } from '../../lib/repeats'
import type { Shape } from './interrupt'

/**
 * One typed line about an interruption, in Lithuanian or in English:
 * "tomorrow 10-13 dad", "thu afternoon", "ryt 10 val tetis", "pn ryte",
 * "rytoj 14:00 dantistas 30min".
 *
 * The chips on the sheet are the ordinary path, and this is the faster one
 * for somebody who types quicker than they tap. It is a table of the words
 * that actually get said about a day - the weekdays and their short forms,
 * today and tomorrow and the day after, the four parts of a day, a time, a
 * range, a length - and nothing more: not a grammar, not a library. Every
 * word it knows is in this file, and a word it does not know is part of the
 * title, which is the safe failure.
 *
 * Diacritics are folded before matching, so "ketvirtadienį" and
 * "ketvirtadieni" are the same word and "šeštadienis" finds its row. The
 * fold keeps one character per character, which is what lets a match on the
 * folded text cut the same span out of the original.
 *
 * The result is the tokens plus their positions, because the sheet works
 * the other way too: tapping a day chip takes the day word *out* of the
 * line, so the line and the chips can never say two different things -
 * CONVENTIONS section 16's rule for quick-add, kept here the cheap way.
 */

export type TokenKind = 'day' | 'shape' | 'time' | 'length' | 'open'

/** Days from today, or a weekday - which means the next one, never today. */
export type DayToken = { offset: number } | { weekday: number }

export interface Span {
  start: number
  end: number
  kind: TokenKind
}

export interface ParsedLine {
  day?: DayToken
  shape?: Shape
  /** Clock minutes. A range sets both; "from 10" sets only the start; "until 13" only the end. */
  start?: number
  end?: number
  /** A length written as one - "2h", "30min", "1h30". */
  minutes?: number
  /** Open-ended: "don't know" said in words, a "?" at the end, or "from 10" with nothing closing it. */
  open?: boolean
  /** Whatever the tokens did not claim. Empty when the line was all tokens. */
  title: string
  spans: Span[]
}

// --- the words ----------------------------------------------------------------

/**
 * Folded weekday names to `Date.getDay()` numbers. Full names, the English
 * three-letter forms, and the Lithuanian two-letter ones the owner writes -
 * pr, an, tr, kt, pn, st, sk - plus the cases a phrase puts them in
 * ("ketvirtadienį" folds to "ketvirtadieni").
 */
const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, sk: 0, sekmadienis: 0, sekmadieni: 0, sekmadienio: 0,
  mon: 1, monday: 1, pr: 1, pirmadienis: 1, pirmadieni: 1, pirmadienio: 1,
  tue: 2, tues: 2, tuesday: 2, an: 2, antradienis: 2, antradieni: 2, antradienio: 2,
  wed: 3, weds: 3, wednesday: 3, tr: 3, treciadienis: 3, treciadieni: 3, treciadienio: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, kt: 4, ketvirtadienis: 4, ketvirtadieni: 4, ketvirtadienio: 4,
  fri: 5, friday: 5, pn: 5, penktadienis: 5, penktadieni: 5, penktadienio: 5,
  sat: 6, saturday: 6, st: 6, sestadienis: 6, sestadieni: 6, sestadienio: 6,
}

// Longest first, so "sekmadienis" is not read as "sekmadieni" plus an s.
const WEEKDAY_RE = new RegExp(
  `\\b(?:${Object.keys(WEEKDAYS)
    .sort((a, b) => b.length - a.length)
    .join('|')})\\b`,
  'g',
)

const DAY_RES: [RegExp, DayToken][] = [
  [/\b(?:the day after tomorrow|day after tomorrow|poryt)\b/g, { offset: 2 }],
  [/\b(?:tomorrow|tmrw|rytoj|ryt)\b/g, { offset: 1 }],
  [/\b(?:today|siandien|sandien)\b/g, { offset: 0 }],
]

// "vakar" is yesterday, so only the forms that mean the evening are here.
const SHAPE_RES: [RegExp, Shape][] = [
  [/\b(?:all[- ]day|the whole day|whole day|visa diena|visa dien[ai])\b/g, 'whole'],
  [/\b(?:afternoon|after lunch|po pietu|popiet\w*)\b/g, 'afternoon'],
  [/\b(?:morning|is ryto|ryte|ryta|rytas|rytmet\w*|priespiet\w*)\b/g, 'morning'],
  [/\b(?:evening|tonight|vakare|vakara|vakaras|vakarop)\b/g, 'evening'],
]

/**
 * Times. Every one of these needs a signal beyond a bare number - a colon,
 * am or pm, "val" (Lithuanian o'clock), "at", a range - because a bare
 * number in a title is usually a number: "call dad 2" is not two o'clock.
 * The range accepts the dash a phone keyboard autocorrects a hyphen into,
 * written as its escape because this codebase spells no dash but a hyphen.
 */
const RANGE_RE =
  /(?:\b(?:nuo|from)\s+)?\b(\d{1,2})(?:[:.](\d{2}))?(?:\s*(am|pm))?\s*(?:-|\u2013|to|till|until|iki)\s*(\d{1,2})(?:[:.](\d{2}))?(?:\s*(am|pm))?(?:\s*val)?\b/g
const FROM_RE = /\b(?:nuo|from)\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*(am|pm))?(?:\s*val)?\b/g
const UNTIL_RE = /\b(?:iki|until|till|before)\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*(am|pm))?(?:\s*val)?\b/g
const AT_RE = /\b(?:at|apie)\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*(am|pm))?(?:\s*val)?\b/g
const COLON_RE = /\b(\d{1,2}):(\d{2})(?:\s*(am|pm))?\b/g
const AMPM_RE = /\b(\d{1,2})\s*(am|pm)\b/g
const VAL_RE = /\b(\d{1,2})\s*val\b/g

const HOURS_RE = /\b(\d{1,2})\s*(?:h|hr|hrs|hour|hours|valand\w*)(?:\s*(\d{1,2})(?:\s*(?:min\w*|m))?)?\b/g
const MINUTES_RE = /\b(\d{1,3})\s*(?:min|mins|minute|minutes|minuciu|minutes|minutems|m)\b/g

const OPEN_RE = /\b(?:don'?t know(?: how long)?|dont know|dunno|no idea|nezinau|nezinia|neaisku|open[- ]ended)\b|\?\s*$/g

// --- folding -----------------------------------------------------------------

/**
 * Lowercase, diacritics off, one character per character. `normalize('NFD')`
 * splits "ą" into "a" plus a combining mark and the first is kept; a
 * character that lowercases to two keeps its first. Positions in the
 * result are positions in the input, which is the whole point.
 */
export function fold(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const base = text[i].normalize('NFD')[0] ?? text[i]
    out += base.toLowerCase()[0] ?? ' '
  }
  return out
}

// --- reading -----------------------------------------------------------------

function clock(h: string, m: string | undefined, ampm: string | undefined): number | undefined {
  let hour = Number(h)
  const minute = m ? Number(m) : 0
  if (minute > 59) return undefined
  if (ampm) {
    if (hour < 1 || hour > 12) return undefined
    if (ampm === 'pm' && hour < 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
  } else if (hour > 23) {
    return undefined
  }
  return hour * 60 + minute
}

interface Found {
  span: Span
  apply: (out: ParsedLine) => void
}

export function parseInterruptLine(text: string): ParsedLine {
  const folded = fold(text)
  const taken: boolean[] = new Array<boolean>(folded.length).fill(false)
  const found: Found[] = []
  let fromOpen = false
  let saidOpen = false

  function claim(kind: TokenKind, start: number, end: number, apply: (out: ParsedLine) => void): void {
    for (let i = start; i < end; i++) if (taken[i]) return
    for (let i = start; i < end; i++) taken[i] = true
    found.push({ span: { start, end, kind }, apply })
  }

  function scan(re: RegExp, kind: TokenKind, read: (m: RegExpExecArray) => ((out: ParsedLine) => void) | undefined): void {
    re.lastIndex = 0
    for (let m = re.exec(folded); m !== null; m = re.exec(folded)) {
      const apply = read(m)
      if (apply) claim(kind, m.index, m.index + m[0].length, apply)
      if (m[0].length === 0) re.lastIndex++
    }
  }

  for (const [re, shape] of SHAPE_RES) scan(re, 'shape', () => out => { out.shape = shape })
  for (const [re, day] of DAY_RES) scan(re, 'day', () => out => { out.day = day })
  scan(WEEKDAY_RE, 'day', m => {
    // Two of the short forms are English words. "an" before a vowel or an h
    // is the article ("an hour with dad"), and "St." is a saint, not a
    // Saturday. Everything else the table says goes.
    const after = folded[m.index + m[0].length] ?? ''
    const next = folded.slice(m.index + m[0].length).trimStart()[0] ?? ''
    if (m[0] === 'an' && /[aeiouh]/.test(next)) return undefined
    if (m[0] === 'st' && after === '.') return undefined
    const weekday = WEEKDAYS[m[0]]
    return out => { out.day = { weekday } }
  })

  scan(RANGE_RE, 'time', m => {
    // "2-4pm": the first number borrows the second's half of the day when it
    // has none of its own and the borrowing keeps the range in order.
    const endSuffix = m[6]
    const startSuffix = m[3] ?? (endSuffix && Number(m[1]) <= 12 ? endSuffix : undefined)
    const start = clock(m[1], m[2], startSuffix)
    const end = clock(m[4], m[5], endSuffix)
    if (start === undefined || end === undefined || start >= end) return undefined
    return out => { out.start = start; out.end = end }
  })
  scan(FROM_RE, 'time', m => {
    const start = clock(m[1], m[2], m[3])
    if (start === undefined) return undefined
    return out => { out.start = start; fromOpen = true }
  })
  scan(UNTIL_RE, 'time', m => {
    const end = clock(m[1], m[2], m[3])
    return end === undefined ? undefined : out => { out.end = end }
  })
  for (const re of [AT_RE, COLON_RE]) {
    scan(re, 'time', m => {
      const start = clock(m[1], m[2], m[3])
      return start === undefined ? undefined : out => { out.start = start }
    })
  }
  scan(AMPM_RE, 'time', m => {
    const start = clock(m[1], undefined, m[2])
    return start === undefined ? undefined : out => { out.start = start }
  })
  scan(VAL_RE, 'time', m => {
    const start = clock(m[1], undefined, undefined)
    return start === undefined ? undefined : out => { out.start = start }
  })

  scan(HOURS_RE, 'length', m => {
    const minutes = Number(m[1]) * 60 + (m[2] !== undefined ? Number(m[2]) : 0)
    return minutes > 0 ? out => { out.minutes = minutes } : undefined
  })
  scan(MINUTES_RE, 'length', m => {
    const minutes = Number(m[1])
    return minutes > 0 ? out => { out.minutes = minutes } : undefined
  })

  scan(OPEN_RE, 'open', () => () => { saidOpen = true })

  const out: ParsedLine = { title: '', spans: [] }
  found.sort((a, b) => a.span.start - b.span.start)
  for (const f of found) f.apply(out)
  // "From 10" on its own is open until something closes it - a length or an
  // end both answer how long. Said in words, open stays open whatever else
  // was typed; the person said they do not know.
  const closed = out.minutes !== undefined || out.end !== undefined
  if (saidOpen || (fromOpen && !closed)) out.open = true
  out.spans = found.map(f => f.span)
  out.title = cut(text, out.spans)
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')
    .trim()
  return out
}

/** The text with the spans taken out, seams left as they fall. */
function cut(text: string, spans: Span[]): string {
  let kept = ''
  let at = 0
  for (const s of spans) {
    kept += text.slice(at, s.start)
    at = s.end
  }
  return kept + text.slice(at)
}

/**
 * The line with one kind of word taken out - what a chip does to it, so a
 * tapped day does not leave "tomorrow" sitting in the words as a second
 * answer. Whitespace is tidied, nothing else is touched.
 */
export function stripTokens(text: string, kinds: TokenKind[]): string {
  const spans = parseInterruptLine(text).spans.filter(s => kinds.includes(s.kind))
  if (spans.length === 0) return text
  return cut(text, spans).replace(/\s{2,}/g, ' ').replace(/^\s+/, '')
}

/**
 * The line with its title replaced and every token kept - what a recent-name
 * chip does. Tokens keep their order; the name goes after them.
 */
export function withTitle(text: string, title: string): string {
  const tokens = parseInterruptLine(text).spans.map(s => text.slice(s.start, s.end).trim())
  return [...tokens, title.trim()].filter(Boolean).join(' ')
}

/**
 * The date a day word means. A weekday is the next one and never today -
 * somebody saying "Thursday" on a Thursday means the one coming, or they
 * would have said today. The same rule the palette's date parsing keeps.
 */
export function resolveDay(day: DayToken, today: string): string {
  if ('offset' in day) return addDays(today, day.offset)
  const ahead = ((day.weekday - weekdayOf(today) + 7) % 7) || 7
  return addDays(today, ahead)
}
