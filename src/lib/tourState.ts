import { useSyncExternalStore } from 'react'
import type { TourPlatform } from './tour'

/**
 * Whether the tour is running, and where it is.
 *
 * Its own small store rather than a field in settings, because a tour is a
 * fact about this device right now: it does not sync, it is not in a backup,
 * and it must be readable by store.ts (which flags what the tour creates)
 * without store.ts importing anything that imports store.ts back.
 *
 * The step survives a reload under its own key - a tour that vanishes when
 * the phone locks is a tour nobody finishes - and an unfinished one is
 * offered again on the next open rather than resumed on top of whatever
 * the person was about to do.
 */

const PROGRESS_KEY = 'dienius:tour-progress'

export interface TourState {
  active: boolean
  step: number
  platform: TourPlatform
}

/** What the last run left behind: a step to come back to, or the fact that it ended. */
export type TourProgress = { step: number } | { done: true }

let state: TourState = { active: false, step: 0, platform: 'desktop' }
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(fn => fn())
}

export function getTourState(): TourState {
  return state
}

export function isTourRunning(): boolean {
  return state.active
}

export function subscribeTour(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useTourState(): TourState {
  return useSyncExternalStore(subscribeTour, getTourState, getTourState)
}

export function startTour(platform: TourPlatform, step = 0): void {
  state = { active: true, step, platform }
  writeProgress({ step })
  emit()
}

export function setTourStep(step: number): void {
  if (!state.active) return
  state = { ...state, step }
  writeProgress({ step })
  emit()
}

/** Finished or skipped, the tour is over and is not offered again on its own. */
export function endTour(): void {
  state = { ...state, active: false }
  writeProgress({ done: true })
  emit()
}

export function readProgress(): TourProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    if ((parsed as { done?: unknown }).done === true) return { done: true }
    const step = (parsed as { step?: unknown }).step
    return typeof step === 'number' && step >= 0 ? { step } : null
  } catch {
    return null
  }
}

function writeProgress(progress: TourProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // A device that cannot remember the step simply starts over next time.
  }
}

/** Test seam. */
export function resetTourForTests(): void {
  state = { active: false, step: 0, platform: 'desktop' }
  try {
    localStorage.removeItem(PROGRESS_KEY)
  } catch {
    // Nothing to do.
  }
  emit()
}
