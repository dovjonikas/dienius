import { useState } from 'react'
import { useAppData } from '../../lib/store'
import { MEAL_TYPE_LABELS, cookedLabel, macroLine, recipesForMeal, type MealFilter } from '../../lib/kitchen'
import { searchRecipes } from '../../lib/search'
import { MEAL_TYPES, type MealType, type Recipe } from '../../lib/types'

/**
 * Kitchen: the recipes cooked in this house - since v2.27.
 *
 * It looks and feels like the Library, and is built from its parts: the
 * page's name at the top, a row of chips under it, and the list as one card
 * of quiet rows. It keeps its own data, because a recipe has no units to be
 * counted through - `Recipe` in lib/types.ts, and docs/RESEARCH-KITCHEN.md.
 *
 * ## The list
 *
 * The chips are the meals - All and the six - one pressed at a time, and a
 * chip shows the recipes for it. The field at the top of the card searches
 * the names and the texts through lib/search.ts, within the chosen meal. A
 * row is a recipe's name, the kcal and the protein on one quiet line when
 * they are known, and how many times it was cooked. The recipes stand in
 * the order of their names, the way a cookbook's index does.
 *
 * ## What it refuses to do
 *
 * Add anything up. No row, chip or heading here totals a number, compares
 * one with a target or colours anything by it; the numbers are the recipe's.
 */
export function KitchenView({ meal: startMeal }: { meal?: MealType }) {
  const data = useAppData()
  const [meal, setMeal] = useState<MealFilter>(startMeal ?? 'all')
  const [query, setQuery] = useState('')
  const recipes = data.recipes

  if (recipes.length === 0) {
    return (
      <section className="library kitchen" aria-label="Kitchen">
        <div className="library-header">
          <h2>Kitchen</h2>
        </div>
        <div className="library-empty">
          <p>The recipes you cook, with what goes in them and how. Add the first one to start.</p>
        </div>
      </section>
    )
  }

  const shown = searchRecipes(recipesForMeal(recipes, meal), query)

  return (
    <section className="library kitchen" aria-label="Kitchen">
      <div className="library-header">
        <h2>Kitchen</h2>
      </div>

      <div className="library-chips kitchen-chips" role="group" aria-label="Meal">
        {(['all', ...MEAL_TYPES] as const).map(option => (
          <button
            key={option}
            type="button"
            className="library-chip"
            aria-pressed={meal === option}
            onClick={() => setMeal(option)}
          >
            {option === 'all' ? 'All' : MEAL_TYPE_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="library-list kitchen-list">
        <input
          type="search"
          className="kitchen-search"
          aria-label="Search recipes"
          placeholder="Search recipes"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {shown.length > 0 ? (
          <ul className="library-items">
            {shown.map(recipe => (
              <RecipeRow key={recipe.id} recipe={recipe} />
            ))}
          </ul>
        ) : (
          <p className="kitchen-none">{noneLine(meal, query)}</p>
        )}
      </div>
    </section>
  )
}

/** What an empty list says: which meal has nothing, and what was searched for. */
function noneLine(meal: MealFilter, query: string): string {
  const typed = query.trim()
  const kind = meal === 'all' ? '' : `${MEAL_TYPE_LABELS[meal].toLowerCase()} `
  if (typed) return `No ${kind}recipe matches "${typed}".`
  return `No ${kind}recipes yet.`
}

/**
 * One recipe in the list: its name, and under it the kcal and the protein on
 * one quiet line when either is known; how many times it was cooked at the
 * row's end, where the Library says how far through a book is.
 */
function RecipeRow({ recipe }: { recipe: Recipe }) {
  const macros = macroLine(recipe)
  const cooked = cookedLabel(recipe.cooked)
  return (
    <li className="library-item kitchen-row">
      <span className="kitchen-row-main">
        <span className="library-item-title kitchen-row-title">{recipe.title}</span>
        {macros && <span className="kitchen-row-macros">{macros}</span>}
      </span>
      {cooked && <span className="library-item-count kitchen-row-cooked">{cooked}</span>}
    </li>
  )
}
