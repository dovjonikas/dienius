import { beforeEach, expect, test } from 'vitest'
import { compareSummaries, summarise } from './cloudBackup'
import { defaultData, exportJson, importJson, validate } from './storage'
import { collectEntities, stampChanges } from './syncEntities'
import { isSyncableState, mergeStates, normaliseRemote } from './syncMerge'
import type { AppData, Recipe } from './types'

/**
 * Kitchen's data: a recipe is an entity of its own - CONVENTIONS 7 - in a
 * top-level list beside the library, not a library list, because a recipe
 * has no units to count through. These are the promises every entity makes:
 * the guard refuses a file that is wrong anywhere in a recipe, a backup
 * carries every field out and back, a backup from before Kitchen loads with
 * none, and two devices merge recipe by recipe.
 *
 * Every recipe here is a generic one.
 */

const MORNING = '2026-09-01T08:00:00.000Z'
const NOON = '2026-09-01T12:00:00.000Z'
const EVENING = '2026-09-01T20:00:00.000Z'
const NOW = '2026-09-02T09:00:00.000Z'

let base: AppData

beforeEach(() => {
  base = defaultData()
})

function recipe(over: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    title: 'A simple soup',
    text: 'INGREDIENTS\nwater\nvegetables\n\nSTEPS\nChop the vegetables.\nSimmer them.',
    ...over,
  }
}

function withRecipes(data: AppData, recipes: Recipe[]): AppData {
  return { ...data, recipes }
}

/** A payload as a file holds it, with the recipes list replaced. */
function payload(recipes: unknown): unknown {
  return { ...JSON.parse(exportJson(base)), recipes }
}

// --- the guard ---------------------------------------------------------------

test('an empty plan has no recipes, and a recipe with every field validates', () => {
  expect(base.recipes).toEqual([])
  const full = recipe({
    mealTypes: ['breakfast', 'post-gym'],
    kcal: 420,
    protein: 32.5,
    carbs: 40,
    fat: 12,
    servings: 2,
    minutes: 25,
    cooked: 3,
    updatedAt: MORNING,
  })
  expect(validate(payload([full]))).toBe(true)
  expect(validate(payload([recipe()]))).toBe(true)
})

test('a recipe without a title or a text as strings is refused, and so is a list that is not one', () => {
  expect(validate(payload([{ id: 'r1', text: 'a text' }]))).toBe(false)
  expect(validate(payload([{ id: 'r1', title: 'A title' }]))).toBe(false)
  expect(validate(payload([recipe({ text: 12 as unknown as string })]))).toBe(false)
  expect(validate(payload([{ title: 'A title', text: 'a text' }]))).toBe(false)
  expect(validate(payload({ r1: recipe() }))).toBe(false)
})

test('a meal type this app does not have is refused', () => {
  expect(validate(payload([recipe({ mealTypes: ['lunch', 'dinner', 'snack', 'pre-gym'] })]))).toBe(true)
  expect(validate(payload([recipe({ mealTypes: ['brunch'] as unknown as Recipe['mealTypes'] })]))).toBe(false)
  expect(validate(payload([recipe({ mealTypes: 'lunch' as unknown as Recipe['mealTypes'] })]))).toBe(false)
})

test('the numbers on a recipe are numbers from nought, the serving count and the minutes whole, and none absurd', () => {
  const refused: Partial<Recipe>[] = [
    { kcal: -1 },
    { kcal: 1_000_000 },
    { protein: '12' as unknown as number },
    { carbs: -0.5 },
    { fat: 99_999 },
    { servings: 0 },
    { servings: 1.5 },
    { minutes: -5 },
    { minutes: 12.5 },
    { cooked: 1.5 },
    { cooked: -1 },
    { cooked: 10_000_000 },
  ]
  for (const over of refused) expect(validate(payload([recipe(over)])), JSON.stringify(over)).toBe(false)
  expect(validate(payload([recipe({ kcal: 0, protein: 0.5, carbs: 0, fat: 0, servings: 1, minutes: 0, cooked: 0 })]))).toBe(true)
})

// --- the file ----------------------------------------------------------------

test('every field of a recipe survives export and re-import, and the file is the plan again', () => {
  const data = withRecipes(base, [
    recipe({ mealTypes: ['dinner'], kcal: 520, protein: 28, carbs: 61.5, fat: 14, servings: 4, minutes: 40, cooked: 7 }),
    recipe({ id: 'r2', title: 'Overnight oats', text: 'Oats, milk and fruit, left in the fridge overnight.' }),
  ])
  const text = exportJson(data)
  const back = importJson(text)
  expect(back.recipes).toEqual(data.recipes)
  expect(exportJson(back)).toBe(text)
})

test('a backup from before Kitchen existed loads, with no recipes and nothing else changed', () => {
  const data = defaultData()
  data.picture = { text: 'a first line' }
  const old = JSON.parse(exportJson(data)) as Record<string, unknown>
  delete old.recipes
  const loaded = importJson(JSON.stringify(old))
  expect(loaded.recipes).toEqual([])
  expect({ ...loaded, recipes: undefined }).toEqual({ ...data, recipes: undefined })
})

// --- sync ----------------------------------------------------------------------

