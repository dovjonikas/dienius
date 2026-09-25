import { MEAL_TYPES, RECIPE_LIMITS, type MealType, type Recipe, type Task, type Template } from './types'
import { readRecipe, recipeIngredients } from './recipeText'
import { dayNumber } from './north'
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

/** One of Kitchen's sections: a meal and its recipes, or the recipes with no meal yet. */
export interface RecipeSection {
  meal: MealType | 'none'
  label: string
  recipes: Recipe[]
}

/**
 * Kitchen's sections, by meal - v2.30, docs/RESEARCH-KITCHEN.md section 6.4.
 *
 * With every meal showing, each meal that has a recipe is a section, in the
 * app's order of meals, and the recipes with no meal yet stand last. A recipe
 * for two meals stands under both, the way a cookbook's index lists a dish in
 * two chapters - a breakfast that is also a snack is looked for under either.
 * A meal with nothing is not a section. With one meal chosen, that meal is the
 * one section, empty or not, so the page can say it has nothing.
 *
 * Each section keeps the order the recipes were given in: the names' order,
 * or a search's.
 */
export function recipeSections(recipes: readonly Recipe[], meal: MealFilter): RecipeSection[] {
  if (meal !== 'all') return [{ meal, label: MEAL_TYPE_LABELS[meal], recipes: recipes.filter(r => r.mealTypes?.includes(meal)) }]
  const sections: RecipeSection[] = MEAL_TYPES.map(type => ({
    meal: type,
    label: MEAL_TYPE_LABELS[type],
    recipes: recipes.filter(r => r.mealTypes?.includes(type)),
  }))
  sections.push({ meal: 'none', label: 'No meal yet', recipes: recipes.filter(r => !r.mealTypes?.length) })
  return sections.filter(section => section.recipes.length > 0)
}

/** A card's quiet lines, whichever are known. */
export interface CardLines {
  /** How long, and how many servings. */
  facts?: string
  /** The kcal and the protein a serving has. */
  numbers?: string
  /** The first three ingredients. */
  ingredients?: string
}

/**
 * What a recipe's card says under its name: how long and how many servings,
 * its kcal and protein for a serving, and the first three of its ingredients -
 * what a choice between two dinners is made on. Each line only when there is
 * something to say.
 */
