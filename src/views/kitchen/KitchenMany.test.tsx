import { beforeEach, expect, test } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KitchenView } from './KitchenView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { getUndo, runUndo } from '../../lib/undo'
import type { Recipe } from '../../lib/types'

/**
 * Kitchen with many recipes - v2.32: many pasted at once and saved with one
 * press, the meals on a card changed where it stands, and one meal given to
 * several recipes at once. Every recipe here is a generic one.
 */

beforeEach(() => {
  actions.resetForTests(defaultData())
})

function seed(recipes: Partial<Recipe>[]) {
  const data = defaultData()
  data.recipes = recipes.map((r, i) => ({ id: `r${i}`, title: `Recipe ${i}`, text: '', ...r }))
  actions.resetForTests(data)
}

/** Thirty generic recipes in Kitchen's own shape: the numbers, the ingredients, the steps. */
function thirty(kcal = 300): string {
  return Array.from({ length: 30 }, (_, i) =>
    [`NAME: Lunch: Bowl number ${i + 1}`, `${kcal + i} kcal, ${10 + i} g protein`, 'INGREDIENTS', 'a grain', 'a vegetable', 'STEPS', 'Cook the grain.'].join('\n'),
  ).join('\n')
}

async function pasteMany(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('button', { name: 'Paste many' }))
  await user.click(screen.getByRole('textbox', { name: 'Recipes' }))
  await user.paste(text)
}

/** The rows of the list under the field, each as its name and what saving it will do. */
function rows(): [string, string][] {
  return [...document.querySelectorAll('.kitchen-paste-row')].map(row => [
    row.querySelector('.kitchen-paste-name')?.textContent ?? '',
    row.querySelector('.kitchen-paste-state')?.textContent ?? '',
  ])
}

test('thirty recipes pasted at once are read into a list, and one Save saves them all with their numbers and meals', async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await pasteMany(user, thirty())
  expect(rows()).toHaveLength(30)
  expect(rows()[0]).toEqual(['Lunch: Bowl number 1', 'New'])
  const first = document.querySelector('.kitchen-paste-row')!
  expect(within(first as HTMLElement).getByText('300 kcal · 10 g protein')).toBeInTheDocument()
  expect(within(first as HTMLElement).getByRole('button', { name: 'Meals for Lunch: Bowl number 1: Lunch' })).toBeInTheDocument()
  expect(screen.getByText('30 new')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().recipes).toHaveLength(30)
  expect(getData().recipes[29]).toMatchObject({ title: 'Lunch: Bowl number 30', kcal: 329, protein: 39, mealTypes: ['lunch'] })
  // Back on the cards, and the whole import is one undo.
  expect(screen.getByRole('heading', { level: 2, name: 'Kitchen' })).toBeInTheDocument()
  expect(getUndo()?.label).toBe('Recipes saved: 30 added')
  act(() => runUndo())
  expect(getData().recipes).toEqual([])
})

test('the same text pasted a second time says each would update the one in Kitchen, and saving makes no second copy', async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await pasteMany(user, thirty())
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const ids = getData().recipes.map(r => r.id)

  await pasteMany(user, thirty(500))
  expect(rows().every(([, state]) => state === 'Updates the one in Kitchen')).toBe(true)
  expect(screen.getByText('30 updated')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().recipes.map(r => r.id)).toEqual(ids)
  expect(getData().recipes[0].kcal).toBe(500)
})

test("a row left out is not saved, and a row's meals changed in the row are the ones saved", async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await pasteMany(user, 'NAME: Lunch: A bean bowl\nwater\nNAME: A plain rice\nrice\nNAME: A soup\nbeans')
  await user.click(screen.getByRole('checkbox', { name: 'Save A soup' }))
  await user.click(screen.getByRole('button', { name: 'Meals for A plain rice: No meal' }))
  const six = within(screen.getByRole('group', { name: 'Meals for A plain rice' }))
  await user.click(six.getByRole('button', { name: 'Dinner' }))
  await user.click(six.getByRole('button', { name: 'Snack' }))
  expect(screen.getByText('2 new')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().recipes.map(r => [r.title, r.mealTypes])).toEqual([
    ['Lunch: A bean bowl', ['lunch']],
    ['A plain rice', ['dinner', 'snack']],
  ])
})

