import { useSyncExternalStore } from 'react'

/**
 * Where a time being chosen right now would land, for the timeline to draw.
 *
 * The hour column used to answer this itself, by washing an hour in the
 * colour of whatever held it. It could not: an hour is a box of sixty
 * minutes and a block from 09:05 to 10:05 painted nine and ten exactly
 * alike, so a column that looked precise was rounding to the hour in both
 * directions, and the same fact - what this day already holds - was being
 * drawn twice, once truthfully in the timeline and once approximately in the
 * picker. CONVENTIONS section 23 has one answer for a fact said twice: say
 * it in the place that can say it properly. The timeline is drawn to the
 * minute, on the day's own scale, with the day's own overlaps, so the
 * timeline is where a candidate time is shown.
 *
 * One line between whoever is choosing and whichever timeline is that
 * choice's own, on the shape `replanState` already uses for the same reason:
 * the picker is three components away from the grid in every direction, and
 * the alternative is a preview prop threaded through the day view, the task
 * sheet, quick-add and both template editors.
 *
 * `key` is what stops one picker drawing on another day: the day view
 * subscribes with its date, the day template editor with 'template', and each
 * column of the week editor with its own weekday. A ghost with nobody
 * listening is drawn nowhere, which is what happens for Settings' sleep
 * fields and the library's own time - neither has a timeline behind it.
 */

export interface TimeGhost {
  /** Whose timeline this belongs to - a date key, 'template', or 'template:<weekday>'. */
  key: string
  /** Minutes from midnight, where the block would start. */
  start: number
  /**
   * How long it would be, or absent when nothing has said.
   *
   * Absent draws a line rather than a block. A length is never invented here:
   * an unsized task is drawn as unsized everywhere else in this app - see
   * `takenBlocks`, which contributes nothing for one, and `computeCapacity`,
   * which refuses to guess free time around one.
   */
  minutes?: number
  /** The category colour it would carry. Absent draws in the neutral one. */
  color?: string
}

let ghost: TimeGhost | null = null
const listeners = new Set<() => void>()

/** Publishes the candidate, or clears it with null when the picker closes. */
export function showTimeGhost(next: TimeGhost | null): void {
  ghost = next
  listeners.forEach(fn => fn())
}

/**
 * Clears the candidate, but only if it is still the one this caller put up.
 *
 * A picker closing after another has already opened must not wipe the new
 * one: React unmounts the old subtree after the new one mounts, so the
 * cleanup runs second and an unconditional clear would leave the open picker
 * drawing nothing.
 */
export function clearTimeGhost(key: string): void {
  if (ghost?.key === key) showTimeGhost(null)
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function get(): TimeGhost | null {
  return ghost
}

/** The candidate for this timeline, or null when the one up belongs to another. */
export function useTimeGhost(key: string | undefined): TimeGhost | null {
  const current = useSyncExternalStore(subscribe, get, get)
  return key !== undefined && current?.key === key ? current : null
}

/** Test seam. */
export function resetTimeGhostForTests(): void {
  ghost = null
}
