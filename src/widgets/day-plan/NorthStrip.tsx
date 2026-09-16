import { useEffect, useId, useRef, useState } from 'react'
import { useAppData } from '../../lib/store'
import { parseNorth, type NorthPart } from '../../lib/northSections'

type NorthSection = Extract<NorthPart, { kind: 'section' }>

/**
 * North's headings under the day's title, so the text is read from the day.
 *
 * The owner asked for the day to be the one place: the page in the rail is
 * a press away, and a press away is where a text goes unread. So the
 * headings of the text - a line in capitals is one, see lib/northSections.ts
 * - stand in a row under the North line, in its register: small, tracked,
 * the third ink, no edge and no ground, collapsed. A press on one opens what
 * is under it in a bubble under the row, the way the line's own peek opens,
 * so the day beneath never moves; a second press, Escape, or a press
 * anywhere else closes it. A finger and a mouse do the same thing here,
 * because the row sits on the busiest screen in the app, and a hover that
 * opened text over the task list would be opening it on the way to a task.
 *
 * Only the headings, never the free lines: the row is an index of the text,
 * not the text, and the page keeps the whole of it. A text with no heading
 * has no index, and the row is not drawn. Switched off in Settings, the
 * same; on by default, since a text written to be read every morning should
 * be where the morning is.
 */
export function NorthStrip({ date }: { date: string }) {
  const data = useAppData()
  const [open, setOpen] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()

  // Closed whenever the day changes underneath it - see NorthLine.
  useEffect(() => {
    setOpen(null)
  }, [date])

  // A press anywhere else closes it. pointerdown rather than click, so the
  // press that lands on a task closes the bubble before the task opens.
  useEffect(() => {
    if (open === null) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (data.settings.north.stripOnDay === false) return null
  const sections = parseNorth(data.picture?.text ?? '').filter((p): p is NorthSection => p.kind === 'section')
  if (sections.length === 0) return null
  const current = open === null ? undefined : sections[open]

  return (
    <div
      ref={ref}
      className="north-strip"
      onKeyDown={e => {
        if (e.key !== 'Escape' || open === null) return
        e.stopPropagation()
        setOpen(null)
      }}
    >
      <div className="north-strip-row" role="group" aria-label="North">
        {sections.map((section, i) =>
          // A heading with nothing under it is a word in the row and not a
          // control - there is nothing to open, so nothing offers to.
          section.lines.length === 0 ? (
            <span key={i} className="north-strip-bare">
              {section.heading}
            </span>
          ) : (
            <button
              key={i}
              type="button"
              className={open === i ? 'north-strip-heading is-open' : 'north-strip-heading'}
              aria-expanded={open === i}
              aria-controls={open === i ? id : undefined}
              onClick={() => setOpen(o => (o === i ? null : i))}
            >
              {section.heading}
            </button>
          ),
        )}
      </div>
      {current && (
        <div id={id} className="north-strip-more">
          <p className="north-strip-lines">{current.lines.join('\n')}</p>
        </div>
      )}
    </div>
  )
}
