import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from '../store'
import { defaultData } from '../storage'
import { cleanRecipe } from '../kitchen'
import { readPastedRecipes } from '../recipeImport'
import { DEFAULT_MEAL_WORDS } from '../mealWords'

/**
 * Writing a recipe down, changing it and letting it go. A recipe is a name,
 * a text when there is one, and information a person may add when they have
 * it: which meals it is for, the numbers on a serving, how many servings, how
 * long. Nothing here adds anything up across recipes or days.
 *
 * Every recipe here is a generic one.
 */

beforeEach(() => {
  actions.resetForTests(defaultData())
})

test('a recipe is saved with a name, and a text when there is one, each trimmed at its ends', () => {
  expect(actions.addRecipe({ title: '   ', text: 'a text' })).toBeUndefined()
  expect(getData().recipes).toEqual([])
  // A name alone is a recipe, since v2.30: the method can be written later.
  const plain = actions.addRecipe({ title: 'A title', text: ' \n ' })
  expect(plain).toMatchObject({ title: 'A title', text: '' })
  actions.removeRecipe(plain!.id)

  const soup = actions.addRecipe({ title: '  A simple soup ', text: '\nINGREDIENTS\nwater\n\nSTEPS\nSimmer it.\n\n' })
  expect(soup).toMatchObject({ title: 'A simple soup', text: 'INGREDIENTS\nwater\n\nSTEPS\nSimmer it.' })
  expect(getData().recipes.map(r => r.id)).toEqual([soup!.id])
  expect(soup!.id).toMatch(/\S/)
  // Nothing optional is written that was not given, and nothing is cooked yet.
  expect(Object.keys(soup!).sort()).toEqual(['id', 'text', 'title', 'updatedAt'])
})

test('the optional fields are kept when they are real, and left out when they are not', () => {
  expect(
    cleanRecipe({
      title: 'A title',
      text: 'a text',
      mealTypes: ['snack', 'breakfast', 'snack'],
      kcal: 419.6,
      protein: 32.46,
      carbs: 0,
      fat: 12,
      servings: 2,
      minutes: 25,
    }),
  ).toEqual({
    title: 'A title',
    text: 'a text',
    // In the app's order, once each.
    mealTypes: ['breakfast', 'snack'],
    kcal: 420,
    protein: 32.5,
    carbs: 0,
    fat: 12,
    servings: 2,
    minutes: 25,
  })

  expect(
    cleanRecipe({
      title: 'A title',
      text: 'a text',
      mealTypes: ['brunch' as never],
      kcal: Number.NaN,
      protein: -3,
      carbs: 20_000,
      servings: 0,
      minutes: 0,
    }),
  ).toEqual({ title: 'A title', text: 'a text' })
})

test('an edit rewrites what the form holds, and keeps a times-cooked count an older device wrote', () => {
  const data = defaultData()
  data.recipes = [{ id: 'soup', title: 'A simple soup', text: 'a text', kcal: 300, mealTypes: ['lunch'], cooked: 1 }]
  actions.resetForTests(data)
  actions.updateRecipe('soup', { title: 'A thicker soup', text: 'another text', mealTypes: ['dinner'] })
  const [edited] = getData().recipes
  expect(edited).toMatchObject({ id: 'soup', title: 'A thicker soup', text: 'another text', mealTypes: ['dinner'], cooked: 1 })
  // Cleared in the form, gone from the recipe.
  expect(edited.kcal).toBeUndefined()

  // An edit that would leave no name changes nothing.
  actions.updateRecipe('soup', { title: '', text: 'another text' })
  expect(getData().recipes[0].title).toBe('A thicker soup')
})

test('there is nothing left to count a cooking with, and removing a recipe takes it out', () => {
  expect('markCooked' in actions).toBe(false)
  const soup = actions.addRecipe({ title: 'A simple soup', text: 'a text' })!
  const oats = actions.addRecipe({ title: 'Overnight oats', text: 'a text' })!
  expect(getData().recipes.find(r => r.id === soup.id)?.cooked).toBeUndefined()
  actions.removeRecipe(oats.id)
  expect(getData().recipes.map(r => r.title)).toEqual(['A simple soup'])
  expect(getData().tombstones?.[`recipe:${oats.id}`]).toBeDefined()
})

