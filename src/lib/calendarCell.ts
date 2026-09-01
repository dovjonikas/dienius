import type { MonthCell } from './dates'
import { formatDayTitle } from './dates'
import type { Template } from './types'

/**
 * Extracted from CalendarView.tsx - docs/LAYOUT-WIDE.md section 5, build
 * step 5 - so MiniCalendar.tsx can share the exact same rules a month cell
 * already follows there instead of re-deriving them. CalendarView.tsx
 * imports these back; nothing about its own behaviour changes.
 */

export type TaskState = 'none' | 'unfinished' | 'done'

/**
 * A cell built only from templateId cannot tell a genuinely empty day apart
 * from one that holds real, unstamped tasks - a hand-planned day, a day a
 * task was pushed onto, or a day whose template was later deleted. This is
 * what closes that gap: it looks at the day's actual tasks, independent of
 * whether a template happens to be stamped on top of them.
 */
export function taskState(day: { tasks: { done: boolean }[] } | undefined): TaskState {
  const tasks = day?.tasks ?? []
  if (tasks.length === 0) return 'none'
  return tasks.every(t => t.done) ? 'done' : 'unfinished'
}

/**
 * The template-lookup-and-colour logic a stamped cell needs. Deliberately
 * plain - just the id-to-template lookup - so CalendarView.tsx's own
 * staged-paint overrides (see its effectiveTemplateId) stay local to it
 * rather than becoming part of this shared, read-only rule.
 */
export function resolveTemplate(templateId: string | null | undefined, templates: Template[]): Template | undefined {
  return templateId ? templates.find(t => t.id === templateId) : undefined
}

/**
 * The visible cell only ever shows a bare day number, which is meaningless
 * out of context to a screen reader user jumping cell to cell - two "12"s
 * a month apart read identically. The accessible name carries the full
 * date instead, plus the template name where the visible chip already
 * shows one, since a 10px chip is not the only place that information
 * needs to reach. It also carries whether the day has tasks at all and
 * whether they are finished - see taskState above for why that cannot be
 * left to the cell's color alone.
 */
export function cellLabel(cell: MonthCell, templateName: string | undefined, state: TaskState): string {
  const parts = [formatDayTitle(cell.key)]
  if (templateName) parts.push(templateName)
  if (state === 'unfinished') parts.push('has unfinished tasks')
  if (state === 'done') parts.push('tasks completed')
  return parts.join(', ')
}
