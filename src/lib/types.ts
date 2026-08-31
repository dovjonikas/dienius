export interface TemplateBlock {
  id: string
  time?: string
  title: string
}

export interface Template {
  id: string
  name: string
  color: string
  blocks: TemplateBlock[]
}

export interface Task {
  id: string
  time?: string
  title: string
  done: boolean
  fromTemplate?: boolean
  /**
   * How many times this task has been pushed to the next day. Absent or
   * undefined means never pushed, same as 0 - tasks written before this
   * field existed load without it and are treated as fresh.
   */
  pushCount?: number
}

export interface DayPlan {
  date: string
  templateId?: string
  tasks: Task[]
}

export interface Settings {
  theme: 'light' | 'dark'
  enabledWidgets: string[]
}

export interface AppData {
  templates: Template[]
  days: Record<string, DayPlan>
  settings: Settings
}
