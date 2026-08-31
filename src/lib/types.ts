/**
 * What kind of day a template describes. A full day is measured on every
 * task, the same way every day worked before this field existed. On a
 * shift, night or rest day the score counts only tasks marked `core` -
 * see `dayScore` in `src/widgets/day-plan/score.ts`. Shift and night are
 * kept as separate values because they read differently on a calendar and
 * in a person's own head, even though today they behave identically for
 * scoring; rest is its own value for the same reason, not because it
 * scores any differently from the other two.
 */
export type DayType = 'full' | 'shift' | 'night' | 'rest'

export interface TemplateBlock {
  id: string
  time?: string
  title: string
  /**
   * Marks this block as something that genuinely had to happen. Only
   * matters on a template whose type is not 'full' - there, only core
   * blocks count toward the day's score. Absent or false is not core.
   */
  core?: boolean
}

export interface Template {
  id: string
  name: string
  color: string
  blocks: TemplateBlock[]
  /**
   * Absent means 'full' - a template saved before this field existed
   * loads and scores exactly as it always did.
   */
  type?: DayType
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
  /**
   * Copied from the template block this task was stamped from - see
   * `applyStamps` in `stamping.ts`. A task typed by hand through quick-add
   * is never core; see `docs/DECISIONS.md` for why. Meaningless on a full
   * day, where every task counts regardless.
   *
   * Cleared when a task is pushed to the next day by `rolloverUnfinished`,
   * the same as `fromTemplate` - core is a promise the day's own template
   * made, not a property that travels with the task onto a day it was
   * never planned for.
   */
  core?: boolean
}

export interface DayPlan {
  date: string
  templateId?: string
  /**
   * Copied from the template's type at the moment of stamping, not looked
   * up live - so editing or deleting the template afterward does not
   * silently change how an already-stamped day is scored. Absent means
   * 'full', same as an unstamped or hand-built day always scored.
   */
  dayType?: DayType
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
