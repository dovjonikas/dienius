import { dismissUndo, runUndo, useUndo } from '../lib/undo'

/**
 * The one undo offer, at the root of the app.
 *
 * Fixed to the bottom of the window rather than placed in a layout, because
 * what it undoes could have happened on any tab - a task deleted on the day
 * view, an item removed from the library, a template stamped over a day from
 * the calendar - and the offer has to be findable without hunting for it.
 *
 * `role="status"` rather than `alert`: it is an offer, not a warning, and it
 * should not interrupt whatever a screen reader is already saying. Its text
 * says what happened, so hearing it is enough to know whether to reach for
 * the button.
 */
export function UndoToast() {
  const undo = useUndo()
  if (!undo) return null

  return (
    <div className="undo-toast" role="status">
      <span className="undo-toast-text">{undo.label}</span>
      <button type="button" className="undo-toast-button" onClick={runUndo}>
        Undo
      </button>
      <button type="button" className="undo-toast-dismiss" aria-label="Dismiss" onClick={dismissUndo}>
        &times;
      </button>
    </div>
  )
}
