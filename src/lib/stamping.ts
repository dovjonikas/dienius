import { currentItem } from './library'
import { originFor } from './taskIdentity'
import { weekdayOf } from './repeats'
import { MAX_HIGHLIGHTS } from './types'
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

/**
 * A day's tasks, asked again for what their blocks give them.
 *
 * The binding was resolved once, at the moment the day was stamped, and then
 * never again - which is exactly wrong for the one thing a binding is for. A
 * block bound to a list does not say a book; it says "whatever is next in
 * that list", and what is next changes. The owner stamped a week, added the
 * books afterwards, and the days went on saying "Read: MIND" with no book
 * behind them: the list was empty when the stamp happened, `boundTo` found
 * nothing, and nothing ever asked again.
 *
 * Two ways a day goes stale and this answers both. A list that had nothing
 * has something now, so a task with no binding takes one. And the book that
 * was current has been finished since, so a task still pointing at it moves
 * on to the next one - which is the promise the library's own doc already
 * makes, that finishing a book moves the block on rather than leaving a dead
 * block behind.
 *
 * **Only what has not happened yet.** A done task is a record of a sitting
 * with a particular book and is never touched. Nor is a past day: a Tuesday
 * that has been lived says what was on it, and re-pointing it would be the
 * app editing history to match a list.
 *
 * **And only what the block gave.** A task the owner renamed by hand is
 * still re-pointed - the title comes from the block on a re-stamp too, and a
 * bound task's title is the book's name rather than anything anybody typed.
 *
 * ---
 *
 * **The note is the second thing that goes stale, and for the same reason.**
 * The owner stamped a template, then wrote the block's note, and the days
 * already on the calendar went on showing nothing: "neatsiranda, kol
 * neperdedu is naujo template i kalendoriu". A block's note is not a copy
 * taken at stamp time either - it is what that block is, in the words you
 * would say to yourself, and editing it is editing every day it has not yet
 * been written on.
 *
 * Only two of the things a block hands a task can be refreshed, and it is
 * worth being exact about why. Refreshing anything means being able to tell
 * "the day still carries what the block gave it" from "somebody changed
 * this", and the app records the block's own last answer for exactly two
 * fields: `templateNote` beside `note`, and `libraryRef` beside `title`.
 * For a time, a length or a category it keeps no such record, so a day that
 * differs from its block might be a day somebody moved by hand, and handing
 * those back would quietly undo real edits. Those still wait for a re-stamp,
 * which is a person saying "make this day the template again".
 */
export function refreshFromTemplate(
  day: DayPlan,
  templates: Template[],
  library: LibraryList[],
): DayPlan | null {
  let changed = false
  const tasks = day.tasks.map(task => {
    if (task.done) return task
    const origin = originFor(task)
    if (origin.type !== 'template' || !origin.blockId) return task
    const block = templates
      .find(t => t.id === origin.sourceId)
      ?.blocks.find(b => b.id === origin.blockId)
    if (!block) return task
    let next = task

    if (block.libraryListId) {
      const bound = boundTo(library.find(l => l.id === block.libraryListId))
      // Nothing to point at: the list is gone, or everything in it is
      // finished. The block's own title stands, which is what it does at
      // stamp time in the same case.
      const title = bound?.title ?? block.title
      const ref = bound?.ref
      if (next.title !== title || next.libraryRef?.itemId !== ref?.itemId) next = { ...next, title, libraryRef: ref }
    }

    // A task still carrying exactly what the block last gave it has not been
    // written on, so the block is free to change its mind. Both absent is the
    // same answer by the same test, and that is the reported case: the day
    // was stamped before the block had a note at all. `noteExpanded` travels
    // with the note and is never the day's, so it comes along either way.
    //
    // Not `ownNote`, which the stamp uses, and the difference is a real one.
    // `ownNote` reads a note the owner deleted as "has none", so a stamp
    // hands it back - defensible there, because stamping is a person saying
    // "make this day the template again". Opening a day is not that, and a
    // note that came back every time the day was looked at would be a note
    // that cannot be deleted. `note` absent while `templateNote` is still
    // there is exactly the shape of a deletion, and it is left alone.
    const noteIsStillTheBlocks = task.note === task.templateNote
    if (noteIsStillTheBlocks && (next.note !== block.note || next.templateNote !== block.note || next.noteExpanded !== block.noteExpanded)) {
      next = { ...next, note: block.note, templateNote: block.note, noteExpanded: block.noteExpanded }
    }

    if (next === task) return task
    changed = true
    return next
  })
  return changed ? { ...day, tasks } : null
}

