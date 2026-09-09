import { useSyncExternalStore } from 'react'
import type { ChimeHandle } from './chime'

/**
 * The one sound that is going on right now, and the five ways to end it.
 *
 * Three of the four profiles are over in a second and need nothing: they
 * start, they finish, nobody has to do anything about them. The alarm is
 * the one that repeats - for a minute, out loud, so it can be heard from
 * another room - and a sound like that must have an obvious way out or it
 * is a thing that happens *to* somebody rather than for them.
 *
 * So it is held here rather than inside whichever component started it, and
 * everything that should end it can:
 *
 * 1. **Stop, on the floating widget**, in words rather than as an icon, and
 *    drawn only while something is actually ringing.
 * 2. **Escape**, first in the app's own ladder - a sound filling the room is
 *    by definition the loudest thing open.
 * 3. **Acknowledging the timer**, which is the press that already means "yes,
 *    I have seen this".
 * 4. **Starting another timer**, because the old one is over by then either
 *    way.
 * 5. **Closing the tab**, which needs no code at all: the audio graph goes
 *    with the page.
 *
 * Only repeating sounds are tracked. A half-second chime that has already
 * finished is not something to offer a Stop button for, and a button that
 * appears for four hundred milliseconds is worse than no button.
 */

let current: ChimeHandle | null = null
const listeners = new Set<() => void>()

function announce(): void {
  listeners.forEach(fn => fn())
}

/**
 * Takes over from whatever was ringing before.
 *
 * The old one is stopped rather than left to overlap: there is one timer in
 * this app, so there is one sound, and two alarms at once is the shape of
 * bug that only ever appears at the worst moment.
 */
export function startRinging(handle: ChimeHandle): void {
  if (current) current.stop()
  current = handle.repeats ? handle : null
  announce()
}

export function stopRinging(): void {
  if (!current) return
  current.stop()
  current = null
  announce()
}

export function isRinging(): boolean {
  return current !== null
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** For the widget that draws the way out. */
export function useIsRinging(): boolean {
  return useSyncExternalStore(subscribe, isRinging, isRinging)
}

/**
 * Forgets what is ringing without stopping it, for a test that has faked the
 * audio away and only cares about the flag.
 */
export function resetRingingForTests(): void {
  current = null
  announce()
}
