import { useSyncExternalStore } from 'react'
import type { AppData, DayPlan, DayType, IfThenEntry, Template, ThemeState } from './types'
import { importJson, loadData, saveData } from './storage'
import { applyStamps } from './stamping'
import { addDays } from './dates'
import { MAX_PUSHES } from './pushRules'

export { MAX_PUSHES } from './pushRules'

let data: AppData = loadData()
let saveOk = true
const listeners = new Set<() => void>()

function commit(next: AppData): void {
  data = next
  saveOk = saveData(data)
  listeners.forEach(fn => fn())
}

export function getData(): AppData {
  return data
}

export function getSaveOk(): boolean {
  return saveOk
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getData)
}

function dayOf(date: string): DayPlan {
  return data.days[date] ?? { date, tasks: [] }
}

function withDay(date: string, day: DayPlan): AppData {
  return { ...data, days: { ...data.days, [date]: day } }
}

export interface RolloverResult {
  /** Tasks moved to the next day, with pushCount incremented. */
  moved: number
  /** Tasks left in place because they had already reached MAX_PUSHES. */
  held: number
}

// Shared by rolloverUnfinished and pushTask below - both move a task to the
// next day the same way, one pushing everything unfinished at once, the
// other pushing exactly one. See the doc comment on rolloverUnfinished's
// own mapping for why fromTemplate and core are cleared here.
function pushedForward(task: DayPlan['tasks'][number]): DayPlan['tasks'][number] {
  return { ...task, fromTemplate: false, pushCount: (task.pushCount ?? 0) + 1, core: undefined }
}

