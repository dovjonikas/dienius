/**
 * The note a template block carries onto every day it stamps.
 *
 * It exists because a template could only ever bring a title and a time. The
 * owner's words were that a meal block should arrive with the recipe on it -
 * and until `TemplateBlock.note` existed, text written into a template
 * reached no day at all: `applyStamps` read the note off the matching prior
 * task, which on a fresh day is nothing. See the stamping rule in
 * `stamping.ts`, which is `match?.note ?? b.note`.
 *
 * **Closed unless asked.** A block that carries nothing looks exactly as it
 * did before this existed - one small word at the end of its row. Most blocks
 * are a title and a time and always will be, and a textarea under every one
 * of them would be a form where there was a list.
 *
 * It held a list of steps beside the note until v2.13. In a year of use the
 * list was never the thing anybody reached for and the note always was, so
 * there is one place text goes now - see lib/stepsToNote.ts for what happened
 * to the lists that already existed.
 *
 * The button says whether there is anything behind it, because a note nobody
 * can see from the outside is a note nobody remembers writing.
 */
export function blockCarries(note: string | undefined): boolean {
  return Boolean(note?.trim())
}

export function BlockNoteButton({
  note,
  open,
  label,
  onToggle,
}: {
  note?: string
  open: boolean
  /** What this block is, for somebody listening rather than looking. */
  label: string
  onToggle: () => void
}) {
  const carries = blockCarries(note)
  return (
    <button
      type="button"
      className={carries ? 'block-note-toggle has-note' : 'block-note-toggle'}
      aria-expanded={open}
      aria-label={carries ? `Open the note on ${label}` : `Add a note to ${label}`}
      onClick={onToggle}
    >
      Note
    </button>
  )
}

/**
 * The panel itself.
 *
 * Plain text, deliberately: line breaks and nothing else. A markdown engine
 * here would mean a template note and a task note render differently, and
 * `TaskDetail` shows a note as the lines somebody typed. What the owner asked
 * for was a recipe in a block, and a recipe is a list of lines.
 */
export function BlockNotePanel({
  note,
  label,
  expanded = false,
  onNote,
  onExpanded,
}: {
  note?: string
  label: string
  expanded?: boolean
  onNote: (next: string) => void
  onExpanded?: (next: boolean) => void
}) {
  return (
    <div className="block-note">
      <label className="field">
        <span className="field-label">Note</span>
        <textarea
          className="block-note-text"
          rows={3}
          value={note ?? ''}
          aria-label={`Note on ${label}`}
          placeholder="What this block is, in the words you would say to yourself"
          onChange={e => onNote(e.target.value)}
        />
      </label>
      {/* One line, here rather than in Settings: it is a fact about this
          block and not a preference about all of them. A meal block whose
          recipe is the reason you look at the card says so; the rest stay
          behind their mark. */}
      {onExpanded && (
        <label className="block-note-expand">
          <input type="checkbox" checked={expanded} onChange={e => onExpanded(e.target.checked)} />
          <span className="check" aria-hidden="true" />
          <span>Show this note without opening it</span>
        </label>
      )}
    </div>
  )
}
