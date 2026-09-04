import { useEffect, type RefObject } from 'react'

/**
 * Closes a small panel on a press outside it or on Escape. Escape is
 * stopped at the capture phase so the app's own keyboard layer - which
 * closes sheets and leaves tours on the same key - does not act on a press
 * that only meant "put this popover away"; the sheet under it reacts to the
 * next press, which is the order a person expects.
 *
 * `close` and `ref` are read when the panel opens and are stable for as
 * long as it stays open, so the effect is keyed on `open` alone.
 */
export function useClickAway(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}
