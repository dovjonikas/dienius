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
    const templateTasks: Task[] = template.blocks.map(b => ({
      id: crypto.randomUUID(),
      time: b.time,
      title: b.title,
      done: false,
      fromTemplate: true,
    }))
    next[date] = { date, templateId, tasks: [...templateTasks, ...manual] }
  }
  return next
}
