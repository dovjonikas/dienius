import { useId, useState } from 'react'
import { MEAL_TYPE_LABELS, recipeSections, recipesForMeal, type MealRecipes } from '../../lib/kitchen'
import { searchRecipes } from '../../lib/search'
import { MEAL_TYPES, type MealType, type Recipe } from '../../lib/types'

export type { MealRecipes } from '../../lib/kitchen'

/** The one line a meal's field says: its recipe, its first and how many more, its kind of meal, or no recipe. */
export function recipesSummary(value: MealRecipes, recipes: readonly Recipe[]): string {
  const chosen = (value.recipeIds ?? []).flatMap(id => recipes.filter(r => r.id === id))
  if (chosen.length === 1) return chosen[0].title
  if (chosen.length > 1) return `${chosen[0].title} and ${chosen.length - 1} more`
  if (value.mealType) return `${MEAL_TYPE_LABELS[value.mealType]}, chosen on the day`
  return 'No recipe'
}

/**
 * A meal's recipes, chosen from Kitchen - since v2.30, docs/RESEARCH-KITCHEN.md
 * section 6.5. It replaces the one select every meal was chosen with, which
 * listed every recipe by name: with a lot of recipes that is a long scroll
 * through names nobody can find in.
 *
 * One line says what the meal holds, and a press on it opens Kitchen in small:
 * a search, the recipes in sections by meal the way Kitchen stands them, and a
 * press on a recipe to add it or take it away. On a template's block the chosen
 * recipes are a walk - each day stamped from the block gets the next - so they
 * stand at the top in the order they come round, each with a way out. Under
 * them, the kinds of meal to leave to the day instead; choosing one takes the
 * recipes away, and choosing a recipe takes the kind away, since a block is one
 * or the other.
 *
 * On a day (`single`) there is one recipe: a press chooses it and the field
 * closes, and a press on the one chosen takes it away again. It has no Done of
 * its own there - it stands in the day's sheet, whose Done closes the sheet,
 * and two Dones one above the other would be a guess which is which.
 *
 * The line names itself - "Recipes for Dinner: Lentil soup and 2 more" - so a
 * screen reader hears what the meal holds; the word beside it on a form is for
 * the eye.
 */
export function RecipesField({
  id,
  label,
  recipes,
  value,
  single = false,
  onChange,
}: {
  /** The summary button's id. */
  id: string
  /** What the field is called - "Recipes for Dinner" - its line and its open panel both. */
  label: string
  recipes: readonly Recipe[]
  value: MealRecipes
  /** A day's meal: one recipe, and choosing it closes the field. */
  single?: boolean
  onChange: (next: MealRecipes) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const panelId = useId()
  const chosen = (value.recipeIds ?? []).filter(recipeId => recipes.some(r => r.id === recipeId))
  const sections = recipeSections(searchRecipes(recipesForMeal(recipes, 'all'), query), 'all')
  const summary = recipesSummary(value, recipes)

  function close() {
    setOpen(false)
    setQuery('')
  }

  function toggle(recipeId: string) {
    if (single) {
      onChange(chosen.includes(recipeId) ? {} : { recipeIds: [recipeId] })
      close()
      return
    }
    const next = chosen.includes(recipeId) ? chosen.filter(other => other !== recipeId) : [...chosen, recipeId]
    onChange(next.length > 0 ? { recipeIds: next } : {})
  }

  function leaveToDay(meal: MealType) {
    onChange(value.mealType === meal ? {} : { mealType: meal })
    if (single) close()
  }

  return (
    <div className="recipes-field">
      <button
        type="button"
        id={id}
        className="recipes-field-summary"
        aria-label={`${label}: ${summary}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="recipes-field-summary-words">{summary}</span>
        <span className="recipes-field-caret" aria-hidden="true" />
      </button>

      {open && (
        <div id={panelId} className="recipes-field-panel" role="group" aria-label={label}>
          <input
            type="search"
            className="recipes-field-search"
            aria-label="Find a recipe"
            placeholder="Find a recipe"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />

          {!single && chosen.length > 0 && (
            <ol className="recipes-field-walk" aria-label="Walked in this order">
              {chosen.map(recipeId => {
                const title = recipes.find(r => r.id === recipeId)!.title
                return (
                  <li key={recipeId} className="recipes-field-walk-item">
                    <span className="recipes-field-walk-title">{title}</span>
                    <button
                      type="button"
                      className="btn-quiet recipes-field-out"
                      aria-label={`Take ${title} out`}
                      onClick={() => toggle(recipeId)}
                    >
                      Take out
                    </button>
                  </li>
                )
              })}
            </ol>
          )}

          <div className="recipes-field-shelf">
            {sections.length > 0 ? (
              sections.map(section => (
                <div key={section.meal} className="recipes-field-section" role="group" aria-label={section.label}>
                  <span className="recipes-field-section-name" aria-hidden="true">
                    {section.label}
                  </span>
                  <div className="duration-chips recipes-field-options">
                    {section.recipes.map(recipe => (
                      <button
                        key={recipe.id}
                        type="button"
                        className={chosen.includes(recipe.id) ? 'is-on' : ''}
                        aria-label={recipe.title}
                        aria-pressed={chosen.includes(recipe.id)}
                        onClick={() => toggle(recipe.id)}
                      >
                        {recipe.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="recipes-field-none">
                {recipes.length === 0 ? 'No recipes in Kitchen yet.' : `No recipe matches "${query.trim()}".`}
              </p>
            )}
          </div>

          <div className="recipes-field-kinds" role="group" aria-label="Or choose on the day">
            <span className="recipes-field-section-name" aria-hidden="true">
              Or choose on the day
            </span>
            <div className="duration-chips recipes-field-options">
              {MEAL_TYPES.map(meal => (
                <button
                  key={meal}
                  type="button"
                  className={value.mealType === meal ? 'is-on' : ''}
                  aria-pressed={value.mealType === meal}
                  onClick={() => leaveToDay(meal)}
                >
                  {MEAL_TYPE_LABELS[meal]}
                </button>
              ))}
            </div>
          </div>

          {!single && (
            <div className="recipes-field-foot">
              <button type="button" className="btn-secondary" onClick={close}>
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
