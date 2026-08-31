import { useSyncExternalStore } from 'react'
import type { AppData, DayPlan, Template } from './types'
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
    const moved = pushable.map(t => ({ ...t, fromTemplate: false, pushCount: (t.pushCount ?? 0) + 1 }))
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

  addTemplate(input: { name: string; color: string; blocks: { time?: string; title: string }[] }): Template {
    const template: Template = {
      id: crypto.randomUUID(),
      name: input.name,
      color: input.color,
      blocks: input.blocks.map(b => ({ id: crypto.randomUUID(), time: b.time, title: b.title })),
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

  setTheme(theme: 'light' | 'dark'): void {
    commit({ ...data, settings: { ...data.settings, theme } })
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