/** A state as it would be after a device made a change at a given instant. */
function device(build: (data: AppData) => AppData, at: string, from = base): AppData {
  return stampChanges(from, build(from), at)
}

test('a recipe is an entity of its own: a new or changed one is stamped, and a removed one leaves a tombstone', () => {
  const added = device(d => withRecipes(d, [recipe(), recipe({ id: 'r2', title: 'Overnight oats' })]), MORNING)
  expect(added.recipes.map(r => r.updatedAt)).toEqual([MORNING, MORNING])
  expect(collectEntities(added).get('recipe:r1')?.kind).toBe('recipe')

  const cooked = device(d => withRecipes(d, [{ ...d.recipes[0], cooked: 1 }, d.recipes[1]]), NOON, added)
  expect(cooked.recipes[0].updatedAt).toBe(NOON)
  // The one nobody touched keeps its stamp.
  expect(cooked.recipes[1].updatedAt).toBe(MORNING)

  const removed = device(d => withRecipes(d, [d.recipes[0]]), EVENING, cooked)
  expect(removed.tombstones?.['recipe:r2']).toBe(EVENING)
})

test('a recipe cooked on the phone and another edited on the PC both survive a merge', () => {
  const shared = device(d => withRecipes(d, [recipe(), recipe({ id: 'r2', title: 'Overnight oats' })]), MORNING)
  const phone = device(d => withRecipes(d, [{ ...d.recipes[0], cooked: 1 }, d.recipes[1]]), NOON, shared)
  const pc = device(d => withRecipes(d, [d.recipes[0], { ...d.recipes[1], kcal: 350 }]), EVENING, shared)

  const merged = mergeStates(phone, pc, NOW).data
  expect(merged.recipes.find(r => r.id === 'r1')?.cooked).toBe(1)
  expect(merged.recipes.find(r => r.id === 'r2')?.kcal).toBe(350)
})

test('a recipe deleted on one device stays deleted after a merge with one that still has it', () => {
  const shared = device(d => withRecipes(d, [recipe()]), MORNING)
  const phone = device(d => withRecipes(d, []), NOON, shared)

  const merged = mergeStates(shared, phone, NOW)
  expect(merged.data.recipes).toEqual([])
  expect(merged.deleted).toBe(1)
  expect(mergeStates(phone, shared, NOW).data.recipes).toEqual([])
})

test('a state whose recipes are not a list is not one to merge with, and one without them knows nothing about them', () => {
  expect(isSyncableState({ days: {}, templates: [], settings: {}, recipes: {} })).toBe(false)
  expect(isSyncableState({ days: {}, templates: [], settings: {}, recipes: [] })).toBe(true)

  const local = device(d => withRecipes(d, [recipe()]), NOON)
  const partial = normaliseRemote({ days: {}, templates: [], settings: local.settings } as unknown as AppData)
  expect(partial.recipes).toEqual([])
  const merged = mergeStates(local, partial, NOW)
  expect(merged.data.recipes).toHaveLength(1)
  expect(merged.deleted).toBe(0)
})

// --- the restore's summary -------------------------------------------------------

test("a copy's summary counts its recipes, and a restore that would bring fewer says so", () => {
  const here = withRecipes(base, [recipe(), recipe({ id: 'r2' })])
  const cloud = defaultData()
  expect(summarise(here).recipes).toBe(2)
  const row = compareSummaries(summarise(here), summarise(cloud)).find(r => r.label === 'Recipes')
  expect(row).toMatchObject({ here: 2, cloud: 0, loses: true })
})

// --- a meal on the day and in a template ------------------------------------------

test('a template block and a task may point at a recipe or a kind of meal, carried whole by a backup, and a meal that is not one is refused', () => {
  const data = withRecipes(base, [recipe()])
  data.templates = [
    {
      id: 't',
      name: 'A day',
      color: '#a7c4f5',
      blocks: [
        { id: 'b1', title: 'Lunch', category: 'meal', recipeId: 'r1' },
        { id: 'b2', title: 'Dinner', category: 'meal', mealType: 'dinner' },
      ],
    },
  ]
  data.days['2026-09-01'] = {
    date: '2026-09-01',
    tasks: [{ id: 'k', title: 'Lunch', done: false, category: 'meal', recipeId: 'r1', mealType: 'lunch' }],
  }
  const text = exportJson(data)
  const back = importJson(text)
  expect(back.templates[0].blocks.map(b => [b.recipeId, b.mealType])).toEqual([['r1', undefined], [undefined, 'dinner']])
  expect(back.days['2026-09-01'].tasks[0]).toMatchObject({ recipeId: 'r1', mealType: 'lunch' })
  expect(exportJson(back)).toBe(text)

  const file = JSON.parse(text) as { templates: { blocks: Record<string, unknown>[] }[]; days: Record<string, { tasks: Record<string, unknown>[] }> }
  file.templates[0].blocks[1].mealType = 'brunch'
  expect(validate(file)).toBe(false)
  file.templates[0].blocks[1].mealType = 'dinner'
  file.days['2026-09-01'].tasks[0].recipeId = 12
  expect(validate(file)).toBe(false)
  file.days['2026-09-01'].tasks[0].recipeId = 'r1'
  expect(validate(file)).toBe(true)
})
