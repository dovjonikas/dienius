import { commit, dayOf, getData } from './core'
import type { BacklogItem, Task } from '../types'
import type { CategoryId } from '../categories'

/**
 * The two undated shelves - the inbox and the backlog - and the doors
 * between them and the day. See CONVENTIONS.md section 14 for what each
 * asks and why there are exactly four shelves.
 *
 * The backlog holds a decision without a date. Nothing here records or
 * shows how long something has been sitting, order is priority, and the
 * day view never mentions it - see the doc comment on `BacklogItem`.
 */
export const backlogActions = {
  /**
   * Catches one line of text with nothing else attached - see `InboxItem`.
   * Newest first, because an inbox is read from the top and the thing just
   * written is the thing most likely to still matter.
   */
  addInboxItem(text: string): void {
    const data = getData()
    const trimmed = text.trim()
    if (!trimmed) return
    const item = { id: crypto.randomUUID(), text: trimmed, captured: new Date().toISOString() }
    commit({ ...data, inbox: [item, ...data.inbox] })
  },

  deleteInboxItem(id: string): void {
    const data = getData()
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
    const data = getData()
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

  /**
   * The third door out of the inbox, beside "put it on this day" and "delete
   * it": decided, but not for now. It is the one triage answer the inbox was
   * missing, and its absence is why inboxes fill up - "not this week" had no
   * home, so the line sat there being re-read every morning.
   */
  inboxToBacklog(id: string): boolean {
    const data = getData()
    const line = data.inbox.find(i => i.id === id)
    if (!line) return false
    const item: BacklogItem = { id: crypto.randomUUID(), title: line.text }
    commit({
      ...data,
      inbox: data.inbox.filter(i => i.id !== id),
      backlog: [...data.backlog, item],
    })
    return true
  },

  //
  addBacklogItem(input: { title: string; category?: CategoryId; minutes?: number }): BacklogItem | undefined {
    const data = getData()
    const title = input.title.trim()
    if (!title) return undefined
    const item: BacklogItem = { id: crypto.randomUUID(), title }
    if (input.category) item.category = input.category
    if (input.minutes !== undefined && input.minutes > 0) item.minutes = input.minutes
    // Appended, not prepended. The inbox is newest-first because it is read
    // from the top and the newest catch is the one most likely to still
    // matter; a backlog is a ranking, and a thing added today does not
    // outrank a thing decided last week just by being newer.
    commit({ ...data, backlog: [...data.backlog, item] })
    return item
  },

  updateBacklogItem(id: string, patch: { title?: string; category?: CategoryId; minutes?: number | null }): void {
    const data = getData()
    const index = data.backlog.findIndex(i => i.id === id)
    if (index === -1) return
    const item = { ...data.backlog[index] }
    if (patch.title !== undefined) {
      const title = patch.title.trim()
      if (!title) return
      item.title = title
    }
    if (patch.category !== undefined) item.category = patch.category
    // null clears the size, undefined leaves it alone - the same distinction
    // `setTaskMinutes` draws between an empty field and an untouched one.
    if (patch.minutes === null) delete item.minutes
    else if (patch.minutes !== undefined && patch.minutes > 0) item.minutes = patch.minutes
    const backlog = [...data.backlog]
    backlog[index] = item
    commit({ ...data, backlog })
  },

  deleteBacklogItem(id: string): void {
    const data = getData()
    if (!data.backlog.some(i => i.id === id)) return
    commit({ ...data, backlog: data.backlog.filter(i => i.id !== id) })
  },

  /** Order is the only ranking this list has - see `BacklogItem`. */
  moveBacklogItem(id: string, toIndex: number): void {
    const data = getData()
    const from = data.backlog.findIndex(i => i.id === id)
    if (from === -1) return
    const to = Math.max(0, Math.min(toIndex, data.backlog.length - 1))
    if (from === to) return
    const backlog = [...data.backlog]
    const [item] = backlog.splice(from, 1)
    backlog.splice(to, 0, item)
    commit({ ...data, backlog })
  },

  /**
   * Pulling one onto a day. The item leaves the backlog in the same commit
   * that puts the task on the day, because a thing that is on today and still
   * in the backlog is the same thing written down twice, and the second copy
   * is the one nobody notices until it is stale.
   *
   * `time` is optional and absent means a float, exactly as everywhere else.
   */
  scheduleBacklogItem(id: string, date: string, time?: string): boolean {
    const data = getData()
    const item = data.backlog.find(i => i.id === id)
    if (!item) return false
    const day = dayOf(date)
    const task: Task = { id: crypto.randomUUID(), title: item.title, done: false }
    if (time) task.time = time
    if (item.minutes !== undefined) task.minutes = item.minutes
    if (item.category) task.category = item.category
    commit({
      ...data,
      days: { ...data.days, [date]: { ...day, tasks: [...day.tasks, task] } },
      backlog: data.backlog.filter(i => i.id !== id),
    })
    return true
  },
}
