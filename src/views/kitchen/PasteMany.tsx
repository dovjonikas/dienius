import { useEffect, useMemo, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { mealWordsOf } from '../../lib/mealWords'
import { readPastedRecipes, type ImportRow, type ImportState } from '../../lib/recipeImport'
import { offerUndo } from '../../lib/undo'
import type { MealType } from '../../lib/types'
import { MealsPicker } from './MealsPicker'

/** What a row says it will do. */
const STATE_WORDS: Record<ImportState, string> = {
  new: 'New',
  update: 'Updates the one in Kitchen',
  untitled: 'No name: start it with NAME:',
  repeated: 'Again further down, which is saved',
}

/** A row's name while the text above it is edited: its place and its name. */
const rowKey = (row: ImportRow) => `${row.key}:${row.title}`

/**
 * Many recipes at once - Kitchen, since v2.32.
 *
 * The wall this is for: thirty recipes already written in Kitchen's own shape
 * - a line of numbers, INGREDIENTS, STEPS - and each one a trip through New
 * recipe. Here they are pasted as one text, a line that starts NAME: or a line
 * of --- between them, and read on every keystroke into the list under the
 * field (lib/recipeImport.ts): each recipe's name, its kcal and protein, the
 * meals its name's first word says, and what saving it will do. A row can be
 * left out with its box, and its meals changed in the row; a name Kitchen
 * already has writes over that recipe rather than making a second one, and the
 * row says so before the press. One Save saves every row that is ticked, and
 * the list offers it back as one undo.
 */
export function PasteMany({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const data = useAppData()
  const [text, setText] = useState('')
  const [left, setLeft] = useState<ReadonlySet<string>>(new Set())
  const [meals, setMeals] = useState<Readonly<Record<string, MealType[]>>>({})
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  const words = mealWordsOf(data.settings)
  const rows = useMemo(() => readPastedRecipes(text, data.recipes, words), [text, data.recipes, words])
  const saveable = (row: ImportRow) => row.state === 'new' || row.state === 'update'
  const chosen = rows.filter(row => saveable(row) && !left.has(rowKey(row)))
  const adding = chosen.filter(row => row.state === 'new').length
  const updating = chosen.length - adding

  function save() {
    if (chosen.length === 0) return
    const done = actions.importRecipes(chosen.map(row => ({ ...row.input, mealTypes: meals[rowKey(row)] ?? row.meals, existingId: row.existingId })))
    const said = [done.added > 0 ? `${done.added} added` : '', done.updated > 0 ? `${done.updated} updated` : ''].filter(Boolean).join(', ')
    offerUndo(`Recipes saved: ${said}`, done.undo)
    onDone()
  }

  return (
    <>
      <div className="library-header">
        <h2>Paste many recipes</h2>
      </div>

      <form
        className="library-list kitchen-form kitchen-paste"
        noValidate
        onSubmit={e => {
          e.preventDefault()
          save()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            save()
            return
          }
          if (e.key === 'Escape' && !e.defaultPrevented) {
            e.preventDefault()
            e.stopPropagation()
            onCancel()
          }
        }}
      >
        <label className="field">
          <span className="field-label">Recipes</span>
          <textarea
            ref={fieldRef}
            className="kitchen-text"
            rows={12}
            aria-describedby="kitchen-paste-rule"
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </label>
        <p id="kitchen-paste-rule" className="kitchen-rule">
          Start each recipe with a line NAME: and its name, or put a line of --- between them. Each is read the way New recipe reads
          one, and a first word like Lunch: chooses its meals.
        </p>

        {rows.length > 0 && (
          <ul className="kitchen-paste-rows" aria-label="What Save will do">
            {rows.map(row => {
              const key = rowKey(row)
              const can = saveable(row)
              const name = row.title || 'No name'
              const numbers = [row.kcal !== undefined ? `${row.kcal} kcal` : '', row.protein !== undefined ? `${row.protein} g protein` : '']
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={key} className={can ? 'kitchen-paste-row' : 'kitchen-paste-row is-out'}>
                  <input
                    type="checkbox"
                    className="kitchen-paste-check"
                    aria-label={`Save ${name}`}
                    checked={can && !left.has(key)}
                    disabled={!can}
                    onChange={e =>
                      setLeft(was => {
                        const next = new Set(was)
                        if (e.target.checked) next.delete(key)
                        else next.add(key)
                        return next
                      })
                    }
                  />
                  <span className="kitchen-paste-name">{name}</span>
                  <span className="kitchen-paste-state">{STATE_WORDS[row.state]}</span>
                  <span className="kitchen-paste-numbers">{numbers || 'No numbers'}</span>
                  {can && (
                    <MealsPicker
                      meals={meals[key] ?? row.meals}
                      label={`Meals for ${name}`}
                      onChange={next => setMeals(was => ({ ...was, [key]: next }))}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="kitchen-form-actions">
          <p className="kitchen-paste-count" aria-live="polite">
            {chosen.length === 0
              ? 'Nothing to save yet'
              : [adding > 0 ? `${adding} new` : '', updating > 0 ? `${updating} updated` : ''].filter(Boolean).join(', ')}
          </p>
          <button type="button" className="btn-quiet kitchen-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={chosen.length === 0}>
            Save
          </button>
        </div>
      </form>
    </>
  )
}
