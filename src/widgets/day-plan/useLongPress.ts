import { useRef } from 'react'

export interface LongPressOptions {
  /** How long a hold has to last before it counts as a long press. */
  delay?: number
  /**
   * How far the pointer can drift before a hold stops counting as a long
   * press. This is the same disambiguation `touch-action` gives the
   * pointer-drag elsewhere in this feature, applied to a timer instead of
   * CSS: a real scroll gesture moves well past this before 500ms is up
   * (and the browser also cancels the pointer outright once it commits to
   * scrolling - see the `onPointerCancel` handler below), so it never
   * reads as a long press by accident.
   */
  moveThreshold?: number
}

export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: (e: React.PointerEvent) => void
  onClickCapture: (e: React.MouseEvent) => void
}

/**
 * A press-and-hold gesture, offered as a spreadable set of pointer
 * handlers so it can sit on an element that already has its own short-tap
 * behaviour (a task row's `<label>`, which toggles the task done on a
 * plain click) without disturbing it - see the `onClickCapture` handler
 * below for how the two coexist.
 *
 * This is the touch-safe fallback docs/TIMELINE.md section 5 asks for:
 * "a long-press menu does the same thing, because the calendar drag
 * already has a documented history of not working on touch in this
 * repo." It is deliberately independent of the pointer-drag machinery in
 * `DayView.tsx` - if that drag fails on a real device the way the
 * calendar's first attempt did, this still works, because it never
 * depends on sustained pointer capture or cross-element `pointermove`
 * tracking the way a drag does. It only needs the pointer to stay roughly
 * still for `delay` milliseconds.
 *
 * A short tap - the overwhelmingly common case, checking a task off -
 * clears the timer on `onPointerUp` before it ever fires, so the
 * element's own click behaves exactly as it always did. Only once the
 * timer has actually fired does the next click get intercepted: the
 * browser still dispatches a click when the pointer lifts, however long
 * it was held, so without this the checkbox underneath a long-pressed row
 * would silently toggle right after the menu opened. `onClickCapture`
 * runs in the capture phase, before the label's own default action
 * (forwarding activation to its nested control) executes, so
 * `preventDefault` there stops that forwarded toggle rather than merely
 * being too late to matter.
 */
export function useLongPress(onLongPress: () => void, options: LongPressOptions = {}): LongPressHandlers {
  const delay = options.delay ?? 500
  const moveThreshold = options.moveThreshold ?? 10
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const firedRef = useRef(false)

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startRef.current = null
  }

  function onPointerDown(e: React.PointerEvent) {
    // A secondary mouse button (right-click) has its own meaning and is
    // not the start of a hold.
    if (e.button !== 0) return
    startRef.current = { x: e.clientX, y: e.clientY }
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      firedRef.current = true
      onLongPress()
    }, delay)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (Math.hypot(dx, dy) > moveThreshold) clearTimer()
  }

  function onPointerUp() {
    clearTimer()
  }

  function onPointerCancel() {
    clearTimer()
  }

  function onClickCapture(e: React.MouseEvent) {
    if (!firedRef.current) return
    firedRef.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture }
}
