import { beforeEach, expect, test } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KitchenView } from './KitchenView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { getUndo, runUndo } from '../../lib/undo'
import type { Recipe } from '../../lib/types'

/**
 * Kitchen's list: the meals as chips over it, a field that searches the
 * recipes by name and by text, and each recipe as a quiet row - its name,
 * the kcal and the protein on one quiet line when they are known, and how
 * many times it was cooked. Every recipe here is a generic one.
 */

beforeEach(() => {
  actions.resetForTests(defaultData())
})

function seed(recipes: Partial<Recipe>[]) {
  const data = defaultData()
  data.recipes = recipes.map((r, i) => ({ id: `r${i}`, title: `Recipe ${i}`, text: 'a text', ...r }))
  actions.resetForTests(data)
}

const SAMPLE: Partial<Recipe>[] = [
  { title: 'Overnight oats', text: 'INGREDIENTS\noats\nmilk', mealTypes: ['breakfast', 'snack'], kcal: 380, protein: 18, cooked: 6 },
  { title: 'Lentil soup', text: 'INGREDIENTS\nred lentils\nonion', mealTypes: ['lunch', 'dinner'], kcal: 420 },
  { title: 'Banana toast', text: 'Toast the bread and slice a banana over it.', mealTypes: ['pre-gym', 'snack'], cooked: 1 },
]

/** The names in the list, top to bottom. */
function rows(): string[] {
  return screen.getAllByRole('listitem').map(row => row.querySelector('.kitchen-row-title')?.textContent ?? '')
}

test('with no recipes the page says what Kitchen is for, and draws no chips and no field', () => {
  render(<KitchenView />)
  expect(screen.getByRole('heading', { level: 2, name: 'Kitchen' })).toBeInTheDocument()
  expect(screen.getByText('The recipes you cook, with what goes in them and how. Add the first one to start.')).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Meal' })).toBeNull()
  expect(screen.queryByRole('searchbox')).toBeNull()
})

test('every recipe is a quiet row in the order of the names: its name, its kcal and protein when known, and how often it was cooked', () => {
  seed(SAMPLE)
  render(<KitchenView />)
  expect(rows()).toEqual(['Banana toast', 'Lentil soup', 'Overnight oats'])
  const [toast, soup, oats] = screen.getAllByRole('listitem')
  expect(within(oats).getByText('380 kcal · 18 g protein')).toBeInTheDocument()
  expect(within(oats).getByText('Cooked 6 times')).toBeInTheDocument()
  expect(within(soup).getByText('420 kcal')).toBeInTheDocument()
  expect(within(soup).queryByText(/Cooked/)).toBeNull()
  expect(within(toast).getByText('Cooked once')).toBeInTheDocument()
  expect(within(toast).queryByText(/kcal|protein/)).toBeNull()
})

