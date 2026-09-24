import { commit, getData } from './core'
import { readChimeSettings } from '../chime'
import { cleanMealWords } from '../mealWords'
import type { ChimeSettings, MealWord, Settings, SleepWindow, Template, ThemeState, WeekDayOverride } from '../types'

/** Everything under Settings that is not North or a calendar: theme, density, sleep, the day view's own switches. */
export const settingsActions = {
  /**
   * Sets the light/dark/system mode without touching which preset is
   * active or any override patch - mode and preset are independent axes,
   * see docs/THEMES.md section 4. Kept under its original name since this
   * is exactly what the Settings toggle already called before presets
   * existed; setThemePreset and setThemeOverride below are the new
   * controls the pipeline needed added alongside it.
   */
  setTheme(mode: ThemeState['mode']): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, theme: { ...data.settings.theme, mode } } })
  },

  setThemePreset(presetId: string): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, theme: { ...data.settings.theme, presetId } } })
  },

  /**
   * Writes one token into the override patch for a preset, keyed by that
   * preset's own id so switching to a different room and back leaves this
   * patch exactly as it was - see docs/THEMES.md section 3. The accent is
   * the one token anything writes (AppearanceControls).
   */
  setThemeOverride(presetId: string, token: string, value: string): void {
    const data = getData()
    const current = data.settings.theme.overrides[presetId] ?? {}
    commit({
      ...data,
      settings: {
        ...data.settings,
        theme: {
          ...data.settings.theme,
          overrides: { ...data.settings.theme.overrides, [presetId]: { ...current, [token]: value } },
        },
      },
    })
  },

  /**
   * Removes one token from a preset's override patch, leaving any other
   * overridden tokens on that preset untouched - the accent picker's "none"
   * - so the patch stays sparse rather than accumulating no-op entries.
   * Drops the preset's own entry out of overrides entirely once its patch is
   * empty.
   */
  unsetThemeOverride(presetId: string, token: string): void {
    const data = getData()
    const current = data.settings.theme.overrides[presetId]
    if (!current || !(token in current)) return
    const rest = Object.fromEntries(Object.entries(current).filter(([key]) => key !== token))
    const overrides = { ...data.settings.theme.overrides }
    if (Object.keys(rest).length > 0) {
      overrides[presetId] = rest
    } else {
      delete overrides[presetId]
    }
    commit({ ...data, settings: { ...data.settings, theme: { ...data.settings.theme, overrides } } })
  },

  /**
   * Shows or collapses the day view's timeline grid - see
   * docs/TIMELINE.md section 5. A single app-wide setting rather than
   * anything the day's own data carries, so opening the grid once keeps it
   * open on every day after, and closing it again keeps it closed - the
   * choice persists exactly like a theme preference, not like a task.
   */
  setTimelineExpanded(expanded: boolean): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, timelineExpanded: expanded } })
  },

  /**
   * Changes which pane the wide day view gives the width to - see
   * docs/LAYOUT-WIDE.md section 5. Mirrors setTimelineExpanded exactly: a
   * single app-wide setting, flipped in isolation, so it persists like a
   * theme preference rather than resetting per day.
   */
  setDayLayoutFocus(focus: Settings['dayLayoutFocus']): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, dayLayoutFocus: focus } })
  },

  /**
   * How much air the interface spends, and how big its type is. Both are
   * device preferences rather than theme choices - see their own comments in
   * types.ts - so they live in settings beside the other app-wide switches
   * rather than inside a preset's override patch, and survive changing theme.
   */
  setDensity(density: Settings['density']): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, density } })
  },

  setTextScale(textScale: Settings['textScale']): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, textScale } })
  },

  setEveningClose(eveningClose: Settings['eveningClose']): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, eveningClose } })
  },

  /**
   * The words a recipe's name can start with, and the meals each says -
   * Kitchen, v2.32, lib/mealWords.ts. Written the way `cleanMealWords` keeps
   * them: trimmed, a word said twice kept the first time.
   */
  setMealWords(words: readonly MealWord[]): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, mealWords: cleanMealWords(words) } })
  },

  /**
   * What the timer sounds like, how loud, and whether it rings at the start.
   *
   * All three at once rather than three setters, because they are answered on
   * one row of one panel and a caller that has one of them has all of them -
   * see ClockPopover. `readChimeSettings` is what everything else reads them
   * back through, so a caller cannot store a volume of five here either.
   */
  setChime(chime: ChimeSettings): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, chime: readChimeSettings(chime) } })
  },

  /**
   * Changes the hours of one sleep schedule - see `Settings.sleepProfiles`.
   * Both ends are always written together: a bedtime with no matching wake
   * time, or the reverse, is not a shape this app can compute a window from.
   */
  setSleepProfileWindow(id: string, window: SleepWindow): void {
    const data = getData()
    commit({
      ...data,
      settings: {
        ...data.settings,
        sleepProfiles: data.settings.sleepProfiles.map(p => (p.id === id ? { ...p, window } : p)),
      },
    })
  },

  renameSleepProfile(id: string, name: string): void {
    const data = getData()
    const trimmed = name.trim()
    if (!trimmed) return
    commit({
      ...data,
      settings: {
        ...data.settings,
        sleepProfiles: data.settings.sleepProfiles.map(p => (p.id === id ? { ...p, name: trimmed } : p)),
      },
    })
  },

  /**
   * Adds a schedule, seeded from the default one rather than from nothing -
   * a second schedule is almost always a variation on the first, and an
   * empty pair of fields is a form to fill in rather than a thing to adjust.
   */
  addSleepProfile(name: string): void {
    const data = getData()
    const base = data.settings.sleepProfiles[0]
    const profile = { id: crypto.randomUUID(), name: name.trim() || 'New schedule', window: { ...base.window } }
    commit({ ...data, settings: { ...data.settings, sleepProfiles: [...data.settings.sleepProfiles, profile] } })
  },

  /**
   * Removes a schedule, and every reference to it. The first one can never be
   * deleted: something has to be the default, and a day pointing at nothing
   * would have no hours at all. Days and templates that used the deleted one
   * fall back to the default in the same commit rather than being left
   * pointing at an id that resolves to it by accident - the fallback in
   * `sleepProfileWindow` is a safety net, not a storage strategy.
   *
   * A week template's own days are references too: a weekday that named
   * the schedule stops naming it, and one left overriding nothing is no
   * override at all, the way the week editor leaves it.
   */
  deleteSleepProfile(id: string): void {
    const data = getData()
    if (data.settings.sleepProfiles.length < 2 || data.settings.sleepProfiles[0].id === id) return
    const days = Object.fromEntries(
      Object.entries(data.days).map(([key, day]) =>
        day.sleepProfileId === id ? [key, { ...day, sleepProfileId: undefined }] : [key, day],
      ),
    )
    commit({
      ...data,
      days,
      templates: data.templates.map(t => withoutSleepProfile(t, id)),
      settings: { ...data.settings, sleepProfiles: data.settings.sleepProfiles.filter(p => p.id !== id) },
    })
  },
}

/** A template with a deleted schedule taken off it, and off each of its own days. */
function withoutSleepProfile(template: Template, id: string): Template {
  const onWeekDays = Object.values(template.weekDays ?? {}).some(o => o?.sleepProfileId === id)
  if (template.sleepProfileId !== id && !onWeekDays) return template
  const next: Template = { ...template }
  if (next.sleepProfileId === id) next.sleepProfileId = undefined
  if (onWeekDays) {
    const weekDays: Partial<Record<number, WeekDayOverride>> = {}
    for (const [weekday, override] of Object.entries(template.weekDays ?? {})) {
      if (!override) continue
      const kept: WeekDayOverride = override.sleepProfileId === id ? { type: override.type } : { ...override }
      if (kept.type === undefined) delete kept.type
      if (kept.type !== undefined || kept.sleepProfileId !== undefined) weekDays[Number(weekday)] = kept
    }
    next.weekDays = Object.keys(weekDays).length > 0 ? weekDays : undefined
  }
  return next
}
