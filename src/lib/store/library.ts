import { commit, dayOf, getData, withDay } from './core'
import { seedLibrary as librarySeed } from '../librarySeed'
import type { AppData, LibraryItem, LibraryList, LibraryTrack, Task, TemplateBlock } from '../types'
import { hasAnotherSeason, isItemFinished, itemProgress, nextSeason, parseLibraryItemInput } from '../library'

function withLibrary(library: LibraryList[]): AppData {
  return { ...getData(), library }
}

function mapList(listId: string, fn: (list: LibraryList) => LibraryList): AppData {
  return withLibrary(getData().library.map(l => (l.id === listId ? fn(l) : l)))
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
  // Reaching the end of a season is not reaching the end of a series. Without
  // this, watching the last episode of season one of three filed the whole
  // thing under Finished and the offer to start season two went with it.
  const done = full && !hasAnotherSeason({ ...item, progress: capped })
  return { ...item, progress: capped, finished: done ? (item.finished ?? today) : undefined }
}

/**
 * The one place a task's done state and its library item stay in step.
 *
 * Ticking a bound task off is what advances the book; un-ticking it steps
 * back. Doing it here rather than in the view means every way of finishing a
 * task - the card, the detail sheet, Focus, the keyboard - advances it, and
 * none of them has to know the library exists.
 */
export function advanceForTask(library: LibraryList[], task: Task, nowDone: boolean, today: string): LibraryList[] {
  const ref = task.libraryRef
  if (!ref) return library
  return library.map(list => {
    if (list.id !== ref.listId) return list
    if (!list.items.some(i => i.id === ref.itemId)) return list
    return { ...list, items: list.items.map(i => (i.id === ref.itemId ? advanced(i, nowDone ? 1 : -1, today) : i)) }
  })
}

/**
 * The Library: lists, items, progress, the tracks, and the two ways a session
 * reaches a day or a template. `advanceForTask` is exported for the day's
 * own toggle, which is the one place a task's done state and its book stay
 * in step.
 */
