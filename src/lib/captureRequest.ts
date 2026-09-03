import { useSyncExternalStore } from 'react'

/**
 * A request to open quick-add on a particular shelf, from outside the day
 * view.
 *
 * The same one line `replanState.ts` is, for the same reason and in the same
 * shape: quick-add lives inside the day view because it is about the day, the
 * command palette lives at the root because it is about the app, and neither
 * has any business knowing the other's internals. The palette asks; the field
 * answers.
 *
 * A counter rather than a flag, so asking twice works twice - somebody who
 * types "backlog" into the palette, thinks better of it, and comes back a
 * minute later gets the same behaviour both times.
 */

export type CaptureShelf = 'task' | 'inbox' | 'backlog'

export interface CaptureRequest {
  shelf: CaptureShelf
  seq: number
}

let request: CaptureRequest = { shelf: 'task', seq: 0 }
const listeners = new Set<() => void>()

export function requestCapture(shelf: CaptureShelf): void {
  request = { shelf, seq: request.seq + 1 }
  listeners.forEach(fn => fn())
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function get(): CaptureRequest {
  return request
}

export function useCaptureRequest(): CaptureRequest {
  return useSyncExternalStore(subscribe, get, get)
}

/** Test seam. */
export function resetCaptureForTests(): void {
  request = { shelf: 'task', seq: 0 }
}
