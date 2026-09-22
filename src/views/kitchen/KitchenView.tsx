import { useEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { MEAL_TYPE_LABELS, cardLines, recipeSections, recipesForMeal, type MealFilter } from '../../lib/kitchen'
import { categoryColor } from '../../lib/categories'
import { searchRecipes } from '../../lib/search'
import { offerUndo } from '../../lib/undo'
import { MEAL_TYPES, type MealType, type Recipe } from '../../lib/types'
import { RecipePage } from './RecipePage'
import { RecipeForm } from './RecipeForm'
import { PasteMany } from './PasteMany'
import { MealsPicker, mealsLine } from './MealsPicker'

/**
 * Kitchen: the recipes cooked in this house - since v2.27, on cards since v2.30.
 *
 * The page's name at the top with its actions, a row of chips under it, the
 * search, and the recipes on cards in sections by meal. It keeps its own data,
 * because a recipe has no units to be counted through - `Recipe` in
 * lib/types.ts, and docs/RESEARCH-KITCHEN.md.
 *
 * ## The cards
 *
 * There will be a lot of recipes, so they stand sorted by meal: with every
 * meal showing, each meal with a recipe is a section with how many it has, a
 * recipe for two meals under both, and the recipes with no meal yet last
 * (`recipeSections`). The chips are the meals - All and the six - one pressed
 * at a time, and a chip shows its meal's cards alone. The field searches the
 * names and the texts through lib/search.ts, within the chosen meal. A card is
 * a recipe's name, how long and how many servings, its kcal and protein, and
 * its first ingredients (`cardLines`); the cards lie in a grid on North's small
 * shadow, each marked with the Meals category's colour, the mark a meal block
 * has on the day. The recipes stand in the order of their names, the way a
 * cookbook's index does, or a search's.
 *
 * Under a card's lines are its meals, and a press on them changes them there,
 * without opening the recipe - v2.32 (MealsPicker).
 *
 * ## Many at once
 *
 * Paste many, beside New recipe, takes a whole text of recipes and saves them
 * in one press (PasteMany). Select, beside the search, turns the cards into
 * things to pick: a press picks a card rather than opening it, and the bar in
 * the search's place gives one meal to every picked recipe, or takes it off
 * them, in one press - v2.32.
 *
 * ## A recipe, and writing one
 *
 * A card opens the recipe's page (RecipePage) in the list's place, and
 * Kitchen at its top goes back to the list as it was left - the same meal,
 * the same search, the focus on the card. New recipe, Paste many and Edit open
 * their forms in the same place. The list's meal and search live here, above
 * them, so going into a recipe and back loses neither.
 *
 * ## What it refuses to do
 *
 * Add anything up. No card, chip or heading here totals a number, compares
 * one with a target or colours anything by it; the numbers are the recipe's.
 */
export function KitchenView({ meal: startMeal, recipeId }: { meal?: MealType; recipeId?: string }) {
  const data = useAppData()
  const [meal, setMeal] = useState<MealFilter>(startMeal ?? 'all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState<KitchenPage>(recipeId ? { kind: 'recipe', id: recipeId } : { kind: 'list' })
  // The cards picked while Select is on; null while it is off.
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null)
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
            const { undo } = actions.removeRecipe(open.id)
            offerUndo(`${before.title} deleted`, undo)
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

  if (showing.kind === 'paste') {
    return (
      <section className="library kitchen" aria-label="Kitchen">
        <PasteMany onDone={() => backToList()} onCancel={() => backToList()} />
      </section>
    )
  }

  const header = (
    <div className="library-header">
      <h2>Kitchen</h2>
      <div className="library-header-actions">
        <button type="button" className="btn-secondary" onClick={() => setPage({ kind: 'paste' })}>
          Paste many
        </button>
        <button type="button" className="btn-primary" onClick={() => setPage({ kind: 'new' })}>
          New recipe
        </button>
      </div>
    </div>
  )

  if (recipes.length === 0) {
    return (
      // The shelf's width with nothing on it yet, so the page's name and New
      // recipe stand where they will stand once the first recipe is there.
      // At the page width the first recipe moved both by 160px, and an empty
      // Kitchen began 160px right of an empty North beside it in the rail.
      <section className="library kitchen kitchen-shelf" aria-label="Kitchen">
        {header}
        <div className="library-empty">
          <p>The recipes you cook, with what goes in them and how. Add the first one to start, or paste many at once.</p>
        </div>
      </section>
    )
  }

  const shown = recipeSections(searchRecipes(recipesForMeal(recipes, 'all'), query), meal)
  const anything = shown.some(section => section.recipes.length > 0)
  const mealColor = categoryColor('meal', data.categories)
  // What Select's Pick all picks: every recipe on the page now, each once.
  const onPage = [...new Set(shown.flatMap(section => section.recipes.map(r => r.id)))]

  function pick(id: string) {
    setPicked(was => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="library kitchen kitchen-shelf" aria-label="Kitchen">
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

      {picked ? (
        <PickedBar picked={picked} onPage={onPage} onPickAll={() => setPicked(new Set(onPage))} onDone={() => setPicked(null)} />
      ) : (
        <div className="kitchen-find">
          <input
            type="search"
            className="kitchen-search"
            aria-label="Search recipes"
            placeholder="Search recipes"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button type="button" className="btn-secondary kitchen-select" onClick={() => setPicked(new Set())}>
            Select
          </button>
        </div>
      )}

      {anything ? (
        <div
          className="kitchen-sections"
          ref={listRef}
          style={mealColor ? ({ '--cat': mealColor } as React.CSSProperties) : undefined}
        >
          {shown.map(section => (
            <section key={section.meal} className="kitchen-section" aria-label={section.label}>
              {/* A chosen meal is one grid, and its chip already says which. */}
              {meal === 'all' && (
                <h3 className="kitchen-section-heading">
                  <span className="kitchen-section-name">{section.label}</span>
                  <span className="kitchen-section-count">{section.recipes.length}</span>
                </h3>
              )}
              <ul className="kitchen-cards">
                {section.recipes.map(recipe => (
                  <li key={recipe.id} className="kitchen-cards-item">
                    <RecipeCard
                      recipe={recipe}
                      picked={picked ? picked.has(recipe.id) : undefined}
                      onOpen={() => (picked ? pick(recipe.id) : setPage({ kind: 'recipe', id: recipe.id }))}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="kitchen-none">{noneLine(meal, query)}</p>
      )}
    </section>
  )
}

/** Where Kitchen is: the list, a recipe's page, or the form for a new, an existing or many recipes. */
type KitchenPage = { kind: 'list' } | { kind: 'recipe'; id: string } | { kind: 'new' } | { kind: 'edit'; id: string } | { kind: 'paste' }

/** What an empty list says: which meal has nothing, and what was searched for. */
function noneLine(meal: MealFilter, query: string): string {
  const typed = query.trim()
  const kind = meal === 'all' ? '' : `${MEAL_TYPE_LABELS[meal].toLowerCase()} `
  if (typed) return `No ${kind}recipe matches "${typed}".`
  return `No ${kind}recipes yet.`
}

/**
 * Select's bar, in the search's place while it is on - v2.32: how many are
 * picked, Pick all for every card on the page, and one meal given to every
 * picked recipe or taken off them. Done puts the search back.
 */
function PickedBar({
  picked,
  onPage,
  onPickAll,
  onDone,
}: {
  picked: ReadonlySet<string>
  onPage: string[]
  onPickAll: () => void
  onDone: () => void
}) {
  const [meal, setMeal] = useState<MealType>('lunch')
  const [said, setSaid] = useState('')
  const count = picked.size
  const ids = [...picked]

  function give(on: boolean) {
    if (count === 0) return
    actions.setMealOnRecipes(ids, meal, on)
    const word = MEAL_TYPE_LABELS[meal]
    const recipes = `${count} ${count === 1 ? 'recipe' : 'recipes'}`
    setSaid(on ? `${word} given to ${recipes}` : `${word} taken off ${recipes}`)
  }

  return (
    <div className="kitchen-picked" role="group" aria-label="Picked recipes">
      <div className="kitchen-picked-count">
        <span className="kitchen-picked-words" aria-live="polite">
          {said || (count === 0 ? 'Press the cards to pick them' : `${count} picked`)}
        </span>
        <button type="button" className="btn-quiet" disabled={onPage.every(id => picked.has(id))} onClick={onPickAll}>
          Pick all
        </button>
      </div>
      <div className="kitchen-picked-meal">
        <select aria-label="Meal" value={meal} onChange={e => setMeal(e.target.value as MealType)}>
          {MEAL_TYPES.map(option => (
            <option key={option} value={option}>
              {MEAL_TYPE_LABELS[option]}
            </option>
          ))}
        </select>
        <button type="button" className="btn-secondary" disabled={count === 0} onClick={() => give(true)}>
          Give
        </button>
        <button type="button" className="btn-secondary" disabled={count === 0} onClick={() => give(false)}>
          Take off
        </button>
        <button type="button" className="btn-primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}

/**
 * One recipe's card: a press on its name and lines opens it - or, while
 * Select is on, picks it - and under them its meals, changed in place.
 * Each line only when there is something to say.
 */
function RecipeCard({ recipe, picked, onOpen }: { recipe: Recipe; picked?: boolean; onOpen: () => void }) {
  const lines = cardLines(recipe)
  const picking = picked !== undefined
  return (
    <div className={picked ? 'kitchen-card is-picked' : 'kitchen-card'}>
      <button type="button" className="kitchen-card-open" data-recipe-id={recipe.id} aria-pressed={picking ? picked : undefined} onClick={onOpen}>
        <span className="kitchen-card-title">{recipe.title}</span>
        {lines.facts && <span className="kitchen-card-line">{lines.facts}</span>}
        {lines.numbers && <span className="kitchen-card-line">{lines.numbers}</span>}
        {lines.ingredients && <span className="kitchen-card-line kitchen-card-ingredients">{lines.ingredients}</span>}
      </button>
      {picking ? (
        // While picking, the meals are said where their line was, beside the
        // card's mark, so a card is the same height picking as reading.
        <div className="kitchen-card-foot" aria-hidden="true">
          <span className="meals-picker-words">{mealsLine(recipe.mealTypes ?? [], 'No meal yet')}</span>
          <span className="kitchen-card-mark" />
        </div>
      ) : (
        <MealsPicker
          meals={recipe.mealTypes ?? []}
          label={`Meals for ${recipe.title}`}
          none="No meal yet"
          onChange={next => actions.setRecipeMeals(recipe.id, next)}
        />
      )}
    </div>
  )
}
