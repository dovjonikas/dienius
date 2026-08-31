import type { DayPlan, Task, Template } from './types'

export function applyStamps(
  days: Record<string, DayPlan>,
  templates: Template[],
  stamps: Record<string, string | null>,
): Record<string, DayPlan> {
  const next = { ...days }
  for (const [date, templateId] of Object.entries(stamps)) {
    const existing = next[date] ?? { date, tasks: [] }
    const manual = existing.tasks.filter(t => !t.fromTemplate)
    if (templateId === null) {
      next[date] = { date, tasks: manual }
      continue
    }
    const template = templates.find(t => t.id === templateId)
    if (!template) continue

    // Re-stamping the same template the day already carries should not
    // wipe out completed work. Block ids are not stable across template
    // edits, so match prior template tasks to the current blocks by title
    // and time instead: a match carries its done state forward, a block
    // with no match arrives unchecked, and a prior task with no matching
    // block simply does not come back. A genuinely different template
    // replaces everything, same as before.
    const priorTemplateTasks =
      existing.templateId === templateId ? existing.tasks.filter(t => t.fromTemplate) : []
    const pool = [...priorTemplateTasks]

    const templateTasks: Task[] = template.blocks.map(b => {
      const matchIndex = pool.findIndex(t => t.title === b.title && t.time === b.time)
      const match = matchIndex >= 0 ? pool.splice(matchIndex, 1)[0] : undefined
      return {
        id: crypto.randomUUID(),
        time: b.time,
        title: b.title,
        done: match?.done ?? false,
        fromTemplate: true,
      }
    })
    next[date] = { date, templateId, tasks: [...templateTasks, ...manual] }
  }
  return next
}
