import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MAX_HIGHLIGHTS, type Task } from '../../lib/types'

export interface TaskContextMenuProps {
  task: Task
  /** Where the pointer was, in viewport coordinates. */
  x: number
  y: number
  /** How many tasks on this day are already marked key. */
  highlightCount: number
  onDetails: () => void
  onToggleDone: () => void
  onToggleHighlight: () => void
  onPush: () => void
  onDelete: () => void
  onClose: () => void
}

/**
 * The right-click menu - a real one, not the browser's.
 *
 * The browser's own context menu on a task offers Back, Reload and View
 * Source, none of which have anything to do with the task. Replacing it is
 * the rare case where overriding a platform default is the honest choice:
 * the gesture already means "act on this thing", and here it finally does.
 *
 * Five entries, all of them things somebody does often enough to want a
 * shortcut for. Everything rarer stays behind Details, and the long-press
 * menu on touch is untouched - this is the pointer's own path to the same
 * actions, not a replacement for it.
 */
export function TaskContextMenu({
  task,
  x,
  y,
  highlightCount,
  onDetails,
  onToggleDone,
  onToggleHighlight,
  onPush,
  onDelete,
  onClose,
}: TaskContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // Measured after layout, before paint: a menu opened near the right or
  // bottom edge flips back inside rather than being clipped or pushing the
  // page into a scroll it never had.
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const nextX = x + rect.width > window.innerWidth - 8 ? Math.max(8, window.innerWidth - rect.width - 8) : x
    const nextY = y + rect.height > window.innerHeight - 8 ? Math.max(8, y - rect.height) : y
    setPos({ x: nextX, y: nextY })
    el.focus()
  }, [x, y])

  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  const highlightFull = !task.highlight && highlightCount >= MAX_HIGHLIGHTS

  function run(fn: () => void) {
    fn()
    onClose()
  }

  return (
    <div
      className="task-context-menu"
      role="menu"
      aria-label={`Actions for ${task.title}`}
      tabIndex={-1}
      ref={menuRef}
      style={{ left: pos.x, top: pos.y }}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <button type="button" role="menuitem" onClick={() => run(onDetails)}>
        Details
      </button>
      <button type="button" role="menuitem" onClick={() => run(onToggleDone)}>
        {task.done ? 'Mark not done' : 'Mark done'}
      </button>
      <button type="button" role="menuitem" disabled={highlightFull} onClick={() => run(onToggleHighlight)}>
        {task.highlight ? 'Not a key task' : 'Mark as key'}
      </button>
      <button type="button" role="menuitem" disabled={task.done} onClick={() => run(onPush)}>
        Push to tomorrow
      </button>
      <div className="task-context-sep" role="separator" />
      <button type="button" role="menuitem" className="danger" onClick={() => run(onDelete)}>
        Delete
      </button>
    </div>
  )
}
