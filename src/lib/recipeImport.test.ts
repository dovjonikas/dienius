import { expect, test } from 'vitest'
import { readPastedRecipes, splitPastedRecipes } from './recipeImport'
import { DEFAULT_MEAL_WORDS } from './mealWords'
import type { MealWord, Recipe } from './types'

/**
 * Many recipes pasted at once - Kitchen, v2.32. A line that starts NAME: or a
 * line of --- parts one recipe from the next; each piece is read the way New
 * recipe reads a recipe, and the list says, before anything is saved, what
 * each will be. Every recipe here is a generic one.
 */

/** A generic recipe in the Kitchen format: its numbers first, then the two lists. */
function piece(n: number): string {
  return [
    `NAME: Lunch: Bowl number ${n}`,
    `${300 + n} kcal, ${10 + n} g protein, 2 servings, 20 min`,
    '',
    'INGREDIENTS',
    `${n}00 g of a grain`,
    'a vegetable',
    '',
    'STEPS',
    'Cook the grain.',
    'Add the vegetable.',
  ].join('\n')
}

test('a NAME: line starts a recipe, its words are the name, and the lines under it are the text', () => {
  const text = 'NAME: A first one\n450 kcal\n\nINGREDIENTS\nwater\n\nNAME: A second one\nSTEPS\nBoil it.'
  expect(splitPastedRecipes(text)).toEqual([
    { title: 'A first one', text: '450 kcal\n\nINGREDIENTS\nwater' },
    { title: 'A second one', text: 'STEPS\nBoil it.' },
  ])
})

test('a line of --- parts two recipes, and a first line that is neither a heading nor numbers is the name', () => {
  const text = 'A first one\n450 kcal\nINGREDIENTS\nwater\n---\nA second one\n\nSTEPS\nBoil it.\n---\n'
  expect(splitPastedRecipes(text)).toEqual([
    { title: 'A first one', text: '450 kcal\nINGREDIENTS\nwater' },
    { title: 'A second one', text: 'STEPS\nBoil it.' },
  ])
})

test('a piece that opens on its numbers or a heading has no name, and keeps every line as its text', () => {
  expect(splitPastedRecipes('450 kcal, 30 g protein\nINGREDIENTS\nwater\n---\nINGREDIENTS\nrice')).toEqual([
    { text: '450 kcal, 30 g protein\nINGREDIENTS\nwater' },
    { text: 'INGREDIENTS\nrice' },
  ])
})

test('the two ways of parting together, and blank pieces, make no empty recipe', () => {
  const text = '\n\nNAME: A first one\nwater\n---\n\n---\nNAME: A second one\nrice\n---\n   \n'
  expect(splitPastedRecipes(text)).toEqual([
    { title: 'A first one', text: 'water' },
    { title: 'A second one', text: 'rice' },
  ])
  expect(splitPastedRecipes('')).toEqual([])
  expect(splitPastedRecipes('---\n---')).toEqual([])
})

test('a NAME: line with no words after it is a recipe with no name, and name: in any case is read', () => {
  expect(splitPastedRecipes('NAME:\nwater\nname: A second one\nrice')).toEqual([{ text: 'water' }, { title: 'A second one', text: 'rice' }])
})

test('each piece is read the way New recipe reads one: the numbers from its text and the meals from its name', () => {
  const [row] = readPastedRecipes(piece(1), [], DEFAULT_MEAL_WORDS)
  expect(row).toMatchObject({
    title: 'Lunch: Bowl number 1',
    state: 'new',
    meals: ['lunch'],
    from: 'name',
    kcal: 301,
    protein: 11,
  })
  expect(row.input).toMatchObject({ title: 'Lunch: Bowl number 1', kcal: 301, protein: 11, servings: 2, minutes: 20, mealTypes: ['lunch'] })
  expect(row.input.text.startsWith('301 kcal, 11 g protein')).toBe(true)
  // An amount inside the ingredients is a line, never a number of the recipe's.
  expect(row.input.carbs).toBeUndefined()
})

test('thirty generic recipes pasted at once are thirty rows, each with its own numbers, all new', () => {
  const pasted = Array.from({ length: 30 }, (_, i) => piece(i + 1)).join('\n')
  const rows = readPastedRecipes(pasted, [], DEFAULT_MEAL_WORDS)
  expect(rows).toHaveLength(30)
  expect(rows.every(r => r.state === 'new')).toBe(true)
  expect(rows.map(r => r.kcal)).toEqual(Array.from({ length: 30 }, (_, i) => 301 + i))
  expect(new Set(rows.map(r => r.key)).size).toBe(30)
})

test('a name Kitchen already has is an update of that recipe, however it is capitalised or spaced', () => {
  const have: Recipe[] = [{ id: 'r1', title: 'Lunch: Bowl  number 1', text: 'old', mealTypes: ['dinner'] }]
  const [row] = readPastedRecipes(piece(1).replace('Bowl number 1', 'bowl number 1'), have, DEFAULT_MEAL_WORDS)
  expect(row).toMatchObject({ state: 'update', existingId: 'r1', from: 'name' })
  // The meals it was given since stay, and its name's word adds its own:
  // pasting the same text again never takes a meal away.
  expect(row.meals).toEqual(['lunch', 'dinner'])
  expect(row.input.mealTypes).toEqual(['lunch', 'dinner'])
})

test("an update whose name says no meal keeps the meals the recipe has; a new one with no word has none", () => {
  const have: Recipe[] = [{ id: 'r1', title: 'A plain bowl', text: 'old', mealTypes: ['dinner', 'snack'] }]
  const rows = readPastedRecipes('NAME: A plain bowl\nwater\nNAME: Another plain bowl\nrice', have, DEFAULT_MEAL_WORDS)
  expect(rows.map(r => [r.state, r.meals, r.from])).toEqual([
    ['update', ['dinner', 'snack'], 'kept'],
    ['new', [], 'none'],
  ])
})

test('a name pasted twice is saved once, from the last piece, and the earlier one says so', () => {
  const rows = readPastedRecipes('NAME: A bowl\nwater\nNAME: Another\nrice\nNAME: a bowl\nbeans', [], DEFAULT_MEAL_WORDS)
  expect(rows.map(r => [r.title, r.state])).toEqual([
    ['A bowl', 'repeated'],
    ['Another', 'new'],
    ['a bowl', 'new'],
  ])
})

test('a piece with no name is a row that cannot be saved', () => {
  const rows = readPastedRecipes('450 kcal\nINGREDIENTS\nwater', [], DEFAULT_MEAL_WORDS)
  expect(rows).toMatchObject([{ title: '', state: 'untitled', kcal: 450 }])
})

test("the meals come from the words in force, a word of somebody's own included", () => {
  const words: MealWord[] = [{ word: 'Brunch', meals: ['breakfast', 'lunch'] }, { word: 'Plain', meals: [] }]
  const rows = readPastedRecipes('NAME: Brunch: Eggs\nwater\nNAME: Plain: Rice\nrice\nNAME: Lunch: Soup\nbeans', [], words)
  expect(rows.map(r => [r.meals, r.from])).toEqual([
    [['breakfast', 'lunch'], 'name'],
    [[], 'name'],
    [[], 'none'],
  ])
})
