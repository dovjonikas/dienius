import { useSyncExternalStore } from 'react'

/**
 * One undo, app-wide, for five seconds.
 *
 * It started inside the day view, where it covered exactly one gesture -
 * dragging a block. Everything else destructive had nothing: deleting a task,
 * removing a library item, stamping a template over a day somebody had
 * already filled in. Those are the three most expensive mistakes this app
 * allows, and two of them are one tap.
 *
 * Deliberately one, not a stack. An undo history in an app with no server and
 * no document model would need every action to be invertible, forever, and
 * would raise the question of what redo means - a lot of machinery for a
 * problem that is really "I just did that by accident". One offer, on screen,
 * for as long as it takes to notice.
 *
 * Replacing an offer that is still showing is also deliberate: the newest
 * mistake is the one somebody is looking at, and stacking two bars would
 * cover the thing they just changed.
 */

export const UNDO_MS = 5000

export interface UndoOffer {
  label: string
  restore: () => void
}

let offer: UndoOffer | null = null
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach(fn => fn())
}

export function offerUndo(label: string, restore: () => void): void {
  if (timer) clearTimeout(timer)
  offer = { label, restore }
  timer = setTimeout(() => {
    offer = null
    timer = null
    notify()
  }, UNDO_MS)
  notify()
}

export function dismissUndo(): void {
  if (timer) clearTimeout(timer)
  timer = null
  offer = null
  notify()
}

/** Runs the offer and clears it. A no-op when nothing is armed. */
export function runUndo(): void {
  const current = offer
  dismissUndo()
  current?.restore()
}

export function getUndo(): UndoOffer | null {
  return offer
}

export function subscribeUndo(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useUndo(): UndoOffer | null {
  return useSyncExternalStore(subscribeUndo, getUndo, getUndo)
}

/** Test seam: forgets the offer and its timer without running either. */
export function resetUndoForTests(): void {
  if (timer) clearTimeout(timer)
  timer = null
  offer = null
  listeners.clear()
}
