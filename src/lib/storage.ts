import type { AppData, DayPlan, DayType, IfThenEntry, IfThenWhen, Task, Template, TemplateBlock, ThemeOverrides, ThemeState } from './types'

const DAY_TYPES: readonly string[] = ['full', 'shift', 'night', 'rest']
const IF_THEN_WHENS: readonly string[] = ['morning', 'day', 'evening', 'any']
const THEME_MODES: readonly string[] = ['light', 'dark', 'system']

// Duplicated from themes.ts on purpose rather than imported - storage.ts
// has no reason to depend on the preset data itself, only on the id a
// fresh install should start with. See DEFAULT_PRESET_ID in themes.ts.
const DEFAULT_PRESET_ID = 'slate'

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
    },
    ifThens: [],
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isOptionalString(x: unknown): x is string | undefined {
  return x === undefined || typeof x === 'string'
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
    isOptionalBoolean(x.unbounded)
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
    isOptionalBoolean(x.unbounded)
  )
}

function isTemplate(x: unknown): x is Template {
  if (!isRecord(x)) return false
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.color === 'string' &&
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
  return isRecord(x) && Object.values(x).every(v => typeof v === 'string')
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

// timelineExpanded is checked only when present - a payload written before
// the day view's timeline collapse existed has no such key at all, the
// same absence-is-fine treatment ifThens gets a few lines below.
// normalizeLoaded is what actually backfills it to false once validation
// passes, matching defaultData()'s own collapsed-by-default choice.
function isSettings(x: unknown): x is { theme: StoredTheme; enabledWidgets: string[]; timelineExpanded?: boolean } {
  if (!isRecord(x)) return false
  return (
    isStoredTheme(x.theme) &&
    Array.isArray(x.enabledWidgets) &&
    x.enabledWidgets.every(w => typeof w === 'string') &&
    isOptionalBoolean(x.timelineExpanded)
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
    isOptionalString(x.color) &&
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
  settings: { theme: StoredTheme; enabledWidgets: string[]; timelineExpanded?: boolean }
  ifThens?: IfThenEntry[]
}

export function validate(x: unknown): x is StoredAppData {
  if (!isRecord(x)) return false
  if (!Array.isArray(x.templates) || !x.templates.every(isTemplate)) return false
  if (!isRecord(x.days) || !Object.values(x.days).every(isDayPlan)) return false
  if (!isSettings(x.settings)) return false
  if (x.ifThens !== undefined && (!Array.isArray(x.ifThens) || !x.ifThens.every(isIfThenEntry))) return false
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
function normalizeLoaded(data: StoredAppData, wasMigrated: boolean): AppData {
  const enabledWidgets = (
    wasMigrated
      ? data.settings.enabledWidgets
      : [...new Set([...data.settings.enabledWidgets, ...DEFAULT_ENABLED_WIDGETS])]
  ).filter(id => id !== LEGACY_IF_THEN_WIDGET_ID)
  return {
    ...data,
    ifThens: data.ifThens ?? [],
    settings: {
      theme: migrateTheme(data.settings.theme),
      enabledWidgets,
      timelineExpanded: data.settings.timelineExpanded ?? false,
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
