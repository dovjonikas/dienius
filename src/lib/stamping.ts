import { currentItem } from './library'
import { originFor } from './taskIdentity'
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

    // Re-stamping the same template must not wipe out completed work, and
    // must not duplicate a block the day already holds - including one that
    // arrived by being pushed from yesterday, which is how a day used to end
    // up with two of everything. Matching is by block id first, which is
    // stable and survives a rename; title-and-time is the fallback for tasks
    // stamped before origins existed. A match keeps its own state and its own
    // id; a block with no match arrives unchecked; a prior task with no
    // matching block does not come back.
    const priorTemplateTasks =
      existing.templateId === templateId ? existing.tasks.filter(t => t.fromTemplate) : []
    // Anything on the day carrying this template's identity, however it got
    // here. This is the set a re-stamp must not duplicate.
    const carried = existing.tasks.filter(t => originFor(t).type === 'template' && originFor(t).sourceId === templateId)
    const pool = [...new Set([...priorTemplateTasks, ...carried])]

    const templateTasks: Task[] = template.blocks.map(b => {
      const byBlock = pool.findIndex(t => originFor(t).blockId === b.id)
      const matchIndex = byBlock >= 0 ? byBlock : pool.findIndex(t => t.title === b.title && t.time === b.time)
      const match = matchIndex >= 0 ? pool.splice(matchIndex, 1)[0] : undefined
      const bound = b.libraryListId ? boundTo(library.find(l => l.id === b.libraryListId)) : undefined
      return {
        // A matched task keeps its own id, so anything pointing at it - a
        // focus session, an undo offer - still resolves after a re-stamp.
        id: match?.id ?? crypto.randomUUID(),
        origin: { type: 'template', sourceId: templateId, blockId: b.id },
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
        // State a day earned, kept: a note written on it, the steps ticked
        // off, whether it was one of the day's key tasks, how far it has been
        // carried. Editing a template is a statement about its shape, not
        // permission to erase what happened on a day it was stamped onto.
        note: match?.note,
        subtasks: match?.subtasks,
        highlight: match?.highlight,
        pushCount: match?.pushCount,
      }
    })
    // dayType is copied from the template at this moment, not looked up
    // live later - see the field's doc comment in types.ts. Manual keeps
    // every task the template does not account for - including repeat
    // instances, which are not this template's to replace.
    const kept = manual.filter(t => !templateTasks.some(s => s.id === t.id))
    next[date] = {
      ...existing,
      date,
      templateId,
      dayType: template.type,
      tasks: [...templateTasks, ...kept],
    }
  }
  return next
}