test('the meal chips are All and the six, one pressed at a time, and a chip shows only its recipes', async () => {
  const user = userEvent.setup()
  seed(SAMPLE)
  render(<KitchenView />)
  const chips = screen.getByRole('group', { name: 'Meal' })
  expect(within(chips).getAllByRole('button').map(b => b.textContent)).toEqual(['All', 'Breakfast', 'Lunch', 'Dinner', 'Pre-gym', 'Post-gym', 'Snack'])
  expect(within(chips).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')

  await user.click(within(chips).getByRole('button', { name: 'Snack' }))
  expect(within(chips).getByRole('button', { name: 'Snack' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(chips).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  expect(rows()).toEqual(['Banana toast', 'Overnight oats'])

  await user.click(within(chips).getByRole('button', { name: 'Post-gym' }))
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  expect(screen.getByText('No post-gym recipes yet.')).toBeInTheDocument()

  await user.click(within(chips).getByRole('button', { name: 'All' }))
  expect(rows()).toHaveLength(3)
})

test('the field searches the names and the texts, within the meal that is chosen, and says when nothing matches', async () => {
  const user = userEvent.setup()
  seed(SAMPLE)
  render(<KitchenView />)
  const field = screen.getByRole('searchbox', { name: 'Search recipes' })

  await user.type(field, 'onion')
  expect(rows()).toEqual(['Lentil soup'])

  await user.clear(field)
  await user.type(field, 'toast')
  expect(rows()).toEqual(['Banana toast'])
  await user.click(screen.getByRole('button', { name: 'Breakfast' }))
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  expect(screen.getByText('No breakfast recipe matches "toast".')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'All' }))
  await user.clear(field)
  await user.type(field, 'zebra')
  expect(screen.getByText('No recipe matches "zebra".')).toBeInTheDocument()
})

test('opened for a meal, the list starts on that meal', () => {
  seed(SAMPLE)
  render(<KitchenView meal="lunch" />)
  expect(screen.getByRole('button', { name: 'Lunch' })).toHaveAttribute('aria-pressed', 'true')
  expect(rows()).toEqual(['Lentil soup'])
})

// --- a recipe's page ------------------------------------------------------------

test("a row opens the recipe's page: its name, its numbers and facts, the ingredients as a list and the steps in order", async () => {
  const user = userEvent.setup()
  seed([
    {
      title: 'Overnight oats',
      text: 'Made the night before.\n\nINGREDIENTS\n50 g oats\n- 150 ml milk\n\nSTEPS\n1. Stir it together.\n2. Leave it overnight.\n\nTO SERVE\nWith berries.',
      mealTypes: ['breakfast', 'snack'],
      kcal: 380,
      protein: 18,
      servings: 1,
      minutes: 5,
      cooked: 6,
    },
  ])
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: /Overnight oats/ }))

  expect(screen.getByRole('heading', { level: 2, name: 'Overnight oats' })).toBeInTheDocument()
  expect(screen.getByText('380 kcal · 18 g protein per serving')).toBeInTheDocument()
  expect(screen.getByText('Breakfast, snack · 1 serving · 5 min · Cooked 6 times')).toBeInTheDocument()
  expect(screen.getByText('Made the night before.')).toBeInTheDocument()
  const ingredients = screen.getByRole('list', { name: 'INGREDIENTS' })
  expect(within(ingredients).getAllByRole('listitem').map(li => li.textContent)).toEqual(['50 g oats', '150 ml milk'])
  const steps = screen.getByRole('list', { name: 'STEPS' })
  expect(steps.tagName).toBe('OL')
  expect(within(steps).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Stir it together.', 'Leave it overnight.'])
  expect(screen.getByRole('heading', { level: 3, name: 'TO SERVE' })).toBeInTheDocument()
  expect(screen.getByText('With berries.')).toBeInTheDocument()
  // The list is not under the page.
  expect(screen.queryByRole('searchbox')).toBeNull()
})

test('a recipe with no heading reads as it was typed', async () => {
  const user = userEvent.setup()
  seed([{ title: 'Banana toast', text: 'Toast the bread.\nSlice a banana over it.\n\nEat it warm.' }])
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: /Banana toast/ }))
  expect(screen.getAllByText(/Toast the bread|Eat it warm/).map(p => p.textContent)).toEqual(['Toast the bread.\nSlice a banana over it.', 'Eat it warm.'])
  expect(screen.queryByRole('list')).toBeNull()
})

test('Kitchen on the page goes back to the list as it was left - the same meal, the same search - with the focus on the row', async () => {
  const user = userEvent.setup()
  seed(SAMPLE)
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'Snack' }))
  await user.type(screen.getByRole('searchbox', { name: 'Search recipes' }), 'oats')
  await user.click(screen.getByRole('button', { name: /Overnight oats/ }))

  await user.click(screen.getByRole('button', { name: 'Kitchen' }))
  expect(screen.getByRole('button', { name: 'Snack' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('searchbox', { name: 'Search recipes' })).toHaveValue('oats')
  expect(screen.getByRole('button', { name: /Overnight oats/ })).toHaveFocus()
})

test('opened on a recipe, Kitchen starts on its page', () => {
  seed(SAMPLE)
  render(<KitchenView recipeId="r1" />)
  expect(screen.getByRole('heading', { level: 2, name: 'Lentil soup' })).toBeInTheDocument()
})

