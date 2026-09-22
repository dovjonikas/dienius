import { expect, test } from 'vitest'
import { DEFAULT_MEAL_WORDS, cleanMealWords, mealWordsOf, mealsFromName, namePrefix } from './mealWords'
import type { MealWord } from './types'

/**
 * The meals a recipe's name says - Kitchen, v2.32. A name that starts with a
 * word and a colon says which meals it is for, by a list of words Settings
 * keeps. Every name and every word here is a generic one.
 */

test('a new device starts with the map, and every meal the map does not name by its own name', () => {
  expect(DEFAULT_MEAL_WORDS).toEqual([
    { word: 'Breakfast', meals: ['breakfast'] },
    { word: 'Lunch', meals: ['lunch', 'dinner'] },
    { word: 'Pre-gym', meals: ['pre-gym'] },
    { word: 'After', meals: ['dinner', 'post-gym'] },
    { word: 'Pack', meals: ['lunch', 'snack'] },
    { word: 'Evening', meals: ['snack'] },
    { word: 'Side', meals: [] },
    { word: 'Dinner', meals: ['dinner'] },
    { word: 'Post-gym', meals: ['post-gym'] },
    { word: 'Snack', meals: ['snack'] },
  ])
})

test("a name's first word is the word before its first colon, and only a word", () => {
  expect(namePrefix('Lunch: A bean bowl')).toBe('Lunch')
  expect(namePrefix('Pre-gym: Rice cakes')).toBe('Pre-gym')
  expect(namePrefix('  Post gym : A shake')).toBe('Post gym')
  expect(namePrefix('Lunch: Soup: the thick one')).toBe('Lunch')
  expect(namePrefix('Lunch:')).toBe('Lunch')
  // No colon, a colon inside a time, a colon too far in to be a word.
  expect(namePrefix('A bean bowl')).toBeUndefined()
  expect(namePrefix('12:30 lunch')).toBeUndefined()
  expect(namePrefix('A very long first part of a name that runs on: and on')).toBeUndefined()
  expect(namePrefix(': nothing before it')).toBeUndefined()
})

test("the list's word says the meals, however it is capitalised or hyphenated", () => {
  expect(mealsFromName('Lunch: A bean bowl', DEFAULT_MEAL_WORDS)).toEqual(['lunch', 'dinner'])
  expect(mealsFromName('lunch: a bean bowl', DEFAULT_MEAL_WORDS)).toEqual(['lunch', 'dinner'])
  expect(mealsFromName('PRE GYM: rice cakes', DEFAULT_MEAL_WORDS)).toEqual(['pre-gym'])
  expect(mealsFromName('After: A shake', DEFAULT_MEAL_WORDS)).toEqual(['dinner', 'post-gym'])
  expect(mealsFromName('Pack: A wrap', DEFAULT_MEAL_WORDS)).toEqual(['lunch', 'snack'])
  expect(mealsFromName('Evening: Yoghurt', DEFAULT_MEAL_WORDS)).toEqual(['snack'])
  // A word that says no meal is still a word: the recipe is sorted by it, for none.
  expect(mealsFromName('Side: Coleslaw', DEFAULT_MEAL_WORDS)).toEqual([])
  expect(mealsFromName('Dinner: A stew', DEFAULT_MEAL_WORDS)).toEqual(['dinner'])
  // A word the list does not know, and a name with none, say nothing.
  expect(mealsFromName('Soup: a thick one', DEFAULT_MEAL_WORDS)).toBeUndefined()
  expect(mealsFromName('A bean bowl', DEFAULT_MEAL_WORDS)).toBeUndefined()
})

test("a word of somebody's own says several meals, in the app's order, or says none and still counts as a word", () => {
  const words: MealWord[] = [
    { word: 'Brunch', meals: ['lunch', 'breakfast'] },
    { word: 'Plain', meals: [] },
  ]
  expect(mealsFromName('Brunch: Eggs on toast', words)).toEqual(['breakfast', 'lunch'])
  expect(mealsFromName('Plain: Boiled rice', words)).toEqual([])
  // Only the list in force is read: the six names are not in this one.
  expect(mealsFromName('Lunch: A bean bowl', words)).toBeUndefined()
})

test('the words in force are the stored list, or the six until somebody changes it, and nothing malformed is read', () => {
  expect(mealWordsOf({})).toEqual(DEFAULT_MEAL_WORDS)
  expect(mealWordsOf({ mealWords: [] })).toEqual([])
  const stored = [
    { word: 'Brunch', meals: ['lunch', 'breakfast'] },
    { word: '', meals: ['snack'] },
    { word: 'Late', meals: ['snack', 'supper'] },
    { word: 7, meals: ['snack'] },
    'Lunch',
  ] as unknown as MealWord[]
  expect(mealWordsOf({ mealWords: stored })).toEqual([
    { word: 'Brunch', meals: ['breakfast', 'lunch'] },
    { word: 'Late', meals: ['snack'] },
  ])
  // A list that is not a list at all is the six again, rather than no words.
  expect(mealWordsOf({ mealWords: 'Lunch' as unknown as MealWord[] })).toEqual(DEFAULT_MEAL_WORDS)
})

test('a list written from Settings is trimmed, keeps the first of a word said twice, and holds its meals in order', () => {
  expect(
    cleanMealWords([
      { word: '  Brunch ', meals: ['lunch', 'breakfast', 'lunch'] },
      { word: '   ', meals: ['snack'] },
      { word: 'brunch', meals: ['dinner'] },
      { word: 'Late', meals: [] },
    ]),
  ).toEqual([
    { word: 'Brunch', meals: ['breakfast', 'lunch'] },
    { word: 'Late', meals: [] },
  ])
})
