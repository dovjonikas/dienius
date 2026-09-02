import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * Drag-to-reorder a vertical list, on a finger as well as a pointer.
 *
 * The library's reorder started life on the HTML5 drag API, which does not
 * fire from a touch at all - so on the one device this app is mostly used
 * from, the grip was a handle that did nothing. This is the same pointer
 * model the timeline's own block drag already uses (see `DayView`'s
 * `startDrag`): capture the pointer, read what is under it with
 * `elementFromPoint`, commit on release.
 *
 * The row under the finger is found by its own `data-reorder-index` rather
 * than by measuring rectangles, so nothing here has to know the row height,
 * whether rows differ in height, or whether the list has scrolled since the
 * drag began.
 */
export interface ListReorder {
  /** The id currently being dragged, or null. For styling the lifted row. */
  draggingId: string | null
  /** The index the drop would land on, or null. For drawing the seam. */
  overIndex: number | null
  /** Put this on the grip. */
  start: (id: string, index: number, e: ReactPointerEvent) => void
}

export function useListReorder(
  containerRef: React.RefObject<HTMLElement | null>,
  onMove: (id: string, toIndex: number) => void,
): ListReorder {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const state = useRef<{ id: string; from: number; to: number } | null>(null)

  function indexAt(clientX: number, clientY: number): number | null {
    const el = document.elementFromPoint(clientX, clientY)
    const row = el?.closest('[data-reorder-index]')
    if (!row || !containerRef.current?.contains(row)) return null
    const raw = Number((row as HTMLElement).dataset.reorderIndex)
    return Number.isInteger(raw) ? raw : null
  }

  function start(id: string, index: number, e: ReactPointerEvent) {
    // Left button or a finger only - a right click is the context menu's,
    // and a middle click is nobody's.
    if (e.button !== 0) return
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    state.current = { id, from: index, to: index }
    setDraggingId(id)
    setOverIndex(index)

    function move(ev: PointerEvent) {
      const next = indexAt(ev.clientX, ev.clientY)
      if (next === null || !state.current) return
      state.current.to = next
      setOverIndex(next)
    }

    function end() {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', end)
      target.removeEventListener('pointercancel', end)
      const current = state.current
      state.current = null
      setDraggingId(null)
      setOverIndex(null)
      if (current && current.to !== current.from) onMove(current.id, current.to)
    }

    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', end)
    target.addEventListener('pointercancel', end)
  }

  return { draggingId, overIndex, start }
}
