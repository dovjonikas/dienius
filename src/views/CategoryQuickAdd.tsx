import { useState } from 'react'
import { actions } from '../lib/store'
import { CATEGORY_PALETTE, categoryColorName, resolvedColor } from '../lib/categories'
import type { Category, CategoryId } from '../lib/categories'
import { useRestoreFocus } from '../lib/useRestoreFocus'

/**
 * A category, made where it is needed.
 *
 * Building a week is when somebody discovers they want a colour for
 * something, and until this existed the answer was to leave the editor,
 * go to Settings, make it, come back, and find the draft gone. That is
 * four screens for a word and a colour, in the middle of the one job the
 * app exists for.
 *
 * **The curated palette, and no colour wheel.** Settings has a wheel
 * because that is a place somebody has gone deliberately, with the
 * readability warning in front of them. Here the whole point is speed, and
 * a wheel at speed is how you end up with a category whose 2px edge on a
 * card and whose dot in a month cell cannot be seen - which is the reason
 * `isCategoryColorReadable` exists at all. Every colour offered here
 * already passes it.
 *
 * **A colour already in use is still offered**, named for the category that
 * has it. Two things can share a colour if that is what somebody wants; the
 * app's job is to say so, not to refuse.
 *
 * Deleting stays in Settings. It asks what happens to the tasks that were
 * in the category, and that question does not belong on a row of swatches.
 */
export function CategoryQuickAdd({
  categories,
  onMade,
  label = 'Make a category',
}: {
  categories: Category[]
  /** The new or edited one, so the caller can select it for what it is on. */
  onMade: (id: CategoryId) => void
  label?: string
}) {
  const [open, setOpen] = useState<null | { id?: CategoryId }>(null)
  return (
    <>
      <button
        type="button"
        className="category-swatch is-add"
        aria-expanded={open !== null}
        aria-label={label}
        data-tip={label}
        onClick={() => setOpen(open === null ? {} : null)}
      >
        +
      </button>
      {open !== null && (
        <CategorySheet
          categories={categories}
          editing={open.id ? categories.find(c => c.id === open.id) : undefined}
          onDone={id => {
            if (id) onMade(id)
            setOpen(null)
          }}
        />
      )}
    </>
  )
}

/**
 * The small sheet: a name, and the palette as a grid of round swatches.
 *
 * Not a row of dots. Nine colours in a line read as a setting somebody has
 * to squint at; a grid of them with the name under the pointer reads as a
 * choice. The chosen one carries the same ring every other picker in this
 * app uses - see `.accent-swatch.selected` in styles.css.
 */
function CategorySheet({
  categories,
  editing,
  onDone,
}: {
  categories: Category[]
  editing?: Category
  onDone: (id?: CategoryId) => void
}) {
  useRestoreFocus()
  const [label, setLabel] = useState(editing?.label ?? '')
  const [color, setColor] = useState(editing ? resolvedColor(editing) : CATEGORY_PALETTE[0].value)

  /** Which category already has a given colour, if any but this one. */
  const heldBy = (value: string) =>
    categories.find(c => c.id !== editing?.id && resolvedColor(c).toLowerCase() === value.toLowerCase())

  function save() {
    const name = label.trim()
    if (!name) return
    if (editing) {
      actions.updateCategory(editing.id, { label: name, color })
      onDone(editing.id)
      return
    }
    const made = actions.addCategory({ label: name, color })
    onDone(made?.id)
  }

  return (
    <div
      className="category-quick"
      role="dialog"
      aria-label={editing ? `Edit ${editing.label}` : 'A new category'}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onDone()
        }
      }}
    >
      <label className="field">
        <span className="field-label">Name</span>
        <input
          autoFocus
          value={label}
          maxLength={40}
          placeholder="Deep work"
          aria-label="Category name"
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
        />
      </label>
      <div className="field">
        <span className="field-label">Colour</span>
        <div className="category-quick-grid" role="group" aria-label="Colour">
          {CATEGORY_PALETTE.map(c => {
            const taken = heldBy(c.value)
            return (
              <button
                key={c.value}
                type="button"
                className={color === c.value ? 'category-swatch selected' : 'category-swatch'}
                style={{ ['--cat' as string]: c.value } as React.CSSProperties}
                aria-pressed={color === c.value}
                // The name of the colour, and whose it already is - said in
                // the label rather than only in the bubble, so it reaches
                // somebody who is not looking at the pointer.
                aria-label={taken ? `${c.name}, already ${taken.label}` : c.name}
                data-tip={taken ? `${c.name} - already ${taken.label}` : c.name}
                onClick={() => setColor(c.value)}
              />
            )
          })}
        </div>
        <span className="setting-state">{categoryColorName(color)}</span>
      </div>
      <div className="category-quick-actions">
        <button type="button" className="btn-primary" disabled={!label.trim()} onClick={save}>
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
 * The pencil on the chosen swatch: rename or recolour without leaving.
 *
 * Only on the one that is chosen, because a pencil on every swatch is six
 * more controls on a row that already has six - CONVENTIONS section 25. The
 * one you are on is the one you are about to want to fix.
 */
export function CategoryEdit({ category, categories }: { category: Category; categories: Category[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="category-edit"
        aria-expanded={open}
        aria-label={`Edit ${category.label}`}
        data-tip={`Edit ${category.label}`}
        onClick={() => setOpen(o => !o)}
      >
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M13.5 3.5 16.5 6.5 7 16H4v-3z" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <CategorySheet categories={categories} editing={category} onDone={() => setOpen(false)} />
      )}
    </>
  )
}
