import type { DayPlan, IfThenEntry, Settings, SleepProfile, SleepWindow, Template, ThemeState } from './types'
import { isCategoryId } from './categories'

/**
 * The shape a stored payload has to have before any of it is trusted.
 *
 * This is the import path for a file a person may have edited, and the
 * load path for a key any extension on the page can write, so it is a
 * deep type guard rather than a shape check: every field the app reads is
 * checked to the value, and a payload that fails anywhere is discarded
 * whole rather than partly trusted. `loadData` and `importJson` only ever
 * replace state after this says yes, which is why a bad backup changes
 * nothing.
 *
 * Written as tables, one per entity: a field, and what a value in it may
 * be. The checks are the small vocabulary at the top - a string, a whole
 * number in a range, one of a list, a list of, optional - and a table
 * reads the way `types.ts` reads, field by field, with the same names in
 * the same order. It used to be a hand-written guard per entity, each a
 * chain of `typeof` and `&&`, and the one thing that made hard was
 * answering "is this field checked at all" without reading every line.
 *
 * What absent means is documented on the type, in `types.ts`, and what
 * absent becomes is decided in `normalizeLoaded` in `storage.ts` - some
 * of those are migrations rather than defaults, and they belong beside the
 * load rather than in a table about validity. A field marked `optional`
 * here is one the app reads as "not set"; nothing is ever coerced.
 *
 * Every rule that is tighter than the type - a bounded reminder interval,
 * a real "HH:MM", a hex colour - has its reason beside it, because each
 * one was a bug or a hole first.
 */

type Check = (x: unknown) => boolean

// --- the vocabulary -----------------------------------------------------------

const string: Check = x => typeof x === 'string'
const boolean: Check = x => typeof x === 'boolean'

/** Absent is a state; present must pass. Nothing here ever coerces. */
const optional = (check: Check): Check => x => x === undefined || check(x)

const listOf = (check: Check): Check => x => {
  if (!Array.isArray(x)) return false
  for (const item of x) if (!check(item)) return false
  return true
}

const oneOf = (values: readonly string[]): Check => x => typeof x === 'string' && values.includes(x)

/** A whole number in a range: never fractional, never negative unless said so. */
const wholeNumber = (min: number, max = Number.POSITIVE_INFINITY): Check => x =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max

/** A string with a length cap - a backup is an untrusted document. */
const text = (min: number, max: number): Check => x => typeof x === 'string' && x.length >= min && x.length <= max

const matching = (re: RegExp): Check => x => typeof x === 'string' && re.test(x)

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/**
 * An object whose named fields each pass their check. Fields not named are
 * not read by the app and ride along untouched, which is what lets a backup
 * from a newer build load on an older one. `also` is for the rule that is
 * about the object rather than one field in it.
 */
const record = (fields: Record<string, Check>, also?: (x: Record<string, unknown>) => boolean): Check => {
  // The table is read once, here, not on every value: a twenty-megabyte
  // backup runs this a few hundred thousand times, and an entries array per
  // call was the difference between a second and five.
  const entries = Object.entries(fields)
  return x => {
    if (!isRecord(x)) return false
    for (const [key, check] of entries) if (!check(x[key])) return false
    return also === undefined || also(x)
  }
}

/** An object used as a map: every key and every value checked. */
const mapOf = (key: Check, value: Check): Check => x =>
  isRecord(x) && Object.entries(x).every(([k, v]) => key(k) && value(v))

// --- the values with a grammar --------------------------------------------------

// A crafted backup could set Template.color, IfThenEntry.color, or any value
// inside a ThemeOverrides patch to a CSS url() value. None of these strings
// are ever built into a "property: value;" text this app writes itself -
// they only reach the page through CSSStyleDeclaration.setProperty or a
// React style object, and a live check confirmed both reject a malformed
// combined declaration. What does work is a single url() value landing
// somewhere a browser accepts one as a value on its own - a background
// layer being the confirmed case - which fires a real request and leaks the
// viewer's IP, user agent and timing to whoever crafted the file.
// Validating here, at the one place every one of these strings passes
// through before it is trusted, closes the whole class rather than chasing
// every render site that happens to use one today.
//
// Template.color and IfThenEntry.color are always one of the eight palette
// values in practice, chosen from a swatch grid with no free-text field
// anywhere - see colors.ts. Every hex length CSS recognises is accepted (3,
// 4, 6 or 8 digits) rather than only the 6 the palette uses, so a hand-picked
// value from an older export is not punished for a shape the UI never needed.
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const color = matching(HEX_COLOR_RE)

