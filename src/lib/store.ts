import { useSyncExternalStore } from 'react'
import type { AppData, DayPlan, DayType, IfThenEntry, IfThenWhen, LibraryItem, LibraryList, LibraryRef, Repeat, Settings, SleepWindow, Subtask, Task, Template, ThemeState } from './types'
import { MAX_HIGHLIGHTS } from './types'
import { isItemFinished, itemProgress, parseLibraryItemInput } from './library'
import { importJson, loadData, saveData } from './storage'
import { applyStamps } from './stamping'
import { addDays } from './dates'
import { isPushable } from './pushRules'
import type { CategoryId } from './categories'

export { MAX_PUSHES } from './pushRules'

let data: AppData = loadData()
let saveOk = true
const listeners = new Set<() => void>()

function commit(next: AppData): void {
  data = next
  saveOk = saveData(data)
  listeners.forEach(fn => fn())
}

export function getData(): AppData {
  return data
}

export function getSaveOk(): boolean {
  return saveOk
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getData)
}

function dayOf(date: string): DayPlan {
  return data.days[date] ?? { date, tasks: [] }
}

function withDay(date: string, day: DayPlan): AppData {
  return { ...data, days: { ...data.days, [date]: day } }
}

export interface RolloverResult {
  /** Tasks moved to the next day, with pushCount incremented. */
  moved: number
  /** Tasks left in place because they had already reached MAX_PUSHES. */
  held: number
}

// Shared by rolloverUnfinished and pushTask below - both move a task to the
// next day the same way, one pushing everything unfinished at once, the
// other pushing exactly one. See the doc comment on rolloverUnfinished's
// own mapping for why fromTemplate and core are cleared here. unbounded is
// deliberately left untouched - see its own doc comment on Task in
// types.ts - it is a fact about the kind of task this is, not a promise
// tied to the day it was pushed from.
function pushedForward(task: DayPlan['tasks'][number]): DayPlan['tasks'][number] {
  return { ...task, fromTemplate: false, pushCount: (task.pushCount ?? 0) + 1, core: undefined }
}

function withLibrary(library: LibraryList[]): AppData {
  return { ...data, library }
}

function mapList(listId: string, fn: (list: LibraryList) => LibraryList): AppData {
  return withLibrary(data.library.map(l => (l.id === listId ? fn(l) : l)))
}

function mapItem(list: LibraryList, itemId: string, fn: (item: LibraryItem) => LibraryItem): LibraryList {
  return { ...list, items: list.items.map(i => (i.id === itemId ? fn(i) : i)) }
}

/**
 * Moves one item forward or back by a number of units, and keeps the
 * finished flag honest in both directions.
 *
 * The flag is set here rather than inferred at read time because an item
 * with no total can still be finished - somebody just decides a podcast is
 * done - and because stepping back off the last unit has to un-finish it,
 * which a derived value could not express. isItemFinished still treats a
 * full count as finished regardless, so the two agree on the ordinary case.
 */
function advanced(item: LibraryItem, by: number, today: string): LibraryItem {
  const next = Math.max(0, itemProgress(item) + by)
  const capped = item.total !== undefined ? Math.min(next, item.total) : next
  const full = item.total !== undefined && item.total > 0 && capped >= item.total
  return { ...item, progress: capped, finished: full ? (item.finished ?? today) : undefined }
}

/**
 * The one place a task's done state and its library item stay in step.
 *
 * Ticking a bound task off is what advances the book; un-ticking it steps
 * back. Doing it here rather than in the view means every way of finishing a
 * task - the card, the detail sheet, Focus, the keyboard - advances it, and
 * none of them has to know the library exists.
 */
function advanceForTask(library: LibraryList[], task: Task, nowDone: boolean, today: string): LibraryList[] {
  const ref = task.libraryRef
  if (!ref) return library
  return library.map(list => {
    if (list.id !== ref.listId) return list
    if (!list.items.some(i => i.id === ref.itemId)) return list
    return { ...list, items: list.items.map(i => (i.id === ref.itemId ? advanced(i, nowDone ? 1 : -1, today) : i)) }
  })
}

