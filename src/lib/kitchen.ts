import { MEAL_TYPES, RECIPE_LIMITS, type MealType, type Recipe } from './types'

/**
 * Kitchen: recipes, since v2.27.
 *
 * A recipe library that looks and feels like the Library and keeps its own
 * data - `Recipe` in types.ts has why it is not a library list, and
 * docs/RESEARCH-KITCHEN.md the rest. This module holds what is true of a
 * recipe away from any screen: the words for the meals, and what a form's
 * input becomes when it is saved.
 *
 * What it refuses to do, like North: nothing here adds up a day, compares a
 * number with a target, or says whether a meal was a good one. The numbers
 * are information on a recipe.
 */

/** The words for the meals, as every screen says them. */
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  'pre-gym': 'Pre-gym',
  'post-gym': 'Post-gym',
  snack: 'Snack',
}

/** What a recipe's form holds when it is saved. Numbers the form could not read arrive as NaN or absent. */
export interface RecipeInput {
  title: string
  text: string
  mealTypes?: readonly MealType[]
  kcal?: number
  protein?: number
  carbs?: number
  fat?: number
  servings?: number
  minutes?: number
}

/** The part of a recipe its form writes: everything but the id, the count and the stamp. */
export type RecipeFields = Omit<Recipe, 'id' | 'cooked' | 'updatedAt'>

/**
 * A form's input as a recipe's fields, or nothing when it cannot be saved.
 *
 * A recipe needs a name and a text, each trimmed at its two ends and nothing
 * inside - the text keeps its blank lines, which part it into paragraphs the
 * way North's do. The rest is kept only when it is real: meal types this app
 * has, in its order and once each; numbers from nought within
 * `RECIPE_LIMITS`, kcal whole and grams to one decimal; servings and minutes
 * whole from one. Anything else is left out rather than stored as nought,
 * because nought is a number somebody meant.
 */
export function cleanRecipe(input: RecipeInput): RecipeFields | undefined {
  const title = input.title.trim()
  const text = input.text.trim()
  if (!title || !text) return undefined

  const fields: RecipeFields = { title, text }
  const meals = MEAL_TYPES.filter(meal => input.mealTypes?.includes(meal))
  if (meals.length > 0) fields.mealTypes = meals

  const kcal = amount(input.kcal, 0, RECIPE_LIMITS.kcal, 1)
  if (kcal !== undefined) fields.kcal = kcal
  for (const macro of ['protein', 'carbs', 'fat'] as const) {
    const grams = amount(input[macro], 0, RECIPE_LIMITS.grams, 10)
    if (grams !== undefined) fields[macro] = grams
  }
  const servings = amount(input.servings, 1, RECIPE_LIMITS.servings, 1)
  if (servings !== undefined) fields.servings = servings
  const minutes = amount(input.minutes, 1, RECIPE_LIMITS.minutes, 1)
  if (minutes !== undefined) fields.minutes = minutes
  return fields
}

/**
 * A number rounded to a step - 1 for whole, 10 for tenths - when it is one
 * and it lies between the two bounds after rounding; otherwise nothing.
 */
function amount(value: number | undefined, min: number, max: number, per: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined
  // Plus nought, so a small negative rounded up is 0 rather than -0.
  const rounded = Math.round(value * per) / per + 0
  return rounded >= min && rounded <= max ? rounded : undefined
}
