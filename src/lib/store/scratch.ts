import { commit, dayOf, getData } from './core'
import type { NotePhoto, Task, ScratchNote } from '../types'
import { todayKey } from '../dates'
import { deletePhotos, photoIds, readPhoto, restorePhoto } from '../photos'

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

  /**
   * A picture on a note: the id and the shape, never the blob - the blob is
   * already in IndexedDB by the time this is called, put there by
   * `keepPhoto`. See lib/photos.ts for why the two are separate.
   */
  addScratchPhoto(id: string, photo: NotePhoto): void {
    const data = getData()
    if (!data.scratch.some(n => n.id === id)) return
    commit({
      ...data,
      scratch: data.scratch.map(n => (n.id === id ? { ...n, photos: [...(n.photos ?? []), photo] } : n)),
    })
  },

  /**
   * One picture off a note, and out of the store with it. A note with none
   * left carries no empty list: absent and empty would be two ways to say
   * the same thing, and every optional list in this state means absent.
   */
  async removeScratchPhoto(id: string, photoId: string): Promise<void> {
    const data = getData()
    const note = data.scratch.find(n => n.id === id)
    if (!note?.photos?.some(p => p.id === photoId)) return
    const left = note.photos.filter(p => p.id !== photoId)
    const { photos: _gone, ...bare } = note
    commit({
      ...data,
      scratch: data.scratch.map(n => (n.id === id ? (left.length > 0 ? { ...bare, photos: left } : bare) : n)),
    })
    await deletePhotos([photoId])
  },

  /**
   * Delete a note and the pictures on it, and hand back the undo.
   *
   * The undo puts both back. Keeping the blobs until the offer expires was
   * the other way, and it is worse: the offer can outlive the tab, and a
   * blob nobody can reach is exactly the orphan `sweepPhotos` exists to
   * clean up. So the delete is real and the undo re-adds - which it can,
   * because it is holding the blobs it just took out.
   */
  async deleteScratchWithPhotos(id: string): Promise<() => Promise<void>> {
    const data = getData()
    const note = data.scratch.find(n => n.id === id)
    if (!note) return async () => {}
    const kept = new Map<string, Blob>()
    for (const photo of note.photos ?? []) {
      const blob = await readPhoto(photo.id)
      if (blob) kept.set(photo.id, blob)
    }
    commit({ ...data, scratch: data.scratch.filter(n => n.id !== id) })
    await deletePhotos([...kept.keys()])
    return async () => {
      for (const [photoId, blob] of kept) await restorePhoto(photoId, blob)
      const now = getData()
      if (now.scratch.some(n => n.id === note.id)) return
      commit({ ...now, scratch: [note, ...now.scratch] })
    }
  },

  /**
   * Every blob no note points at, gone.
   *
   * A delete can be interrupted - a closed tab between the commit and the
   * IndexedDB write, a device that synced the note's deletion without ever
   * having had the picture - and an orphan is invisible, so nothing would
   * ever prompt anybody to clean it up. Cheap enough to run on open: it is
   * one key listing and a delete per orphan, usually none.
   */
  async sweepPhotos(): Promise<void> {
    const used = new Set(getData().scratch.flatMap(n => (n.photos ?? []).map(p => p.id)))
    const stored = await photoIds()
    const orphans = stored.filter(id => !used.has(id))
    if (orphans.length > 0) await deletePhotos(orphans)
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
  /**
   * A note made into a task, with the note kept.
   *
   * It used to consume the note, and that was wrong twice over. The words
   * somebody wrote down are not the title of the task they turned into -
   * "charger. the usb c one. from the drawer" becomes "Order a USB-C
   * charger" and both are worth having. And a note can carry photographs
   * since v2.5, which have to stay somewhere; the task points back at the
   * note rather than the pictures being moved or copied.
   *
   * Both ends are written in the one commit: the note learns where it went,
   * the task learns where it came from. A note that already has a task is
   * left alone, so the same intention arriving twice makes one task.
   */
  scratchToTaskKeepingNote(
    id: string,
    date: string,
    task: { title: string; time?: string; minutes?: number; category?: string; highlight?: boolean },
  ): string | null {
    const data = getData()
    const note = data.scratch.find(n => n.id === id)
    if (!note || note.taskId || !task.title.trim()) return null
    const day = dayOf(date)
    const added: Task = { id: crypto.randomUUID(), title: task.title.trim(), time: task.time, done: false, fromNote: id }
    if (task.minutes !== undefined) added.minutes = task.minutes
    if (task.category !== undefined) added.category = task.category
    if (task.highlight) added.highlight = true
    commit({
      ...data,
      days: { ...data.days, [date]: { ...day, tasks: [...day.tasks, added] } },
      scratch: data.scratch.map(n => (n.id === id ? { ...n, taskId: added.id, taskDate: date } : n)),
    })
    return added.id
  },
}
