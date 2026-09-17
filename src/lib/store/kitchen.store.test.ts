import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from '../store'
import { defaultData } from '../storage'
import { cleanRecipe } from '../kitchen'

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
