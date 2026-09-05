import { useEffect, useId, useRef, useState } from 'react'
import { explain, type ExplainId } from '../lib/explain'

export interface ExplainProps {
  id: ExplainId
  /**
   * Where the bubble hangs. `'end'` pins its right edge to the marker, for a
   * term that sits near the right of its row and would otherwise push a
   * 32ch bubble off the screen.
   */
  align?: 'start' | 'end'
  /**
   * Print the sentence in place instead of hiding it behind an (i).
   *
   * Some terms are not words in a sentence somebody might hover - they are
   * whole choices, and the explanation is the thing that makes the choice
   * possible. The three replan doors are the clearest case: nobody can pick
   * between "Something came up" and "Shift the rest" from the names, and a
   * tooltip on a control somebody is deciding about is an explanation behind
   * a second decision. Same copy, same file, same audit; the difference is
   * only whether it is asked for or already there.
   */
  inline?: boolean
}

/** How long a pointer has to rest before the bubble appears. */
export const EXPLAIN_DELAY = 400

/**
 * The one way this app explains a word.
 *
 * A small (i) beside the term, and one or two sentences when you ask for it.
 * The copy is not here - it is all in `lib/explain.ts`, so the app's whole
 * vocabulary can be read as copy rather than found one string literal at a
 * time.
 *
 * ## Why an (i) rather than a hover on the word itself
 *
 * Because a finger has no hover, and this app is used on a phone at least as
 * much as on a laptop. A tooltip that only exists for a mouse is an
 * explanation half the people who need it cannot reach - the same rule as
 * CONVENTIONS section 17, one step down. So the marker is a real button,
 * always there, and every input opens it:
 *
 * - **A mouse** opens it by resting on it for 400ms. Not instantly: a bubble
 *   that appears the moment a cursor crosses something is a bubble that
 *   appears while somebody is on their way to a different control.
 * - **A finger** opens it by tapping, and a second tap closes it.
 * - **A keyboard** opens it on focus, immediately - there is no such thing as
 *   tabbing past something by accident.
 *
 * Escape closes it, and so does a press anywhere else. It never traps focus
 * and it is never modal: this is an aside, and an aside that has to be
 * dismissed before you can carry on is not an aside.
 *
 * ## What it is not allowed to become
 *
 * One or two sentences, no heading, no link, no second paragraph and no
 * control inside it. The moment a tooltip has something to press in it, it
 * has to be reachable, which makes it a popover, which makes it a thing
 * somebody has to get out of. There are three of those in this app already
 * and none of them exists to define a word.
 */
export function Explain({ id, align = 'start', inline = false }: ExplainProps) {
  const { term, text } = explain(id)
  const [open, setOpen] = useState(false)
  const bubbleId = useId()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapRef = useRef<HTMLSpanElement>(null)
  /**
   * Set when a focus opened the bubble, cleared by the next click.
   *
   * A tap fires a focus and then a click, so a click that plainly toggled
   * would close what the focus had just opened and a finger could never open
   * this at all. The North line under the day had exactly this bug for four
   * versions; this is the same fix, one line shorter.
   */
  const openedByFocus = useRef(false)

  useEffect(() => () => clearTimeout(timer.current), [])

  // Declared before the hooks below would be skipped by it: an early return
  // above a useEffect is the one shape React genuinely cannot allow.
  const printed = inline

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

  function openAfterDelay() {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), EXPLAIN_DELAY)
  }

  function close() {
    clearTimeout(timer.current)
    setOpen(false)
  }

  if (printed) {
    return (
      <span className="explain-inline" data-explains={id}>
        {text}
      </span>
    )
  }

  return (
    <span
      className={open ? 'explain is-open' : 'explain'}
      // The audit's own hook. `explain.test.tsx` walks the rendered app for
      // these and checks the set against EXPLAIN_IDS, so a term that has copy
      // but was never put on screen fails just as loudly as one with no copy.
      data-explains={id}
      ref={wrapRef}
      onPointerEnter={e => e.pointerType === 'mouse' && openAfterDelay()}
      onPointerLeave={e => e.pointerType === 'mouse' && close()}
    >
      <button
        type="button"
        className="explain-button"
        aria-label={`What ${term} means`}
        aria-expanded={open}
        aria-describedby={open ? bubbleId : undefined}
        onClick={() => {
          if (openedByFocus.current) {
            openedByFocus.current = false
            return
          }
          setOpen(o => !o)
        }}
        onFocus={() => {
          openedByFocus.current = !open
          setOpen(true)
        }}
        onBlur={() => {
          openedByFocus.current = false
          close()
        }}
        onKeyDown={e => {
          if (e.key !== 'Escape') return
          // Stopped here, because Escape at the document is the shell's key
          // for closing the loudest thing open - and while a bubble is up,
          // the bubble is the loudest thing open.
          e.stopPropagation()
          close()
        }}
      >
        <span aria-hidden="true">i</span>
      </button>
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
