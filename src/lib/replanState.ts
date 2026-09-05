import { useSyncExternalStore } from 'react'
import { todayKey } from './dates'

/**
 * A request to open the replan sheet, from anywhere.
 *
 * The sheet is mounted at the root of the app and reads the store itself,
 * given a day - so the day header, the week view, the calendar's day
 * preview, the palette and the R key all open the same one without leaving
 * the screen they are on. Until v2.2 it lived inside the day view, because
 * it was about today; "Something came up" is about any day now. This is the
 * one line between whoever asks and the sheet. A counter rather than a
 * flag, so asking twice opens twice.
 */

export type ReplanMode = 'menu' | 'interrupt' | 'shift' | 'away' | 'back'

export interface ReplanRequest {
  mode: ReplanMode
  /** The day an interruption lands on to begin with. The other doors are about today whatever this says. */
  date: string
  seq: number
}

let request: ReplanRequest = { mode: 'menu', date: '', seq: 0 }
const listeners = new Set<() => void>()

export function requestReplan(mode: ReplanMode, date: string = todayKey()): void {
  request = { mode, date, seq: request.seq + 1 }
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
  request = { mode: 'menu', date: '', seq: 0 }
}