test('a piece with no name cannot be saved, and its row says how to name it', async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await pasteMany(user, '450 kcal\nINGREDIENTS\nwater')
  expect(rows()).toEqual([['No name', 'No name: start it with NAME:']])
  expect(screen.getByRole('checkbox', { name: 'Save No name' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  expect(screen.getByText('Nothing to save yet')).toBeInTheDocument()
})

test('Cancel and Escape go back to the cards and save nothing', async () => {
  const user = userEvent.setup()
  seed([{ title: 'A bean bowl' }])
  render(<KitchenView />)
  await pasteMany(user, 'NAME: A soup\nwater')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('heading', { level: 2, name: 'Kitchen' })).toBeInTheDocument()
  await pasteMany(user, 'NAME: A soup\nwater')
  await user.keyboard('{Escape}')
  expect(screen.getByRole('heading', { level: 2, name: 'Kitchen' })).toBeInTheDocument()
  expect(getData().recipes.map(r => r.title)).toEqual(['A bean bowl'])
})

test("a card's meals change where it stands, without opening the recipe, and it moves to its meal's section", async () => {
  const user = userEvent.setup()
  seed([{ title: 'A bean bowl' }, { title: 'A soup', mealTypes: ['dinner'] }])
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'Meals for A bean bowl: No meal yet' }))
  await user.click(within(screen.getByRole('group', { name: 'Meals for A bean bowl' })).getByRole('button', { name: 'Lunch' }))
  expect(getData().recipes[0].mealTypes).toEqual(['lunch'])
  // Still the cards, not the recipe's page.
  expect(screen.getByRole('heading', { level: 2, name: 'Kitchen' })).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Lunch' })).getByText('A bean bowl')).toBeInTheDocument()
})

test('Select picks cards rather than opening them, and gives one meal to every picked recipe or takes it off, in one press', async () => {
  const user = userEvent.setup()
  seed([{ title: 'A bean bowl' }, { title: 'A soup', mealTypes: ['dinner'] }, { title: 'A stew' }])
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'Select' }))
  expect(screen.queryByRole('searchbox')).toBeNull()
  await user.click(screen.getByRole('button', { name: /^A bean bowl/ }))
  await user.click(screen.getByRole('button', { name: /^A soup/ }))
  expect(screen.getByRole('button', { name: /^A bean bowl/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('2 picked')).toBeInTheDocument()

  await user.selectOptions(screen.getByRole('combobox', { name: 'Meal' }), 'lunch')
  await user.click(screen.getByRole('button', { name: 'Give' }))
  expect(getData().recipes.map(r => r.mealTypes)).toEqual([['lunch'], ['lunch', 'dinner'], undefined])
  expect(screen.getByText('Lunch given to 2 recipes')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Take off' }))
  expect(getData().recipes.map(r => r.mealTypes)).toEqual([undefined, ['dinner'], undefined])

  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(screen.getByRole('searchbox', { name: 'Search recipes' })).toBeInTheDocument()
  // Pressed again, a card opens its recipe.
  await user.click(screen.getByRole('button', { name: /^A stew/ }))
  expect(screen.getByRole('heading', { level: 2, name: 'A stew' })).toBeInTheDocument()
})

test('Pick all picks every card on the page, once each, and the bar says so', async () => {
  const user = userEvent.setup()
  seed([{ title: 'A bean bowl', mealTypes: ['lunch', 'dinner'] }, { title: 'A soup' }])
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'Select' }))
  await user.click(screen.getByRole('button', { name: 'Pick all' }))
  expect(screen.getByText('2 picked')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pick all' })).toBeDisabled()
})

// --- a name that says its meals, in New recipe ------------------------------------------------------

test("a name typed with a first word like Lunch: chooses its meals, and a press on them after is kept", async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'New recipe' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Lunch: A bean bowl')
  // More opens so the chosen meal is seen.
  const meals = within(screen.getByRole('group', { name: 'Meals' }))
  expect(meals.getByRole('button', { name: 'Lunch' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(meals.getByRole('button', { name: 'Dinner' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), ' with rice')
  expect(meals.getByRole('button', { name: 'Dinner' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().recipes[0]).toMatchObject({ title: 'Lunch: A bean bowl with rice', mealTypes: ['lunch', 'dinner'] })
})

test("a word of somebody's own from Settings chooses its meals too, and a word it does not know chooses none", async () => {
  const user = userEvent.setup()
  actions.setMealWords([{ word: 'Brunch', meals: ['breakfast', 'lunch'] }])
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'New recipe' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Brunch: Eggs on toast')
  const meals = within(screen.getByRole('group', { name: 'Meals' }))
  expect(meals.getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent)).toEqual(['Breakfast', 'Lunch'])

  await user.clear(screen.getByRole('textbox', { name: 'Name' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Soup: A thick one')
  // An unknown word leaves the meals as they were.
  expect(meals.getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent)).toEqual(['Breakfast', 'Lunch'])
})
