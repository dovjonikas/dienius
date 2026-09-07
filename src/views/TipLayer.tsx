import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** How long a pointer rests before the words appear. The same as an explanation's. */
export const TIP_DELAY = 400

/** Air between the control and the bubble, and between the bubble and the window's edge. */
const GAP = 8
const EDGE = 8

/** Half the arrow's diagonal: how far the bubble's edge sits back from its tip. */
const ARROW = 5

type Side = 'below' | 'above' | 'right'

interface Shown {
  host: HTMLElement
  text: string
  /** Where the host asked for it - the rail's icons want it beside them. */
  at: 'below' | 'right'
}

interface Box {
  left: number
  top: number
  side: Side
  /** Where the arrow sits along the bubble, so it points at the control even when the bubble was pushed off centre by the window's edge. */
  arrow: number
}

/**
 * The one tooltip, for every control that carries `data-tip`.
 *
 * The browser's own `title` tooltip lands wherever the browser puts it,
 * which on a line of small caps was on the words it was about, and on a
 * button was over the button beside it. The rule since v2.6 is that a
 * tooltip sits under the thing it explains - above it when there is no room
 * under, beside it in the rail - and never on it. So the words moved from
 * `title` to `data-tip`, and this draws them: one element for the whole app,
 * positioned in the window rather than inside whatever scroller or clipped
 * rail the control happens to live in, 400ms after a mouse rests and at once
 * when a keyboard arrives.
 *
 * Mounted once, at the root. Nothing else has to import it: a control says
 * `data-tip="Leave focus"` and that is the whole of its part. The attribute
 * is read at the moment the words are due, not when the pointer arrives, so
 * a control that stops carrying one in between - a rail item once the rail
 * has opened its labels - shows nothing.
 *
 * Not a replacement for `Explain`, which is a sentence about a word this
 * app invented, reachable by a held finger; this is the name of a control,
 * or the one fact about it a hover is for, and a finger does not get it -
 * every host keeps an `aria-label` or visible text of its own, so a screen
 * reader and a touch screen lose nothing that was not a hover to begin
 * with.
 */
export function TipLayer() {
  const [shown, setShown] = useState<Shown | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let current: HTMLElement | null = null
    // Whether the last thing that moved focus was a key. A focus that
    // arrived by a press is the press, and the pointer's own rule applies.
    let byKeyboard = false

    function hostOf(target: EventTarget | null): HTMLElement | null {
      return target instanceof Element ? target.closest<HTMLElement>('[data-tip]') : null
    }

    function show(host: HTMLElement) {
      const text = host.getAttribute('data-tip')
      if (!text || !host.isConnected) {
        setShown(null)
        return
      }
      setShown({ host, text, at: host.getAttribute('data-tip-at') === 'right' ? 'right' : 'below' })
    }

    function hide() {
      clearTimeout(timer)
      current = null
      setShown(null)
    }

    function onOver(e: PointerEvent) {
      if (e.pointerType !== 'mouse') return
      const host = hostOf(e.target)
      if (host === current) return
      clearTimeout(timer)
      current = host
      setShown(null)
      if (host) timer = setTimeout(() => show(host), TIP_DELAY)
    }

    function onOut(e: PointerEvent) {
      if (e.pointerType !== 'mouse' || !current) return
      const to = e.relatedTarget instanceof Node ? e.relatedTarget : null
      if (to && current.contains(to)) return
      hide()
    }

    function onFocusIn(e: FocusEvent) {
      const host = hostOf(e.target)
      clearTimeout(timer)
      if (!host || !byKeyboard) {
        if (current && host !== current) hide()
        return
      }
      current = host
      show(host)
    }

    function onFocusOut(e: FocusEvent) {
      if (current && hostOf(e.target) === current) hide()
    }

    function onKeyDown(e: KeyboardEvent) {
      byKeyboard = true
      if (e.key === 'Escape') hide()
    }

    // A press means the control is being used, not asked about.
    function onPointerDown() {
      byKeyboard = false
      hide()
    }

    // A scroll moves the control out from under a bubble fixed in the
    // window, so a bubble that is showing goes. One that is still due stays
    // due: it is placed at the moment it appears, and the rail scrolls
    // itself a pixel whenever a control in it is brought into view, which
    // used to cancel every tooltip in it before it could show.
    function onScroll() {
      setShown(null)
    }

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [])

  // Placed once the bubble has a size, before it is painted. Under the
  // control, centred; pushed back inside the window's edges if it has to be,
  // with the arrow still on the control; above it when there is no room
  // under; beside it when the host asked for that.
  useLayoutEffect(() => {
    if (!shown || !bubbleRef.current) {
      setBox(null)
      return
    }
    const host = shown.host.getBoundingClientRect()
    const bubble = bubbleRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    if (shown.at === 'right') {
      const left = host.right + GAP
      const top = clamp(host.top + host.height / 2 - bubble.height / 2, EDGE, vh - bubble.height - EDGE)
      setBox({ left, top, side: 'right', arrow: host.top + host.height / 2 - top - ARROW })
      return
    }
    const centre = host.left + host.width / 2
    const left = clamp(centre - bubble.width / 2, EDGE, Math.max(EDGE, vw - bubble.width - EDGE))
    const arrow = clamp(centre - left - ARROW, GAP, Math.max(GAP, bubble.width - GAP - ARROW * 2))
    const below = host.bottom + GAP
    if (below + bubble.height <= vh - EDGE || host.top - GAP - bubble.height < EDGE) {
      setBox({ left, top: below, side: 'below', arrow })
    } else {
      setBox({ left, top: host.top - GAP - bubble.height, side: 'above', arrow })
    }
  }, [shown])

  if (!shown) return null

  return createPortal(
    <div
      ref={bubbleRef}
      role="tooltip"
      className={box ? `tip is-${box.side}` : 'tip'}
      style={
        box
          ? ({ left: `${box.left}px`, top: `${box.top}px`, ['--tip-arrow' as string]: `${box.arrow}px` } as React.CSSProperties)
          : { visibility: 'hidden', left: 0, top: 0 }
      }
    >
      {shown.text}
    </div>,
    document.body,
  )
}
