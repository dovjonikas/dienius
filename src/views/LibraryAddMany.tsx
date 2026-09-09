import { useMemo, useState } from 'react'
import { actions } from '../lib/store'
import { parsePastedItems, unitPlural } from '../lib/library'
import type { LibraryList } from '../lib/types'

/**
 * A whole list, pasted in at once.
 *
 * The wall this exists for, in the owner's words: twenty-eight books, one at
 * a time, through a field that clears itself between each. Nothing about that
 * is hard and all of it is tedious, which is the exact shape of thing that
 * stops a list from ever being filled in at all - and an empty list is a
 * reading block that stamps its own title forever.
 *
 * **Folded until asked for**, beside the add line rather than instead of it.
 * One book is still one line typed into the field above; this is for the
 * afternoon somebody sits down with a shelf.
 *
 * The rules are in `parsePastedItems` and the whole of the interface is here
 * to say what they will do *before* the press: how many will be added, and
 * how many of them the list already has. A count that only appears afterwards
 * is a count nobody can act on.
 */
export function LibraryAddMany({ list }: { list: LibraryList }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  // Read on every keystroke rather than on the press: the two lines under the
  // box are the whole point, and a preview that arrives after the fact is not
  // a preview.
  const parsed = useMemo(() => parsePastedItems(text, list.items), [text, list.items])

  if (!open) {
    return (
      <button type="button" className="btn-secondary library-add-many-open" onClick={() => setOpen(true)}>
        Add many
      </button>
    )
  }

  const count = parsed.items.length

  return (
    <div className="library-add-many">
      <label className="field">
        <span className="field-label">One a line</span>
        <textarea
          className="library-add-many-text"
          autoFocus
          value={text}
          aria-label={`Paste a list into ${list.name}, one a line`}
          placeholder={`Something good\nAnother one | 34\nA third`}
          onChange={e => setText(e.target.value)}
        />
      </label>

      {/* What a bar does, said the way the note editor says what "## " does:
          one quiet line, no tooltip, no help button. */}
      <p className="library-add-many-rule">
        A number after a bar is how many {unitPlural(list)} it has.
      </p>

      <p className="library-add-many-count" aria-live="polite">
        {count === 0 ? 'Nothing to add yet' : `${count} ${count === 1 ? 'item' : 'items'} will be added`}
        {/* Never a blocker, and never silent either. The app does not decide
            for somebody, and it does not make doubles behind their back. */}
        {parsed.duplicates > 0 && (
          <span className="library-add-many-dupes">
            {' '}
            &middot; {parsed.duplicates} already in this list
          </span>
        )}
      </p>

      <div className="library-add-many-actions">
        <button
          type="button"
          className="primary"
          disabled={count === 0}
          onClick={() => {
            actions.addLibraryItemsMany(list.id, parsed.items)
            setText('')
            setOpen(false)
          }}
        >
          Add {count > 0 ? count : ''}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setText('')
            setOpen(false)
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
