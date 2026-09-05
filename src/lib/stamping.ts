import { currentItem } from './library'
import { originFor } from './taskIdentity'
import { weekdayOf } from './repeats'
import type { DayPlan, LibraryList, Task, Template, TemplateBlock } from './types'

/**
 * The blocks a given date takes from a template, and the day type and sleep
 * schedule that come with them.
 *
 * This is the entire difference between a day template and a week one. A day
 * template hands over all of its blocks whatever the date is; a week template
 * hands over the column for that weekday, and lets that column override the
 * template's own day type and sleep schedule. Everything after this point -
 * matching, keeping what a day earned, not duplicating a pushed task - is the
 * same code for both, which is the reason the two kinds share one entity
 * rather than having a stamping path each.
 *
 * A block on a week template with no weekday belongs to no column and is
 * simply not stamped. That is a defect rather than a state, but it degrades
 * the way a dangling id does instead of throwing: one bad block cannot cost
 * somebody their week.
 */
export function columnFor(
  template: Template,
  date: string,
): { blocks: TemplateBlock[]; type: Template['type']; sleepProfileId: string | undefined } {
  if (template.kind !== 'week') {
    return { blocks: template.blocks, type: template.type, sleepProfileId: template.sleepProfileId }
  }
  const weekday = weekdayOf(date)
  const override = template.weekDays?.[weekday]
  return {
    blocks: template.blocks.filter(b => b.weekday === weekday),
    type: override?.type ?? template.type,
    sleepProfileId: override?.sleepProfileId ?? template.sleepProfileId,
  }
}

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

    const column = columnFor(template, date)

    const templateTasks: Task[] = column.blocks.map(b => {
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
      dayType: column.type,
      // Sleep is deliberately *not* written onto the day here, the way dayType
      // is. A day's sleep schedule is looked up from its template when it is
      // drawn - see DayView and WeekView - and a week template's answer to
      // that lookup is its column's, which is why both callers ask
      // columnFor rather than reading template.sleepProfileId. Writing it
      // here would pin a stamped day's sleep against a later template edit,
      // which is a change to how day templates have always behaved and is not
      // this feature's to make.
      tasks: [...templateTasks, ...kept],
    }
  }
  return next
}