// --- writing one ------------------------------------------------------------------

test('New recipe asks for a name and a text, Save waits for both, and the saved recipe opens on its page', async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'New recipe' }))
  const name = screen.getByRole('textbox', { name: 'Name' })
  expect(name).toHaveFocus()
  const save = screen.getByRole('button', { name: 'Save' })
  expect(save).toBeDisabled()
  await user.type(name, 'A simple soup')
  expect(save).toBeDisabled()
  await user.type(screen.getByRole('textbox', { name: 'Recipe' }), 'INGREDIENTS{Enter}water{Enter}{Enter}STEPS{Enter}Boil it.')
  expect(save).toBeEnabled()
  // The optional fields wait behind More.
  expect(screen.queryByRole('spinbutton', { name: 'kcal' })).toBeNull()
  await user.click(save)

  expect(getData().recipes).toHaveLength(1)
  expect(getData().recipes[0]).toMatchObject({ title: 'A simple soup', text: 'INGREDIENTS\nwater\n\nSTEPS\nBoil it.' })
  expect(screen.getByRole('heading', { level: 2, name: 'A simple soup' })).toBeInTheDocument()
})

test('More opens the meals, the numbers for a serving, the servings and the minutes, and they are saved with the recipe', async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'New recipe' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Overnight oats')
  await user.type(screen.getByRole('textbox', { name: 'Recipe' }), 'Oats and milk, left overnight.')
  const more = screen.getByRole('button', { name: 'More' })
  expect(more).toHaveAttribute('aria-expanded', 'false')
  await user.click(more)
  expect(more).toHaveAttribute('aria-expanded', 'true')

  const meals = screen.getByRole('group', { name: 'Meals' })
  await user.click(within(meals).getByRole('button', { name: 'Snack' }))
  await user.click(within(meals).getByRole('button', { name: 'Breakfast' }))
  expect(within(meals).getByRole('button', { name: 'Breakfast' })).toHaveAttribute('aria-pressed', 'true')
  await user.type(screen.getByRole('spinbutton', { name: 'kcal' }), '380')
  await user.type(screen.getByRole('spinbutton', { name: 'Protein (g)' }), '18.5')
  await user.type(screen.getByRole('spinbutton', { name: 'Servings' }), '1')
  await user.type(screen.getByRole('spinbutton', { name: 'Minutes' }), '5')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(getData().recipes[0]).toMatchObject({ mealTypes: ['breakfast', 'snack'], kcal: 380, protein: 18.5, servings: 1, minutes: 5 })
  expect(getData().recipes[0].carbs).toBeUndefined()
})

