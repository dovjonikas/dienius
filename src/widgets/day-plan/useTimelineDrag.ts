import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import type { Task } from '../../lib/types'
import { formatDuration, timeToMinutes } from './capacity'
import { formatClock, snapToStep, SNAP_MINUTES } from './timelineLayout'
import { resolveDrop, type DropTarget } from './dragDrop'
import type { GridGeometry } from './TimelineGrid'

/**
 * A block on a timeline grid, moved or resized with a pointer.
 *
 * This was the day view's own until v2.21, bound to a date and to the store:
 * `useDayDrag`. The template editor's picture draws the same grid and wanted
 * the same two gestures, and the plan said the drag machinery already built
 * - pointer capture, the grid's geometry, the snap - should be reused rather
 * than written a second time. So the machinery is here, and what to do with
 * the result is the caller's: a day reshapes a task and offers an undo, a
 * template reshapes a block in a draft. `useDayDrag` is the day's binding
 * of this and is one screen long.
 *
 * Two gestures, one hook. A move carries the distance from the block's own
 * top edge to where it was grabbed, so the block follows the pointer rather
 * than jumping its top to it. A resize carries the block's start, since the
 * new length is measured from there. Both snap to the grid's step, and a
 * pointer that has not travelled eight pixels has not dragged - it has
 * pressed, and a press means whatever the block means.
 *
 * Refs, not state, hold what is being dragged: the document listeners have
 * to read them synchronously without being re-subscribed on every render.
 * The host is read through a ref for the same reason, so a caller handing
 * in a fresh `reshape` on every render does not re-subscribe the document
 * on every render either.
 */

const MIN_DRAG_DISTANCE_PX = 8
const MIN_TASK_MINUTES = SNAP_MINUTES

/**
 * The last start a day has. A time is on its own date's clock, and "24:00" is
 * the end of a day rather than a start in it - a block dropped at the bottom
 * edge used to be saved as 24:00, a time nothing else can read.
 * docs/RESEARCH-SHIFTS.md section 3.4.
 */
const LAST_START_MINUTES = 24 * 60 - 1

export interface TimelineDragHost {
  /** What is on the grid. Ids are what the callbacks get back. */
  tasks: Task[]
  /**
   * Put the change in. `false` means it was refused and nothing moved, so
   * nothing is announced and no undo is offered.
   */
  reshape: (taskId: string, patch: { time?: string; minutes?: number }) => boolean
  /** A drop on the tray takes the time off. Absent where there is no tray. */
  unanchor?: (taskId: string) => boolean
  /** Offer a way back, where the host has one. */
  offerUndo?: (label: string, undo: () => void) => void
}

export interface TimelineDrag {
  draggingTaskId: string | null
  dropMinutes: number | null
  announcement: string
  announce: (text: string) => void
  startDrag: (taskId: string, e: React.PointerEvent) => void
  startResize: (taskId: string, e: React.PointerEvent) => void
  onGeometry: (geometry: GridGeometry | null) => void
}

