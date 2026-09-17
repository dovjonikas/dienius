import { MEAL_TYPE_LABELS, recipesForMeal } from '../../lib/kitchen'
import { MEAL_TYPES, type MealType, type Recipe } from '../../lib/types'

/** What a meal points at: a recipe, a kind of meal left open, or neither. */
export interface MealBinding {
  recipeId?: string
  mealType?: MealType
}

/**
 * The select's value for a meal: `recipe:<id>` for a recipe that is there,
 * `meal:<kind>` for a kind of meal, or nothing. A recipe removed on another
 * device reads as the kind of meal if there is one - see `mealLink` - so the
 * select never holds a value it has no option for.
 */
export function mealBindingValue(binding: MealBinding, recipes: readonly Recipe[]): string {
  if (binding.recipeId && recipes.some(r => r.id === binding.recipeId)) return `recipe:${binding.recipeId}`
  if (binding.mealType) return `meal:${binding.mealType}`
  return ''
}

/** A select's value read back into what the meal points at. */
export function readMealBinding(value: string): MealBinding {
  if (value.startsWith('recipe:') && value.length > 'recipe:'.length) return { recipeId: value.slice('recipe:'.length) }
  const meal = value.slice('meal:'.length) as MealType
  if (value.startsWith('meal:') && MEAL_TYPES.includes(meal)) return { mealType: meal }
  return {}
}

/**
 * A meal's recipe, chosen - Kitchen, since v2.27. One select for the three
 * answers a meal block can have: no recipe; a kind of meal, to choose from on
 * the day; or a recipe, by name, in the order of the names. The same control
 * wherever a meal is set up - a template's block, a week's, a task on the day
 * - so a meal is chosen one way everywhere.
 */
export function RecipeSelect({
  id,
  label,
  className,
  recipes,
  recipeId,
  mealType,
  onChange,
}: MealBinding & {
  id?: string
  /** The accessible name, when no visible label points at the select. */
  label?: string
  className?: string
  recipes: readonly Recipe[]
  onChange: (binding: MealBinding) => void
}) {
  return (
    <select
      id={id}
      aria-label={label}
      className={className}
      value={mealBindingValue({ recipeId, mealType }, recipes)}
      onChange={e => onChange(readMealBinding(e.target.value))}
    >
      <option value="">No recipe</option>
      <optgroup label="Choose on the day">
        {MEAL_TYPES.map(meal => (
          <option key={meal} value={`meal:${meal}`}>
            {MEAL_TYPE_LABELS[meal]} recipes
          </option>
        ))}
      </optgroup>
      {recipes.length > 0 && (
        <optgroup label="A recipe">
          {recipesForMeal(recipes, 'all').map(recipe => (
            <option key={recipe.id} value={`recipe:${recipe.id}`}>
              {recipe.title}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

/**
 * The select with its word beside it, for a row that asks before a block
 * exists - the shape `LibraryBindingField` has one shelf over, so the two
 * questions a block can be asked read the same way.
 */
export function RecipeBindingField({
  id,
  recipes,
  recipeId,
  mealType,
  onChange,
}: MealBinding & {
  /** Unique per block, so the label points at this select and not another's. */
  id: string
  recipes: readonly Recipe[]
  onChange: (binding: MealBinding) => void
}) {
  return (
    <div className="library-binding recipe-binding">
      <label className="library-binding-label" htmlFor={id}>
        Recipe
      </label>
      <RecipeSelect
        id={id}
        className="block-library block-recipe"
        recipes={recipes}
        recipeId={recipeId}
        mealType={mealType}
        onChange={onChange}
      />
    </div>
  )
}
