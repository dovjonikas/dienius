import { commit, dayOf, getData } from './core'
import type { Task, ScratchNote } from '../types'
import { todayKey } from '../dates'

/** Scratch: one stream, and the two ways out of it. See lib/scratch.ts. */
export const scratchActions = {
  /**
   * Scratch - see lib/scratch.ts. A note exists from its first keystroke:
   * the overlay creates it on the first character and rewrites it on every
   * one after, so closing the overlay mid-sentence loses nothing. Newest
   * first, the same reading the inbox has.
   */
  addScratch(text: string): ScratchNote {
    const data = getData()
    const note: ScratchNote = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString(), date: todayKey() }
    commit({ ...data, scratch: [note, ...data.scratch] })
    return note
  },

  updateScratch(id: string, text: string): void {
    const data = getData()
    if (!data.scratch.some(n => n.id === id)) return
    commit({ ...data, scratch: data.scratch.map(n => (n.id === id ? { ...n, text } : n)) })
  },

  toggleScratchPin(id: string): void {
    const data = getData()
    commit({
      ...data,
      scratch: data.scratch.map(n => {
        if (n.id !== id) return n
        const { pinned: _was, ...rest } = n
        return n.pinned ? rest : { ...rest, pinned: true }
      }),
    })
  },

  deleteScratch(id: string): void {
    const data = getData()
    commit({ ...data, scratch: data.scratch.filter(n => n.id !== id) })
  },

  /** The undo of a delete: the note back exactly as it was, if it is not already there. */
  restoreScratch(note: ScratchNote): void {
    const data = getData()
    if (data.scratch.some(n => n.id === note.id)) return
    commit({ ...data, scratch: [note, ...data.scratch] })
  },

  /**
   * A note becomes an inbox line and leaves the stream in the same commit -
   * the same one-action shape as scheduleInboxItem, for the same reason.
   */
  scratchToInbox(id: string, text: string): boolean {
    const data = getData()
    const note = data.scratch.find(n => n.id === id)
    if (!note || !text.trim()) return false
    const item = { id: crypto.randomUUID(), text: text.trim(), captured: new Date().toISOString() }
    commit({ ...data, inbox: [item, ...data.inbox], scratch: data.scratch.filter(n => n.id !== id) })
    return true
  },

  /**
   * A note becomes a task on a day and leaves the stream. The caller has
   * already run the text through quick-add's parser, which is where a time
   * and a size come from; this only places what it is handed.
   */
  scratchToTask(id: string, date: string, task: { title: string; time?: string; minutes?: number }): boolean {
    const data = getData()
    const note = data.scratch.find(n => n.id === id)
    if (!note || !task.title.trim()) return false
    const day = dayOf(date)
    const added: Task = { id: crypto.randomUUID(), title: task.title.trim(), time: task.time, done: false }
    if (task.minutes !== undefined) added.minutes = task.minutes
    commit({
      ...data,
      days: { ...data.days, [date]: { ...day, tasks: [...day.tasks, added] } },
      scratch: data.scratch.filter(n => n.id !== id),
    })
    return true
  },
}
