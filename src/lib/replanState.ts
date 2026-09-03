import { useSyncExternalStore } from 'react'

/**
 * A request to open the replan sheet, from outside the day view.
 *
 * The sheet lives inside the day view, because it is about the day; the
 * command palette lives at the root, because it is about the app. This is
 * the one line between them: the palette asks, the day view answers. A
 * counter rather than a flag, so asking twice opens twice.
 */

export type ReplanMode = 'menu' | 'interrupt' | 'shift' | 'away' | 'back'

export interface ReplanRequest {
  mode: ReplanMode
  seq: number
}

let request: ReplanRequest = { mode: 'menu', seq: 0 }
const listeners = new Set<() => void>()

export function requestReplan(mode: ReplanMode): void {
  request = { mode, seq: request.seq + 1 }
  listeners.forEach(fn => fn())
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function get(): ReplanRequest {
  return request
}

export function useReplanRequest(): ReplanRequest {
  return useSyncExternalStore(subscribe, get, get)
}

/** Test seam. */
export function resetReplanForTests(): void {
  request = { mode: 'menu', seq: 0 }
}