test('a removed recipe put back is the same recipe again, and its deletion is forgotten', () => {
  const soup = actions.addRecipe({ title: 'A simple soup', text: 'a text', kcal: 300 })!
  const before = getData().recipes[0]
  actions.removeRecipe(soup.id)
  actions.restoreRecipe(before)
  expect(getData().recipes).toHaveLength(1)
  expect(getData().recipes[0]).toMatchObject({ id: soup.id, title: 'A simple soup', kcal: 300 })
  expect(getData().tombstones?.[`recipe:${soup.id}`]).toBeUndefined()
  // Put back twice is put back once.
  actions.restoreRecipe(before)
  expect(getData().recipes).toHaveLength(1)
})

// --- many at once - v2.32 ------------------------------------------------------------------------

/** Thirty generic recipes in Kitchen's own shape, as they would be pasted. */
function pasted(count = 30, kcal = 300): string {
  return Array.from({ length: count }, (_, i) =>
    [`NAME: Lunch: Bowl number ${i + 1}`, `${kcal + i} kcal, ${10 + i} g protein`, '', 'INGREDIENTS', 'a grain', '', 'STEPS', 'Cook it.'].join('\n'),
  ).join('\n')
}

test('thirty recipes pasted at once are thirty recipes, each with its numbers and the meal its name says', () => {
  const rows = readPastedRecipes(pasted(), [], DEFAULT_MEAL_WORDS)
  const done = actions.importRecipes(rows.map(r => ({ ...r.input, existingId: r.existingId })))
  expect(done).toMatchObject({ added: 30, updated: 0 })
  const recipes = getData().recipes
  expect(recipes).toHaveLength(30)
  expect(recipes[0]).toMatchObject({ title: 'Lunch: Bowl number 1', kcal: 300, protein: 10, mealTypes: ['lunch', 'dinner'] })
  expect(recipes[29]).toMatchObject({ title: 'Lunch: Bowl number 30', kcal: 329, protein: 39 })
})

test('the same text pasted a second time makes no second copy: each name writes over its recipe, keeping its id', () => {
  const first = readPastedRecipes(pasted(), [], DEFAULT_MEAL_WORDS)
  actions.importRecipes(first.map(r => ({ ...r.input, existingId: r.existingId })))
  const ids = getData().recipes.map(r => r.id)

  const second = readPastedRecipes(pasted(30, 500), getData().recipes, DEFAULT_MEAL_WORDS)
  expect(second.every(r => r.state === 'update')).toBe(true)
  const done = actions.importRecipes(second.map(r => ({ ...r.input, existingId: r.existingId })))
  expect(done).toMatchObject({ added: 0, updated: 30 })
  expect(getData().recipes.map(r => r.id)).toEqual(ids)
  expect(getData().recipes[0]).toMatchObject({ kcal: 500, protein: 10 })
})

test('an update writes the text and the numbers it says, and keeps a number it does not say and the count of times cooked', () => {
  const had = actions.addRecipe({ title: 'A bowl', text: 'old', kcal: 400, fat: 12, mealTypes: ['dinner'] })!
  actions.resetForTests({ ...getData(), recipes: getData().recipes.map(r => ({ ...r, cooked: 3 })) })
  const [row] = readPastedRecipes('NAME: A bowl\n450 kcal\nINGREDIENTS\nrice', getData().recipes, DEFAULT_MEAL_WORDS)
  actions.importRecipes([{ ...row.input, existingId: row.existingId }])
  expect(getData().recipes).toEqual([
    expect.objectContaining({ id: had.id, title: 'A bowl', text: '450 kcal\nINGREDIENTS\nrice', kcal: 450, fat: 12, mealTypes: ['dinner'], cooked: 3 }),
  ])
})

