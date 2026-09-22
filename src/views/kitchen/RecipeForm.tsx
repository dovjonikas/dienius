import { useEffect, useId, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { MEAL_TYPE_LABELS, type RecipeInput } from '../../lib/kitchen'
import { mealWordsOf, mealsFromName, namePrefix } from '../../lib/mealWords'
import { clearRecipeNumber, recipeNumbers, writeRecipeNumber } from '../../lib/recipeNumbers'
import { MEAL_TYPES, type MealType, type Recipe } from '../../lib/types'

/** The numbers the form asks for, each as the text in its field. */
type NumberName = 'kcal' | 'protein' | 'carbs' | 'fat' | 'servings' | 'minutes'

const NUMBER_NAMES: NumberName[] = ['kcal', 'protein', 'carbs', 'fat', 'servings', 'minutes']

/** A field's words: a whole number, or a number in grams with its unit said. */
const NUMBER_LABELS: Record<NumberName, string> = {
  kcal: 'kcal',
  protein: 'Protein (g)',
  carbs: 'Carbs (g)',
  fat: 'Fat (g)',
  servings: 'Servings',
  minutes: 'Minutes',
}

/**
 * A recipe, written - Kitchen, since v2.27.
 *
 * Two fields are the recipe: its name, and one large field for everything
 * else, read by the capitals rule the grey line under it says once. The name
 * alone is enough to save one, since v2.30. More opens the rest, which a recipe has when somebody
 * knows it: the meals it is for, as chips, several at once; kcal, protein,
 * carbs and fat for a serving; how many servings; how long. Editing a recipe
 * that has any of them opens with More open, so nothing it holds is hidden.
 *
 * **The text and the numbers are one truth** (CONVENTIONS 16), since v2.30:
 * a number typed into the text beside its word - "450 kcal", "Serves 2" -
 * fills its field, and More opens so the filled fields are seen; a field
 * changed rewrites the number the text says, and a field cleared takes it out
 * of the text. A field the text says nothing about is filled by hand, as
 * before. lib/recipeNumbers.ts reads and writes the numbers.
 *
 * **A name can say its meals**, since v2.32: a name typed with a first word
 * and a colon - "Lunch: a bean bowl" - chooses the meals that word says in
 * Settings (lib/mealWords.ts), and More opens so they are seen. Chosen when
 * the word is typed or changed, and not again while it stays, so a press on
 * the chips after it is kept.
 *
 * Save waits, in its place, until there is a name; Cancel is
 * always beside it. Ctrl or Cmd with Enter is Save and Escape is Cancel, the
 * way North's field works. What the fields hold becomes a recipe through
 * `cleanRecipe` - a number that is not one, or is out of bounds, is simply
 * left out. On an existing recipe Delete stands at the row's other end and
 * asks a second time; the list offers it back after.
 */
export function RecipeForm({
  recipe,
  onSaved,
  onCancel,
  onDelete,
}: {
  recipe?: Recipe
  onSaved: (id: string) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const words = mealWordsOf(useAppData().settings)
  const [title, setTitle] = useState(recipe?.title ?? '')
  const [text, setText] = useState(recipe?.text ?? '')
  const [meals, setMeals] = useState<MealType[]>(recipe?.mealTypes ?? [])
  const [numbers, setNumbers] = useState<Record<NumberName, string>>(() =>
    Object.fromEntries(NUMBER_NAMES.map(name => [name, recipe?.[name] === undefined ? '' : String(recipe[name])])) as Record<NumberName, string>,
  )
  const [more, setMore] = useState(() => meals.length > 0 || NUMBER_NAMES.some(name => numbers[name] !== ''))
  const [armed, setArmed] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const ruleId = useId()
  const mealsId = useId()
  const canSave = title.trim() !== ''

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  function input(): RecipeInput {
    const number = (name: NumberName) => (numbers[name].trim() === '' ? undefined : Number(numbers[name]))
    return {
      title,
      text,
      mealTypes: meals,
      kcal: number('kcal'),
      protein: number('protein'),
      carbs: number('carbs'),
      fat: number('fat'),
      servings: number('servings'),
      minutes: number('minutes'),
    }
  }

  function save() {
    if (!canSave) return
    if (recipe) {
      actions.updateRecipe(recipe.id, input())
      onSaved(recipe.id)
      return
    }
    const made = actions.addRecipe(input())
    if (made) onSaved(made.id)
  }

  /** The name as typed, and the meals a first word typed or changed says. */
  function changeTitle(next: string) {
    setTitle(next)
    const now = namePrefix(next)?.toLocaleLowerCase()
    if (now === undefined || now === namePrefix(title)?.toLocaleLowerCase()) return
    const said = mealsFromName(next, words)
    if (said === undefined) return
    setMeals(said)
    setMore(true)
  }

  /** The text as typed, and every number it says read into its field. */
  function changeText(next: string) {
    setText(next)
    const said = recipeNumbers(next)
    const read = NUMBER_NAMES.filter(name => said[name] !== undefined)
    if (read.length === 0) return
    setNumbers(current => ({ ...current, ...Object.fromEntries(read.map(name => [name, String(said[name]!.value)])) }))
    setMore(true)
  }

  /** A field as typed, and the number the text says for it rewritten, or taken out when the field is cleared. */
  function changeNumber(name: NumberName, value: string) {
    setNumbers(current => ({ ...current, [name]: value }))
    if (recipeNumbers(text)[name] === undefined) return
    if (value.trim() === '') {
      setText(clearRecipeNumber(text, name))
      return
    }
    const number = Number(value)
    if (Number.isFinite(number) && number >= 0) setText(writeRecipeNumber(text, name, number))
  }

  function toggleMeal(meal: MealType) {
    setMeals(current => (current.includes(meal) ? current.filter(m => m !== meal) : [...current, meal]))
  }

  function numberField(name: NumberName) {
    return (
      <label key={name} className="field kitchen-number">
        <span className="field-label">{NUMBER_LABELS[name]}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={numbers[name]}
          onChange={e => changeNumber(name, e.target.value)}
        />
      </label>
    )
  }

  return (
    <>
      <div className="library-header">
        <h2>{recipe ? 'Edit recipe' : 'New recipe'}</h2>
      </div>

      <form
        className="library-list kitchen-form"
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
          if (e.key === 'Escape') {
            // Stopped here, or one press would close the form and whatever is
            // under it together - CONVENTIONS section 13.
            e.preventDefault()
            e.stopPropagation()
            onCancel()
          }
        }}
      >
        <label className="field">
          <span className="field-label">Name</span>
          <input ref={nameRef} value={title} onChange={e => changeTitle(e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">Recipe</span>
          <textarea
            className="kitchen-text"
            rows={12}
            aria-describedby={ruleId}
            value={text}
            onChange={e => changeText(e.target.value)}
          />
        </label>
        <p id={ruleId} className="kitchen-rule">
          A line in capitals is a heading. Under INGREDIENTS each line is an ingredient, and under STEPS each line is a step.
          Anywhere else, 450 kcal or Serves 2 fills its field under More.
        </p>

        <button type="button" className="btn-quiet kitchen-more" aria-expanded={more} onClick={() => setMore(open => !open)}>
          More
          <span className="kitchen-more-caret" aria-hidden="true" />
        </button>

        {more && (
          <div className="kitchen-more-fields">
            <div className="field">
              <span className="kitchen-group-label" id={mealsId}>
                Meals
              </span>
              <div className="duration-chips kitchen-meal-chips" role="group" aria-labelledby={mealsId}>
                {MEAL_TYPES.map(meal => (
                  <button
                    key={meal}
                    type="button"
                    className={meals.includes(meal) ? 'is-on' : ''}
                    aria-pressed={meals.includes(meal)}
                    onClick={() => toggleMeal(meal)}
                  >
                    {MEAL_TYPE_LABELS[meal]}
                  </button>
                ))}
              </div>
            </div>
            <div className="kitchen-numbers">{(['servings', 'minutes'] as const).map(numberField)}</div>
            <fieldset className="kitchen-numbers">
              <legend className="kitchen-group-label">Per serving</legend>
              {(['kcal', 'protein', 'carbs', 'fat'] as const).map(numberField)}
            </fieldset>
          </div>
        )}

        <div className="kitchen-form-actions">
          {onDelete && (
            <button
              type="button"
              className={armed ? 'btn-danger is-armed kitchen-delete' : 'btn-danger kitchen-delete'}
              onClick={() => (armed ? onDelete() : setArmed(true))}
              onBlur={() => setArmed(false)}
            >
              {armed ? 'Delete?' : 'Delete'}
            </button>
          )}
          <button type="button" className="btn-quiet kitchen-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!canSave}>
            Save
          </button>
        </div>
      </form>
    </>
  )
}
