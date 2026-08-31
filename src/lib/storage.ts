import type { AppData } from './types'

export const STORAGE_KEY = 'dienius:data'

export function defaultData(): AppData {
  return {
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
  }
}

export function validate(x: unknown): x is AppData {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return (
    Array.isArray(o.templates) &&
    typeof o.days === 'object' && o.days !== null && !Array.isArray(o.days) &&
    typeof o.settings === 'object' && o.settings !== null
  )
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const parsed: unknown = JSON.parse(raw)
    return validate(parsed) ? parsed : defaultData()
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
    return parsed
  } catch {
    throw new Error('Invalid Dienius backup file')
  }
}