export function useTimelineDrag(host: TimelineDragHost): TimelineDrag {
  const hostRef = useRef(host)
  hostRef.current = host
  const dragRef = useRef<string | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  // What kind of drag is running, and what it needs to compute a new value.
  const dragKindRef = useRef<'move' | 'resize' | null>(null)
  // `grabMinutes` and `cutAtEdge` are a resize's: where on the clock the edge
  // was taken hold of, and whether the block runs on past the drawn window, so
  // the edge under the pointer is not its real end.
  const dragGrabRef = useRef<{ offsetPx: number; startMinutes: number; grabMinutes: number; cutAtEdge: boolean }>({
    offsetPx: 0,
    startMinutes: 0,
    grabMinutes: 0,
    cutAtEdge: false,
  })
  const geometryRef = useRef<GridGeometry | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dropMinutes, setDropMinutes] = useState<number | null>(null)
  const [announcement, announce] = useState('')

  function endDrag() {
    dragRef.current = null
    dragStartRef.current = null
    dragKindRef.current = null
    setDraggingTaskId(null)
    setDropMinutes(null)
  }

  /** Where a moved block starts: snapped, and never before the day's first minute or after its last. */
  function movedStart(geometry: GridGeometry, clientY: number): number {
    return Math.min(LAST_START_MINUTES, Math.max(0, snapToStep(geometry.minutesAtClientY(clientY - dragGrabRef.current.offsetPx))))
  }

  /**
   * A resized block's length. Normally its end is where the pointer is. A block
   * drawn cut at the window's edge - a night shift, on the day it starts - has
   * its real end beyond what is drawn, so its length changes by as much as the
   * pointer moved: a grab and a small drag no longer cut an eight-hour shift to
   * the two hours left before midnight.
   */
  function resizedLength(geometry: GridGeometry, task: Task, clientY: number): number {
    const grab = dragGrabRef.current
    if (grab.cutAtEdge && task.minutes !== undefined) {
      return Math.max(MIN_TASK_MINUTES, task.minutes + snapToStep(geometry.minutesAtClientY(clientY) - grab.grabMinutes))
    }
    return Math.max(MIN_TASK_MINUTES, snapToStep(geometry.minutesAtClientY(clientY) - grab.startMinutes))
  }

  function edgeAt(taskId: string, kind: 'move' | 'resize', clientY: number): number | null {
    const geometry = geometryRef.current
    const task = hostRef.current.tasks.find(t => t.id === taskId)
    if (!geometry || !task?.time) return null
    if (kind === 'move') return movedStart(geometry, clientY)
    return dragGrabRef.current.startMinutes + resizedLength(geometry, task, clientY)
  }

  function beginPointerDrag(taskId: string, kind: 'move' | 'resize', e: React.PointerEvent) {
    const task = hostRef.current.tasks.find(t => t.id === taskId)
    if (!task?.time) return
    // The grid's own capture would keep every later pointer event on the
    // element under the first press; the document listeners below want them.
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    e.preventDefault()
    e.stopPropagation()
    const startMinutes = timeToMinutes(task.time)
    const geometry = geometryRef.current
    const realEnd = task.minutes !== undefined ? startMinutes + task.minutes : undefined
    dragRef.current = taskId
    dragKindRef.current = kind
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    dragGrabRef.current = {
      offsetPx: e.clientY - (geometry?.clientYAt(startMinutes) ?? e.clientY),
      startMinutes,
      grabMinutes: geometry?.minutesAtClientY(e.clientY) ?? startMinutes,
      // The drawn window stops where the grid does: an end beyond it reads back
      // as the window's edge.
      cutAtEdge: !!geometry && realEnd !== undefined && geometry.minutesAtClientY(geometry.clientYAt(realEnd)) < realEnd,
    }
    setDraggingTaskId(taskId)
  }

  function commitPointerDrag(taskId: string, kind: 'move' | 'resize', clientY: number): boolean {
    const geometry = geometryRef.current
    const { tasks, reshape, offerUndo } = hostRef.current
    const task = tasks.find(t => t.id === taskId)
    if (!geometry || !task?.time) return false
    if (kind === 'move') {
      const next = formatClock(movedStart(geometry, clientY))
      if (next === task.time) return false
      const previous = task.time
      if (!reshape(taskId, { time: next })) return false
      announce(`${task.title} moved to ${next}.`)
      offerUndo?.(`${task.title} moved to ${next}`, () => reshape(taskId, { time: previous }))
      return true
    }
    const next = resizedLength(geometry, task, clientY)
    if (next === task.minutes) return false
    const previous = task.minutes
    if (!reshape(taskId, { minutes: next })) return false
    announce(`${task.title} is now ${formatDuration(next)}.`)
    offerUndo?.(`${task.title} resized to ${formatDuration(next)}`, () => reshape(taskId, { minutes: previous ?? next }))
    return true
  }

  function targetAt(clientX: number, clientY: number): DropTarget {
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return null
    if (el.closest('[data-tray-zone]')) return { type: 'tray' }
    return null
  }

  useEffect(() => {
    function handleUp(e: PointerEvent) {
      const taskId = dragRef.current
      if (!taskId) return
      const kind = dragKindRef.current ?? 'move'
      const start = dragStartRef.current
      const movedEnough = !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) >= MIN_DRAG_DISTANCE_PX
      // Only a move can land on the tray; a resize never leaves the grid.
      const target = kind === 'move' && movedEnough ? targetAt(e.clientX, e.clientY) : null
      const outcome = resolveDrop(hostRef.current.tasks, taskId, target)
      endDrag()
      if (outcome.action === 'unanchor') {
        const { tasks, unanchor } = hostRef.current
        const task = tasks.find(t => t.id === outcome.taskId)
        if (unanchor?.(outcome.taskId)) {
          announce(task ? `${task.title} no longer has a set time.` : 'No longer has a set time.')
        }
        return
      }
      if (movedEnough) commitPointerDrag(taskId, kind, e.clientY)
    }
    function handleMove(e: PointerEvent) {
      const taskId = dragRef.current
      if (!taskId) return
      const start = dragStartRef.current
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < MIN_DRAG_DISTANCE_PX) return
      setDropMinutes(edgeAt(taskId, dragKindRef.current ?? 'move', e.clientY))
    }
    function handleCancel() {
      endDrag()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || !dragRef.current) return
      e.stopPropagation()
      endDrag()
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointercancel', handleCancel)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointercancel', handleCancel)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
    // Subscribed once. Everything the handlers need is read through refs.
  }, [])

  return {
    draggingTaskId,
    dropMinutes,
    announcement,
    announce,
    startDrag: (taskId, e) => beginPointerDrag(taskId, 'move', e),
    startResize: (taskId, e) => beginPointerDrag(taskId, 'resize', e),
    onGeometry: geometry => {
      geometryRef.current = geometry
    },
  }
}
