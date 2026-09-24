import { useSyncExternalStore } from 'react'
import type { AppData, DayPlan } from '../types'
import { loadData, planFromOtherTab, saveData } from '../storage'
import { stampChanges } from '../syncEntities'
import { mergeStates } from '../syncMerge'
import { resetClockForTests, sawPlan, stampNow } from '../clock'
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
// Every stamp from here on is after every stamp in the plan as it loaded -
// see clock.ts.
sawPlan(data)
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
  // From the clock that is never behind anything this device has seen, and
  // is on GitHub's where GitHub has said - see clock.ts. The device's own
  // clock let an edit made after seeing the other device's lose to it.
  data = stampChanges(previous, marked, stampNow())
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
 * carries the right timestamps from both sides, and by a backup merged in.
 *
 * `owed` says the result holds something the shared copy does not, so the
 * commit watchers hear of it - sync pushes it, the backup marks itself
 * changed - without anything in it being stamped as new.
 */
export function replaceState(next: AppData, options: { owed?: boolean } = {}): void {
  data = next
  sawPlan(next)
  saveOk = saveData(data)
  listeners.forEach(fn => fn())
  if (options.owed) onCommit.forEach(fn => fn())
}

/**
 * Another tab of the app on this device saved the plan - the owner's shift
 * brief of 2026-09-25, stage 7. Every tab keeps the plan in memory and saves
 * it whole, so a tab left open behind another saved its older copy over the
 * other's next change: a tick made in one tab was gone the moment anything
 * was written in the other. Now a tab takes in what another saved one entity
 * at a time, the way sync takes in another device (the later stamp wins, a
 * deletion sticks), and writes the result back only where it holds something
 * the other's copy did not - so two tabs settle in one exchange instead of
 * answering each other for ever. Nothing is stamped: both sides' stamps
 * already say which is later.
 */
export function takeFromOtherTab(other: AppData): void {
  const now = new Date().toISOString()
  const merged = mergeStates(data, other, now)
  // What this tab has that the other's copy lacks, which only this tab can write back.
  const theirs = mergeStates(other, data, now)
  const lacking = theirs.applied > 0 || theirs.deleted > 0
  if (merged.applied === 0 && merged.deleted === 0 && !lacking) return
  data = merged.data
  sawPlan(data)
  if (lacking) saveOk = saveData(data)
  listeners.forEach(fn => fn())
}

// The browser tells a tab when another one saved, and never the tab that wrote.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    const other = planFromOtherTab(event.key, event.newValue)
    if (other) takeFromOtherTab(other)
  })
}

/**
 * A wait on the writes the store makes on its own - a day stamping its
 * template as it is opened - while something says they must wait. Sync
 * holds them until the page's first pull has come back, so that a day is
 * stamped on what the other device already did to it rather than beside
 * it (docs/SYNC-AUDIT.md, path 8). Registered rather than imported: the
 * store knows nothing about sync.
 */
export interface AutomaticHold {
  held: () => boolean
  then: (fn: () => void) => void
}

let automaticHold: AutomaticHold | null = null

export function holdAutomaticWrites(hold: AutomaticHold | null): void {
  automaticHold = hold
}

/** Runs `fn` once the hold is off and says true, or says false when nothing holds it. */
export function laterIfHeld(fn: () => void): boolean {
  if (!automaticHold?.held()) return false
  automaticHold.then(fn)
  return true
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
  resetClockForTests()
  sawPlan(next)
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
