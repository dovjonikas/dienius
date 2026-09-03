import { useRef, useState } from 'react'

/**
 * The floating way into Scratch on a phone, where there is no key to press.
 *
 * A small round button in a corner. It can be dragged, and when let go it
 * snaps to whichever corner it is nearest - a free position would sooner or
 * later sit on top of the timeline's now line or a task's checkbox, and a
 * corner never does. The corner is remembered on this device only; where a
 * thumb rests is a fact about a hand, not a plan.
 *
 * A tap and a drag are told apart by distance, the same eight pixels the
 * week grid uses: less is a tap that wobbled and opens the box.
 */

export interface ScratchFabProps {
  onOpen: () => void
}

type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

const CORNER_KEY = 'dienius:scratch-fab'
const TAP_DISTANCE_PX = 8

function readCorner(): Corner {
  try {
    const raw = localStorage.getItem(CORNER_KEY)
    if (raw === 'bottom-left' || raw === 'top-right' || raw === 'top-left') return raw
  } catch {
    // A browser refusing storage gets the default corner every time.
  }
  return 'bottom-right'
}

function saveCorner(corner: Corner): void {
  try {
    localStorage.setItem(CORNER_KEY, corner)
  } catch {
    // Not worth a message: the button still works, it just forgets.
  }
}

export function ScratchFab({ onOpen }: ScratchFabProps) {
  const [corner, setCorner] = useState<Corner>(readCorner)
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    startRef.current = { x: e.clientX, y: e.clientY }
    setOffset({ dx: 0, dy: 0 })
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const start = startRef.current
    if (!start) return
    setOffset({ dx: e.clientX - start.x, dy: e.clientY - start.y })
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const start = startRef.current
    startRef.current = null
    setOffset(null)
    if (!start) return
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < TAP_DISTANCE_PX) {
      onOpen()
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const next: Corner = `${cy < window.innerHeight / 2 ? 'top' : 'bottom'}-${cx < window.innerWidth / 2 ? 'left' : 'right'}`
    setCorner(next)
    saveCorner(next)
  }

  function onPointerCancel() {
    startRef.current = null
    setOffset(null)
  }

  return (
    <button
      type="button"
      className={`scratch-fab at-${corner}${offset ? ' is-dragging' : ''}`}
      aria-label="Scratch: write something down"
      style={offset ? { transform: `translate(${offset.dx}px, ${offset.dy}px)` } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // The pointer handlers above own the tap; a click would fire a second
      // time on top of it, and a keyboard still reaches this through Enter,
      // which the browser sends as a click - so only that one is kept.
      onClick={e => {
        if (e.detail !== 0) e.preventDefault()
        else onOpen()
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M4 14.5V16h1.5l8.6-8.6-1.5-1.5L4 14.5zM14.9 5.6l-1.5-1.5 1-1a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 1 0 1.4l-1 1z"
          fill="currentColor"
        />
      </svg>
    </button>
  )
}
