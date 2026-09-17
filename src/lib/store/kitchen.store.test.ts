import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from '../store'
import { defaultData } from '../storage'
import { cleanRecipe } from '../kitchen'

/**
 * Writing a recipe down, changing it, cooking it and letting it go. A recipe
 * is a name and a text, and the rest is information a person may add when
 * they have it: which meals it is for, the numbers on a serving, how many
 * servings, how long. Nothing here adds anything up across recipes or days.
 *
 * Every recipe here is a generic one.
 */

beforeEach(() => {
  actions.resetForTests(defaultData())
})

test('a recipe is saved with a name and a text, each trimmed at its ends, and not without both', () => {
  expect(actions.addRecipe({ title: '   ', text: 'a text' })).toBeUndefined()
  expect(actions.addRecipe({ title: 'A title', text: ' \n ' })).toBeUndefined()
  expect(getData().recipes).toEqual([])

  const soup = actions.addRecipe({ title: '  A simple soup ', text: '\nINGREDIENTS\nwater\n\nSTEPS\nSimmer it.\n\n' })
  expect(soup).toMatchObject({ title: 'A simple soup', text: 'INGREDIENTS\nwater\n\nSTEPS\nSimmer it.' })
  expect(getData().recipes).toEqual([soup])
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

test('an edit rewrites what the form holds and keeps how many times it was cooked', () => {
  const soup = actions.addRecipe({ title: 'A simple soup', text: 'a text', kcal: 300, mealTypes: ['lunch'] })!
  actions.markCooked(soup.id)
  actions.updateRecipe(soup.id, { title: 'A thicker soup', text: 'another text', mealTypes: ['dinner'] })
  const [edited] = getData().recipes
  expect(edited).toMatchObject({ id: soup.id, title: 'A thicker soup', text: 'another text', mealTypes: ['dinner'], cooked: 1 })
  // Cleared in the form, gone from the recipe.
  expect(edited.kcal).toBeUndefined()

  // An edit that would leave no name or no text changes nothing.
  actions.updateRecipe(soup.id, { title: '', text: 'another text' })
  expect(getData().recipes[0].title).toBe('A thicker soup')
})

test('cooking a recipe adds one to how many times it was cooked, and removing it takes it out', () => {
  const soup = actions.addRecipe({ title: 'A simple soup', text: 'a text' })!
  const oats = actions.addRecipe({ title: 'Overnight oats', text: 'a text' })!
  actions.markCooked(soup.id)
  actions.markCooked(soup.id)
  expect(getData().recipes.find(r => r.id === soup.id)?.cooked).toBe(2)
  expect(getData().recipes.find(r => r.id === oats.id)?.cooked).toBeUndefined()

  actions.markCooked('no-such-recipe')
  actions.removeRecipe(oats.id)
  expect(getData().recipes.map(r => r.title)).toEqual(['A simple soup'])
  expect(getData().tombstones?.[`recipe:${oats.id}`]).toBeDefined()
})

test('a removed recipe put back is the same recipe again, and its deletion is forgotten', () => {
  const soup = actions.addRecipe({ title: 'A simple soup', text: 'a text', kcal: 300 })!
  actions.markCooked(soup.id)
  const before = getData().recipes[0]
  actions.removeRecipe(soup.id)
  actions.restoreRecipe(before)
  expect(getData().recipes).toHaveLength(1)
  expect(getData().recipes[0]).toMatchObject({ id: soup.id, title: 'A simple soup', kcal: 300, cooked: 1 })
  expect(getData().tombstones?.[`recipe:${soup.id}`]).toBeUndefined()
  // Put back twice is put back once.
  actions.restoreRecipe(before)
  expect(getData().recipes).toHaveLength(1)
})
