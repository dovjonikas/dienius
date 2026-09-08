import { useEffect, useRef } from 'react'

/**
 * Hands focus back to whatever had it when a sheet, panel or popover opened.
 *
 * Every modal surface in this app takes focus on mount - the sheet itself,
 * or its first field - and until v2.1 none of them gave it back. Escape on
 * the task menu left focus on the document body, and the next Tab started
 * again from the navigation rail: for somebody on a keyboard, every closed
 * sheet was a walk back through thirty controls to where they had been.
 *
 * **The opener is read while the surface renders, not in an effect.** Being
 * first in the component was enough while every surface took focus in an
 * effect of its own, because effects run in the order they are declared. It
 * stopped being enough the moment a surface had a child that takes focus:
 * React runs a child's effects before its parent's, so the two header
 * popovers captured the note field inside themselves as the opener, and the
 * restore then had nothing to give focus back to - the field went with the
 * panel. Render runs before any of that, and reading which element has focus
 * is a question rather than a change.
 *
 * **And a surface opened from inside another falls back to the one under
 * it.** Pressing Details on the task's actions sheet closes that sheet and
 * opens the detail sheet in the same commit, so the opener the detail sheet
 * captures is a button that is about to leave the page with the sheet it sat
 * in. There is nothing to restore to, and Escape landed on the body - which
 * is the walk this hook exists to prevent, one step along. So the openers
 * are kept in a short list, and a restore that finds its own gone takes the
 * newest one still on the page: the menu button the whole chain started
 * from.
 *
 * It restores only when focus is nowhere useful - on the body, or on nothing
 * - because a sheet closed by a press elsewhere has already put focus where
 * the person put it, and a sheet that opened another sheet must not pull
 * focus out from under it.
 *
 * `active` is for a surface that stays mounted and toggles: the capture
 * happens when it becomes active and the restore when it stops.
 */

/**
 * Every opener captured by a surface that is still open, oldest first.
 *
 * Short on purpose: three surfaces deep is the most this app stacks (a menu,
 * a sheet, a picker inside it), and an entry that has left the page is
 * dropped the next time anything is captured, so nothing here keeps a
 * detached node alive for longer than the next press.
 */
const openers: HTMLElement[] = []
const MAX_OPENERS = 6

function remember(el: HTMLElement | null): void {
  for (let i = openers.length - 1; i >= 0; i--) {
    if (!document.contains(openers[i])) openers.splice(i, 1)
  }
  if (el && el !== document.body && !openers.includes(el)) openers.push(el)
  while (openers.length > MAX_OPENERS) openers.shift()
}

/**
 * The opener itself where it is still on the page, else the newest one that
 * is.
 *
 * Nothing is taken out of the list when a surface closes, only when it has
 * left the page: the first version of this dropped its own entry on the way
 * out, so the menu's cleanup removed the very button the detail sheet was
 * about to need. What the list holds is recent openers still on the page,
 * and the newest of those is where focus came from.
 */
function survivor(from: HTMLElement | null): HTMLElement | null {
  if (from && from !== document.body && document.contains(from)) return from
  for (let i = openers.length - 1; i >= 0; i--) {
    if (document.contains(openers[i])) return openers[i]
  }
  return null
}

export function useRestoreFocus(active = true): void {
  const opener = useRef<HTMLElement | null>(null)
  if (active && opener.current === null) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    remember(opener.current)
  }
  if (!active && opener.current !== null) opener.current = null

  useEffect(() => {
    if (!active) return
    const from = opener.current
    return () => {
      const now = document.activeElement
      if (now && now !== document.body && document.contains(now)) return
      survivor(from)?.focus()
    }
  }, [active])
}