test('Edit opens the form holding the recipe, with More open when it has more; Save rewrites it and Cancel leaves it', async () => {
  const user = userEvent.setup()
  seed(SAMPLE)
  render(<KitchenView recipeId="r0" />)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Overnight oats')
  expect(screen.getByRole('textbox', { name: 'Recipe' })).toHaveValue('INGREDIENTS\noats\nmilk')
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('spinbutton', { name: 'kcal' })).toHaveValue(380)

  await user.clear(screen.getByRole('textbox', { name: 'Name' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Cold oats')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(getData().recipes.find(r => r.id === 'r0')?.title).toBe('Overnight oats')
  expect(screen.getByRole('heading', { level: 2, name: 'Overnight oats' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await user.clear(screen.getByRole('spinbutton', { name: 'kcal' }))
  await user.clear(screen.getByRole('textbox', { name: 'Name' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Cold oats')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const edited = getData().recipes.find(r => r.id === 'r0')!
  expect(edited).toMatchObject({ title: 'Cold oats', protein: 18, cooked: 6 })
  expect(edited.kcal).toBeUndefined()
  expect(screen.getByRole('heading', { level: 2, name: 'Cold oats' })).toBeInTheDocument()
})

test('in the form Ctrl and Enter saves, and Escape cancels', async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'New recipe' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'A simple soup')
  await user.type(screen.getByRole('textbox', { name: 'Recipe' }), 'Boil water.')
  await user.keyboard('{Escape}')
  expect(getData().recipes).toEqual([])
  expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull()

  await user.click(screen.getByRole('button', { name: 'New recipe' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'A simple soup')
  await user.type(screen.getByRole('textbox', { name: 'Recipe' }), 'Boil water.')
  await user.keyboard('{Control>}{Enter}{/Control}')
  expect(getData().recipes.map(r => r.title)).toEqual(['A simple soup'])
})

test('Delete asks a second time, removes the recipe, goes back to the list and offers it back', async () => {
  const user = userEvent.setup()
  seed(SAMPLE)
  render(<KitchenView recipeId="r1" />)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await user.click(screen.getByRole('button', { name: 'Delete' }))
  expect(getData().recipes).toHaveLength(3)
  await user.click(screen.getByRole('button', { name: 'Delete?' }))
  expect(getData().recipes.map(r => r.title)).toEqual(['Overnight oats', 'Banana toast'])
  expect(screen.getByRole('searchbox', { name: 'Search recipes' })).toBeInTheDocument()
  expect(getUndo()?.label).toBe('Lentil soup deleted')
  act(() => runUndo())
  expect(getData().recipes.map(r => r.title)).toContain('Lentil soup')
})

// --- cooking ----------------------------------------------------------------------

test("Cook opens the recipe over everything, larger, with each ingredient and step to tick, and ticks are the cooking's own", async () => {
  const user = userEvent.setup()
  seed([
    {
      title: 'Overnight oats',
      text: 'Made the night before.\n\nINGREDIENTS\n50 g oats\n150 ml milk\n\nSTEPS\nStir it together.\nLeave it overnight.',
      cooked: 6,
    },
  ])
  render(<KitchenView recipeId="r0" />)
  const cook = screen.getByRole('button', { name: 'Cook' })
  await user.click(cook)

  const dialog = screen.getByRole('dialog', { name: 'Cook: Overnight oats' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(within(dialog).getByText('Made the night before.')).toBeInTheDocument()
  const ingredients = within(within(dialog).getByRole('group', { name: 'INGREDIENTS' })).getAllByRole('checkbox')
  expect(ingredients.map(box => box.closest('label')?.textContent)).toEqual(['50 g oats', '150 ml milk'])
  const steps = within(within(dialog).getByRole('group', { name: 'STEPS' })).getAllByRole('checkbox')
  expect(steps).toHaveLength(2)
  expect(steps[0]).toHaveAccessibleName('1 Stir it together.')

  await user.click(ingredients[0])
  expect(ingredients[0]).toBeChecked()
  await user.click(within(dialog).getByText('Stir it together.'))
  expect(steps[0]).toBeChecked()
  await user.click(ingredients[0])
  expect(ingredients[0]).not.toBeChecked()

  // Leaving counts nothing, and the ticks go with the cooking.
  await user.click(within(dialog).getByRole('button', { name: /Close/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(getData().recipes[0].cooked).toBe(6)
  expect(cook).toHaveFocus()
  await user.click(cook)
  expect(within(screen.getByRole('dialog')).getAllByRole('checkbox').some(box => (box as HTMLInputElement).checked)).toBe(false)
})

test('Done adds one to how many times it was cooked and closes, and Escape closes without counting', async () => {
  const user = userEvent.setup()
  seed([{ title: 'Banana toast', text: 'Toast the bread and slice a banana over it.', cooked: 1 }])
  render(<KitchenView recipeId="r0" />)

  await user.click(screen.getByRole('button', { name: 'Cook' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(getData().recipes[0].cooked).toBe(1)

  await user.click(screen.getByRole('button', { name: 'Cook' }))
  // A text with no lists is read, larger, with nothing to tick.
  expect(within(screen.getByRole('dialog')).queryAllByRole('checkbox')).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(getData().recipes[0].cooked).toBe(2)
  expect(screen.getByText('Cooked twice')).toBeInTheDocument()
})