test('an import is one step to undo, and a row with no name is never saved', () => {
  actions.addRecipe({ title: 'Kept as it was', text: 'old' })
  const before = getData().recipes
  const { undo } = actions.importRecipes([
    { title: 'A new one', text: 'rice', mealTypes: [] },
    { title: '   ', text: 'water', mealTypes: ['lunch'] },
    { title: 'Kept as it was', text: 'new', mealTypes: [], existingId: before[0].id },
  ])
  expect(getData().recipes.map(r => r.title)).toEqual(['Kept as it was', 'A new one'])
  undo()
  // As it was - its stamp is the undo's, which is what carries it to another device.
  const bare = (recipes: typeof before) => recipes.map(({ updatedAt: _stamp, ...rest }) => rest)
  expect(bare(getData().recipes)).toEqual(bare(before))
})

test("a recipe's meals are chosen on its card, and everything else about it stays", () => {
  const bowl = actions.addRecipe({ title: 'A bowl', text: 'rice', kcal: 400 })!
  actions.setRecipeMeals(bowl.id, ['snack', 'lunch'])
  expect(getData().recipes[0]).toMatchObject({ title: 'A bowl', text: 'rice', kcal: 400, mealTypes: ['lunch', 'snack'] })
  actions.setRecipeMeals(bowl.id, [])
  expect(getData().recipes[0].mealTypes).toBeUndefined()
})

test('one meal given to several recipes at once, and taken off them, touches only those', () => {
  const [a, b, c] = ['A bowl', 'A soup', 'A stew'].map(title => actions.addRecipe({ title, text: '', mealTypes: title === 'A soup' ? ['dinner'] : [] })!)
  actions.setMealOnRecipes([a.id, b.id], 'lunch', true)
  expect(getData().recipes.map(r => r.mealTypes)).toEqual([['lunch'], ['lunch', 'dinner'], undefined])
  actions.setMealOnRecipes([a.id, b.id, c.id], 'lunch', false)
  expect(getData().recipes.map(r => r.mealTypes)).toEqual([undefined, ['dinner'], undefined])
})

test("the words a recipe's name starts with are kept as Settings writes them, and travel with the settings", () => {
  actions.setMealWords([
    { word: ' Brunch ', meals: ['lunch', 'breakfast'] },
    { word: 'brunch', meals: ['snack'] },
  ])
  expect(getData().settings.mealWords).toEqual([{ word: 'Brunch', meals: ['breakfast', 'lunch'] }])
  expect(getData().settingsUpdatedAt?.mealWords).toBeDefined()
})

/**
 * A templates file is often pasted before the recipes it names - the week
 * first, the recipes after. The block keeps the name and takes the recipe as
 * soon as Kitchen has one of it: the owner's brief of 2026-09-22, part 2.
 */
test('a template meal block waiting for a recipe takes it when the recipes are pasted in', () => {
  const file = JSON.stringify({
    templates: [{ name: 'A day', blocks: [{ time: '12:00', title: 'Lunch', mealType: 'lunch', recipes: ['A bean bowl'] }] }],
  })
  const { read } = actions.importTemplatesJson(file)
  expect(read.templates[0].action).toBe('create')
  const waiting = getData().templates.find(t => t.name === 'A day')!
  expect(waiting.blocks[0].waitingRecipes).toEqual(['A bean bowl'])

  const rows = readPastedRecipes(['NAME: A bean bowl', '400 kcal', 'INGREDIENTS', 'beans'].join('\n'), [], DEFAULT_MEAL_WORDS)
  actions.importRecipes(rows.map(r => r.input))

  const block = getData().templates.find(t => t.name === 'A day')!.blocks[0]
  const bowl = getData().recipes.find(r => r.title === 'A bean bowl')!
  expect(block.recipeIds).toEqual([bowl.id])
  expect(block.waitingRecipes).toBeUndefined()
})

test('a recipe written one at a time is taken by a block waiting for its name, whatever its case', () => {
  const file = JSON.stringify({
    templates: [{ name: 'A day', blocks: [{ time: '12:00', title: 'Lunch', mealType: 'lunch', recipes: ['A Bean Bowl'] }] }],
  })
  actions.importTemplatesJson(file)
  const bowl = actions.addRecipe({ title: 'a bean bowl', text: 'beans' })!

  const block = getData().templates.find(t => t.name === 'A day')!.blocks[0]
  expect(block.recipeIds).toEqual([bowl.id])
  expect(block.waitingRecipes).toBeUndefined()
})
