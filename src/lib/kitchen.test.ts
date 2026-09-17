import { expect, test } from 'vitest'
import { cardLines, factsLine, fullMacroLine, isMealCategory, macroLine, mealLink, recipeSections, recipesForMeal } from './kitchen'
import type { Recipe } from './types'

/**
 * What Kitchen's list says about a recipe and which recipes it shows. Every
 * recipe here is a generic one.
 */

function recipe(over: Partial<Recipe> = {}): Recipe {
  return { id: crypto.randomUUID(), title: 'A simple soup', text: 'a text', ...over }
}

test("a row's quiet line is the kcal and the protein, whichever of the two are known, and nothing when neither is", () => {
  expect(macroLine(recipe({ kcal: 380, protein: 18, carbs: 55, fat: 9 }))).toBe('380 kcal · 18 g protein')
  expect(macroLine(recipe({ kcal: 380 }))).toBe('380 kcal')
  expect(macroLine(recipe({ protein: 32.5 }))).toBe('32.5 g protein')
  expect(macroLine(recipe({ protein: 0 }))).toBe('0 g protein')
  // Carbs and fat are the recipe page's to say, not the row's.
  expect(macroLine(recipe({ carbs: 55, fat: 9 }))).toBeUndefined()
  expect(macroLine(recipe())).toBeUndefined()
})

test('the list is every recipe, or the ones for a meal, in the order of their names', () => {
  const oats = recipe({ title: 'overnight oats', mealTypes: ['breakfast', 'snack'] })
  const bowl = recipe({ title: 'Chicken and rice bowl', mealTypes: ['lunch', 'post-gym'] })
  const toast = recipe({ title: 'Banana toast', mealTypes: ['pre-gym', 'snack'] })
  const plain = recipe({ title: 'Apple' })
  const all = [oats, bowl, toast, plain]

  expect(recipesForMeal(all, 'all').map(r => r.title)).toEqual(['Apple', 'Banana toast', 'Chicken and rice bowl', 'overnight oats'])
  expect(recipesForMeal(all, 'snack').map(r => r.title)).toEqual(['Banana toast', 'overnight oats'])
  expect(recipesForMeal(all, 'dinner')).toEqual([])
  // The list it was given is left as it was.
  expect(all.map(r => r.title)).toEqual(['overnight oats', 'Chicken and rice bowl', 'Banana toast', 'Apple'])
})

test("a recipe page's number line is every one of the four that is known, per serving, and nothing when none is", () => {
  expect(fullMacroLine(recipe({ kcal: 380, protein: 18, carbs: 55, fat: 9 }))).toBe('380 kcal · 18 g protein · 55 g carbs · 9 g fat per serving')
  expect(fullMacroLine(recipe({ carbs: 61.5 }))).toBe('61.5 g carbs per serving')
  expect(fullMacroLine(recipe())).toBeUndefined()
})

test("a recipe page's facts are its meals, its servings and its time, whichever are known", () => {
  // How often it was cooked is kept in the data and said nowhere, since v2.30.
  expect(factsLine(recipe({ mealTypes: ['breakfast', 'pre-gym'], servings: 1, minutes: 5, cooked: 6 }))).toBe('Breakfast, pre-gym · 1 serving · 5 min')
  expect(factsLine(recipe({ servings: 4, minutes: 90 }))).toBe('4 servings · 1h 30 min')
  expect(factsLine(recipe({ mealTypes: ['snack'] }))).toBe('Snack')
  expect(factsLine(recipe())).toBeUndefined()
})

// --- the cards, by meal (v2.30) ----------------------------------------------------

/**
 * Kitchen on cards, in sections by meal - docs/RESEARCH-KITCHEN.md section 6.4.
 * A recipe for two meals stands under both, the way a cookbook's index lists a
 * dish in two chapters; recipes with no meal yet stand last; a meal with nothing
 * is not a section. Each section keeps the order it was given, which is the
 * names' order, or a search's.
 */