// A real "HH:MM" clock time. Stricter than a bare string, because a
// malformed sleep-window time does not stay contained to one row - it feeds
// straight into wakingWindow's arithmetic in capacity.ts, where a NaN from
// a bad split corrupts the capacity line, every gap and the grid's greyed
// band for the whole day. Task.time and TemplateBlock.time are a bare
// string still: a bad one there breaks one card, not the day.
const TIME_STRING_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const clockTime = matching(TIME_STRING_RE)

// The 21 keys ThemeTokens in themes.ts actually names, grouped by what a
// legitimate value looks like - duplicated here rather than imported because
// this file only needs the shape, not the values, and a hand-maintained list
// next to its own validator is easier to audit than a cross-module
// reference. Keep in sync with ThemeTokens in themes.ts.
const COLOR_TOKEN_KEYS = new Set([
  'bg', 'surface', 'rule', 'border', 'margin',
  'text', 'muted', 'accent', 'accentDim', 'mark', 'danger', 'good',
])
const DIMENSION_TOKEN_KEYS = new Set(['ruleSize', 'radius', 'edge'])
const FONT_TOKEN_KEYS = new Set(['fontDisplay', 'fontBody', 'fontMono'])

const DIMENSION_PART_RE = /^-?\d+(?:\.\d+)?(?:px|em|rem|%)$/

// edge alone can be a full CSS border-radius shorthand - four lengths and an
// optional "/" group for the hand-drawn preset's asymmetric corner (see
// HAND_DRAWN_EDGE in themes.ts) - so every space- or slash-separated piece
// is checked as its own plain length. A value built entirely from digits, a
// decimal point and a known unit can never spell a function call: there is
// no character left to write a "(" with.
const dimensionList: Check = x =>
  typeof x === 'string' && x.length > 0 && x.length <= 100 && x.split(/[\s/]+/).every(part => DIMENSION_PART_RE.test(part))

// grain: "a plain 0-1 number as a string", per ThemeTokens' own doc comment.
const unitInterval = matching(/^(?:0|1|0?\.\d+)$/)

// vignette: "a css percentage string", per the same.
const percent = matching(/^\d+(?:\.\d+)?%$/)

