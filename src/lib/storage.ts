import type { AppData, DayPlan, DayType, IfThenEntry, IfThenWhen, InboxItem, Settings, SleepProfile, SleepWindow, Task, Template, TemplateBlock, ThemeOverrides, ThemeState } from './types'
import { isCategoryId } from './categories'

const DAY_TYPES: readonly string[] = ['full', 'shift', 'night', 'rest']
const IF_THEN_WHENS: readonly string[] = ['morning', 'day', 'evening', 'any']
const THEME_MODES: readonly string[] = ['light', 'dark', 'system']
const DAY_LAYOUT_FOCUSES: readonly string[] = ['both', 'calendar', 'tasks']

// Duplicated from themes.ts on purpose rather than imported - storage.ts
// has no reason to depend on the preset data itself, only on the id a
// fresh install should start with. See DEFAULT_PRESET_ID in themes.ts.
const DEFAULT_PRESET_ID = 'dark'

// Off, every twenty minutes, and a sentence about the two things a body
// actually needs during a long block. Duplicated here rather than imported
// for the same reason DEFAULT_PRESET_ID is: this file only needs the literal
// a fresh install starts with.
const DEFAULT_REMINDER: Settings['reminder'] = { enabled: false, everyMinutes: 20, text: 'Stand up, drink water' }

// Duplicated from capacity.ts for the same reason DEFAULT_SLEEP_WINDOW is.
const DEFAULT_SLEEP_PROFILE_ID = 'default'
const DEFAULT_SLEEP_PROFILE_NAME = 'Sleep schedule'

// Duplicated from capacity.ts's own DEFAULT_SLEEP_WINDOW/DEFAULT_NIGHT_SLEEP_WINDOW
// rather than imported, for the same reason DEFAULT_PRESET_ID above is not
// imported from themes.ts: this file only needs the two literal values a
// fresh install starts with, not a dependency on a widget module. Each is
// the exact inverse of the fixed waking window this setting replaces
// (07:00-23:00, 13:00-24:00) - see that file's own comment for why.
const DEFAULT_SLEEP_WINDOW: SleepWindow = { start: '23:00', end: '07:00' }
const DEFAULT_NIGHT_SLEEP_WINDOW: SleepWindow = { start: '00:00', end: '13:00' }

// A payload written before this phase has settings.theme as a plain
// 'light' | 'dark' string. isSettings accepts both that legacy shape and
// the new ThemeState object so an existing person's data still loads;
// migrateTheme below is what actually upgrades it, called on every load
// and import regardless of which shape validation just accepted.
type LegacyTheme = 'light' | 'dark'
type StoredTheme = LegacyTheme | ThemeState

// Widgets that ship enabled for everyone, with no settings control to turn
// them off.
const DEFAULT_ENABLED_WIDGETS = ['day-plan']

// The if-then board's old widget registry id, from when it rendered as its
// own stacked section under the day plan - see docs/TIMELINE.md section 6.
// It surfaces inline on the day view now (IfThenDayRule) rather than
// through the widget registry, so this id no longer names anything in
// `WIDGETS`. Kept here only so normalizeLoaded can strip it out of real
// people's existing `enabledWidgets` lists below - every install from
// before this change has it, since there was never a toggle to remove it
// by hand, and leaving it in place would mean carrying a dead reference in
// everyone's data forever for no reason.
const LEGACY_IF_THEN_WIDGET_ID = 'if-then'

// Also duplicated, deliberately and minimally, in the pre-paint script in
// index.html - that script reads settings.theme straight out of this key
// before React mounts, so it has to know the key and that one field's shape
// on its own. Change either here and check the other still matches.
export const STORAGE_KEY = 'dienius:data'

// A brand new install has never expressed a light/dark preference, so it
// gets the spec's own default of following the system live - unlike a
// legacy payload being migrated below, which had an explicit choice on
// disk already and keeps it. See docs/THEMES.md section 4.
function defaultThemeState(): ThemeState {
  return { presetId: DEFAULT_PRESET_ID, overrides: {}, mode: 'system' }
}

