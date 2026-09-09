import { useState } from 'react'
import { actions } from '../lib/store'
import { suggestShortForm, UNIT_SUGGESTIONS } from '../lib/library'
import { useRestoreFocus } from '../lib/useRestoreFocus'

/**
 * A list, made where a block is about to be bound to one.
 *
 * The same argument `CategoryQuickAdd` was built on, one shelf over. Until
 * this existed the binding control was hidden outright while the library was
 * empty, which is the state every person is in the first time they build a
 * template - so the one moment somebody wants a reading block is the one
 * moment the app shows no sign that reading blocks exist. The answer was to
 * leave the editor, go to the Library tab, make a list, come back, and find
 * the draft gone.
 *
 * **Two answers, not four.** The full form in the Library asks a name, a unit
 * from six chips or a box, and a short form for the card. Here the short form
 * is derived - `suggestShortForm` is right for every unit in the chip row and
 * one keystroke from right for anything else - and the colour is left to the
 * list's own settings, where the swatch row already lives. What is left is
 * the two things nobody else can answer: what it is called and what one of
 * them is.
 *
 * **Not the presets.** The Library's Quick start makes three reading lanes in
 * one press, which is a decision about a shelf rather than about the block in
 * front of you; offering it here would answer a question that was not asked
 * and put three lists on a person who wanted one.
 */
export function LibraryQuickAdd({
  onMade,
  label = 'Make a list',
  worded = false,
}: {
  /** The new list's id, so the caller can bind the block to what it just made. */
  onMade: (id: string) => void
  label?: string
  /**
   * A word rather than a plus, for the one case where there is no select
   * beside it to explain what the plus would add to. A lone `+` after a
   * label reads as "add a block"; "New list" cannot.
   */
  worded?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={worded ? 'library-quick-word' : 'library-quick-round'}
        aria-expanded={open}
        aria-label={label}
        data-tip={worded ? undefined : label}
        onClick={() => setOpen(o => !o)}
      >
        {worded ? 'New list' : '+'}
      </button>
      {open && (
        <LibrarySheet
          onDone={id => {
            if (id) onMade(id)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

/** The small sheet: a name, and what one of them is. */
function LibrarySheet({ onDone }: { onDone: (id?: string) => void }) {
  useRestoreFocus()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')

  function save() {
    const listName = name.trim()
    const listUnit = unit.trim()
    if (!listName || !listUnit) return
    const made = actions.addLibraryList({
      name: listName,
      unit: listUnit,
      // Derived rather than asked. The Library's own form asks, because that
      // is a place somebody went on purpose; this is a detour off a template.
      unitShort: suggestShortForm(listUnit),
    })
    onDone(made.id)
  }

  return (
    <div
      className="library-quick"
      role="dialog"
      aria-label="A new list"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          // Stopped here, or the shell's own Escape chain closes the editor
          // behind this sheet and takes the draft with it.
          e.stopPropagation()
          onDone()
        }
      }}
    >
      <label className="field">
        <span className="field-label">List name</span>
        <input
          autoFocus
          value={name}
          maxLength={40}
          placeholder="Courses"
          aria-label="List name"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
        />
      </label>
      {/* Singular, the same way the Library asks it: that is the form
          somebody thinks in when naming a thing, and the plural is derivable
          from it far more often than the other way round. */}
      <div className="field">
        <span className="field-label">One of them is a</span>
        <div className="duration-chips library-unit-chips" role="group" aria-label="One of them is a">
          {UNIT_SUGGESTIONS.map(word => (
            <button
              key={word}
              type="button"
              className={unit === word ? 'is-on' : ''}
              aria-pressed={unit === word}
              onClick={() => setUnit(word)}
            >
              {word}
            </button>
          ))}
        </div>
        <input
          value={unit}
          onChange={e => setUnit(e.target.value)}
          placeholder="or type one"
          aria-label="Another unit"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
        />
      </div>
      <div className="library-quick-actions">
        <button type="button" className="btn-primary" disabled={!name.trim() || !unit.trim()} onClick={save}>
          Save
        </button>
        <button type="button" className="btn-secondary" onClick={() => onDone()}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * The whole binding control: what this block draws from, and a way to make a
 * list when there is nothing to draw from yet.
 *
 * One component for the three places that compose a block - both editors' add
 * rows and the week editor's open block - because the three had drifted
 * already. The week's add row had the select and the day's had none; the
 * block panel had a visible label and neither add row did; and all three hid
 * the control outright when the library was empty, which is the state a first
 * template is built in.
 *
 * The label is visible everywhere now. It was an `aria-label` on a bare
 * dropdown sitting between the category swatches and Ongoing, which the owner
 * described exactly right: a random dropdown in a row of chips. A select with
 * no words beside it is a control nobody can name, and a control nobody can
 * name is a feature nobody finds.
 */
export function LibraryBindingField({
  id,
  lists,
  value,
  onChange,
}: {
  /** Unique per block, so the label points at this select and not another's. */
  id: string
  lists: { id: string; name: string }[]
  value: string | undefined
  onChange: (listId: string | undefined) => void
}) {
  return (
    <div className="library-binding">
      <label className="library-binding-label" htmlFor={id}>
        Library list
      </label>
      {lists.length > 0 && (
        <select
          id={id}
          className="block-library"
          value={value ?? ''}
          onChange={e => onChange(e.target.value || undefined)}
        >
          <option value="">Nothing</option>
          {lists.map(list => (
            <option key={list.id} value={list.id}>
              From {list.name}
            </option>
          ))}
        </select>
      )}
      {/* Whatever it makes is what this block binds to. Making a list and then
          having to choose it would be two answers to one question. */}
      <LibraryQuickAdd worded={lists.length === 0} onMade={onChange} />
    </div>
  )
}