// A font stack is letters, digits, spaces, hyphens, apostrophes and commas -
// "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" (see
// SYSTEM_SANS in themes.ts). No parenthesis is ever legitimate in one, so
// excluding it leaves no way to write a function call.
const fontStack: Check = x => typeof x === 'string' && x.length > 0 && x.length <= 200 && /^[a-zA-Z0-9 ,'-]+$/.test(x)

// shadow: a real box-shadow, "0 1px 3px rgba(0, 0, 0, 0.06)" or several
// joined with commas - the one token whose legitimate grammar needs
// parentheses. Only rgba()/rgb()/hsla()/hsl() calls may carry them: every
// such call is stripped first, and whatever is left must hold no parenthesis
// at all, so a url() can hide neither inside a fake function name nor
// outside one.
const SHADOW_FUNCTION_RE = /\b(?:rgba|rgb|hsla|hsl)\([\d.\s,%]*\)/gi
const shadow: Check = x => {
  if (typeof x !== 'string' || x.length === 0 || x.length > 300) return false
  const withoutFunctions = x.replace(SHADOW_FUNCTION_RE, '')
  return !/[(){}]/.test(withoutFunctions) && /^[\d.,#a-zA-Z%\s-]*$/.test(withoutFunctions)
}

// One value in a ThemeOverrides patch, keyed by which token it claims to
// override. A key naming none of the 21 - a stale token from an older build,
// "ruleStyle" (carried in the patch but never written to a custom property,
// see applyOverrides in theme.ts), a typo - is checked only as a bounded
// string: applyOverrides ignores any key outside the list, so it never
// reaches a style attribute whatever it holds.
function overrideValue(key: string, value: unknown): boolean {
  if (COLOR_TOKEN_KEYS.has(key)) return color(value)
  if (DIMENSION_TOKEN_KEYS.has(key)) return dimensionList(value)
  if (key === 'grain') return unitInterval(value)
  if (key === 'vignette') return percent(value)
  if (FONT_TOKEN_KEYS.has(key)) return fontStack(value)
  if (key === 'shadow') return shadow(value)
  return typeof value === 'string' && value.length <= 200
}

const themeOverrides: Check = x => isRecord(x) && Object.entries(x).every(([key, v]) => overrideValue(key, v))

// --- the lists a value may come from ------------------------------------------

const DAY_TYPES = ['full', 'shift', 'night', 'rest'] as const
const IF_THEN_WHENS = ['morning', 'day', 'evening', 'any'] as const
const THEME_MODES = ['light', 'dark', 'system'] as const
const DAY_LAYOUT_FOCUSES = ['both', 'calendar', 'tasks'] as const
const LIBRARY_TRACKS = ['pages', 'movie', 'series'] as const
const REPEATS = ['daily', 'weekdays', 'weekly'] as const
const ORIGIN_TYPES = ['template', 'repeat', 'manual'] as const

// A category is checked by identity against the six the app defines, not by
// shape: unlike a colour there is no grammar, and an id that is not one of
// ours would silently draw nothing.
const category: Check = x => isCategoryId(x)

// A whole number of minutes, never negative. Rejecting a fractional or
// negative value rather than coercing it keeps a corrupted field from
// silently poisoning the capacity arithmetic - docs/TIMELINE.md section 4.
const minutes = wholeNumber(0)

// A count typed by a person, or restored from a file they may have edited:
// bounded well below anything that could make a progress bar misbehave.
const count = wholeNumber(0, 100_000)

// --- the entities, field by field ----------------------------------------------

const LIBRARY_REF = record({ listId: string, itemId: string })

const SUBTASK = record({ id: string, title: string, done: boolean })

const ORIGIN = record({ type: oneOf(ORIGIN_TYPES), sourceId: optional(string), blockId: optional(string) })

const TASK = record({
  id: string,
  title: string,
  done: boolean,
  time: optional(string),
  fromTemplate: optional(boolean),
  pushCount: optional(wholeNumber(0)),
  core: optional(boolean),
  minutes: optional(minutes),
  unbounded: optional(boolean),
  category: optional(category),
  libraryRef: optional(LIBRARY_REF),
  note: optional(string),
  highlight: optional(boolean),
  subtasks: optional(listOf(SUBTASK)),
  repeat: optional(oneOf(REPEATS)),
  repeatOf: optional(string),
  origin: optional(ORIGIN),
  tourCreated: optional(boolean),
})

const TEMPLATE_BLOCK = record({
  id: string,
  title: string,
  time: optional(string),
  core: optional(boolean),
  minutes: optional(minutes),
  unbounded: optional(boolean),
  category: optional(category),
  libraryListId: optional(string),
})

const TEMPLATE = record({
  id: string,
  name: string,
  color,
  blocks: listOf(TEMPLATE_BLOCK),
  // Absent for a template saved before day types existed; anything but the
  // four known values - a typo, a future build's value - fails rather than
  // being coerced into a guess.
  type: optional(oneOf(DAY_TYPES)),
  tourCreated: optional(boolean),
})

const DAY_PLAN = record({
  date: string,
  templateId: optional(string),
  sleepProfileId: optional(string),
  away: optional(string),
  bestMoment: optional(string),
  dayType: optional(oneOf(DAY_TYPES)),
  repeatSkips: optional(listOf(string)),
  autoApplied: optional(boolean),
  tasks: listOf(TASK),
})

const IF_THEN_ENTRY = record({
  id: string,
  trigger: string,
  action: string,
  color: optional(color),
  // Absent means every day, the same as an entry written before dayTypes
  // existed; present must be known values, an empty list included.
  dayTypes: optional(listOf(oneOf(DAY_TYPES))),
  when: optional(oneOf(IF_THEN_WHENS)),
  lastSurfaced: optional(string),
})

const INBOX_ITEM = record({ id: string, text: string, captured: string })

const BACKLOG_ITEM = record({
  id: string,
  title: string,
  category: optional(category),
  minutes: optional(minutes),
})

const SCRATCH_NOTE = record({
  id: string,
  text: string,
  createdAt: string,
  date: string,
  pinned: optional(boolean),
})

const GOAL = record({
  id: string,
  title: string,
  createdAt: string,
  why: optional(string),
  identity: optional(string),
  archivedAt: optional(string),
  tourCreated: optional(boolean),
})

const LIBRARY_ITEM = record({
  id: string,
  title: string,
  total: optional(count),
  progress: optional(count),
  track: optional(oneOf(LIBRARY_TRACKS)),
  pace: optional(string),
  season: optional(count),
  seasons: optional(count),
  finished: optional(string),
})

const LIBRARY_LIST = record({
  id: string,
  name: string,
  unit: string,
  unitPlural: optional(string),
  unitShort: optional(string),
  // A colour is a CSS value that gets painted, so it goes through the same
  // check every other colour in a payload does.
  color: optional(color),
  items: listOf(LIBRARY_ITEM),
  tourCreated: optional(boolean),
})

// Both halves required once a window is present at all: a bedtime with no
// wake time is not a shape the app can use, and defaulting the missing half
// would be inventing a fact.
const SLEEP_WINDOW = record({ start: clockTime, end: clockTime })

const SLEEP_PROFILE = record({ id: text(1, Number.POSITIVE_INFINITY), name: text(1, 60), window: SLEEP_WINDOW })

// Two schedules with the same id would make which one a day points at a
// matter of array order - the same reason preset ids are checked for
// uniqueness in themes.test.ts. An empty list is refused too: a payload on
// profiles has at least the default one.
const sleepProfiles: Check = x =>
  listOf(SLEEP_PROFILE)(x) && (x as SleepProfile[]).length > 0 && new Set((x as SleepProfile[]).map(p => p.id)).size === (x as SleepProfile[]).length

// The interval is bounded on both ends rather than merely "a number": a
// reminder every zero minutes is a loop, and one every three days is not a
// reminder. The text is capped for the reason every free string here is.
const REMINDER = record({ enabled: boolean, everyMinutes: wholeNumber(1, 240), text: text(0, 120) })

const TASK_REMINDER = record({ enabled: boolean, minutesBefore: wholeNumber(0, 120) })

const NORTH = record({ afterASlowDay: boolean, onMonday: boolean })

// The time is checked, not merely typed: "at": "banana" would make the
// comparison in shouldClose silently never true, which is a feature quietly
// switching itself off rather than a file being refused.
const EVENING_CLOSE = record({ enabled: boolean, at: clockTime, askBestMoment: boolean })

// Keys 0-6, values template ids. A weekday outside the week, or a non-string
// id, would be a map the app silently ignores forever, so it is refused at
// the door instead.
const WEEKDAY_MAP = mapOf(matching(/^[0-6]$/), string)

const THEME_STATE = record({
  presetId: string,
  overrides: mapOf(() => true, themeOverrides),
  mode: oneOf(THEME_MODES),
})

/** Pre-migration payloads stored the theme as a bare 'light' | 'dark'. */
export type LegacyTheme = 'light' | 'dark'
export type StoredTheme = LegacyTheme | ThemeState

export function isLegacyTheme(x: unknown): x is LegacyTheme {
  return x === 'light' || x === 'dark'
}

export function isStoredTheme(x: unknown): x is StoredTheme {
  return isLegacyTheme(x) || THEME_STATE(x)
}

// Every field after enabledWidgets is checked only when present: a payload
// written before the field existed has no such key at all, and that is not
// corruption, it is every real backup on disk before the feature shipped.
// normalizeLoaded backfills them once validation passes. A field that is
// present but malformed fails the whole payload, exactly like a bad
// Template.color does.
const SETTINGS = record({
  theme: isStoredTheme,
  enabledWidgets: listOf(string),
  timelineExpanded: optional(boolean),
  dayLayoutFocus: optional(oneOf(DAY_LAYOUT_FOCUSES)),
  density: optional(oneOf(['comfortable', 'compact'])),
  textScale: optional(oneOf(['s', 'm', 'l'])),
  reminder: optional(REMINDER),
  sleepWindow: optional(SLEEP_WINDOW),
  nightSleepWindow: optional(SLEEP_WINDOW),
  sleepProfiles: optional(sleepProfiles),
  weekdayTemplates: optional(WEEKDAY_MAP),
  taskReminder: optional(TASK_REMINDER),
  north: optional(NORTH),
  eveningClose: optional(EVENING_CLOSE),
})

/**
 * The shape `validate` accepts: everything AppData requires, except that
 * settings.theme may still be the pre-migration string and every list added
 * since v1.0 may be absent. `normalizeLoaded` turns this into a real
 * AppData.
 */
export interface StoredAppData {
  templates: Template[]
  days: Record<string, DayPlan>
  settings: Omit<Partial<Settings>, 'theme' | 'enabledWidgets'> & {
    theme: StoredTheme
    enabledWidgets: string[]
    sleepWindow?: SleepWindow
    nightSleepWindow?: SleepWindow
  }
  ifThens?: IfThenEntry[]
  inbox?: AppDataLists['inbox']
  backlog?: AppDataLists['backlog']
  scratch?: AppDataLists['scratch']
  library?: AppDataLists['library']
  goals?: AppDataLists['goals']
}

type AppDataLists = Pick<import('./types').AppData, 'inbox' | 'backlog' | 'scratch' | 'library' | 'goals'>

// Templates, days and settings are required: a payload without them is not
// a plan. A shape check on those three alone once let {"templates":[{}],
// "days":{},"settings":{}} through, which crashed the templates view on
// t.blocks.length with no way back except clearing storage by hand - hence
// the tables above go all the way down.
const STORED_APP_DATA = record({
  templates: listOf(TEMPLATE),
  days: mapOf(() => true, DAY_PLAN),
  settings: SETTINGS,
  ifThens: optional(listOf(IF_THEN_ENTRY)),
  inbox: optional(listOf(INBOX_ITEM)),
  backlog: optional(listOf(BACKLOG_ITEM)),
  scratch: optional(listOf(SCRATCH_NOTE)),
  library: optional(listOf(LIBRARY_LIST)),
  goals: optional(listOf(GOAL)),
})

export function validate(x: unknown): x is StoredAppData {
  return STORED_APP_DATA(x)
}
