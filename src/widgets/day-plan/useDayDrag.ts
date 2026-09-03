import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import type { DayPlan } from '../../lib/types'
import { actions } from '../../lib/store'
import { offerUndo } from '../../lib/undo'
import { formatDuration, timeToMinutes } from './capacity'
import { formatClock, snapToStep, SNAP_MINUTES } from './timelineLayout'
import { resolveDrop, type DropTarget } from './dragDrop'
import type { GridGeometry } from './TimelineGrid'

/**
 * Dragging a block in the timeline: moving it, resizing it, and dropping it
 * back into the task list to take its time away.
 *
 * Lifted out of DayView because it is the one part of that component that is
 * not about what a day looks like. It is five refs, a document-level listener
 * and a set of rules about what a release means - none of which the view has
 * any reason to be able to see.
 *
 * Follows CalendarView.tsx's pointer approach exactly, since that component
 * already solved touch drag in this repo the hard way: release pointer capture
 * on pointerdown so the browser keeps delivering events to whatever is
 * actually under the finger, and clean up on document-level
 * pointerup/pointercancel so a finger lifted anywhere - off the day view
 * entirely, past the edge of the screen - always ends the drag instead of
 * leaving it stuck on.
 *
 * Placing a float by dragging it out of its own row used to be this same
 * machinery's other direction, started from a small dedicated handle on every
 * draggable row. It was removed along with that handle - see the comment on
 * TaskRow.tsx's own actions-menu button - once the row's actions menu made a
 * float placeable through a genuine one-extra-tap path that needs neither a
 * live drag gesture nor the grid expanded. Only an anchor's own visual block
 * in the grid still starts a drag now; a float's row has nothing left that
 * does.
 */

/**
 * How far the pointer has to move before a release counts as a genuine drop
 * rather than a tap that merely started on a drag source. Small enough that a
 * real drag of even a few pixels still counts, large enough to absorb the
 * jitter a finger or a mouse naturally has while holding still.
 *
 * An anchor block has no click behaviour of its own today (it is decorative),
 * so without this guard a plain tap on it - pointerdown immediately followed
 * by pointerup at the same spot - would resolve to the tray target and
 * un-anchor the task with no actual drag having happened.
 */
const MIN_DRAG_DISTANCE_PX = 8

/** The shortest a task can be pulled down to. One snap step - see SNAP_MINUTES. */
const MIN_TASK_MINUTES = SNAP_MINUTES

export interface DayDrag {
  /** The task being dragged right now, for the grid to draw differently. */
  draggingTaskId: string | null
  /**
   * What to put in the day's live region.
   *
   * The announcer lives here rather than in its own hook because a drag is
   * what most often has something to say, but it is deliberately writable
   * from outside: placing a task through the actions menu or the gap sheet
   * needs the same region, and those gestures never touch a pointer.
   */
  announcement: string
  announce: (text: string) => void
  startDrag: (taskId: string, e: React.PointerEvent) => void
  startResize: (taskId: string, e: React.PointerEvent) => void
  onGeometry: (geometry: GridGeometry | null) => void
}

