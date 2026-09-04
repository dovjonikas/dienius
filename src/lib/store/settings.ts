import { commit, getData } from './core'
import type { Settings, SleepWindow, ThemeState } from '../types'

/** Everything under Settings that is not a goal, a calendar or a rule: theme, density, sleep, the reminders, the day view's own switches. */
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
   * patch exactly as it was - see docs/THEMES.md section 3. There is no
   * override UI yet; this exists so the pipeline and storage already
   * support one when the panel that calls it is built.
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
   * overridden tokens on that preset untouched. Used when a write would
   * restore exactly the preset's own stock value for that token - see
   * ThemeOverridePanel.tsx's setToken - so the patch stays sparse rather
   * than accumulating no-op entries, and the changed-token dot never lights
   * up on a token that no longer actually differs from the preset. Drops
   * the preset's own entry out of overrides entirely once its patch is
   * empty, the same shape resetThemeOverrides below leaves behind.
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

  /** Clears the override patch for one preset - the "Reset to preset" control. */
  resetThemeOverrides(presetId: string): void {
    const data = getData()
    const rest = Object.fromEntries(
      Object.entries(data.settings.theme.overrides).filter(([id]) => id !== presetId),
    )
    commit({ ...data, settings: { ...data.settings, theme: { ...data.settings.theme, overrides: rest } } })
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

  setReminder(reminder: Settings['reminder']): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, reminder } })
  },

  setTaskReminder(taskReminder: Settings['taskReminder']): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, taskReminder } })
  },

  setEveningClose(eveningClose: Settings['eveningClose']): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, eveningClose } })
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
   *  is a safety net, not a storage strategy.
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
      templates: data.templates.map(t => (t.sleepProfileId === id ? { ...t, sleepProfileId: undefined } : t)),
      settings: { ...data.settings, sleepProfiles: data.settings.sleepProfiles.filter(p => p.id !== id) },
    })
  },
}
