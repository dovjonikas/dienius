import { currentItem } from './library'
import type { DayPlan, LibraryList, Task, Template } from './types'

/**
 * A block bound to a library list stamps a task named after whatever is next
 * in that list, bound to it - so a "Reading" block on Tuesday arrives saying
 * the actual book, and ticking it off advances the book.
 *
 * Everything here degrades to an ordinary task rather than failing: the
 * library is optional (most callers, and every test written before it
 * existed, pass nothing), a list that was deleted resolves to nothing, and a
 * list with nothing unfinished left resolves to nothing too. In all three
 * cases the block's own title stands, which is exactly what it did before
 * this existed.
 */
function boundTo(list: LibraryList | undefined): { title: string; ref: Task['libraryRef'] } | undefined {
  if (!list) return undefined
  const item = currentItem(list)
  if (!item) return undefined
  return { title: item.title, ref: { listId: list.id, itemId: item.id } }
}

export function applyStamps(
  days: Record<string, DayPlan>,
  templates: Template[],
  stamps: Record<string, string | null>,
  library: LibraryList[] = [],
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
      const bound = b.libraryListId ? boundTo(library.find(l => l.id === b.libraryListId)) : undefined
      return {
        id: crypto.randomUUID(),
        time: b.time,
        title: bound?.title ?? b.title,
        libraryRef: bound?.ref,
        done: match?.done ?? false,
        fromTemplate: true,
        // Core, minutes, unbounded and category all come from the template's
        // current block, not the matched prior task - the same rule stamping
        // already applies to title and time, so editing a block's size (or
        // its colour, or whether it is a standing task) and re-stamping
        // updates the day the same way editing its title does.
        core: b.core,
        minutes: b.minutes,
        unbounded: b.unbounded,
        category: b.category,
      }
    })
    // dayType is copied from the template at this moment, not looked up
    // live later - see the field's doc comment in types.ts.
    next[date] = { date, templateId, dayType: template.type, tasks: [...templateTasks, ...manual] }
  }
  return next
}
