import type { AppData, DayPlan, DayType, IfThenEntry, Settings, Task, Template, TemplateBlock } from './types'

const DAY_TYPES: readonly string[] = ['full', 'shift', 'night', 'rest']

// Widgets that ship enabled for everyone, with no settings control to turn
// them off. The if-then board is not an optional add-on a person opts into -
// see IF_THEN_WIDGET_ID's use in normalizeWidgets below for how a backup
// written before it existed still gets it.
const DEFAULT_ENABLED_WIDGETS = ['day-plan', 'if-then']

// Also duplicated, deliberately and minimally, in the pre-paint script in
// index.html - that script reads settings.theme straight out of this key
// before React mounts, so it has to know the key and that one field's shape
// on its own. Change either here and check the other still matches.
export const STORAGE_KEY = 'dienius:data'

export function defaultData(): AppData {
  return {
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [...DEFAULT_ENABLED_WIDGETS] },
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

// Accepts both an absent type (a template saved before this field existed,
// or a day never stamped) and any of the four known values. Anything else
// - a typo, a hand-edited backup, a future value this build doesn't know
// about - fails validation rather than being coerced into a guess.
function isOptionalDayType(x: unknown): x is DayType | undefined {
  return x === undefined || (typeof x === 'string' && DAY_TYPES.includes(x))
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
    isOptionalBoolean(x.core)
  )
}

function isTemplateBlock(x: unknown): x is TemplateBlock {
  if (!isRecord(x)) return false
  return (
    typeof x.id === 'string' &&
    typeof x.title === 'string' &&
    isOptionalString(x.time) &&
    isOptionalBoolean(x.core)
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

function isSettings(x: unknown): x is Settings {
  if (!isRecord(x)) return false
  return (
    (x.theme === 'light' || x.theme === 'dark') &&
    Array.isArray(x.enabledWidgets) &&
    x.enabledWidgets.every(w => typeof w === 'string')
  )
}

function isIfThenEntry(x: unknown): x is IfThenEntry {
  if (!isRecord(x)) return false
  return (
    typeof x.id === 'string' &&
    typeof x.trigger === 'string' &&
    typeof x.action === 'string' &&
    isOptionalString(x.color)
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
export function validate(x: unknown): x is AppData {
  if (!isRecord(x)) return false
  if (!Array.isArray(x.templates) || !x.templates.every(isTemplate)) return false
  if (!isRecord(x.days) || !Object.values(x.days).every(isDayPlan)) return false
  if (!isSettings(x.settings)) return false
  if (x.ifThens !== undefined && (!Array.isArray(x.ifThens) || !x.ifThens.every(isIfThenEntry))) return false
  return true
}

// Fills in what a payload from before the if-then board existed does not
// have: an empty ifThens list, and the board's widget id added to whatever
// enabledWidgets the payload already carries. The widget has no settings
// control to turn it off yet, so upgrading a person's existing data to
// include it is the same kind of default-on treatment a brand new install
// gets from defaultData() - not a preference their old data ever expressed
// an opinion about one way or the other.
//
// wasMigrated distinguishes "this payload predates ifThens entirely" from
// "this payload already went through this function once, and enabledWidgets
// is however it is now for a reason" - the ifThens key's own presence in the
// raw payload is that signal, since it is added by this same function on
// first load and then persisted by every subsequent save from here on. Once
// a payload has been migrated, enabledWidgets is left exactly as it stands.
// Without this check, a future settings toggle that lets someone turn the
// if-then widget off would find it silently back on at their next app open,
// because there would be no way to tell that apart from never having seen
// the widget at all.
function normalizeLoaded(data: AppData, wasMigrated: boolean): AppData {
  const enabledWidgets = wasMigrated
    ? data.settings.enabledWidgets
    : [...new Set([...data.settings.enabledWidgets, ...DEFAULT_ENABLED_WIDGETS])]
  return {
    ...data,
    ifThens: data.ifThens ?? [],
    settings: { ...data.settings, enabledWidgets },
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const parsed: unknown = JSON.parse(raw)
    if (!validate(parsed)) return defaultData()
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
