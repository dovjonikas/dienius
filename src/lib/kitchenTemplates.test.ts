import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData, exportJson, importJson, validate } from './storage'
import { applyStamps, refreshFromTemplate } from './stamping'
import { blockRecipeIds, mealFields, mealRecipesOf, recipeForDate } from './kitchen'
import { validate as validateV228 } from './fixtures/validate-v2.28'
import type { AppData, Recipe, Template, TemplateBlock } from './types'

/**
 * A meal block takes recipes from Kitchen, a day at a time - Kitchen, v2.30,
 * docs/RESEARCH-KITCHEN.md section 6.5. A block holds several recipes the way a
 * reading block holds a list of books; each day stamped from it gets the next
 * one, walked by the date alone; a recipe removed leaves every block that
 * walked it; and a recipe can be added to a template from its page. Every
 * recipe here is a generic one.
 */

const RECIPES: Recipe[] = ['Overnight oats', 'Porridge with banana', 'Scrambled eggs on toast', 'Greek yogurt with berries'].map(
  (title, i) => ({ id: `r${i}`, title, text: '' }),
)
const WALK = ['r0', 'r1', 'r2']

function meal(over: Partial<TemplateBlock> = {}): TemplateBlock {
  return { id: 'breakfast', time: '07:30', title: 'Breakfast', minutes: 20, category: 'meal', recipeIds: WALK, recipeId: 'r0', ...over }
}

function weekday(blocks: TemplateBlock[] = [meal()]): Template {
  return { id: 'weekday', name: 'Weekday', color: '#a7c4f5', blocks }
}

function plan(templates: Template[] = [weekday()]): AppData {
  const data = defaultData()
  data.recipes = RECIPES
  data.templates = templates
  return data
}

beforeEach(() => {
  actions.resetForTests(plan())
})

// --- the walk -----------------------------------------------------------------------------------

test('the walk gives consecutive dates consecutive recipes, round again after the last, and a date always the same one', () => {
  const dates = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']
  const at = dates.map(date => WALK.indexOf(recipeForDate(WALK, date)!))
  expect(at.map(n => (n - at[0] + WALK.length) % WALK.length)).toEqual([0, 1, 2, 0])
  expect(new Set(dates.slice(0, 3).map(date => recipeForDate(WALK, date)))).toEqual(new Set(WALK))
  expect(recipeForDate(WALK, '2026-09-15')).toBe(recipeForDate(WALK, '2026-09-15'))
  // Across a year's end and a leap day it goes on walking, one a day.
  expect(WALK.indexOf(recipeForDate(WALK, '2028-03-01')!)).toBe((WALK.indexOf(recipeForDate(WALK, '2028-02-28')!) + 2) % 3)
  expect(recipeForDate(['r3'], '2027-01-01')).toBe('r3')
  expect(recipeForDate([], '2026-09-15')).toBeUndefined()
})

test("a block's recipes are its list, or the one recipe a block was given before lists", () => {
  expect(blockRecipeIds({ recipeIds: ['r1', 'r2'], recipeId: 'r1' })).toEqual(['r1', 'r2'])
  expect(blockRecipeIds({ recipeId: 'r1' })).toEqual(['r1'])
  expect(blockRecipeIds({})).toEqual([])
})

test("what a meal's field writes is recipes or a kind of meal, never both, and recipes first", () => {
  expect(mealFields({ recipeIds: ['r1', 'r2'] })).toEqual({ recipeIds: ['r1', 'r2'], recipeId: 'r1', mealType: undefined })
  expect(mealFields({ mealType: 'dinner' })).toEqual({ recipeIds: undefined, recipeId: undefined, mealType: 'dinner' })
  expect(mealFields({ recipeIds: [], mealType: 'dinner' })).toEqual({ recipeIds: undefined, recipeId: undefined, mealType: 'dinner' })
  expect(mealFields({})).toEqual({ recipeIds: undefined, recipeId: undefined, mealType: undefined })
  // A block that came in holding both - an import written by hand - is saved
  // holding its recipes.
  expect(mealFields(mealRecipesOf({ recipeIds: ['r1'], mealType: 'lunch' }))).toEqual({ recipeIds: ['r1'], recipeId: 'r1', mealType: undefined })
})

// --- the days -----------------------------------------------------------------------------------

