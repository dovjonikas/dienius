import { commit, dayOf, getData } from './core'
import type { LaterItem, Task } from '../types'
import type { CategoryId } from '../categories'

/**
 * Later - the one undated shelf - and the doors between it and the day. See
 * CONVENTIONS.md section 14 for what each shelf asks and why there are
 * exactly this many.
 *
 * Later holds something to do that has no day yet. Nothing here records or
 * shows how long it has been sitting, order is priority, and the day view
 * never mentions it - see the doc comment on `LaterItem`, which also says
 * why the field these actions write is still called `backlog`.
 */
export const laterActions = {
  addLaterItem(input: { title: string; category?: CategoryId; minutes?: number }): LaterItem | undefined {
    const data = getData()
    const title = input.title.trim()
    if (!title) return undefined
    const item: LaterItem = { id: crypto.randomUUID(), title }
    if (input.category) item.category = input.category
    if (input.minutes !== undefined && input.minutes > 0) item.minutes = input.minutes
    // Appended, not prepended. The inbox this list absorbed was newest-first
    // because it was read from the top and the newest catch was the one most
    // likely to still matter; Later is a ranking, and a thing added today
    // does not outrank a thing decided last week just by being newer. The
    // order is the owner's to change, with the grip or the arrow keys.
    commit({ ...data, backlog: [...data.backlog, item] })
    return item
  },

  deleteLaterItem(id: string): void {
    const data = getData()
    if (!data.backlog.some(i => i.id === id)) return
    commit({ ...data, backlog: data.backlog.filter(i => i.id !== id) })
  },

  /** Order is the only ranking this list has - see `LaterItem`. */
  moveLaterItem(id: string, toIndex: number): void {
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
   * Pulling one onto a day. The item leaves Later in the same commit that
   * puts the task on the day, because a thing that is on today and still in
   * Later is the same thing written down twice, and the second copy is the
   * one nobody notices until it is stale.
   *
   * `time` is optional and absent means a float, exactly as everywhere else.
   */
  scheduleLaterItem(id: string, date: string, time?: string): boolean {
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