export function defaultData(): AppData {
  return {
    templates: [],
    days: {},
    settings: {
      theme: defaultThemeState(),
      enabledWidgets: [...DEFAULT_ENABLED_WIDGETS],
      timelineExpanded: false,
      dayLayoutFocus: 'both',
      density: 'comfortable',
      textScale: 'm',
      reminder: { ...DEFAULT_REMINDER },
      sleepProfiles: [{ id: DEFAULT_SLEEP_PROFILE_ID, name: DEFAULT_SLEEP_PROFILE_NAME, window: { ...DEFAULT_SLEEP_WINDOW } }],
    },
    ifThens: [],
    inbox: [],
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isOptionalString(x: unknown): x is string | undefined {
  return x === undefined || typeof x === 'string'
}

// --- Color and other CSS-value validation -------------------------------
//
// A crafted backup could set Template.color, IfThenEntry.color, or any
// value inside a ThemeOverrides patch to a CSS url() value. None of these
// strings are ever built into a "property: value;" text string this app
// writes itself - they only ever reach the page through
// CSSStyleDeclaration.setProperty or a React style object, and a live check
// confirmed both reject a malformed combined declaration outright (a
// semicolon-based breakout does not work here). What does work is a single
// url() value landing somewhere a browser accepts one as a value on its
// own - a background layer being the confirmed case - which fires a real
// request and leaks the viewer's IP, user agent and timing to whoever
// crafted the file. Validating here, at the one place every one of these
// strings has to pass through before it is trusted, closes the whole class
// rather than chasing every render site that happens to use one today.
//
// A bad value here fails the whole payload's validate(), the same
// treatment an out-of-range Task.minutes or an unknown DayType already
// gets - this file has never partially accepted a payload by silently
// dropping the one field that failed, and a color is not a special case
// that earns different treatment. Because loadData() and importJson() both
// only ever replace state after validate() succeeds, a backup that fails
// this check changes nothing - existing data stays exactly as it was, the
// same as any other rejected import.

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

// Template.color and IfThenEntry.color: both are always one of the eight
// hex values in PALETTE_COLORS in practice, chosen from a fixed swatch grid
// with no free-text color field anywhere in the app - see colors.ts. This
// accepts every length of hex color CSS itself recognizes (3, 4, 6 or 8
// digits, the last two carrying alpha) rather than only the exact 6-digit
// shape the palette happens to use today, so a genuinely hand-picked hex
// value from an older export or another tool is not punished for a shape
// the UI itself never needed.
function isColor(x: unknown): x is string {
  return typeof x === 'string' && HEX_COLOR_RE.test(x)
}

function isOptionalColor(x: unknown): x is string | undefined {
  return x === undefined || isColor(x)
}

// The 21 keys ThemeTokens in themes.ts actually names, grouped by what a
// legitimate value looks like - duplicated here rather than imported for
// the same reason DEFAULT_PRESET_ID above is: this file only needs to know
// the shape, not the values, and a hand-maintained list next to its own
// validator is easier to audit at a glance than a cross-module reference.
// Keep in sync with ThemeTokens in themes.ts.
const COLOR_TOKEN_KEYS = new Set([
  'bg', 'surface', 'rule', 'border', 'margin',
  'text', 'muted', 'accent', 'accentDim', 'mark', 'danger', 'good',
])
const DIMENSION_TOKEN_KEYS = new Set(['ruleSize', 'radius', 'edge'])
const FONT_TOKEN_KEYS = new Set(['fontDisplay', 'fontBody', 'fontMono'])

const DIMENSION_PART_RE = /^-?\d+(?:\.\d+)?(?:px|em|rem|%)$/

// edge alone can be a full CSS border-radius shorthand - four lengths and
// an optional "/" group for the hand-drawn preset's own asymmetric corner
// (see HAND_DRAWN_EDGE in themes.ts) - so this checks that every space- or
// slash-separated piece is its own plain length, rather than expecting one
// single value. A value built entirely from digits, a decimal point and a
// known unit can never spell out a function call, with or without "url" in
// it - there is no character left to write a "(" with.
function isDimensionList(x: unknown): x is string {
  if (typeof x !== 'string' || x.length === 0 || x.length > 100) return false
  return x.split(/[\s/]+/).every(part => DIMENSION_PART_RE.test(part))
}

// grain: "a plain 0-1 number as a string" per its own doc comment on ThemeTokens.
function isUnitInterval(x: unknown): x is string {
  return typeof x === 'string' && /^(?:0|1|0?\.\d+)$/.test(x)
}

// vignette: "a css percentage string" per its own doc comment.
function isPercent(x: unknown): x is string {
  return typeof x === 'string' && /^\d+(?:\.\d+)?%$/.test(x)
}

// A font stack is letters, digits, spaces, hyphens, apostrophes and commas
// only - real values look like "-apple-system, BlinkMacSystemFont, 'Segoe
// UI', system-ui, sans-serif" (see SYSTEM_SANS in themes.ts). No
// parenthesis is ever legitimate in a font-family value, so excluding it
// outright leaves no way to write a function call regardless of what
// letters surround it.
function isFontStack(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0 && x.length <= 200 && /^[a-zA-Z0-9 ,'-]+$/.test(x)
}

// shadow: a real box-shadow value, e.g. "0 1px 3px rgba(0, 0, 0, 0.06)" or
// several of those joined with commas (see every preset's own shadow in
// themes.ts) - the one token whose legitimate grammar genuinely needs
// parentheses. Only rgba()/rgb()/hsla()/hsl() calls are allowed to carry
// them: every such call is stripped first, and whatever text is left must
// contain no parenthesis at all, so a url() (or anything else) can never
// hide either inside a fake function name or outside one.
const SHADOW_FUNCTION_RE = /\b(?:rgba|rgb|hsla|hsl)\([\d.\s,%]*\)/gi
function isShadow(x: unknown): x is string {
  if (typeof x !== 'string' || x.length === 0 || x.length > 300) return false
  const withoutFunctions = x.replace(SHADOW_FUNCTION_RE, '')
  return !/[(){}]/.test(withoutFunctions) && /^[\d.,#a-zA-Z%\s-]*$/.test(withoutFunctions)
}

// One value inside a ThemeOverrides patch, keyed by which of the 21
// ThemeTokens keys it claims to override. A key that names none of them -
// a stale token from an older build, "ruleStyle" (carried in the same patch
// object but validated here only as a plain bounded string, since
// applyOverrides in theme.ts never writes it to a custom property - see
// that function's own comment), a typo in a hand-edited backup - is
// checked only as a bounded string: theme.ts's own applyOverrides already
// ignores any key outside this list, so it never reaches a style attribute
// or a custom property regardless of what it holds.
function isOverrideValue(key: string, value: unknown): boolean {
  if (COLOR_TOKEN_KEYS.has(key)) return isColor(value)
  if (DIMENSION_TOKEN_KEYS.has(key)) return isDimensionList(value)
  if (key === 'grain') return isUnitInterval(value)
  if (key === 'vignette') return isPercent(value)
  if (FONT_TOKEN_KEYS.has(key)) return isFontStack(value)
  if (key === 'shadow') return isShadow(value)
  return typeof value === 'string' && value.length <= 200
}

function isOptionalPushCount(x: unknown): x is number | undefined {
  return x === undefined || (typeof x === 'number' && Number.isInteger(x) && x >= 0)
}

function isOptionalBoolean(x: unknown): x is boolean | undefined {
  return x === undefined || typeof x === 'boolean'
}

// Same rigor as isOptionalPushCount: absent is fine (unsized), but a
// present value must be a real non-negative whole number of minutes.
// Rejecting a fractional or negative value here rather than coercing it
// keeps a corrupted field from silently poisoning the capacity arithmetic
// in capacity.ts - see docs/TIMELINE.md section 4.
function isOptionalMinutes(x: unknown): x is number | undefined {
  return x === undefined || (typeof x === 'number' && Number.isInteger(x) && x >= 0)
}

// Accepts both an absent type (a template saved before this field existed,
// or a day never stamped) and any of the four known values. Anything else
// - a typo, a hand-edited backup, a future value this build doesn't know
// about - fails validation rather than being coerced into a guess.
function isOptionalDayType(x: unknown): x is DayType | undefined {
  return x === undefined || (typeof x === 'string' && DAY_TYPES.includes(x))
}

// Same acceptance rule as isOptionalDayType, but for the array an if-then
// entry carries - absent means every day, same as an entry written before
// dayTypes existed; present must be a real array of known DayType values,
// including an empty one (which is functionally the same as absent but
// still a valid shape, not something worth rejecting).
function isOptionalDayTypeArray(x: unknown): x is DayType[] | undefined {
  return x === undefined || (Array.isArray(x) && x.every(v => typeof v === 'string' && DAY_TYPES.includes(v)))
}

function isOptionalIfThenWhen(x: unknown): x is IfThenWhen | undefined {
  return x === undefined || (typeof x === 'string' && IF_THEN_WHENS.includes(x))
}

// Same acceptance rule as isOptionalIfThenWhen - a payload written before
// dayLayoutFocus existed has no such key at all, which is not corruption,
// see the comment on isSettings below. normalizeLoaded backfills it to
// 'both' once validation passes.
function isOptionalDayLayoutFocus(x: unknown): x is Settings['dayLayoutFocus'] | undefined {
  return x === undefined || (typeof x === 'string' && DAY_LAYOUT_FOCUSES.includes(x))
}

// Density and text scale, same absence-is-fine rule as everything above -
// a backup written before Appearance offered them simply has neither key.
function isOptionalDensity(x: unknown): x is Settings['density'] | undefined {
  return x === undefined || x === 'comfortable' || x === 'compact'
}

function isOptionalTextScale(x: unknown): x is Settings['textScale'] | undefined {
  return x === undefined || x === 's' || x === 'm' || x === 'l'
}

// The interval is bounded on both ends rather than merely "a number": a
// reminder every zero minutes is a loop, and one every three days is not a
// reminder. The text is length-capped for the same reason every other free
// string in this file is - a backup is an untrusted document.
function isSleepProfile(x: unknown): x is SleepProfile {
  if (!isRecord(x)) return false
  return (
    typeof x.id === 'string' &&
    x.id.length > 0 &&
    typeof x.name === 'string' &&
    x.name.length > 0 &&
    x.name.length <= 60 &&
    isSleepWindow(x.window)
  )
}

function isOptionalSleepProfiles(x: unknown): x is SleepProfile[] | undefined {
  if (x === undefined) return true
  if (!Array.isArray(x) || x.length === 0 || !x.every(isSleepProfile)) return false
  // Two schedules with the same id would make which one a day points at a
  // matter of array order - the same reason preset ids are checked for
  // uniqueness in themes.test.ts.
  return new Set(x.map(p => p.id)).size === x.length
}

function isOptionalReminder(x: unknown): x is Settings['reminder'] | undefined {
  if (x === undefined) return true
  if (!isRecord(x)) return false
  return (
    typeof x.enabled === 'boolean' &&
    typeof x.everyMinutes === 'number' &&
    Number.isInteger(x.everyMinutes) &&
    x.everyMinutes >= 1 &&
    x.everyMinutes <= 240 &&
    typeof x.text === 'string' &&
    x.text.length <= 120
  )
}

function isInboxItem(x: unknown): x is InboxItem {
  if (!isRecord(x)) return false
  return typeof x.id === 'string' && typeof x.text === 'string' && typeof x.captured === 'string'
}

// A real "HH:MM" clock time - two digits, a colon, two digits, hour 00-23,
// minute 00-59. Stricter than isOptionalString already gets for Task.time
// and TemplateBlock.time (a bare typeof check, unvalidated) because a
// malformed sleep-window time does not stay contained to one task's own
// row - it feeds straight into wakingWindow's arithmetic in capacity.ts,
// where a NaN from a bad split would corrupt the capacity line, every gap
// and the grid's own greyed band for the whole day, not just one field's
// display.
const TIME_STRING_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function isTimeString(x: unknown): x is string {
  return typeof x === 'string' && TIME_STRING_RE.test(x)
}

// Both fields required once a sleepWindow object is present at all - a
// bedtime with no wake time (or the reverse) is not a shape this app can
// use, so it fails the whole payload the same as any other malformed
// field, rather than silently defaulting the missing half.
function isSleepWindow(x: unknown): x is SleepWindow {
  return isRecord(x) && isTimeString(x.start) && isTimeString(x.end)
}

function isOptionalSleepWindow(x: unknown): x is SleepWindow | undefined {
  return x === undefined || isSleepWindow(x)
}

// A category is validated by identity against the six this app defines, not
// by shape - unlike a colour, there is no grammar to check, and an id that is
// not one of ours would silently draw nothing. Same treatment an unknown
// DayType already gets: the whole payload is refused rather than quietly
// dropping the one field that failed.
function isOptionalCategory(x: unknown): boolean {
  return x === undefined || isCategoryId(x)
}

function isTask(x: unknown): x is Task {
  if (!isRecord(x)) return false
  return (
    typeof x.id === 'string' &&
    typeof x.title === 'string' &&
    typeof x.done === 'boolean' &&
    isOptionalString(x.time) &&
    (x.fromTemplate === undefined || typeof x.fromTemplate === 'boolean') &&
    isOptionalPushCount(x.pushCount) &&
    isOptionalBoolean(x.core) &&
    isOptionalMinutes(x.minutes) &&
    isOptionalBoolean(x.unbounded) &&
    isOptionalCategory(x.category)
  )
}

function isTemplateBlock(x: unknown): x is TemplateBlock {
  if (!isRecord(x)) return false
  return (
    typeof x.id === 'string' &&
    typeof x.title === 'string' &&
    isOptionalString(x.time) &&
    isOptionalBoolean(x.core) &&
    isOptionalMinutes(x.minutes) &&
    isOptionalBoolean(x.unbounded) &&
    isOptionalCategory(x.category)
  )
}

function isTemplate(x: unknown): x is Template {
  if (!isRecord(x)) return false
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    isColor(x.color) &&
    Array.isArray(x.blocks) &&
    x.blocks.every(isTemplateBlock) &&
    isOptionalDayType(x.type)
  )
}

function isDayPlan(x: unknown): x is DayPlan {
  if (!isRecord(x)) return false
  return (
    typeof x.date === 'string' &&
    isOptionalString(x.templateId) &&
    isOptionalDayType(x.dayType) &&
    Array.isArray(x.tasks) &&
    x.tasks.every(isTask)
  )
}

function isLegacyTheme(x: unknown): x is LegacyTheme {
  return x === 'light' || x === 'dark'
}

function isThemeOverrides(x: unknown): x is ThemeOverrides {
  return isRecord(x) && Object.entries(x).every(([key, v]) => isOverrideValue(key, v))
}

function isThemeState(x: unknown): x is ThemeState {
  if (!isRecord(x)) return false
  return (
    typeof x.presetId === 'string' &&
    isRecord(x.overrides) &&
    Object.values(x.overrides).every(isThemeOverrides) &&
    typeof x.mode === 'string' &&
    THEME_MODES.includes(x.mode)
  )
}

function isStoredTheme(x: unknown): x is StoredTheme {
  return isLegacyTheme(x) || isThemeState(x)
}

// timelineExpanded, dayLayoutFocus, sleepWindow and nightSleepWindow are all
// checked only when present - a payload written before any of them existed
// has no such key at all, the same absence-is-fine treatment ifThens gets a
// few lines below. normalizeLoaded is what actually backfills them (to
// false, 'both', and the two default sleep windows respectively) once
// validation passes, matching defaultData()'s own defaults. A sleep window
// that is present but malformed - the wrong type, or a string that is not a
// real "HH:MM" - fails the whole payload exactly like a bad Template.color
// already does, rather than silently substituting a default for a value
// that was actually there.
function isSettings(x: unknown): x is {
  theme: StoredTheme
  enabledWidgets: string[]
  timelineExpanded?: boolean
  dayLayoutFocus?: Settings['dayLayoutFocus']
  density?: Settings['density']
  textScale?: Settings['textScale']
  reminder?: Settings['reminder']
  sleepProfiles?: SleepProfile[]
  sleepWindow?: SleepWindow
  nightSleepWindow?: SleepWindow
} {
  if (!isRecord(x)) return false
  return (
    isStoredTheme(x.theme) &&
    Array.isArray(x.enabledWidgets) &&
    x.enabledWidgets.every(w => typeof w === 'string') &&
    isOptionalBoolean(x.timelineExpanded) &&
    isOptionalDayLayoutFocus(x.dayLayoutFocus) &&
    isOptionalDensity(x.density) &&
    isOptionalTextScale(x.textScale) &&
    isOptionalReminder(x.reminder) &&
    isOptionalSleepWindow(x.sleepWindow) &&
    isOptionalSleepWindow(x.nightSleepWindow) &&
    isOptionalSleepProfiles(x.sleepProfiles)
  )
}

// Upgrades a legacy 'light' | 'dark' string into the current ThemeState
// shape, keeping the person's actual choice as an explicit mode rather than
// resetting it to 'system' - only a genuinely fresh install gets that
// default, see defaultThemeState above. A payload already in the new shape
// passes through untouched.
function migrateTheme(theme: StoredTheme): ThemeState {
  return isLegacyTheme(theme) ? { presetId: DEFAULT_PRESET_ID, overrides: {}, mode: theme } : theme
}

function isIfThenEntry(x: unknown): x is IfThenEntry {
  if (!isRecord(x)) return false
  return (
    typeof x.id === 'string' &&
    typeof x.trigger === 'string' &&
    typeof x.action === 'string' &&
    isOptionalColor(x.color) &&
    isOptionalDayTypeArray(x.dayTypes) &&
    isOptionalIfThenWhen(x.when) &&
    isOptionalString(x.lastSurfaced)
  )
}

// Anything this accepts must be safe to render: a shape check on templates,
// days and settings alone let payloads like {"templates":[{}],"days":{},
// "settings":{}} through, which later crashed the templates view on
// t.blocks.length with no way back except clearing storage by hand.
//
// ifThens is checked only when present. A backup written before the
// if-then board existed has no such key at all - that is not corruption,
// it is every real backup on disk before this feature shipped - so its
// absence must not fail the whole payload. normalizeLoaded below is what
// actually backfills it once validation passes.
// The shape validate() actually accepts as input: everything AppData
// requires, except settings.theme may still be the pre-migration
// 'light' | 'dark' string. normalizeLoaded is what turns this into a real
// AppData, by running every settings.theme through migrateTheme.
interface StoredAppData {
  templates: Template[]
  days: Record<string, DayPlan>
  settings: {
    theme: StoredTheme
    enabledWidgets: string[]
    timelineExpanded?: boolean
    dayLayoutFocus?: Settings['dayLayoutFocus']
    density?: Settings['density']
    textScale?: Settings['textScale']
    reminder?: Settings['reminder']
    sleepProfiles?: SleepProfile[]
    sleepWindow?: SleepWindow
    nightSleepWindow?: SleepWindow
  }
  ifThens?: IfThenEntry[]
  inbox?: InboxItem[]
}

export function validate(x: unknown): x is StoredAppData {
  if (!isRecord(x)) return false
  if (!Array.isArray(x.templates) || !x.templates.every(isTemplate)) return false
  if (!isRecord(x.days) || !Object.values(x.days).every(isDayPlan)) return false
  if (!isSettings(x.settings)) return false
  if (x.ifThens !== undefined && (!Array.isArray(x.ifThens) || !x.ifThens.every(isIfThenEntry))) return false
  if (x.inbox !== undefined && (!Array.isArray(x.inbox) || !x.inbox.every(isInboxItem))) return false
  return true
}

// Fills in what a payload from before the if-then board existed does not
// have: an empty ifThens list. Older payloads may also carry
// LEGACY_IF_THEN_WIDGET_ID in enabledWidgets, from when the board briefly
// lived in the widget registry - that id is stripped out below regardless
// of how the payload otherwise got here, so nobody's real data keeps
// carrying a reference to a widget that no longer exists.
//
// wasMigrated distinguishes "this payload predates ifThens entirely" from
// "this payload already went through this function once, and enabledWidgets
// is however it is now for a reason" - the ifThens key's own presence in the
// raw payload is that signal, since it is added by this same function on
// first load and then persisted by every subsequent save from here on. Once
// a payload has been migrated, enabledWidgets is left exactly as it stands
// apart from that one strip - a future settings toggle for some other
// widget would find its own choice respected exactly the way this comment
// used to promise for if-then, back when if-then still had a widget id to
// turn off.
/**
 * Turns whatever a payload carries about sleep into the profile list.
 *
 * Three cases. A payload already on profiles keeps them. A payload from
 * before profiles existed becomes one default schedule from its own
 * `sleepWindow`, plus - and only plus - a second one from its
 * `nightSleepWindow` if that window was both changed from the shipped
 * default and actually used by something. A payload with neither gets the
 * shipped default.
 *
 * The "actually used" test is what keeps this honest. Every install that has
 * ever existed carries a `nightSleepWindow`, because it was a field rather
 * than a choice; carrying all of them forward would give a second schedule to
 * thousands of people who never worked a night in their lives, and the whole
 * point of profiles is that the second one only appears for somebody who
 * needs it. So it survives only if some template or some already-planned day
 * was actually typed as a night.
 */
function migrateSleepProfiles(data: StoredAppData): SleepProfile[] {
  if (data.settings.sleepProfiles && data.settings.sleepProfiles.length > 0) {
    return data.settings.sleepProfiles
  }
  const base: SleepProfile = {
    id: DEFAULT_SLEEP_PROFILE_ID,
    name: DEFAULT_SLEEP_PROFILE_NAME,
    window: data.settings.sleepWindow ?? { ...DEFAULT_SLEEP_WINDOW },
  }
  const night = data.settings.nightSleepWindow
  if (!night) return [base]
  const unchanged = night.start === DEFAULT_NIGHT_SLEEP_WINDOW.start && night.end === DEFAULT_NIGHT_SLEEP_WINDOW.end
  if (unchanged) return [base]
  const used =
    data.templates.some(t => t.type === 'night') ||
    Object.values(data.days).some(d => d.dayType === 'night')
  if (!used) return [base]
  return [base, { id: 'shift', name: 'Shift', window: night }]
}

function normalizeLoaded(data: StoredAppData, wasMigrated: boolean): AppData {
  const enabledWidgets = (
    wasMigrated
      ? data.settings.enabledWidgets
      : [...new Set([...data.settings.enabledWidgets, ...DEFAULT_ENABLED_WIDGETS])]
  ).filter(id => id !== LEGACY_IF_THEN_WIDGET_ID)
  return {
    ...data,
    ifThens: data.ifThens ?? [],
    inbox: data.inbox ?? [],
    settings: {
      theme: migrateTheme(data.settings.theme),
      enabledWidgets,
      timelineExpanded: data.settings.timelineExpanded ?? false,
      dayLayoutFocus: data.settings.dayLayoutFocus ?? 'both',
      density: data.settings.density ?? 'comfortable',
      textScale: data.settings.textScale ?? 'm',
      reminder: data.settings.reminder ?? { ...DEFAULT_REMINDER },
      sleepProfiles: migrateSleepProfiles(data),
    },
  }
}

// Reads settings.theme out of a payload that has already failed full
// validation, without requiring anything else in it to be valid. Exists
// because the pre-paint script in index.html makes this exact same narrow
// read of raw storage before React ever mounts: it only ever looks at
// settings.theme, so if a payload has a valid theme but something else
// wrong with it - a malformed template, say - the script commits to that
// theme on the very first paint. If loadData() then discarded the whole
// payload and defaulted to light the normal way, the page would revert
// right after mounting - a dark flash immediately followed by a light one,
// worse than the flash this pair of fixes exists to prevent. Salvaging just
// the theme here keeps the two in agreement without loadData() having to
// trust anything else about a payload it has already rejected.
function salvageTheme(x: unknown): ThemeState | undefined {
  if (!isRecord(x) || !isRecord(x.settings)) return undefined
  const theme = x.settings.theme
  return isStoredTheme(theme) ? migrateTheme(theme) : undefined
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const parsed: unknown = JSON.parse(raw)
    if (!validate(parsed)) {
      const theme = salvageTheme(parsed)
      const fallback = defaultData()
      return theme ? { ...fallback, settings: { ...fallback.settings, theme } } : fallback
    }
    return normalizeLoaded(parsed, 'ifThens' in parsed)
  } catch {
    return defaultData()
  }
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function importJson(text: string): AppData {
  try {
    const parsed: unknown = JSON.parse(text)
    if (!validate(parsed)) throw new Error('invalid')
    return normalizeLoaded(parsed, 'ifThens' in parsed)
  } catch {
    throw new Error('Invalid Dienius backup file')
  }
}
