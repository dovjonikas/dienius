import { useEffect, useId, useRef, useState } from 'react'
import { explain, type ExplainId } from '../lib/explain'

export interface ExplainProps {
  id: ExplainId
  /** The control or the word this is about. The explanation attaches to it. */
  children?: React.ReactNode
  /**
   * Where the bubble hangs. `'end'` pins its right edge to the anchor, for
   * something near the right of its row that would otherwise push a 34ch
   * bubble off the screen.
   */
  align?: 'start' | 'end'
  /** Extra class on the wrapper, for a host that needs it to fill its row. */
  className?: string
  /**
   * Print the sentence in place instead of waiting to be asked for.
   *
   * Some terms are not words in a sentence somebody might rest on - they are
   * whole choices, and the explanation is the thing that makes the choice
   * possible. The three replan doors are the clearest case: nobody can pick
   * between "Something came up" and "Shift the rest" from the names, and an
   * explanation behind a gesture is an explanation behind a second decision.
   */
  inline?: boolean
}

/** How long a pointer has to rest, and how long a finger has to hold. */
export const EXPLAIN_DELAY = 400
export const EXPLAIN_HOLD = 500

/** A focus this soon after a press came from the press - see `pressedAt`. */
const PRESS_FOCUS_WINDOW = 400

/**
 * The one way this app explains a word.
 *
 * One or two sentences, attached to the control they are about, and nothing
 * on screen until somebody asks. The copy is not here - it is all in
 * `lib/explain.ts`, so the app's whole vocabulary can be read as copy rather
 * than found one string literal at a time.
 *
 * ## Why there is no marker
 *
 * There was, for exactly one version: a small (i) beside every term. Twenty
 * of them across the app read as twenty controls rather than as texture, and
 * each was the loudest thing in a row it had no business being loudest in - a
 * bordered circle beside a plain word wins that competition every time,
 * whatever it is set in. An explanation is a second thought about something
 * already on screen, and a second thought does not get a permanent button.
 *
 * So the control itself is the anchor:
 *
 * - **A mouse** rests on it for 400ms. Not instantly: a bubble that appears
 *   the moment a cursor crosses something is a bubble that appears while
 *   somebody is on their way to a different control.
 * - **A finger** holds it for 500ms. A press that becomes a hold explains; a
 *   press that does not does what the control does. The hold never swallows
 *   the tap - the control's own handler is untouched, which is the whole
 *   reason this wraps rather than replaces.
 * - **A keyboard** gets it on focus, immediately. Nobody tabs past something
 *   by accident.
 *
 * Escape closes it, and so does a press anywhere else. It never traps focus,
 * it is never modal, and it never takes a click: this is an aside, and an
 * aside that has to be dismissed before you can carry on is not an aside.
 *
 * ## What it is not allowed to become
 *
 * One or two sentences, no heading, no link, no second paragraph and nothing
 * to press inside. The moment a bubble has a control in it, it has to be
 * reachable, which makes it a popover, which makes it a thing somebody has to
 * get out of. There are three of those in this app already and none of them
 * exists to define a word.
 */
export function Explain({ id, children, align = 'start', className, inline = false }: ExplainProps) {
  const { text } = explain(id)
  const [open, setOpen] = useState(false)
  const bubbleId = useId()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapRef = useRef<HTMLSpanElement>(null)
  /**
   * When a press last started, so the focus it causes on its way is not
   * mistaken for somebody tabbing here.
   *
   * Pressing a button focuses it, and a focus that opened the bubble would
   * mean every tap on an explained control popped a sentence over the screen.
   * A timestamp rather than a flag, because the focus does not reliably
   * arrive between the press and the release - in a real browser it lands
   * between them, in jsdom it lands after - and a flag cleared on release is
   * a flag that is already false half the time it is read.
   */
  const pressedAt = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  // A press anywhere else puts it away. Registered only while one is open, so
  // twenty of these on a settings page cost twenty listeners exactly never.
  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  function openAfter(ms: number) {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), ms)
  }

  function close() {
    clearTimeout(timer.current)
    setOpen(false)
  }

  if (inline) {
    return (
      <span className="explain-inline" data-explains={id}>
        {text}
      </span>
    )
  }

  return (
    <span
      className={[open ? 'explain is-open' : 'explain', className].filter(Boolean).join(' ')}
      // The audit's own hook. `Explain.test.tsx` walks the rendered app for
      // these and checks the set against EXPLAIN_IDS, so a term that has copy
      // but was never attached to anything fails just as loudly as one with
      // no copy at all.
      data-explains={id}
      ref={wrapRef}
      // Described-by on the wrapper rather than on the control inside it: the
      // control's own accessible name is its business, and a sentence about
      // what a word means is a description of the region, not part of a
      // button's name.
      aria-describedby={open ? bubbleId : undefined}
      onPointerEnter={e => e.pointerType === 'mouse' && openAfter(EXPLAIN_DELAY)}
      onPointerLeave={e => e.pointerType === 'mouse' && close()}
      // A hold, on a finger. Started on the press and cancelled by the
      // release, so a tap does the control's own job and never this one.
      onPointerDown={e => {
        pressedAt.current = Date.now()
        if (e.pointerType !== 'mouse') openAfter(EXPLAIN_HOLD)
      }}
      onPointerUp={e => e.pointerType !== 'mouse' && clearTimeout(timer.current)}
      onPointerCancel={() => clearTimeout(timer.current)}
      onFocus={() => {
        if (Date.now() - pressedAt.current > PRESS_FOCUS_WINDOW) setOpen(true)
      }}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close()
      }}
      onKeyDown={e => {
        if (e.key !== 'Escape' || !open) return
        // Stopped here, because Escape at the document is the shell's key for
        // closing the loudest thing open - and while a bubble is up, the
        // bubble is the loudest thing open.
        e.stopPropagation()
        close()
      }}
    >
      {children}
      <span
        role="tooltip"
        id={bubbleId}
        className={align === 'end' ? 'explain-bubble is-end' : 'explain-bubble'}
        hidden={!open}
      >
        {text}
      </span>
    </span>
  )
}
