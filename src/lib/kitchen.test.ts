import { expect, test } from 'vitest'
import { cookedLabel, macroLine, recipesForMeal } from './kitchen'
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

test('how many times a recipe was cooked is said in words, and not at all before the first', () => {
  expect(cookedLabel(undefined)).toBeUndefined()
  expect(cookedLabel(0)).toBeUndefined()
  expect(cookedLabel(1)).toBe('Cooked once')
  expect(cookedLabel(2)).toBe('Cooked twice')
  expect(cookedLabel(6)).toBe('Cooked 6 times')
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
