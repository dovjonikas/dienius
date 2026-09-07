import { useEffect, useRef, useState } from 'react'
import type { Template } from '../../lib/types'
import { actions, getData, useAppData } from '../../lib/store'
import { offerUndo } from '../../lib/undo'

export interface TemplateRailProps {
  /** The day currently open in the day view - the one a chip stamps. */
  date: string
}

/**
 * How long "Already on this day" stays under the chips before it goes on
 * its own. Long enough to be read after a glance at the day, short enough
 * that it is gone before the next thing somebody does, since a line that
 * is still there a minute later reads as a state rather than an answer.
 */
const NOTE_MS = 3000

/** The question a press asks before it replaces one template with another. */
interface Ask {
  fromName: string
  toId: string
  toName: string
}

/**
 * Lists data.templates as coloured chips, in place of Sunsama's CHANNELS
 * list - docs/LAYOUT-WIDE.md section 3.1. A chip calls the same
 * actions.stamp the calendar's own stamp bar already calls, against the
 * date currently open here - this does not add a decision, stamping
 * already happens through the Calendar tab, this removes a detour.
 *
 * Three answers to a press, decided here and nowhere else; actions.stamp
 * and the calendar's own doors are untouched:
 *
 * - A day with no template is stamped at once, whatever it holds by hand.
 * - The chip of the template already on the day changes nothing: no commit,
 *   no undo offer, one quiet line saying so. Stamping a template over
 *   itself was harmless (applyStamps matches every block the day already
 *   holds) but it offered an undo for nothing, and an undo toast after a
 *   press that did nothing teaches people the toast means nothing.
 * - Another template over a day that already carries one asks first. This
 *   is the one press in the rail that replaces work: the blocks the old
 *   template put there go, and a day half lived is not something a chip
 *   two inches from the month should rewrite on a slip of the mouse. Blocks
 *   added by hand survive either way, and the question says so.
 *
 * Additive-only still: there is no un-stamp press here, and clearing a
 * stamp stays a Calendar-tab action, unchanged. Rendered only when
 * useIsWide() is true, and only once there is at least one template to
 * show - see DayView.tsx.
 */
export function TemplateRail({ date }: TemplateRailProps) {
  const data = useAppData()
  const [note, setNote] = useState(false)
  const [ask, setAsk] = useState<Ask | null>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The chips by template id, so that closing the question can hand focus
  // back to the chip that raised it: Replace and Cancel unmount themselves
  // on the press, and a keyboard left on the body would start its next Tab
  // from the top of the document.
  const chips = useRef(new Map<string, HTMLButtonElement>())

  function stopNote() {
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = null
    setNote(false)
  }

  // A line about one day must not survive into the next: the question
  // clears when the open day changes, and the note with it.
  useEffect(() => {
    setAsk(null)
    stopNote()
  }, [date])

  // The timer must not fire into a rail that is no longer there.
  useEffect(
    () => () => {
      if (noteTimer.current) clearTimeout(noteTimer.current)
    },
    [],
  )

  if (data.templates.length === 0) return null
  const day = data.days[date]
  const currentTemplateId = day?.templateId
  const current = data.templates.find(t => t.id === currentTemplateId)
  // A dangling id - the template was deleted - reads as no template
  // everywhere else, but the blocks it stamped are still on the day, and a
  // stamp over them takes every one. That day is not empty; it asks like
  // any other day with a template, under a name that says what happened.
  const carriesBlocks = !!currentTemplateId && (day?.tasks ?? []).some(t => t.fromTemplate)

  /**
   * Stamping is the one action here that can silently overwrite work: a day
   * already half filled in is replaced by the template's own blocks. It has
   * to be reversible, and the whole day is what has to come back - the blocks
   * that arrived, the ones that were replaced, and the templateId that says
   * where the day came from.
   */
  function stampWithUndo(templateId: string, name: string) {
    const before = getData().days[date]
    actions.stamp({ [date]: templateId })
    offerUndo(`Stamped ${name}`, () =>
      before ? actions.replaceDay(date, before) : actions.replaceDay(date, { date, tasks: [] }),
    )
  }

  function press(template: Template) {
    // Whatever the last press left under the chips goes before this one is
    // answered - two lines under the chips would be two answers to two
    // questions, only one of which is still being asked.
    stopNote()
    setAsk(null)
    if (!current && !carriesBlocks) {
      stampWithUndo(template.id, template.name)
      return
    }
    if (current && current.id === template.id) {
      setNote(true)
      noteTimer.current = setTimeout(() => {
        noteTimer.current = null
        setNote(false)
      }, NOTE_MS)
      return
    }
    setAsk({
      fromName: current?.name ?? 'a template that is gone',
      toId: template.id,
      toName: template.name,
    })
  }

  function closeAsk() {
    if (!ask) return
    setAsk(null)
    chips.current.get(ask.toId)?.focus()
  }

  function replace() {
    if (!ask) return
    stampWithUndo(ask.toId, ask.toName)
    closeAsk()
  }

  return (
    <div className="template-rail">
      <h3>Templates</h3>
      <div className="template-rail-chips">
        {data.templates.map(t => (
          <button
            key={t.id}
            type="button"
            className={t.id === currentTemplateId ? 'template-chip selected' : 'template-chip'}
            aria-pressed={t.id === currentTemplateId}
            style={{ ['--chip' as string]: t.color } as React.CSSProperties}
            ref={el => {
              if (el) chips.current.set(t.id, el)
              else chips.current.delete(t.id)
            }}
            onClick={() => press(t)}
          >
            <span className="template-chip-dot" aria-hidden="true" />
            {t.name}
          </button>
        ))}
      </div>
      {note && (
        <p className="template-rail-note" role="status">
          Already on this day
        </p>
      )}
      {ask && (
        <div className="template-rail-ask">
          <p role="status">
            Replace {ask.fromName} with {ask.toName}? Blocks you added by hand stay.
          </p>
          <div className="template-rail-ask-actions">
            <button type="button" className="btn-secondary" onClick={replace}>
              Replace
            </button>
            <button type="button" className="link-button" onClick={closeAsk}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