test("stamping a meal block gives each date its walk's recipe, and the day remembers what the block gave", () => {
  const days = applyStamps({}, [weekday()], { '2026-09-14': 'weekday', '2026-09-15': 'weekday' })
  const monday = days['2026-09-14'].tasks[0]
  const tuesday = days['2026-09-15'].tasks[0]
  expect(monday.recipeId).toBe(recipeForDate(WALK, '2026-09-14'))
  expect(tuesday.recipeId).toBe(recipeForDate(WALK, '2026-09-15'))
  expect(monday.recipeId).not.toBe(tuesday.recipeId)
  expect(monday.fromBlock?.recipeId).toBe(monday.recipeId)
})

test("a day still holding what its block gave follows the block's new list, and a recipe chosen on the day stays", () => {
  const days = applyStamps({}, [weekday()], { '2026-09-14': 'weekday' })
  const reordered = weekday([meal({ recipeIds: ['r3'], recipeId: 'r3' })])
  expect(refreshFromTemplate(days['2026-09-14'], [reordered], [])?.tasks[0].recipeId).toBe('r3')

  const chosen = { ...days['2026-09-14'], tasks: days['2026-09-14'].tasks.map(t => ({ ...t, recipeId: 'r2' === t.recipeId ? 'r0' : 'r2' })) }
  const kept = refreshFromTemplate(chosen, [reordered], [])
  expect((kept ?? chosen).tasks[0].recipeId).toBe(chosen.tasks[0].recipeId)
})

// --- the file -----------------------------------------------------------------------------------

test("a block's recipes pass the guard and an older device's, and are carried whole by a backup", () => {
  const data = plan()
  const text = exportJson(data)
  const file = JSON.parse(text)
  expect(validate(file)).toBe(true)
  expect(validateV228(file)).toBe(true)
  expect(importJson(text).templates[0].blocks[0].recipeIds).toEqual(WALK)

  const spoiled = JSON.parse(text)
  spoiled.templates[0].blocks[0].recipeIds = ['r0', 7]
  expect(validate(spoiled)).toBe(false)
})

// --- removing a recipe, and adding one ------------------------------------------------------------

test('a recipe removed leaves every block that walked it, and the undo puts both back', () => {
  const { undo } = actions.removeRecipe('r0')
  const block = getData().templates[0].blocks[0]
  expect(block.recipeIds).toEqual(['r1', 'r2'])
  // The block's one recipe for an older device is the first of what is left.
  expect(block.recipeId).toBe('r1')

  undo()
  expect(getData().templates[0].blocks[0]).toMatchObject({ recipeIds: WALK, recipeId: 'r0' })
  expect(getData().recipes.map(r => r.id)).toContain('r0')
})

test("a recipe added to a template's meal block joins its walk once, and a kind of meal left to the day gives way to it", () => {
  actions.resetForTests(plan([weekday([meal({ recipeIds: undefined, recipeId: undefined, mealType: 'breakfast' })])]))
  expect(actions.addRecipeToTemplate('weekday', 'r3', { blockId: 'breakfast' })).toBe(true)
  expect(getData().templates[0].blocks[0]).toMatchObject({ recipeIds: ['r3'], recipeId: 'r3' })
  expect(getData().templates[0].blocks[0].mealType).toBeUndefined()

  expect(actions.addRecipeToTemplate('weekday', 'r1', { blockId: 'breakfast' })).toBe(true)
  expect(actions.addRecipeToTemplate('weekday', 'r1', { blockId: 'breakfast' })).toBe(true)
  expect(getData().templates[0].blocks[0].recipeIds).toEqual(['r3', 'r1'])
})

test('a recipe added to a template as a new meal block is a meal at its time and length, with the recipe to walk', () => {
  expect(actions.addRecipeToTemplate('weekday', 'r3', { block: { title: 'Snack', time: '16:00', minutes: 10 } })).toBe(true)
  const added = getData().templates[0].blocks.at(-1)!
  expect(added).toMatchObject({ title: 'Snack', time: '16:00', minutes: 10, category: 'meal', recipeIds: ['r3'], recipeId: 'r3' })
  // Nothing is added for a recipe or a template that is not there, or a block that is not a meal.
  expect(actions.addRecipeToTemplate('weekday', 'gone', { blockId: 'breakfast' })).toBe(false)
  expect(actions.addRecipeToTemplate('gone', 'r1', { blockId: 'breakfast' })).toBe(false)
  actions.resetForTests(plan([weekday([meal({ id: 'walk', category: 'health' })])]))
  expect(actions.addRecipeToTemplate('weekday', 'r1', { blockId: 'walk' })).toBe(false)
})
