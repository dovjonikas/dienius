import { useSyncExternalStore } from 'react'
import type { AppData, DayPlan, DayType, IfThenEntry, Template, ThemeState } from './types'
import { importJson, loadData, saveData } from './storage'
import { applyStamps } from './stamping'
import { addDays } from './dates'

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

/** A task can be pushed to the next day at most this many times. */
export const MAX_PUSHES = 2

export interface RolloverResult {
  /** Tasks moved to the next day, with pushCount incremented. */
  moved: number
  /** Tasks left in place because they had already reached MAX_PUSHES. */
  held: number
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
    const moved = pushable.map(t => ({
      ...t,
      fromTemplate: false,
      pushCount: (t.pushCount ?? 0) + 1,
      core: undefined,
    }))
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

  addTemplate(input: {
    name: string
    color: string
    type?: DayType
    blocks: { time?: string; title: string; core?: boolean }[]
  }): Template {
    const template: Template = {
      id: crypto.randomUUID(),
      name: input.name,
      color: input.color,
      type: input.type,
      blocks: input.blocks.map(b => ({ id: crypto.randomUUID(), time: b.time, title: b.title, core: b.core })),
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
