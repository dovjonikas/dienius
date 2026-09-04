import { DEMO_STORAGE_KEY, isDemoMode } from './demoMode'
import { TOUR_STORAGE_KEY, isTourSandbox } from './tourMode'
import { buildDemoData } from './demo'
import type { AppData, DayPlan, EveningCloseSettings, Settings, SleepProfile, SleepWindow, ThemeState } from './types'
import { dedupeTasks } from './taskIdentity'
import { isLegacyTheme, isStoredTheme, validate, type StoredAppData, type StoredTheme } from './validate'


// Duplicated from themes.ts on purpose rather than imported - storage.ts
// has no reason to depend on the preset data itself, only on the id a
// fresh install should start with. See DEFAULT_PRESET_ID in themes.ts.
const DEFAULT_PRESET_ID = 'dark'

// Off, every twenty minutes, and a sentence about the two things a body
// actually needs during a long block. Duplicated here rather than imported
// for the same reason DEFAULT_PRESET_ID is: this file only needs the literal
// a fresh install starts with.
const DEFAULT_REMINDER: Settings['reminder'] = { enabled: false, everyMinutes: 20, text: 'Stand up, drink water' }

// Off, and five minutes. Five is enough to finish a sentence and stand up,
// and short enough that the nudge is still about the thing it names.
const DEFAULT_TASK_REMINDER: Settings['taskReminder'] = { enabled: false, minutesBefore: 5 }

// Both on. Unlike every other interruption in this app, these two are not
// notifications and cannot arrive while somebody is doing something else -
// they are a card on a page already being opened, and dismissing one takes a
// single tap. See north.ts.
const DEFAULT_NORTH: Settings['north'] = { afterASlowDay: true, onMonday: true }

// On, at half nine, and it asks. Duplicated from eveningClose.ts for the same
// reason DEFAULT_PRESET_ID is duplicated from themes.ts: this file needs the
// literal a fresh install starts with, not a dependency on the module that
// owns the behaviour.
const DEFAULT_EVENING_CLOSE: EveningCloseSettings = { enabled: true, at: '21:30', askBestMoment: true }

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

/**
 * The key this tab actually reads and writes.
 *
 * Demo mode is a different file, not a flag inside the same one. That is the
 * only version of the isolation that is genuinely safe: a bug while somebody
 * is poking at the sample week cannot touch a real plan, because the real plan
 * is not the file that is open. Everything else in this module is unchanged by
 * it - the same validation, the same migrations, the same shape.
 */
function activeKey(): string {
  // The tour's sandbox is the same idea as demo mode - a different file, not
  // a flag - and it is checked first because a replay is started from inside
  // the app, never from a demo link.
  if (isTourSandbox()) return TOUR_STORAGE_KEY
  return isDemoMode() ? DEMO_STORAGE_KEY : STORAGE_KEY
}

/**
 * An empty tour sandbox opens as an empty app wearing the person's own
 * theme. Without this a replay of the tour would flash the default dark on
 * somebody who has used Light for a year, and the tour would be teaching a
 * slightly different app from the one they came from.
 */
function sandboxSeed(): AppData {
  const fresh = defaultData()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh
    const theme = salvageTheme(JSON.parse(raw))
    return theme ? { ...fresh, settings: { ...fresh.settings, theme } } : fresh
  } catch {
    return fresh
  }
}

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
      weekdayTemplates: {},
      taskReminder: { ...DEFAULT_TASK_REMINDER },
      north: { ...DEFAULT_NORTH },
      eveningClose: { ...DEFAULT_EVENING_CLOSE },
    },
    ifThens: [],
    inbox: [],
    backlog: [],
    scratch: [],
    library: [],
    goals: [],
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

// Upgrades a legacy 'light' | 'dark' string into the current ThemeState
// shape, keeping the person's actual choice as an explicit mode rather than
// resetting it to 'system' - only a genuinely fresh install gets that
// default, see defaultThemeState above. A payload already in the new shape
// passes through untouched.
function migrateTheme(theme: StoredTheme): ThemeState {
  return isLegacyTheme(theme) ? { presetId: DEFAULT_PRESET_ID, overrides: {}, mode: theme } : theme
}

// The deep type guard itself lives in validate.ts, as tables - one per
// entity, a field and what a value in it may be. Re-exported from here
// because this is the boundary every caller knows, and the tests that hold
// the guard's contract import it from here.
export { validate }
export type { StoredAppData } from './validate'

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
    days: repairDuplicates(data.days),
    ifThens: data.ifThens ?? [],
    inbox: data.inbox ?? [],
    backlog: data.backlog ?? [],
    scratch: data.scratch ?? [],
    library: data.library ?? [],
    goals: data.goals ?? [],
    settings: {
      // Spread first, then normalise. Listing every field by name meant an
      // optional one added later was silently dropped on load: the value was
      // written, saved, and gone on the next open. `northDismissedOn` and
      // `calendars` were both lost this way. Anything unknown that rides along
      // from a hand-edited backup is harmless - `validate` has already checked
      // the shape of everything this app actually reads.
      ...data.settings,
      theme: migrateTheme(data.settings.theme),
      enabledWidgets,
      timelineExpanded: data.settings.timelineExpanded ?? false,
      dayLayoutFocus: data.settings.dayLayoutFocus ?? 'both',
      density: data.settings.density ?? 'comfortable',
      textScale: data.settings.textScale ?? 'm',
      reminder: data.settings.reminder ?? { ...DEFAULT_REMINDER },
      sleepProfiles: migrateSleepProfiles(data),
      weekdayTemplates: data.settings.weekdayTemplates ?? {},
      taskReminder: data.settings.taskReminder ?? { ...DEFAULT_TASK_REMINDER },
      north: data.settings.north ?? { ...DEFAULT_NORTH },
      eveningClose: data.settings.eveningClose ?? { ...DEFAULT_EVENING_CLOSE },
    },
  }
}

/**
 * Removes duplicate tasks from every stored day, once, on load.
 *
 * Before tasks had origins, a template block pushed forward from yesterday
 * and the same block stamped onto today were two unrelated rows - so days
 * really do exist out there holding two of everything, with the timeline
 * drawing them side by side as though they were a genuine clash. Nothing
 * about the new identity rules repairs a day that is already wrong, so this
 * does: see `dedupeTasks` for what counts as the same task and which copy
 * survives.
 *
 * Idempotent and cheap: a day with nothing duplicated is returned untouched,
 * so this costs one pass over the store on load and nothing afterwards.
 */
function repairDuplicates(days: Record<string, DayPlan>): Record<string, DayPlan> {
  let changed = false
  const repaired: Record<string, DayPlan> = {}
  for (const [date, day] of Object.entries(days)) {
    const tasks = dedupeTasks(day.tasks)
    if (tasks.length !== day.tasks.length) changed = true
    repaired[date] = tasks.length === day.tasks.length ? day : { ...day, tasks }
  }
  return changed ? repaired : days
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
    const raw = localStorage.getItem(activeKey())
    // An empty demo key is not an empty app, it is a sample week waiting to be
    // built. Done here rather than before React mounts because this module is
    // evaluated first: store.ts calls loadData() at import time, so anything
    // seeding from main.tsx arrives after the store has already read nothing.
    if (!raw && isTourSandbox()) return sandboxSeed()
    if (!raw && isDemoMode()) return buildDemoData(defaultData())
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
    localStorage.setItem(activeKey(), JSON.stringify(data))
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
