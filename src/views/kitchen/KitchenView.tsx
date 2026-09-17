import { useEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { MEAL_TYPE_LABELS, macroLine, recipesForMeal, type MealFilter } from '../../lib/kitchen'
import { searchRecipes } from '../../lib/search'
import { offerUndo } from '../../lib/undo'
import { MEAL_TYPES, type MealType, type Recipe } from '../../lib/types'
import { RecipePage } from './RecipePage'
import { RecipeForm } from './RecipeForm'

/**
 * Kitchen: the recipes cooked in this house - since v2.27.
 *
 * It looks and feels like the Library, and is built from its parts: the
 * page's name at the top with its action, a row of chips under it, and the
 * list as one card of quiet rows. It keeps its own data, because a recipe has
 * no units to be counted through - `Recipe` in lib/types.ts, and
 * docs/RESEARCH-KITCHEN.md.
 *
 * ## The list
 *
 * The chips are the meals - All and the six - one pressed at a time, and a
 * chip shows the recipes for it. The field at the top of the card searches
 * the names and the texts through lib/search.ts, within the chosen meal. A
 * row is a recipe's name, and the kcal and the protein on one quiet line when
 * they are known. The recipes stand in the order of their names, the way a
 * cookbook's index does.
 *
 * ## A recipe, and writing one
 *
 * A row opens the recipe's page (RecipePage) in the list's place, and
 * Kitchen at its top goes back to the list as it was left - the same meal,
 * the same search, the focus on the row. New recipe and Edit open the form
 * (RecipeForm) in the same place. The list's meal and search live here, above
 * the three, so going into a recipe and back loses neither.
 *
 * ## What it refuses to do
 *
 * Add anything up. No row, chip or heading here totals a number, compares
 * one with a target or colours anything by it; the numbers are the recipe's.
 */
export function KitchenView({ meal: startMeal, recipeId }: { meal?: MealType; recipeId?: string }) {
  const data = useAppData()
  const [meal, setMeal] = useState<MealFilter>(startMeal ?? 'all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState<KitchenPage>(recipeId ? { kind: 'recipe', id: recipeId } : { kind: 'list' })
  // The row to give the focus back to when the list comes back.
  const returnTo = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const recipes = data.recipes
  const open = page.kind === 'recipe' || page.kind === 'edit' ? recipes.find(r => r.id === page.id) : undefined
  // A recipe removed on another device while its page was open is simply gone:
  // the list comes back rather than a page about nothing.
  const showing: KitchenPage = (page.kind === 'recipe' || page.kind === 'edit') && !open ? { kind: 'list' } : page

  useEffect(() => {
    if (showing.kind !== 'list' || returnTo.current === null) return
    const id = returnTo.current
    returnTo.current = null
    listRef.current?.querySelector<HTMLElement>(`[data-recipe-id="${CSS.escape(id)}"]`)?.focus()
  })

  function backToList(from?: string) {
    returnTo.current = from ?? null
    setPage({ kind: 'list' })
  }

  if (showing.kind === 'recipe' && open) {
    return (
      <section className="library kitchen" aria-label="Kitchen">
        <RecipePage recipe={open} onBack={() => backToList(open.id)} onEdit={() => setPage({ kind: 'edit', id: open.id })} />
      </section>
    )
  }

  if (showing.kind === 'edit' && open) {
    return (
      <section className="library kitchen" aria-label="Kitchen">
        <RecipeForm
          recipe={open}
          onSaved={id => setPage({ kind: 'recipe', id })}
          onCancel={() => setPage({ kind: 'recipe', id: open.id })}
          onDelete={() => {
            const before = open
            actions.removeRecipe(open.id)
            offerUndo(`${before.title} deleted`, () => actions.restoreRecipe(before))
            backToList()
          }}
        />
      </section>
    )
  }

  if (showing.kind === 'new') {
    return (
      <section className="library kitchen" aria-label="Kitchen">
        <RecipeForm onSaved={id => setPage({ kind: 'recipe', id })} onCancel={() => backToList()} />
      </section>
    )
  }

  const header = (
    <div className="library-header">
      <h2>Kitchen</h2>
      <button type="button" className="btn-primary" onClick={() => setPage({ kind: 'new' })}>
        New recipe
      </button>
    </div>
  )

  if (recipes.length === 0) {
    return (
      <section className="library kitchen" aria-label="Kitchen">
        {header}
        <div className="library-empty">
          <p>The recipes you cook, with what goes in them and how. Add the first one to start.</p>
        </div>
      </section>
    )
  }

  const shown = searchRecipes(recipesForMeal(recipes, meal), query)

  return (
    <section className="library kitchen" aria-label="Kitchen">
      {header}

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

      <div className="library-list kitchen-list" ref={listRef}>
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
              <RecipeRow key={recipe.id} recipe={recipe} onOpen={() => setPage({ kind: 'recipe', id: recipe.id })} />
            ))}
          </ul>
        ) : (
          <p className="kitchen-none">{noneLine(meal, query)}</p>
        )}
      </div>
    </section>
  )
}

/** Where Kitchen is: the list, a recipe's page, or the form for a new or an existing one. */
type KitchenPage = { kind: 'list' } | { kind: 'recipe'; id: string } | { kind: 'new' } | { kind: 'edit'; id: string }

/** What an empty list says: which meal has nothing, and what was searched for. */
function noneLine(meal: MealFilter, query: string): string {
  const typed = query.trim()
  const kind = meal === 'all' ? '' : `${MEAL_TYPE_LABELS[meal].toLowerCase()} `
  if (typed) return `No ${kind}recipe matches "${typed}".`
  return `No ${kind}recipes yet.`
}

/**
 * One recipe in the list, as one button that opens it: its name, and under
 * it the kcal and the protein on one quiet line when either is known.
 */
function RecipeRow({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  const macros = macroLine(recipe)
  return (
    <li className="library-item kitchen-row">
      <button type="button" className="library-item-open kitchen-row-open" data-recipe-id={recipe.id} onClick={onOpen}>
        <span className="kitchen-row-main">
          <span className="library-item-title kitchen-row-title">{recipe.title}</span>
          {macros && <span className="kitchen-row-macros">{macros}</span>}
        </span>
      </button>
    </li>
  )
}