export const libraryActions = {
  /**
   * Puts a whole library list back as it was, for the same reason
   * `replaceDay` exists: an item's place in the order is part of what it is,
   * and deleting one also clears the bindings on every task that pointed at
   * it. Only the list is restored here - a task's binding is not, because a
   * day already lived is not something an undo on another tab should reach
   * back into.
   */
  replaceLibraryList(list: LibraryList): void {
    const data = getData()
    commit(withLibrary(data.library.map(l => (l.id === list.id ? list : l))))
  },

  addLibraryList(input: { name: string; unit: string; unitShort?: string; unitPlural?: string }): LibraryList {
    const data = getData()
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
      // Carried through by name like every other field here. It was missing,
      // which made the whole dot row in the list editor a control that did
      // nothing at all - see LibraryView's own note. Keyed on the key being
      // present rather than on the value, because `undefined` is a real
      // choice here: it is what the "No colour" button sends.
      color: 'color' in patch ? patch.color : list.color,
    })))
  },

  /**
   * Deleting a list takes every task binding to it with it, the same way
   * deleting a sleep schedule does - a task pointing at a list that is gone
   * would keep drawing a progress chip for something nobody can open.
   */
  deleteLibraryList(listId: string): void {
    const data = getData()
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

  /**
   * Puts the reading plan in, on request, on an install that has no Books
   * list or an empty one - see lib/librarySeed.ts, which owns the rule and
   * the history of why nothing calls this by itself any more.
   *
   * Skips the commit entirely when there is nothing to do, so running the
   * command a second time, or on a device that already got the list by
   * sync, writes, stamps and syncs nothing: seedLibrary returns the same
   * object, and an unchanged state is not worth a save.
   */
  seedLibrary(): void {
    const data = getData()
    const next = librarySeed(data)
    if (next !== data) commit(next)
  },

  /** Takes the raw typed line, so "Daring Greatly, 12 chapters" arrives whole. */
  /**
   * The add line's own door: a title and a shape the controls already hold,
   * so nothing has to be spelt back into a line for the parser to read out
   * again. The same item the typed line makes; `addLibraryItem` stays for
   * the palette and the tests that speak in lines.
   */
  addLibraryItemShaped(listId: string, input: { title: string; track?: LibraryTrack; total?: number; seasons?: number }): LibraryItem | undefined {
    const title = input.title.trim()
    if (!title) return undefined
    const item: LibraryItem = { id: crypto.randomUUID(), title }
    if (input.track) item.track = input.track
    if (input.track !== 'movie' && input.total !== undefined && input.total > 0) item.total = input.total
    if (input.track === 'series') {
      if (input.seasons !== undefined && input.seasons > 0) item.seasons = input.seasons
      item.season = 1
    }
    commit(mapList(listId, list => ({ ...list, items: [...list.items, item] })))
    return item
  },

  addLibraryItem(listId: string, input: string): LibraryItem | undefined {
    const parsed = parseLibraryItemInput(input)
    if (!parsed) return undefined
    const item: LibraryItem = { id: crypto.randomUUID(), title: parsed.title, total: parsed.total }
    // Whatever the line said about how this one is counted travels with it:
    // "The War of Art, 139 pages" and "Invincible, 3 seasons" are two
    // different shapes of thing and typing them is the only place anybody
    // should have to say so.
    if (parsed.track) item.track = parsed.track
    if (parsed.seasons !== undefined) item.seasons = parsed.seasons
    if (parsed.season !== undefined) item.season = parsed.season
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

  /**
   * Everything about one item that is not its progress: what it is called,
   * how it is counted, the pace note, which season it is on.
   *
   * One action rather than six, because they are one edit as far as the
   * person making it is concerned - the detail sheet is open, they change
   * what is wrong, it saves. Six actions would be six commits, six undo
   * entries and six sync stamps for one sitting.
   *
   * `null` clears a field, `undefined` leaves it alone - the same distinction
   * `updateBacklogItem` draws, and the only way one call can both set and
   * unset without a second argument saying which.
   */
  updateLibraryItem(
    listId: string,
    itemId: string,
    patch: {
      title?: string
      pace?: string | null
      track?: LibraryTrack | null
      total?: number | null
      season?: number | null
      seasons?: number | null
    },
  ): void {
    commit(mapList(listId, list =>
      mapItem(list, itemId, item => {
        const next: LibraryItem = { ...item }
        if (patch.title !== undefined && patch.title.trim()) next.title = patch.title.trim()
        if (patch.pace === null) delete next.pace
        else if (patch.pace !== undefined && patch.pace.trim()) next.pace = patch.pace.trim()
        // Switching how something is counted never touches how far through it
        // you are. Turning "chapter 4 of 20" into pages leaves the 4 and the
        // 20 exactly where they were, because the app has no way to convert
        // one into the other and inventing a conversion would be worse than
        // showing a number that needs correcting once.
        if (patch.track === null) delete next.track
        else if (patch.track !== undefined) next.track = patch.track
        if (patch.total === null) delete next.total
        else if (patch.total !== undefined && patch.total > 0) next.total = patch.total
        if (patch.season === null) delete next.season
        else if (patch.season !== undefined && patch.season > 0) next.season = patch.season
        if (patch.seasons === null) delete next.seasons
        else if (patch.seasons !== undefined && patch.seasons > 0) next.seasons = patch.seasons
        return next
      }),
    ))
  },

  /**
   * The end of a season, taken on. Offered rather than applied - see
   * `nextSeason` in library.ts: an app that rolled a finished season into the
   * next one by itself would be answering "did you carry on?" for somebody.
   */
  advanceLibrarySeason(listId: string, itemId: string): void {
    commit(mapList(listId, list =>
      mapItem(list, itemId, item => {
        if (item.track !== 'series') return item
        const { total: _dropped, ...rest } = item
        return { ...rest, ...nextSeason(item), finished: undefined } as LibraryItem
      }),
    ))
  },

  /**
   * A block on a template that draws its title from a list - the flow that
   * used to be two screens and a piece of knowledge nobody has: build a block
   * in the Templates tab, then find the binding control on it.
   *
   * **It binds to the list, not to the item it was started from.** That is
   * the whole point of the binding as it already existed: the block says "a
   * reading session", the list says which book, and finishing a book moves
   * the block on to the next one instead of leaving a dead block behind. See
   * `TemplateBlock.libraryListId`.
   *
   * Returns false when the template already has a block bound to this list -
   * the caller offers to change that block instead, because two reading
   * blocks on one template both pointing at the same book is not something
   * anybody meant.
   */
  addLibraryBlockToTemplate(
    templateId: string,
    listId: string,
    block: { time?: string; minutes?: number; title: string },
  ): boolean {
    const data = getData()
    const template = data.templates.find(t => t.id === templateId)
    if (!template || !data.library.some(l => l.id === listId)) return false
    if (template.blocks.some(b => b.libraryListId === listId)) return false
    const next: TemplateBlock = { id: crypto.randomUUID(), title: block.title, libraryListId: listId }
    if (block.time) next.time = block.time
    if (block.minutes !== undefined && block.minutes > 0) next.minutes = block.minutes
    commit({
      ...data,
      templates: data.templates.map(t => (t.id === templateId ? { ...t, blocks: [...t.blocks, next] } : t)),
    })
    return true
  },

  /** Changing the block that is already bound, rather than adding a second. */
  replaceLibraryBlockOnTemplate(
    templateId: string,
    listId: string,
    block: { time?: string; minutes?: number; title: string },
  ): boolean {
    const data = getData()
    const template = data.templates.find(t => t.id === templateId)
    if (!template) return false
    const existing = template.blocks.find(b => b.libraryListId === listId)
    if (!existing) return false
    const next: TemplateBlock = { ...existing, title: block.title }
    if (block.time) next.time = block.time
    else delete next.time
    if (block.minutes !== undefined && block.minutes > 0) next.minutes = block.minutes
    else delete next.minutes
    commit({
      ...data,
      templates: data.templates.map(t =>
        t.id === templateId ? { ...t, blocks: t.blocks.map(b => (b.id === existing.id ? next : b)) } : t,
      ),
    })
    return true
  },

  deleteLibraryItem(listId: string, itemId: string): void {
    const data = getData()
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
    const data = getData()
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
}