/**
 * The note a day wrote for itself, as opposed to the one its template handed
 * it.
 *
 * A task that still carries exactly what the block last gave it has not been
 * written on, whatever it says, so the block is free to change its mind. Both
 * absent is the same answer by the same test. A note the owner deleted comes
 * back at the next stamp, which is the one case this reads as "has none":
 * the block's note is the default for a day without one, and an empty day is
 * without one.
 */
function ownNote(match: Task | undefined): string | undefined {
  if (!match || match.note === undefined) return undefined
  return match.note === match.templateNote ? undefined : match.note
}

/**
 * The day's key tasks, held to `MAX_HIGHLIGHTS`.
 *
 * Both editors already refuse a fourth key block on a day, so a template
 * built here cannot produce one. This is for everything that did not come
 * from an editor: a template from a backup, a hand-edited file, a group of
 * blocks copied onto a column that already had three, a future migration.
 *
 * The earliest three by the clock keep their mark and the rest arrive
 * unmarked. **Nothing is dropped** - a block that loses its KEY is still a
 * task on the day, because the cap is about how many things can be
 * important and not about how many things there are. Untimed blocks sort
 * last, since a task with no time is not competing for the morning.
 *
 * `budget` is what the day has left after the tasks this stamp is not
 * touching: a person's own key task on a manual entry is theirs, and a
 * template arriving is not a reason to take it away.
 */
function capHighlights(tasks: Task[], budget: number): Task[] {
  const marked = tasks.filter(t => t.highlight)
  if (marked.length <= budget) return tasks
  const byTime = [...marked].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
  const keep = new Set(byTime.slice(0, Math.max(0, budget)).map(t => t.id))
  return tasks.map(t => (t.highlight && !keep.has(t.id) ? { ...t, highlight: false } : t))
}

/**
 * Puts a template onto each date it is handed, or takes one off where the id
 * is null. The one place a day is written from a template, so every door -
 * the rail's chip, the calendar's painted range, a week column, "Stamp week",
 * the weekday map - arrives at the same answer.
 *
 * It stamps whatever date it is given, including one already past, and that
 * is deliberate: painting a template over last week in the month view is
 * somebody saying what those days held, and refusing it here would be this
 * function overruling a person who is looking straight at the day. The rule
 * that a stamp never reaches backwards belongs to the doors that act on a
 * stretch of days without being asked day by day - `planWeekStamp` and the
 * weekday map in `ensureDay.ts` - and it is written down in both.
 */
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
        // State a day earned, kept: whether it was one of the day's key
        // tasks, how far it has been carried. Editing a template is a
        // statement about its shape, not permission to erase what happened on
        // a day it was stamped onto.
        //
        // The note the day actually earned, and the block's own behind it.
        // Before this, `match?.note` on a fresh day was nothing, so a template
        // could carry a recipe and never deliver it.
        //
        // `match?.note ?? b.note` alone was not enough, and the test that
        // says so is in stamping.test.ts: after one stamp the day's note IS
        // the block's text, so a second stamp could no longer tell a day
        // somebody wrote on from a day the template had filled, and editing
        // the block reached neither. `templateNote` is what the block gave
        // last time, so a note that still matches it is the block's to
        // replace and anything else is the day's to keep.
        note: ownNote(match) ?? b.note,
        templateNote: b.note,
        // Travels with the note it is about: a block whose recipe is the
        // reason you look at the card says so on every day it stamps.
        noteExpanded: b.noteExpanded,
        // The same reading as the note, and the day wins in both directions:
        // `toggleTaskHighlight` writes `false` rather than removing the
        // field, so KEY taken off this morning's task is not handed back by
        // the next stamp. Capped below, across the day.
        highlight: match?.highlight ?? b.highlight,
        pushCount: match?.pushCount,
      }
    })
    // dayType is copied from the template at this moment, not looked up
    // live later - see the field's doc comment in types.ts. Manual keeps
    // every task the template does not account for - including repeat
    // instances, which are not this template's to replace.
    const kept = manual.filter(t => !templateTasks.some(s => s.id === t.id))
    // What the day has left for key tasks after the ones this stamp is not
    // touching - see capHighlights.
    const capped = capHighlights(templateTasks, MAX_HIGHLIGHTS - kept.filter(t => t.highlight).length)
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
      tasks: [...capped, ...kept],
    }
  }
  return next
}
