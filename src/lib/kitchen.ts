import { MEAL_TYPES, RECIPE_LIMITS, type MealType, type Recipe } from './types'
import { formatDuration } from '../widgets/day-plan/capacity'

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

/** Which recipes the list shows: all of them, or the ones for one meal. */
export type MealFilter = MealType | 'all'

/**
 * The recipes for a meal - every one for 'all' - in the order of their
 * names, which is the order a cookbook's index is in and the one a person
 * finds a name in without reading every row. A new array; the one given is
 * left as it was.
 */
export function recipesForMeal(recipes: readonly Recipe[], meal: MealFilter): Recipe[] {
  const chosen = meal === 'all' ? [...recipes] : recipes.filter(r => r.mealTypes?.includes(meal))
  return chosen.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
}

/**
 * A row's one quiet line: the kcal and the protein a serving has, whichever
 * of the two are known, or nothing. Carbs and fat are the recipe page's; a
 * row says the two numbers a choice for after the gym is made on.
 */
export function macroLine(recipe: Recipe): string | undefined {
  const parts: string[] = []
  if (recipe.kcal !== undefined) parts.push(`${recipe.kcal} kcal`)
  if (recipe.protein !== undefined) parts.push(`${recipe.protein} g protein`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/**
 * A recipe page's line of numbers: every one of the four that is known, and
 * that they are for a serving, or nothing.
 */
export function fullMacroLine(recipe: Recipe): string | undefined {
  const parts: string[] = []
  if (recipe.kcal !== undefined) parts.push(`${recipe.kcal} kcal`)
  if (recipe.protein !== undefined) parts.push(`${recipe.protein} g protein`)
  if (recipe.carbs !== undefined) parts.push(`${recipe.carbs} g carbs`)
  if (recipe.fat !== undefined) parts.push(`${recipe.fat} g fat`)
  return parts.length > 0 ? `${parts.join(' · ')} per serving` : undefined
}

/**
 * A recipe page's facts, whichever are known: the meals it is for, in one
 * phrase, how many servings, how long, and how often it was cooked.
 */
export function factsLine(recipe: Recipe): string | undefined {
  const parts: string[] = []
  if (recipe.mealTypes?.length) {
    const [first, ...rest] = recipe.mealTypes.map(meal => MEAL_TYPE_LABELS[meal])
    parts.push([first, ...rest.map(label => label.toLowerCase())].join(', '))
  }
  if (recipe.servings !== undefined) parts.push(`${recipe.servings} ${recipe.servings === 1 ? 'serving' : 'servings'}`)
  if (recipe.minutes !== undefined) parts.push(formatDuration(recipe.minutes))
  const cooked = cookedLabel(recipe.cooked)
  if (cooked) parts.push(cooked)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** How many times a recipe was cooked, in words - and nothing before the first. */
export function cookedLabel(cooked: number | undefined): string | undefined {
  if (!cooked) return undefined
  if (cooked === 1) return 'Cooked once'
  if (cooked === 2) return 'Cooked twice'
  return `Cooked ${cooked} times`
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
