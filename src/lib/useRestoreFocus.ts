import { useEffect } from 'react'

/**
 * Hands focus back to whatever had it when a sheet, panel or popover opened.
 *
 * Every modal surface in this app takes focus on mount - the sheet itself,
 * or its first field - and until v2.1 none of them gave it back. Escape on
 * the task menu left focus on the document body, and the next Tab started
 * again from the navigation rail: for somebody on a keyboard, every closed
 * sheet was a walk back through thirty controls to where they had been.
 *
 * Called at the top of the surface's component, before the effect that takes
 * focus, so the capture sees the opener rather than the sheet. On unmount it
 * restores only when focus is nowhere useful - on the body, or on nothing -
 * because a sheet closed by a press elsewhere has already put focus where
 * the person put it, and a sheet that opened another sheet must not pull
 * focus out from under it. An opener that has left the page (the task
 * deleted with it) is not focused; there is nothing honest to focus instead.
 *
 * `active` is for a surface that stays mounted and toggles: the capture
 * happens when it becomes active and the restore when it stops.
 */
export function useRestoreFocus(active = true): void {
  useEffect(() => {
    if (!active) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      const now = document.activeElement
      if (now && now !== document.body && document.contains(now)) return
      if (opener && opener !== document.body && document.contains(opener)) opener.focus()
    }
  }, [active])
}