export function useDayDrag(date: string, day: DayPlan | undefined): DayDrag {
  // Refs, not state, hold what is being dragged: the document listener below
  // has to read them synchronously without being re-subscribed on every
  // render.
  const dragRef = useRef<string | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  // What kind of drag is running, and what it needs to compute a new value.
  // 'move' carries the distance from the block's own top edge to where it was
  // grabbed, so the block follows the pointer instead of jumping its top to
  // it; 'resize' carries the task's start, since the new length is measured
  // from there.
  const dragKindRef = useRef<'move' | 'resize' | null>(null)
  const dragGrabRef = useRef<{ offsetPx: number; startMinutes: number }>({ offsetPx: 0, startMinutes: 0 })
  const geometryRef = useRef<GridGeometry | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [announcement, announce] = useState('')

  function endDrag() {
    dragRef.current = null
    dragStartRef.current = null
    dragKindRef.current = null
    setDraggingTaskId(null)
  }

  function beginPointerDrag(taskId: string, kind: 'move' | 'resize', e: React.PointerEvent) {
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task?.time) return
    // Release the capture the browser takes on pointerdown so it keeps
    // delivering events to whatever is actually under the finger - the same
    // technique CalendarView established for touch drag in this repo.
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    e.preventDefault()
    e.stopPropagation()
    const startMinutes = timeToMinutes(task.time)
    dragRef.current = taskId
    dragKindRef.current = kind
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    dragGrabRef.current = {
      offsetPx: e.clientY - (geometryRef.current?.clientYAt(startMinutes) ?? e.clientY),
      startMinutes,
    }
    setDraggingTaskId(taskId)
  }

  /**
   * Commits the end of a move or a resize, and arms its undo. Returns true
   * when it actually changed something, so the caller knows not to also run
   * the tray path.
   *
   * Both gestures snap - see SNAP_MINUTES - and both refuse a no-op: dropping
   * a block back where it started should feel like nothing happened, not like
   * an edit that happens to have the same value, and should certainly not
   * offer to undo itself.
   */
  function commitPointerDrag(taskId: string, kind: 'move' | 'resize', clientY: number): boolean {
    const geometry = geometryRef.current
    const task = day?.tasks.find(t => t.id === taskId)
    if (!geometry || !task?.time) return false

    if (kind === 'move') {
      const next = formatClock(Math.max(0, snapToStep(geometry.minutesAtClientY(clientY - dragGrabRef.current.offsetPx))))
      if (next === task.time) return false
      const previous = task.time
      if (!actions.reshapeTask(date, taskId, { time: next })) return false
      announce(`${task.title} moved to ${next}.`)
      offerUndo(`${task.title} moved to ${next}`, () => actions.reshapeTask(date, taskId, { time: previous }))
      return true
    }

    const next = Math.max(MIN_TASK_MINUTES, snapToStep(geometry.minutesAtClientY(clientY) - dragGrabRef.current.startMinutes))
    if (next === task.minutes) return false
    const previous = task.minutes
    if (!actions.reshapeTask(date, taskId, { minutes: next })) return false
    announce(`${task.title} is now ${formatDuration(next)}.`)
    offerUndo(
      `${task.title} resized to ${formatDuration(next)}`,
      () => actions.reshapeTask(date, taskId, { minutes: previous ?? next }),
    )
    return true
  }

  function targetAt(clientX: number, clientY: number): DropTarget {
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return null
    if (el.closest('[data-tray-zone]')) return { type: 'tray' }
    return null
  }

  function applyOutcome(outcome: ReturnType<typeof resolveDrop>) {
    if (outcome.action === 'unanchor') {
      const task = day?.tasks.find(t => t.id === outcome.taskId)
      if (actions.unanchorTask(date, outcome.taskId)) {
        announce(task ? `${task.title} no longer has a set time.` : 'No longer has a set time.')
      }
    }
  }

  useEffect(() => {
    function handleUp(e: PointerEvent) {
      if (!dragRef.current) return
      const taskId = dragRef.current
      const start = dragStartRef.current
      const movedEnough = !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) >= MIN_DRAG_DISTANCE_PX
      const kind = dragKindRef.current ?? 'move'
      const target = movedEnough ? targetAt(e.clientX, e.clientY) : null
      // The tray wins wherever the release actually lands on it: dropping a
      // block back into the list means "this has no time any more", which is
      // a different intention from moving it, and the two must not both fire.
      const outcome = resolveDrop(day?.tasks ?? [], taskId, target)
      endDrag()
      if (outcome.action === 'unanchor') {
        applyOutcome(outcome)
        return
      }
      if (movedEnough) commitPointerDrag(taskId, kind, e.clientY)
    }
    function handleCancel() {
      // A drag that goes nowhere - the gesture was cancelled by the browser,
      // or interrupted some other way - leaves state untouched, never a
      // half-removed task.
      endDrag()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dragRef.current) endDrag()
    }
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointercancel', handleCancel)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointercancel', handleCancel)
      document.removeEventListener('keydown', handleKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, date])

  return {
    draggingTaskId,
    announcement,
    announce,
    startDrag: (taskId, e) => beginPointerDrag(taskId, 'move', e),
    startResize: (taskId, e) => beginPointerDrag(taskId, 'resize', e),
    onGeometry: geometry => {
      geometryRef.current = geometry
    },
  }
}
