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

  rolloverUnfinished(date: string): number {
    const day = data.days[date]
    if (!day) return 0
    const unfinished = day.tasks.filter(t => !t.done)
    if (unfinished.length === 0) return 0
    const targetDate = addDays(date, 1)
    const target = data.days[targetDate] ?? { date: targetDate, tasks: [] }
    const moved = unfinished.map(t => ({ ...t, fromTemplate: false }))
    commit({
      ...data,
      days: {
        ...data.days,
        [date]: { ...day, tasks: day.tasks.filter(t => t.done) },
        [targetDate]: { ...target, tasks: [...target.tasks, ...moved] },
      },
    })
    return moved.length
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