export const actions = {
  /**
   * `category` is optional so every existing caller - and a task restored
   * from a backup written before categories existed - keeps producing exactly
   * the uncategorised task it always did, drawn in the day's own template
   * colour. Quick-add is the one caller that passes it.
   */
  addTask(date: string, title: string, time?: string, category?: CategoryId): void {
    const day = dayOf(date)
    const task = { id: crypto.randomUUID(), title, time, done: false, category }
    commit(withDay(date, { ...day, tasks: [...day.tasks, task] }))
  },

  setTaskCategory(date: string, taskId: string, category: CategoryId): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, category } : t)),
    }))
  },

  toggleTask(date: string, taskId: string): void {
    const day = dayOf(date)
    const task = day.tasks.find(t => t.id === taskId)
    const tasks = day.tasks.map(t => (t.id === taskId ? { ...t, done: !t.done } : t))
    const library = task ? advanceForTask(data.library, task, !task.done, date) : data.library
    commit({ ...withDay(date, { ...day, tasks }), library })
  },

  deleteTask(date: string, taskId: string): void {
    const day = dayOf(date)
    commit(withDay(date, { ...day, tasks: day.tasks.filter(t => t.id !== taskId) }))
  },

  // --- task detail ------------------------------------------------------

  setTaskTime(date: string, taskId: string, time: string | undefined): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, time: time || undefined } : t)),
    }))
  },

  setTaskTitle(date: string, taskId: string, title: string): void {
    const trimmed = title.trim()
    if (trimmed === '') return
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, title: trimmed } : t)),
    }))
  },

  setTaskNote(date: string, taskId: string, note: string): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, note: note.trim() || undefined } : t)),
    }))
  },

  /**
   * Refuses past MAX_HIGHLIGHTS rather than dropping the oldest. Silently
   * swapping one out would make the cap invisible and the choice arbitrary;
   * refusing makes the day say, in the one place it matters, that this is a
   * decision with a cost. Un-highlighting always works.
   */
  toggleTaskHighlight(date: string, taskId: string): void {
    const day = dayOf(date)
    const task = day.tasks.find(t => t.id === taskId)
    if (!task) return
    if (!task.highlight && day.tasks.filter(t => t.highlight).length >= MAX_HIGHLIGHTS) return
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, highlight: !t.highlight } : t)),
    }))
  },

  setTaskRepeat(date: string, taskId: string, repeat: Repeat | undefined): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, repeat } : t)),
    }))
  },

  addSubtask(date: string, taskId: string, title: string): void {
    const trimmed = title.trim()
    if (trimmed === '') return
    const day = dayOf(date)
    const subtask: Subtask = { id: crypto.randomUUID(), title: trimmed, done: false }
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, subtasks: [...(t.subtasks ?? []), subtask] } : t)),
    }))
  },

  toggleSubtask(date: string, taskId: string, subtaskId: string): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t =>
        t.id === taskId
          ? { ...t, subtasks: (t.subtasks ?? []).map(sub => (sub.id === subtaskId ? { ...sub, done: !sub.done } : sub)) }
          : t,
      ),
    }))
  },

  deleteSubtask(date: string, taskId: string, subtaskId: string): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t =>
        t.id === taskId ? { ...t, subtasks: (t.subtasks ?? []).filter(sub => sub.id !== subtaskId) } : t,
      ),
    }))
  },

  setTaskLibraryRef(date: string, taskId: string, ref: LibraryRef | undefined): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, libraryRef: ref } : t)),
    }))
  },

  // --- library ----------------------------------------------------------

  addLibraryList(input: { name: string; unit: string; unitShort?: string; unitPlural?: string }): LibraryList {
    const list: LibraryList = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      unit: input.unit.trim().toLowerCase() || 'item',
      unitShort: input.unitShort?.trim() || undefined,
      unitPlural: input.unitPlural?.trim() || undefined,
      items: [],
    }
    commit(withLibrary([...data.library, list]))
    return list
  },

  updateLibraryList(listId: string, patch: Partial<Omit<LibraryList, 'id' | 'items'>>): void {
    commit(mapList(listId, list => ({
      ...list,
      name: patch.name !== undefined ? patch.name : list.name,
      unit: patch.unit !== undefined ? patch.unit.toLowerCase() : list.unit,
      unitShort: patch.unitShort !== undefined ? patch.unitShort.trim() || undefined : list.unitShort,
      unitPlural: patch.unitPlural !== undefined ? patch.unitPlural.trim() || undefined : list.unitPlural,
    })))
  },

  /**
   * Deleting a list takes every task binding to it with it, the same way
   * deleting a sleep schedule does - a task pointing at a list that is gone
   * would keep drawing a progress chip for something nobody can open.
   */
  deleteLibraryList(listId: string): void {
    const days = Object.fromEntries(
      Object.entries(data.days).map(([date, day]) => [
        date,
        { ...day, tasks: day.tasks.map(t => (t.libraryRef?.listId === listId ? { ...t, libraryRef: undefined } : t)) },
      ]),
    )
    commit({
      ...data,
      days,
      library: data.library.filter(l => l.id !== listId),
      templates: data.templates.map(t => ({
        ...t,
        blocks: t.blocks.map(b => (b.libraryListId === listId ? { ...b, libraryListId: undefined } : b)),
      })),
    })
  },

  /** Takes the raw typed line, so "Daring Greatly, 12 chapters" arrives whole. */
  addLibraryItem(listId: string, input: string): LibraryItem | undefined {
    const parsed = parseLibraryItemInput(input)
    if (!parsed) return undefined
    const item: LibraryItem = { id: crypto.randomUUID(), title: parsed.title, total: parsed.total }
    commit(mapList(listId, list => ({ ...list, items: [...list.items, item] })))
    return item
  },

  setLibraryItemProgress(listId: string, itemId: string, progress: number, today: string): void {
    commit(mapList(listId, list =>
      mapItem(list, itemId, item => advanced({ ...item, progress: 0, finished: undefined }, progress, today)),
    ))
  },

  stepLibraryItem(listId: string, itemId: string, by: number, today: string): void {
    commit(mapList(listId, list => mapItem(list, itemId, item => advanced(item, by, today))))
  },

  setLibraryItemTotal(listId: string, itemId: string, total: number | undefined, today: string): void {
    commit(mapList(listId, list =>
      mapItem(list, itemId, item => advanced({ ...item, total, progress: 0 }, itemProgress(item), today)),
    ))
  },

  /** Marks an item finished outright, or reopens one. The manual override. */
  toggleLibraryItemFinished(listId: string, itemId: string, today: string): void {
    commit(mapList(listId, list =>
      mapItem(list, itemId, item =>
        isItemFinished(item)
          ? { ...item, finished: undefined, progress: item.total !== undefined ? Math.max(0, item.total - 1) : itemProgress(item) }
          : { ...item, finished: today, progress: item.total ?? itemProgress(item) },
      ),
    ))
  },

  deleteLibraryItem(listId: string, itemId: string): void {
    const days = Object.fromEntries(
      Object.entries(data.days).map(([date, day]) => [
        date,
        { ...day, tasks: day.tasks.map(t => (t.libraryRef?.itemId === itemId ? { ...t, libraryRef: undefined } : t)) },
      ]),
    )
    commit({
      ...data,
      days,
      library: data.library.map(l => (l.id === listId ? { ...l, items: l.items.filter(i => i.id !== itemId) } : l)),
    })
  },

  /** Drag-reorder: lifts one item out and drops it back at an index. */
  moveLibraryItem(listId: string, itemId: string, toIndex: number): void {
    commit(mapList(listId, list => {
      const from = list.items.findIndex(i => i.id === itemId)
      if (from === -1) return list
      const items = [...list.items]
      const [moved] = items.splice(from, 1)
      items.splice(Math.max(0, Math.min(toIndex, items.length)), 0, moved)
      return { ...list, items }
    }))
  },

  /**
   * Puts a session on this item onto a day, already bound and already named
   * after it. The two-tap path from the Library: pick the item, pick the day.
   *
   * Returns false and writes nothing when that day already has an unfinished
   * session on the same item. Two identical cards is not a plan for reading
   * twice, it is the same tap landing twice, and the day is the one place in
   * this app where a duplicate is never what somebody meant. A day where the
   * session is already *done* is a different case and does add a second one:
   * a second sitting on the same book is a real thing to plan.
   */
  scheduleLibraryItem(date: string, listId: string, itemId: string, minutes?: number): boolean {
    const list = data.library.find(l => l.id === listId)
    const item = list?.items.find(i => i.id === itemId)
    if (!list || !item) return false
    const day = dayOf(date)
    if (day.tasks.some(t => !t.done && t.libraryRef?.listId === listId && t.libraryRef.itemId === itemId)) {
      return false
    }
    const task: Task = {
      id: crypto.randomUUID(),
      title: item.title,
      done: false,
      minutes,
      category: 'personal',
      libraryRef: { listId, itemId },
    }
    commit(withDay(date, { ...day, tasks: [...day.tasks, task] }))
    return true
  },

  rolloverUnfinished(date: string): RolloverResult {
    const day = data.days[date]
    if (!day) return { moved: 0, held: 0 }
    const unfinished = day.tasks.filter(t => !t.done)
    if (unfinished.length === 0) return { moved: 0, held: 0 }

    const pushable = unfinished.filter(isPushable)
    const held = unfinished.length - pushable.length
    if (pushable.length === 0) return { moved: 0, held }

    const targetDate = addDays(date, 1)
    const target = data.days[targetDate] ?? { date: targetDate, tasks: [] }
    const movedIds = new Set(pushable.map(t => t.id))
    // core describes a promise a template made about the day it was
    // stamped for, not a property of the task itself - the same reason
    // fromTemplate is cleared here too. Carrying it forward unchanged
    // would let a shift day's required task silently become a required
    // task on whatever day it happens to land on next, including a rest
    // day that is supposed to have nothing required at all. If a pushed
    // task is still genuinely necessary, the push bound already forces a
    // decision on it - unbounded is the escape hatch from that decision,
    // core is not, and the two stay separate for exactly this reason.
    const moved = pushable.map(pushedForward)
    commit({
      ...data,
      days: {
        ...data.days,
        [date]: { ...day, tasks: day.tasks.filter(t => !movedIds.has(t.id)) },
        [targetDate]: { ...target, tasks: [...target.tasks, ...moved] },
      },
    })
    return { moved: moved.length, held }
  },

  /**
   * Pushes exactly one task to the next day - the same move
   * rolloverUnfinished makes for every unfinished task at once, offered
   * here as its own entry point so one specific task can move without
   * touching anything else on the day. The day view offers this per float,
   * so the owner picks which one moves rather than the app choosing for
   * them - see docs/TIMELINE.md section 8. Bound by the same `isPushable`
   * check rolloverUnfinished uses, so a task marked unbounded keeps moving
   * here too, and a done task is never eligible - pushing finished work to
   * tomorrow makes no sense - so this returns false rather than acting in
   * either case, the same way rolloverUnfinished silently excludes both.
   */
  pushTask(date: string, taskId: string): boolean {
    const day = data.days[date]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task || task.done || !isPushable(task)) return false

    const targetDate = addDays(date, 1)
    const target = data.days[targetDate] ?? { date: targetDate, tasks: [] }
    commit({
      ...data,
      days: {
        ...data.days,
        [date]: { ...day!, tasks: day!.tasks.filter(t => t.id !== taskId) },
        [targetDate]: { ...target, tasks: [...target.tasks, pushedForward(task)] },
      },
    })
    return true
  },

  /**
   * Sets, changes or clears a task's estimated size. Never invoked by the
   * quick-add flow itself - see docs/TIMELINE.md section 9 - this is the
   * separate, optional control a task's own row offers, so sizing a task
   * is never a question the owner has to answer before the day can start.
   * Passing undefined clears it back to unsized.
   */
  setTaskMinutes(date: string, taskId: string, minutes: number | undefined): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, minutes } : t)),
    }))
  },

  /**
   * Sets or clears whether a task is exempt from the push bound - the
   * third choice offered once a task reaches `MAX_PUSHES`, and its own
   * undo. Writes `undefined` rather than a literal `false` when clearing,
   * the same absent-means-false convention `core` and every other
   * optional flag on `Task` already follows, so a task that has never
   * been marked ongoing does not carry a stray field around forever.
   *
   * Plain and reversible with no confirmation step, the same weight as
   * `setTaskMinutes` above - marking a task ongoing by mistake, or
   * deciding it is not standing after all, costs nothing to undo either
   * way.
   */
  setTaskUnbounded(date: string, taskId: string, unbounded: boolean): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, unbounded: unbounded || undefined } : t)),
    }))
  },

  /**
   * Gives a float a `time`, which is what makes it an anchor - see
   * docs/TIMELINE.md section 5 and `capacity.ts`'s own definition of
   * `isAnchor`. This is the tap-a-gap path today; step 7's drag will call
   * the same action rather than invent a second way to place a float.
   * Refuses a task that already has a time - placing only ever moves a
   * float out of the tray, never re-times something already anchored, so a
   * stray double-tap on a race with another update cannot silently move an
   * anchor out from under whatever is already showing for it. Refuses
   * silently (returning false) exactly like `pushTask` does for its own
   * guard, rather than throwing on a state the UI should not have offered
   * in the first place.
   */
  placeFloat(date: string, taskId: string, time: string): boolean {
    const day = data.days[date]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task || task.time !== undefined) return false
    commit(withDay(date, { ...day!, tasks: day!.tasks.map(t => (t.id === taskId ? { ...t, time } : t)) }))
    return true
  },

  /**
   * Clears a task's `time`, returning it to the tray as a float - the undo
   * for `placeFloat` above, and the same action step 7's drag-back-to-tray
   * will call. Nothing else about the task changes: its size, if it has
   * one, survives being placed and undone, because undo is meant to be
   * exactly reversible, not a second push. Refuses a task with no time to
   * clear, the mirror image of `placeFloat`'s own guard.
   */
  unanchorTask(date: string, taskId: string): boolean {
    const day = data.days[date]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task || task.time === undefined) return false
    commit(withDay(date, {
      ...day!,
      tasks: day!.tasks.map(t => (t.id === taskId ? { ...t, time: undefined } : t)),
    }))
    return true
  },

  /**
   * Moves an anchor to a different time, or resizes it - what dragging a
   * block on the grid and pulling its bottom edge actually commit.
   *
   * Deliberately separate from `placeFloat`, which refuses a task that
   * already has a time. That guard is right for placing (placing something
   * twice is a bug), and wrong for moving (moving something is only ever
   * done to a task that already has a position). Both fields are optional
   * so one gesture can change one of them without restating the other, and
   * a no-op call - the same time, the same size - still commits, which is
   * what makes the undo below able to put a task back exactly as it was.
   *
   * Refuses a task that does not exist, or one with no time at all: an
   * untimed task has no position to move and no edge to pull.
   */
  reshapeTask(date: string, taskId: string, next: { time?: string; minutes?: number }): boolean {
    const day = data.days[date]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task || task.time === undefined) return false
    commit(withDay(date, {
      ...day!,
      tasks: day!.tasks.map(t =>
        t.id === taskId
          ? { ...t, time: next.time ?? t.time, minutes: next.minutes ?? t.minutes }
          : t,
      ),
    }))
    return true
  },

  addTemplate(input: {
    name: string
    color: string
    type?: DayType
    sleepProfileId?: string
    // Every field a TemplateBlock has, not a subset. This list used to stop
    // at unbounded, which silently dropped the category off every block of
    // every newly created template - the editor was passing it and this was
    // throwing it away, so a template arrived colourless and only picked its
    // colours up if somebody edited and saved it again (updateTemplate takes
    // a whole Template and never had the gap). Found by writing the library
    // binding's own test, which lost its binding the same way.
    blocks: {
      time?: string
      title: string
      core?: boolean
      minutes?: number
      unbounded?: boolean
      category?: CategoryId
      libraryListId?: string
    }[]
  }): Template {
    const template: Template = {
      id: crypto.randomUUID(),
      name: input.name,
      color: input.color,
      type: input.type,
      sleepProfileId: input.sleepProfileId,
      blocks: input.blocks.map(b => ({
        id: crypto.randomUUID(),
        time: b.time,
        title: b.title,
        core: b.core,
        minutes: b.minutes,
        unbounded: b.unbounded,
        category: b.category,
        libraryListId: b.libraryListId,
      })),
    }
    commit({ ...data, templates: [...data.templates, template] })
    return template
  },

  updateTemplate(template: Template): void {
    commit({
      ...data,
      templates: data.templates.map(t => (t.id === template.id ? template : t)),
    })
  },

  deleteTemplate(id: string): void {
    commit({ ...data, templates: data.templates.filter(t => t.id !== id) })
  },

  stamp(stamps: Record<string, string | null>): void {
    commit({ ...data, days: applyStamps(data.days, data.templates, stamps, data.library) })
  },

  /**
   * Sets the light/dark/system mode without touching which preset is
   * active or any override patch - mode and preset are independent axes,
   * see docs/THEMES.md section 4. Kept under its original name since this
   * is exactly what the Settings toggle already called before presets
   * existed; setThemePreset and setThemeOverride below are the new
   * controls the pipeline needed added alongside it.
   */
  setTheme(mode: ThemeState['mode']): void {
    commit({ ...data, settings: { ...data.settings, theme: { ...data.settings.theme, mode } } })
  },

  setThemePreset(presetId: string): void {
    commit({ ...data, settings: { ...data.settings, theme: { ...data.settings.theme, presetId } } })
  },

  /**
   * Shows or collapses the day view's timeline grid - see
   * docs/TIMELINE.md section 5. A single app-wide setting rather than
   * anything the day's own data carries, so opening the grid once keeps it
   * open on every day after, and closing it again keeps it closed - the
   * choice persists exactly like a theme preference, not like a task.
   */
  setTimelineExpanded(expanded: boolean): void {
    commit({ ...data, settings: { ...data.settings, timelineExpanded: expanded } })
  },

  /**
   * Changes which pane the wide day view gives the width to - see
   * docs/LAYOUT-WIDE.md section 5. Mirrors setTimelineExpanded exactly: a
   * single app-wide setting, flipped in isolation, so it persists like a
   * theme preference rather than resetting per day.
   */
  setDayLayoutFocus(focus: Settings['dayLayoutFocus']): void {
    commit({ ...data, settings: { ...data.settings, dayLayoutFocus: focus } })
  },

  /**
   * How much air the interface spends, and how big its type is. Both are
   * device preferences rather than theme choices - see their own comments in
   * types.ts - so they live in settings beside the other app-wide switches
   * rather than inside a preset's override patch, and survive changing theme.
   */
  /**
   * Catches one line of text with nothing else attached - see `InboxItem`.
   * Newest first, because an inbox is read from the top and the thing just
   * written is the thing most likely to still matter.
   */
  addInboxItem(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    const item = { id: crypto.randomUUID(), text: trimmed, captured: new Date().toISOString() }
    commit({ ...data, inbox: [item, ...data.inbox] })
  },

  deleteInboxItem(id: string): void {
    commit({ ...data, inbox: data.inbox.filter(i => i.id !== id) })
  },

  /**
   * Turns an inbox item into a real task on a real day, and removes it from
   * the inbox in the same commit - one action, not "add it and then remember
   * to clear it". Untimed unless a time is given: the whole point of the
   * inbox is that deciding when was postponed, and being made to decide now
   * would just move the friction rather than remove it.
   */
  scheduleInboxItem(id: string, date: string, time?: string): boolean {
    const item = data.inbox.find(i => i.id === id)
    if (!item) return false
    const day = dayOf(date)
    const task = { id: crypto.randomUUID(), title: item.text, time, done: false }
    commit({
      ...data,
      days: { ...data.days, [date]: { ...day, tasks: [...day.tasks, task] } },
      inbox: data.inbox.filter(i => i.id !== id),
    })
    return true
  },

  setReminder(reminder: Settings['reminder']): void {
    commit({ ...data, settings: { ...data.settings, reminder } })
  },

  setDensity(density: Settings['density']): void {
    commit({ ...data, settings: { ...data.settings, density } })
  },

  setTextScale(textScale: Settings['textScale']): void {
    commit({ ...data, settings: { ...data.settings, textScale } })
  },

  /**
   * Changes the hours of one sleep schedule - see `Settings.sleepProfiles`.
   * Both ends are always written together: a bedtime with no matching wake
   * time, or the reverse, is not a shape this app can compute a window from.
   */
  setSleepProfileWindow(id: string, window: SleepWindow): void {
    commit({
      ...data,
      settings: {
        ...data.settings,
        sleepProfiles: data.settings.sleepProfiles.map(p => (p.id === id ? { ...p, window } : p)),
      },
    })
  },

  renameSleepProfile(id: string, name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    commit({
      ...data,
      settings: {
        ...data.settings,
        sleepProfiles: data.settings.sleepProfiles.map(p => (p.id === id ? { ...p, name: trimmed } : p)),
      },
    })
  },

  /**
   * Adds a schedule, seeded from the default one rather than from nothing -
   * a second schedule is almost always a variation on the first, and an
   * empty pair of fields is a form to fill in rather than a thing to adjust.
   */
  addSleepProfile(name: string): void {
    const base = data.settings.sleepProfiles[0]
    const profile = { id: crypto.randomUUID(), name: name.trim() || 'New schedule', window: { ...base.window } }
    commit({ ...data, settings: { ...data.settings, sleepProfiles: [...data.settings.sleepProfiles, profile] } })
  },

  /**
   * Removes a schedule, and every reference to it. The first one can never be
   * deleted: something has to be the default, and a day pointing at nothing
   * would have no hours at all. Days and templates that used the deleted one
   * fall back to the default in the same commit rather than being left
   * pointing at an id that resolves to it by accident - the fallback in
   *  is a safety net, not a storage strategy.
   */
  deleteSleepProfile(id: string): void {
    if (data.settings.sleepProfiles.length < 2 || data.settings.sleepProfiles[0].id === id) return
    const days = Object.fromEntries(
      Object.entries(data.days).map(([key, day]) =>
        day.sleepProfileId === id ? [key, { ...day, sleepProfileId: undefined }] : [key, day],
      ),
    )
    commit({
      ...data,
      days,
      templates: data.templates.map(t => (t.sleepProfileId === id ? { ...t, sleepProfileId: undefined } : t)),
      settings: { ...data.settings, sleepProfiles: data.settings.sleepProfiles.filter(p => p.id !== id) },
    })
  },

  /** Which schedule one already-planned day is measured against. */
  setDaySleepProfile(date: string, profileId: string | undefined): void {
    const day = dayOf(date)
    commit(withDay(date, { ...day, sleepProfileId: profileId }))
  },

  /**
   * Writes one token into the override patch for a preset, keyed by that
   * preset's own id so switching to a different room and back leaves this
   * patch exactly as it was - see docs/THEMES.md section 3. There is no
   * override UI yet; this exists so the pipeline and storage already
   * support one when the panel that calls it is built.
   */
  setThemeOverride(presetId: string, token: string, value: string): void {
    const current = data.settings.theme.overrides[presetId] ?? {}
    commit({
      ...data,
      settings: {
        ...data.settings,
        theme: {
          ...data.settings.theme,
          overrides: { ...data.settings.theme.overrides, [presetId]: { ...current, [token]: value } },
        },
      },
    })
  },

  /**
   * Removes one token from a preset's override patch, leaving any other
   * overridden tokens on that preset untouched. Used when a write would
   * restore exactly the preset's own stock value for that token - see
   * ThemeOverridePanel.tsx's setToken - so the patch stays sparse rather
   * than accumulating no-op entries, and the changed-token dot never lights
   * up on a token that no longer actually differs from the preset. Drops
   * the preset's own entry out of overrides entirely once its patch is
   * empty, the same shape resetThemeOverrides below leaves behind.
   */
  unsetThemeOverride(presetId: string, token: string): void {
    const current = data.settings.theme.overrides[presetId]
    if (!current || !(token in current)) return
    const rest = Object.fromEntries(Object.entries(current).filter(([key]) => key !== token))
    const overrides = { ...data.settings.theme.overrides }
    if (Object.keys(rest).length > 0) {
      overrides[presetId] = rest
    } else {
      delete overrides[presetId]
    }
    commit({ ...data, settings: { ...data.settings, theme: { ...data.settings.theme, overrides } } })
  },

  /** Clears the override patch for one preset - the "Reset to preset" control. */
  resetThemeOverrides(presetId: string): void {
    const rest = Object.fromEntries(
      Object.entries(data.settings.theme.overrides).filter(([id]) => id !== presetId),
    )
    commit({ ...data, settings: { ...data.settings, theme: { ...data.settings.theme, overrides: rest } } })
  },

  addIfThen(input: {
    trigger: string
    action: string
    color?: string
    dayTypes?: DayType[]
    when?: IfThenWhen
  }): IfThenEntry {
    const entry: IfThenEntry = {
      id: crypto.randomUUID(),
      trigger: input.trigger,
      action: input.action,
      color: input.color,
      dayTypes: input.dayTypes,
      when: input.when,
    }
    commit({ ...data, ifThens: [...data.ifThens, entry] })
    return entry
  },

  updateIfThen(entry: IfThenEntry): void {
    commit({ ...data, ifThens: data.ifThens.map(e => (e.id === entry.id ? entry : e)) })
  },

  deleteIfThen(id: string): void {
    commit({ ...data, ifThens: data.ifThens.filter(e => e.id !== id) })
  },

  /**
   * Records that `id` was the rule `pickIfThenRule` chose to surface for
   * `date` - the rotation's own scheduling metadata, not a measurement of
   * the rule. Called once per day from `IfThenDayRule`'s own effect, and
   * only ever moves `lastSurfaced` forward to the date it was actually
   * shown on; nothing about the rule's trigger, action or tags changes.
   */
  markIfThenSurfaced(id: string, date: string): void {
    commit({
      ...data,
      ifThens: data.ifThens.map(e => (e.id === id ? { ...e, lastSurfaced: date } : e)),
    })
  },

  importData(text: string): void {
    commit(importJson(text))
  },

  resetForTests(next: AppData): void {
    data = next
    saveOk = true
    listeners.forEach(fn => fn())
  },
}
