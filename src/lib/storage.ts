import type { AppData, DayPlan, DayType, Settings, Task, Template, TemplateBlock } from './types'

const DAY_TYPES: readonly string[] = ['full', 'shift', 'night', 'rest']

export const STORAGE_KEY = 'dienius:data'

export function defaultData(): AppData {
  return {
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
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

// Anything this accepts must be safe to render: a shape check on templates,
// days and settings alone let payloads like {"templates":[{}],"days":{},
// "settings":{}} through, which later crashed the templates view on
// t.blocks.length with no way back except clearing storage by hand.
export function validate(x: unknown): x is AppData {
  if (!isRecord(x)) return false
  if (!Array.isArray(x.templates) || !x.templates.every(isTemplate)) return false
  if (!isRecord(x.days) || !Object.values(x.days).every(isDayPlan)) return false
  if (!isSettings(x.settings)) return false
  return true
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