export const actions = {
  addTask(date: string, title: string, time?: string): void {
    const day = dayOf(date)
    const task = { id: crypto.randomUUID(), title, time, done: false }
    commit(withDay(date, { ...day, tasks: [...day.tasks, task] }))
  },

  toggleTask(date: string, taskId: string): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, done: !t.done } : t)),
    }))
  },

  deleteTask(date: string, taskId: string): void {
    const day = dayOf(date)
    commit(withDay(date, { ...day, tasks: day.tasks.filter(t => t.id !== taskId) }))
  },

  rolloverUnfinished(date: string): RolloverResult {
    const day = data.days[date]
    if (!day) return { moved: 0, held: 0 }
    const unfinished = day.tasks.filter(t => !t.done)
    if (unfinished.length === 0) return { moved: 0, held: 0 }

    const pushable = unfinished.filter(t => (t.pushCount ?? 0) < MAX_PUSHES)
    const held = unfinished.length - pushable.length
    if (pushable.length === 0) return { moved: 0, held }

    const targetDate = addDays(date, 1)
    const target = data.days[targetDate] ?? { date: targetDate, tasks: [] }
    const movedIds = new Set(pushable.map(t => t.id))
    // core describes a promise a template made about the day it was
    // stamped for, not a property of the task itself - the same reason
    // fromTemplate is cleared here too. Carrying it forward unchanged
    // would let a shift day's required task silently become a required
    // task on whatever day it happens to land on next, including a rest
    // day that is supposed to have nothing required at all. If a pushed
    // task is still genuinely necessary, the push bound already forces a
    // decision on it within two days - it does not need core to do that
    // job as well.
    const moved = pushable.map(pushedForward)
    commit({
      ...data,
      days: {
        ...data.days,
        [date]: { ...day, tasks: day.tasks.filter(t => !movedIds.has(t.id)) },
        [targetDate]: { ...target, tasks: [...target.tasks, ...moved] },
      },
    })
    return { moved: moved.length, held }
  },

  /**
   * Pushes exactly one task to the next day - the same move
   * rolloverUnfinished makes for every unfinished task at once, offered
   * here as its own entry point so one specific task can move without
   * touching anything else on the day. The day view offers this per float,
   * so the owner picks which one moves rather than the app choosing for
   * them - see docs/TIMELINE.md section 8. Bound by the same MAX_PUSHES
   * rule, and a done task is never eligible - pushing finished work to
   * tomorrow makes no sense - so this returns false rather than acting in
   * either case, the same way rolloverUnfinished silently excludes both.
   */
  pushTask(date: string, taskId: string): boolean {
    const day = data.days[date]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task || task.done || (task.pushCount ?? 0) >= MAX_PUSHES) return false

    const targetDate = addDays(date, 1)
    const target = data.days[targetDate] ?? { date: targetDate, tasks: [] }
    commit({
      ...data,
      days: {
        ...data.days,
        [date]: { ...day!, tasks: day!.tasks.filter(t => t.id !== taskId) },
        [targetDate]: { ...target, tasks: [...target.tasks, pushedForward(task)] },
      },
    })
    return true
  },

  /**
   * Sets, changes or clears a task's estimated size. Never invoked by the
   * quick-add flow itself - see docs/TIMELINE.md section 9 - this is the
   * separate, optional control a task's own row offers, so sizing a task
   * is never a question the owner has to answer before the day can start.
   * Passing undefined clears it back to unsized.
   */
  setTaskMinutes(date: string, taskId: string, minutes: number | undefined): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, minutes } : t)),
    }))
  },

  /**
   * Gives a float a `time`, which is what makes it an anchor - see
   * docs/TIMELINE.md section 5 and `capacity.ts`'s own definition of
   * `isAnchor`. This is the tap-a-gap path today; step 7's drag will call
   * the same action rather than invent a second way to place a float.
   * Refuses a task that already has a time - placing only ever moves a
   * float out of the tray, never re-times something already anchored, so a
   * stray double-tap on a race with another update cannot silently move an
   * anchor out from under whatever is already showing for it. Refuses
   * silently (returning false) exactly like `pushTask` does for its own
   * guard, rather than throwing on a state the UI should not have offered
   * in the first place.
   */
  placeFloat(date: string, taskId: string, time: string): boolean {
    const day = data.days[date]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task || task.time !== undefined) return false
    commit(withDay(date, { ...day!, tasks: day!.tasks.map(t => (t.id === taskId ? { ...t, time } : t)) }))
    return true
  },

  /**
   * Clears a task's `time`, returning it to the tray as a float - the undo
   * for `placeFloat` above, and the same action step 7's drag-back-to-tray
   * will call. Nothing else about the task changes: its size, if it has
   * one, survives being placed and undone, because undo is meant to be
   * exactly reversible, not a second push. Refuses a task with no time to
   * clear, the mirror image of `placeFloat`'s own guard.
   */
  unanchorTask(date: string, taskId: string): boolean {
    const day = data.days[date]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task || task.time === undefined) return false
    commit(withDay(date, {
      ...day!,
      tasks: day!.tasks.map(t => (t.id === taskId ? { ...t, time: undefined } : t)),
    }))
    return true
  },

  addTemplate(input: {
    name: string
    color: string
    type?: DayType
    blocks: { time?: string; title: string; core?: boolean; minutes?: number }[]
  }): Template {
    const template: Template = {
      id: crypto.randomUUID(),
      name: input.name,
      color: input.color,
      type: input.type,
      blocks: input.blocks.map(b => ({
        id: crypto.randomUUID(),
        time: b.time,
        title: b.title,
        core: b.core,
        minutes: b.minutes,
      })),
    }
    commit({ ...data, templates: [...data.templates, template] })
    return template
  },

  updateTemplate(template: Template): void {
    commit({
      ...data,
      templates: data.templates.map(t => (t.id === template.id ? template : t)),
    })
  },

  deleteTemplate(id: string): void {
    commit({ ...data, templates: data.templates.filter(t => t.id !== id) })
  },

  stamp(stamps: Record<string, string | null>): void {
    commit({ ...data, days: applyStamps(data.days, data.templates, stamps) })
  },

  /**
   * Sets the light/dark/system mode without touching which preset is
   * active or any override patch - mode and preset are independent axes,
   * see docs/THEMES.md section 4. Kept under its original name since this
   * is exactly what the Settings toggle already called before presets
   * existed; setThemePreset and setThemeOverride below are the new
   * controls the pipeline needed added alongside it.
   */
  setTheme(mode: ThemeState['mode']): void {
    commit({ ...data, settings: { ...data.settings, theme: { ...data.settings.theme, mode } } })
  },

  setThemePreset(presetId: string): void {
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
    const rest = Object.fromEntries(
      Object.entries(data.settings.theme.overrides).filter(([id]) => id !== presetId),
    )
    commit({ ...data, settings: { ...data.settings, theme: { ...data.settings.theme, overrides: rest } } })
  },

  addIfThen(input: { trigger: string; action: string; color?: string }): IfThenEntry {
    const entry: IfThenEntry = {
      id: crypto.randomUUID(),
      trigger: input.trigger,
      action: input.action,
      color: input.color,
    }
    commit({ ...data, ifThens: [...data.ifThens, entry] })
    return entry
  },

  updateIfThen(entry: IfThenEntry): void {
    commit({ ...data, ifThens: data.ifThens.map(e => (e.id === entry.id ? entry : e)) })
  },

  deleteIfThen(id: string): void {
    commit({ ...data, ifThens: data.ifThens.filter(e => e.id !== id) })
  },

  importData(text: string): void {
    commit(importJson(text))
  },

  resetForTests(next: AppData): void {
    data = next
    saveOk = true
    listeners.forEach(fn => fn())
  },
}