export function cardLines(recipe: Recipe): CardLines {
  const lines: CardLines = {}
  const facts: string[] = []
  if (recipe.minutes !== undefined) facts.push(formatDuration(recipe.minutes))
  if (recipe.servings !== undefined) facts.push(`${recipe.servings} ${recipe.servings === 1 ? 'serving' : 'servings'}`)
  if (facts.length > 0) lines.facts = facts.join(' · ')
  const numbers = macroLine(recipe)
  if (numbers) lines.numbers = numbers
  const ingredients = recipeIngredients(readRecipe(recipe.text)).slice(0, 3)
  if (ingredients.length > 0) lines.ingredients = ingredients.join(' · ')
  return lines
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
 * phrase, how many servings, and how long. How often it was cooked was Cook's
 * to count, and is said nowhere since Cook went - docs/RESEARCH-KITCHEN.md
 * section 6.1.
 */
export function factsLine(recipe: Recipe): string | undefined {
  const parts: string[] = []
  if (recipe.mealTypes?.length) {
    const [first, ...rest] = recipe.mealTypes.map(meal => MEAL_TYPE_LABELS[meal])
    parts.push([first, ...rest.map(label => label.toLowerCase())].join(', '))
  }
  if (recipe.servings !== undefined) parts.push(`${recipe.servings} ${recipe.servings === 1 ? 'serving' : 'servings'}`)
  if (recipe.minutes !== undefined) parts.push(formatDuration(recipe.minutes))
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/**
 * Whether a category is the meals one - the built-in Meals category, by its
 * id, whatever it has been renamed to. The one a day's meal blocks already
 * carry; a category somebody made for food is theirs to use, and a block in
 * it has no link to Kitchen.
 */
export function isMealCategory(category: string | undefined): boolean {
  return category === 'meal'
}

/**
 * What a meal is given from Kitchen: the recipes it walks, in the order they
 * come round; a kind of meal left to the day to choose from; or, on a
 * template's block, a kind of meal whose every recipe it walks (`follow`,
 * v2.32). None of them is a meal with no recipe.
 */
export interface MealRecipes {
  recipeIds?: string[]
  mealType?: MealType
  /** With `mealType`: walk every recipe Kitchen has for it, the ones added later too. */
  follow?: boolean
}

/** A block's recipe fields, as the functions below read them. */
type MealBlock = { recipeIds?: string[]; recipeId?: string; mealType?: MealType; followMeal?: boolean }

/**
 * The recipes a template's meal block walks: every recipe Kitchen has for its
 * meal, in the order of their names, when it follows the meal - v2.32; else
 * its list - v2.30 - or the one recipe a block was given before there were
 * lists. Following reads the recipes given, and with none given it has none.
 */
export function blockRecipeIds(block: MealBlock, recipes: readonly Recipe[] = []): string[] {
  if (block.followMeal && block.mealType) return recipesForMeal(recipes, block.mealType).map(r => r.id)
  if (block.recipeIds?.length) return block.recipeIds
  return block.recipeId ? [block.recipeId] : []
}

/** What a block holds, as the recipes field reads it. */
export function mealRecipesOf(block: MealBlock): MealRecipes {
  if (block.followMeal && block.mealType) return { mealType: block.mealType, follow: true }
  const recipeIds = blockRecipeIds(block)
  return { ...(recipeIds.length > 0 ? { recipeIds } : {}), ...(block.mealType ? { mealType: block.mealType } : {}) }
}

/**
 * What a meal's field writes onto a block: every recipe field said, so a block
 * given recipes loses its kind of meal and the other way round, and the mark
 * that it follows its meal goes with the meal. `recipeId` is the first of the
 * list, for a device on an older version.
 */
export function mealFields(value: MealRecipes): {
  recipeIds: string[] | undefined
  recipeId: string | undefined
  mealType: MealType | undefined
  followMeal: true | undefined
} {
  const ids = value.recipeIds?.length ? value.recipeIds : undefined
  const mealType = ids ? undefined : value.mealType
  return { recipeIds: ids, recipeId: ids?.[0], mealType, followMeal: mealType && value.follow ? true : undefined }
}

/**
 * The recipe a date gets from a block's walk - v2.30, docs/RESEARCH-KITCHEN.md
 * section 6.5. Consecutive dates take consecutive recipes, and round again
 * after the last, worked out from the date alone: the same on every device and
 * nothing stored. A day skipped moves the walk on rather than holding it back.
 */
export function recipeForDate(recipeIds: readonly string[], date: string): string | undefined {
  if (recipeIds.length === 0) return undefined
  const n = recipeIds.length
  return recipeIds[((dayNumber(date) % n) + n) % n]
}

/** What a meal block on the day or in a template points at - see `mealLink`. */
export type MealLink = { kind: 'recipe'; recipe: Recipe } | { kind: 'meal'; meal: MealType; label: string }

/**
 * The recipe a meal block points at, or the kind of meal it leaves open, or
 * nothing. Only a block in the meals category has either. A recipe comes
 * before a kind of meal, being the more particular answer; a recipe that is
 * no longer there - removed on another device - degrades to the kind of meal
 * if the block has one, and to nothing if it has not.
 */
export function mealLink(
  block: { category?: string; recipeId?: string; mealType?: MealType },
  recipes: readonly Recipe[],
): MealLink | undefined {
  if (!isMealCategory(block.category)) return undefined
  const recipe = block.recipeId === undefined ? undefined : recipes.find(r => r.id === block.recipeId)
  if (recipe) return { kind: 'recipe', recipe }
  if (block.mealType) return { kind: 'meal', meal: block.mealType, label: `${MEAL_TYPE_LABELS[block.mealType]} recipes` }
  return undefined
}

/**
 * The recipes a meal's card offers in place, to put another on it with one
 * press - the owner's decisions before the freeze, 2026-09-25, stage 3. The
 * recipes of the meal's kind of meal, by name: the meal it leaves open, else
 * the meal its block in the template is for - a recipe chosen by hand takes
 * the meal off the task - else the meals of the recipe it has. Nothing for a
 * task that is not a meal, a meal whose kind is known nowhere, or a meal
 * whose one recipe is already on it.
 */
export function mealChoices(
  task: Task,
  templates: readonly Pick<Template, 'id' | 'blocks'>[],
  recipes: readonly Recipe[],
): Recipe[] {
  if (!isMealCategory(task.category)) return []
  const origin = task.origin
  const block = origin?.type === 'template' ? templates.find(t => t.id === origin.sourceId)?.blocks.find(b => b.id === origin.blockId) : undefined
  const current = task.recipeId === undefined ? undefined : recipes.find(r => r.id === task.recipeId)
  const meals: readonly MealType[] = task.mealType ? [task.mealType] : block?.mealType ? [block.mealType] : (current?.mealTypes ?? [])
  const choices = recipesForMeal(recipes.filter(r => r.mealTypes?.some(m => meals.includes(m))), 'all')
  return choices.some(r => r.id !== current?.id) ? choices : []
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
 * A recipe needs a name, trimmed at its two ends. Its text is trimmed the same
 * way and may be empty since v2.30 - a breakfast and its numbers are worth
 * keeping before anybody types the method - and it keeps its blank lines
 * inside, which part it into paragraphs the way North's do. The rest is kept
 * only when it is real: meal types this app has, in its order and once each;
 * numbers from nought within `RECIPE_LIMITS`, kcal whole and grams to one
 * decimal; servings and minutes whole from one. Anything else is left out
 * rather than stored as nought, because nought is a number somebody meant.
 */
export function cleanRecipe(input: RecipeInput): RecipeFields | undefined {
  const title = input.title.trim()
  const text = input.text.trim()
  if (!title) return undefined

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