test('every meal with a recipe is a section in the app\'s order, a recipe for two meals under both, and the recipes with no meal last', () => {
  const oats = recipe({ title: 'Overnight oats', mealTypes: ['breakfast', 'snack'] })
  const soup = recipe({ title: 'Lentil soup', mealTypes: ['lunch', 'dinner'] })
  const toast = recipe({ title: 'Banana toast', mealTypes: ['pre-gym', 'snack'] })
  const apple = recipe({ title: 'Apple' })
  const sections = recipeSections([apple, toast, soup, oats], 'all')
  expect(sections.map(s => [s.label, s.recipes.map(r => r.title)])).toEqual([
    ['Breakfast', ['Overnight oats']],
    ['Lunch', ['Lentil soup']],
    ['Dinner', ['Lentil soup']],
    ['Pre-gym', ['Banana toast']],
    ['Snack', ['Banana toast', 'Overnight oats']],
    ['No meal yet', ['Apple']],
  ])
})

test('one meal chosen is one section, with or without recipes, and the order given is kept', () => {
  const oats = recipe({ title: 'Overnight oats', mealTypes: ['breakfast', 'snack'] })
  const toast = recipe({ title: 'Banana toast', mealTypes: ['snack'] })
  expect(recipeSections([oats, toast], 'snack').map(s => [s.meal, s.recipes.map(r => r.title)])).toEqual([['snack', ['Overnight oats', 'Banana toast']]])
  expect(recipeSections([oats, toast], 'dinner')).toEqual([{ meal: 'dinner', label: 'Dinner', recipes: [] }])
})

test("a card's lines: how long and how many servings, its kcal and protein, and its first three ingredients", () => {
  const bowl = recipe({
    title: 'Chicken and rice bowl',
    text: 'Quick.\n\nINGREDIENTS\n2 chicken breasts\n150 g rice\n1 cucumber\nSoy sauce\n\nSTEPS\nCook it.',
    minutes: 30,
    servings: 2,
    kcal: 610,
    protein: 45,
    carbs: 70,
  })
  expect(cardLines(bowl)).toEqual({
    facts: '30 min · 2 servings',
    numbers: '610 kcal · 45 g protein',
    ingredients: '2 chicken breasts · 150 g rice · 1 cucumber',
  })
  // Only what is known, and nothing for a recipe that is a name.
  expect(cardLines(recipe({ text: '', servings: 1 }))).toEqual({ facts: '1 serving' })
  expect(cardLines(recipe({ text: 'Toast the bread.' }))).toEqual({})
})

// --- a meal on the day ------------------------------------------------------------

/**
 * A block on the day or in a template whose category is Meals may point at a
 * recipe, or only at a kind of meal. A recipe it points at is the one it
 * shows; a kind of meal is a door into Kitchen for choosing. A recipe that is
 * no longer there degrades to the kind of meal, or to nothing - CONVENTIONS
 * 7 - and a block in another category shows neither, whatever it carries.
 */
test('a meal block shows the recipe it points at, or its kind of meal, and nothing that is not there', () => {
  const soup = recipe({ id: 'soup', title: 'Lentil soup' })
  const recipes = [soup]
  expect(mealLink({ category: 'meal', recipeId: 'soup' }, recipes)).toEqual({ kind: 'recipe', recipe: soup })
  expect(mealLink({ category: 'meal', mealType: 'lunch' }, recipes)).toEqual({ kind: 'meal', meal: 'lunch', label: 'Lunch recipes' })
  // Both: the recipe is the more particular answer.
  expect(mealLink({ category: 'meal', recipeId: 'soup', mealType: 'lunch' }, recipes)).toEqual({ kind: 'recipe', recipe: soup })
  // A recipe removed elsewhere: the kind of meal if there is one, else nothing.
  expect(mealLink({ category: 'meal', recipeId: 'gone', mealType: 'dinner' }, recipes)).toEqual({ kind: 'meal', meal: 'dinner', label: 'Dinner recipes' })
  expect(mealLink({ category: 'meal', recipeId: 'gone' }, recipes)).toBeUndefined()
  // Not a meal, or nothing pointed at: nothing.
  expect(mealLink({ category: 'health', recipeId: 'soup' }, recipes)).toBeUndefined()
  expect(mealLink({ recipeId: 'soup' }, recipes)).toBeUndefined()
  expect(mealLink({ category: 'meal' }, recipes)).toBeUndefined()
  expect(isMealCategory('meal')).toBe(true)
  expect(isMealCategory('core')).toBe(false)
  expect(isMealCategory(undefined)).toBe(false)
})
