import { useRef, useState } from 'react'
import { actions, useAppData } from '../lib/store'
import {
  CATEGORY_PALETTE,
  HEX_COLOR,
  categoryColorName,
  hasBuiltInColor,
  isCategoryColorReadable,
  resolvedColor,
} from '../lib/categories'
import { categorySlice, categoryUsage } from '../lib/store/categories'
import { offerUndo } from '../lib/undo'
import { useListReorder } from './useListReorder'
import type { Category } from '../lib/types'

/**
 * Where the kinds of thing a day is made of are written.
 *
 * The app ships six and it does not own them. The doctrine that a day is only
 * takeable-in-at-a-glance while the palette is about six has not moved - see
 * `RESEARCH-ADHD.md` section 7 - but who decides *which* six has: a planner
 * that will not let somebody rename "Commute" when they work from home is
 * being precious about a decision that was never the app's to keep. So there
 * is no cap here, only the one sentence under the heading saying what the
 * number is for.
 *
 * Editing lives in Settings and nowhere else, for the same reason North's
 * does: the swatch row under quick-add is a picker, not an editor, and a
 * thing you can rewrite from the screen you look at every morning is a thing
 * you will rewrite on a bad morning.
 */
export function CategorySettings() {
  const data = useAppData()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const categories = data.categories
  const reorder = useListReorder(listRef, (id, to) => {
    const from = categories.findIndex(c => c.id === id)
    if (from >= 0) actions.reorderCategories(from, to)
  })

  function nudge(index: number, by: number) {
    const to = index + by
    if (to < 0 || to >= categories.length) return
    actions.reorderCategories(index, to)
  }

  function remove(category: Category, moveTo: string | undefined) {
    const before = categorySlice(data)
    actions.deleteCategory(category.id, moveTo)
    setDeletingId(null)
    offerUndo(`${category.label} deleted`, () => actions.restoreCategories(before))
  }

  return (
    <div className="settings-group" id="settings-categories">
      <h3>Categories</h3>

      <div className="setting-block">
        <div className="setting-label">
          <span className="setting-name">What a day is made of</span>
          <span className="setting-desc">
            The colour on a card's edge and under a block on the timeline. About six is what a day can be
            taken in at a glance with - past that a palette becomes a legend you have to look up. Nothing
            here stops you going further; it is your day.
          </span>
        </div>

        <ul className="category-list" ref={listRef}>
          {categories.map((category, index) => (
            <li
              key={category.id}
              className={[
                'category-row',
                reorder.draggingId === category.id ? 'is-dragging' : '',
                reorder.overIndex === index && reorder.draggingId !== null && reorder.draggingId !== category.id
                  ? 'is-over'
                  : '',
                editingId === category.id || deletingId === category.id ? 'is-editing' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-reorder-index={index}
            >
              {/* A real button, dragged with a finger or moved a place at a
                  time with the arrows - the same grip the library's items
                  carry, for the same reason. The order is what the swatch row
                  under quick-add draws, and there is nothing else it could
                  be: no sort, no priority. */}
              <button
                type="button"
                className="library-item-grip"
                aria-label={`Reorder ${category.label}, position ${index + 1}`}
                onPointerDown={e => reorder.start(category.id, index, e)}
                onKeyDown={e => {
                  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
                  e.preventDefault()
                  nudge(index, e.key === 'ArrowUp' ? -1 : 1)
                }}
              >
                <span className="library-item-grip-dots" aria-hidden="true" />
              </button>

              <span
                className="category-row-dot"
                style={{ ['--cat' as string]: resolvedColor(category) } as React.CSSProperties}
                aria-hidden="true"
              />
              <span className="category-row-label">{category.label}</span>

              <div className="category-row-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setDeletingId(null)
                    setEditingId(editingId === category.id ? null : category.id)
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="setting-remove"
                  disabled={categories.length <= 1}
                  title={categories.length <= 1 ? 'There has to be one' : undefined}
                  onClick={() => {
                    setEditingId(null)
                    setDeletingId(deletingId === category.id ? null : category.id)
                  }}
                >
                  Delete
                </button>
              </div>

              {editingId === category.id && (
                <CategoryForm
                  category={category}
                  onSave={patch => {
                    actions.updateCategory(category.id, patch)
                    setEditingId(null)
                  }}
                  onCancel={() => setEditingId(null)}
                />
              )}

              {deletingId === category.id && (
                <DeleteCategory
                  category={category}
                  onDelete={moveTo => remove(category, moveTo)}
                  onCancel={() => setDeletingId(null)}
                />
              )}
            </li>
          ))}
        </ul>

        {adding ? (
          <div className="category-row is-editing is-new">
            <CategoryForm
              onSave={patch => {
                if (!patch.label || !patch.color) return
                actions.addCategory({ label: patch.label, color: patch.color })
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <div className="category-add">
            <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
              Add a category
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The one thing on this screen with a real decision in it.
 *
 * A delete offers to move what it would otherwise orphan: never a silent
 * loss, never a locked delete. The count is a fact about a button rather than
 * a warning, and it is stated once - nothing uses this category, and the
 * sentence goes and the button reads plain "Delete".
 */
function DeleteCategory({
  category,
  onDelete,
  onCancel,
}: {
  category: Category
  onDelete: (moveTo: string | undefined) => void
  onCancel: () => void
}) {
  const data = useAppData()
  const others = data.categories.filter(c => c.id !== category.id)
  const usage = categoryUsage(data, category.id)
  const total = usage.tasks + usage.blocks + usage.backlog
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '')

  return (
    <div className="category-delete" role="group" aria-label={`Delete ${category.label}`}>
      <p className="category-delete-title">Delete {category.label}?</p>
      {total > 0 && <p className="category-delete-count">{usageSentence(usage)} use it.</p>}
      {total > 0 && others.length > 0 && (
        <div className="category-delete-move">
          <span className="field-label">Move them to</span>
          {/* Swatches rather than a dropdown: the answers are a fixed set and
              they are colours, which is exactly the case CONVENTIONS section
              16 is about. The first remaining one is already chosen, so the
              ordinary path is one press. */}
          <div className="category-picker" role="group" aria-label="Move them to">
            {others.map(c => (
              <button
                key={c.id}
                type="button"
                className={c.id === moveTo ? 'category-swatch selected' : 'category-swatch'}
                style={{ ['--cat' as string]: resolvedColor(c) } as React.CSSProperties}
                aria-pressed={c.id === moveTo}
                aria-label={c.label}
                title={c.label}
                onClick={() => setMoveTo(c.id)}
              />
            ))}
          </div>
        </div>
      )}
      <div className="category-form-actions">
        <button type="button" className="btn-danger is-armed" onClick={() => onDelete(total > 0 ? moveTo : undefined)}>
          {total > 0 ? 'Delete and move' : 'Delete'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Keep it
        </button>
      </div>
    </div>
  )
}

/** "14 tasks, 2 template blocks and 1 backlog item" - only the parts that are not zero. */
export function usageSentence(usage: { tasks: number; blocks: number; backlog: number }): string {
  const parts: string[] = []
  if (usage.tasks > 0) parts.push(`${usage.tasks} ${usage.tasks === 1 ? 'task' : 'tasks'}`)
  if (usage.blocks > 0) parts.push(`${usage.blocks} ${usage.blocks === 1 ? 'template block' : 'template blocks'}`)
  if (usage.backlog > 0) parts.push(`${usage.backlog} ${usage.backlog === 1 ? 'backlog item' : 'backlog items'}`)
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

interface CategoryFormProps {
  category?: Category
  onSave: (patch: { label?: string; color?: string | null }) => void
  onCancel: () => void
}

/**
 * A name and a colour.
 *
 * The colour is twelve swatches and a wheel behind them. CONVENTIONS section
 * 16 says a person chooses rather than types wherever the answers are a fixed
 * set; a colour wheel is the one case where they are not, so a native
 * `<input type="color">` is the honest escape hatch rather than a control
 * that has not been built yet.
 *
 * A colour that will not read is refused, not clamped, and the form says so
 * before Save rather than after. "The app's own colour" is offered only for
 * one of the six the app ships, because only those have a dark/light pair in
 * the stylesheet to come back to - and it has to exist, because somebody who
 * tries a green Health and dislikes it should not have to remember the
 * original hex.
 */
function CategoryForm({ category, onSave, onCancel }: CategoryFormProps) {
  const [label, setLabel] = useState(category?.label ?? '')
  const [color, setColor] = useState<string | null>(category?.color ?? null)
  const canClear = category !== undefined && hasBuiltInColor(category.id)
  const readable = color === null || isCategoryColorReadable(color)
  const canSave = label.trim().length > 0 && readable && (canClear || color !== null)

  return (
    <div className="category-form">
      <label className="field">
        <span className="field-label">Name</span>
        <input
          autoFocus
          value={label}
          maxLength={40}
          placeholder="Deep work"
          onChange={e => setLabel(e.target.value)}
        />
      </label>

      <div className="field">
        <span className="field-label">Colour</span>
        <div className="category-picker is-palette" role="group" aria-label="Colour">
          {canClear && (
            <button
              type="button"
              className={color === null ? 'category-swatch is-none selected' : 'category-swatch is-none'}
              style={{ ['--cat' as string]: `var(--cat-${category.id})` } as React.CSSProperties}
              aria-pressed={color === null}
              aria-label="The app's own colour"
              title="The app's own colour - one value for dark, one for light"
              onClick={() => setColor(null)}
            />
          )}
          {CATEGORY_PALETTE.map(c => (
            <button
              key={c.value}
              type="button"
              className={color === c.value ? 'category-swatch selected' : 'category-swatch'}
              style={{ ['--cat' as string]: c.value } as React.CSSProperties}
              aria-pressed={color === c.value}
              aria-label={c.name}
              title={c.name}
              onClick={() => setColor(c.value)}
            />
          ))}
          <label className="category-wheel" title="Any other colour">
            <span className="visually-hidden">Any other colour</span>
            <input
              type="color"
              value={color && HEX_COLOR.test(color) ? color : '#5b8ae6'}
              onChange={e => setColor(e.target.value)}
            />
          </label>
        </div>
        {color !== null && <span className="setting-state">{categoryColorName(color)}</span>}
        {/* Said where it can be acted on, and only once something has actually
            been picked that will not work. Refusing without saying why is how
            a person concludes the button is broken. */}
        {!readable && (
          <span className="setting-state is-warning">
            That one will not read as a title on its own block. Try a stronger version of it.
          </span>
        )}
      </div>

      <div className="category-form-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={!canSave}
          onClick={() => onSave({ label, color })}
        >
          {category ? 'Save' : 'Add it'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
