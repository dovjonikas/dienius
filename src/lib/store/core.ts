import { useSyncExternalStore } from 'react'
import type { AppData, DayPlan } from '../types'
import { loadData, saveData } from '../storage'
import { stampChanges } from '../syncEntities'
import { isTourRunning } from '../tourState'
import { markTourCreated } from '../tour'

/**
 * The store's core: the one object, the one place it changes, and the two
 * ways to watch it. Every area module under `store/` reads through
 * `getData()` and writes through `commit()`, and nothing else touches the
 * variable below.
 *
 * `loadData()` runs at import time, which is the thing about this module
 * that bites: anything that needs to influence what the store reads has to
 * happen inside `loadData`, not in `main.tsx` - imports are evaluated before
 * the importing module's body. This ate the first version of demo seeding.
 */

let data: AppData = loadData()
let saveOk = true
const listeners = new Set<() => void>()

/**
 * The one place state changes, and therefore the one place sync timestamps
 * are written.
 *
 * Every action ends here, so stamping here means no action can forget - see
 * `stampChanges`, which diffs what is going out against what was there and
 * marks whatever actually moved. The alternative was sixty actions each
 * remembering to stamp the right entity, which is sixty chances to get it
 * wrong and a sixty-first action next year that gets it wrong by default.
 */
export function commit(next: AppData): void {
  const previous = data
  // While the tour runs, whatever appears is flagged as its doing - by the
  // same diff, for the same reason: no action has to know the tour exists.
  const marked = isTourRunning() ? markTourCreated(previous, next) : next
  data = stampChanges(previous, marked, new Date().toISOString())
  saveOk = saveData(data)
  listeners.forEach(fn => fn())
  onCommit.forEach(fn => fn())
}

/**
 * Called after every commit. The sync client's debounced push hangs off this
 * rather than off a subscription, because it wants to know that something was
 * *written*, not that something re-rendered.
 */
const onCommit = new Set<() => void>()

export function onStateCommitted(fn: () => void): () => void {
  onCommit.add(fn)
  return () => onCommit.delete(fn)
}

/**
 * Replaces the whole state without stamping - the one write that must not
 * look like a local edit. Used by the sync merge, whose result already
 * carries the right timestamps from both sides, and by a snapshot restore.
 */
export function replaceState(next: AppData): void {
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

/** Test seam: the in-memory value only, never storage. */
export function resetForTests(next: AppData): void {
  data = next
  saveOk = true
  listeners.forEach(fn => fn())
}

// --- the two helpers every area that touches a day shares -------------------

/** The day as it is, or an empty one for a date nothing has been written to yet. */
export function dayOf(date: string): DayPlan {
  return data.days[date] ?? { date, tasks: [] }
}

/** The state with one day replaced. */
export function withDay(date: string, day: DayPlan): AppData {
  return { ...data, days: { ...data.days, [date]: day } }
}
