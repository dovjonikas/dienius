import { beforeEach, expect, test } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KitchenView } from './KitchenView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { getUndo, runUndo } from '../../lib/undo'
import type { Recipe } from '../../lib/types'
import { categoryColor } from '../../lib/categories'

/**
 * Kitchen: the meals as chips, a field that searches the recipes by name and by
 * text, and the recipes on cards in sections by meal - since v2.30,
 * docs/RESEARCH-KITCHEN.md section 6.4. A card is a recipe's name, how long and
 * how many servings, its kcal and protein, and its first ingredients. Every
 * recipe here is a generic one.
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

/** The names on the cards, top to bottom, across every section. */
function rows(): string[] {
  return [...document.querySelectorAll('.kitchen-card-title')].map(title => title.textContent ?? '')
}

/** Kitchen's sections as they read: each one's heading, when it has one, and the names on its cards. */
function sections(): [string, string[]][] {
  return [...document.querySelectorAll<HTMLElement>('.kitchen-section')].map(section => [
    section.querySelector('.kitchen-section-name')?.textContent ?? '',
    [...section.querySelectorAll('.kitchen-card-title')].map(title => title.textContent ?? ''),
  ])
}

test('with no recipes the page says what Kitchen is for, and draws no chips and no field', () => {
  render(<KitchenView />)
  expect(screen.getByRole('heading', { level: 2, name: 'Kitchen' })).toBeInTheDocument()
  expect(screen.getByText('The recipes you cook, with what goes in them and how. Add the first one to start, or paste many at once.')).toBeInTheDocument()
  // Both ways in stand on the empty page, where they stand on a full one.
  expect(screen.getByRole('button', { name: 'New recipe' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Paste many' })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Meal' })).toBeNull()
  expect(screen.queryByRole('searchbox')).toBeNull()
})

test('the recipes stand on cards in sections by meal, each with how many it has, a recipe for two meals under both', () => {
  seed([...SAMPLE, { title: 'Apple', text: '' }])
  render(<KitchenView />)
  expect(sections()).toEqual([
    ['Breakfast', ['Overnight oats']],
    ['Lunch', ['Lentil soup']],
    ['Dinner', ['Lentil soup']],
    ['Pre-gym', ['Banana toast']],
    ['Snack', ['Banana toast', 'Overnight oats']],
    ['No meal yet', ['Apple']],
  ])
  const snack = screen.getByRole('region', { name: 'Snack' })
  expect(within(snack).getByText('2', { selector: '.kitchen-section-count' })).toBeInTheDocument()
  // How often a recipe was cooked was Cook's to count, and Cook is gone.
  expect(screen.queryByText(/Cooked/)).toBeNull()
})

test("a card is the recipe's name, how long and how many servings, its kcal and protein, and its first ingredients", () => {
  seed([
    {
      title: 'Chicken and rice bowl',
      text: 'INGREDIENTS\n2 chicken breasts\n150 g rice\n1 cucumber\nSoy sauce',
      mealTypes: ['lunch'],
      minutes: 30,
      servings: 2,
      kcal: 610,
      protein: 45,
    },
  ])
  render(<KitchenView />)
  const card = screen.getByRole('button', { name: /^Chicken and rice bowl/ })
  expect(within(card).getByText('30 min · 2 servings')).toBeInTheDocument()
  expect(within(card).getByText('610 kcal · 45 g protein')).toBeInTheDocument()
  expect(within(card).getByText('2 chicken breasts · 150 g rice · 1 cucumber')).toBeInTheDocument()
})

test("the cards carry the Meals category's colour, the mark a meal block has on the day", () => {
  seed(SAMPLE)
  const { container } = render(<KitchenView />)
  expect((container.querySelector('.kitchen-sections') as HTMLElement).style.getPropertyValue('--cat')).toBe(categoryColor('meal', getData().categories))
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
  // One meal is one grid, and the chip already says which.
  expect(sections()).toEqual([['', ['Banana toast', 'Overnight oats']]])

  await user.click(within(chips).getByRole('button', { name: 'Post-gym' }))
  expect(rows()).toHaveLength(0)
  expect(screen.getByText('No post-gym recipes yet.')).toBeInTheDocument()

  await user.click(within(chips).getByRole('button', { name: 'All' }))
  expect(sections()).toHaveLength(5)
})

test('the field searches the names and the texts, within the meal that is chosen, and says when nothing matches', async () => {
  const user = userEvent.setup()
  seed(SAMPLE)
  render(<KitchenView />)
  const field = screen.getByRole('searchbox', { name: 'Search recipes' })

  await user.type(field, 'onion')
  expect(sections()).toEqual([
    ['Lunch', ['Lentil soup']],
    ['Dinner', ['Lentil soup']],
  ])

  await user.clear(field)
  await user.type(field, 'toast')
  expect(sections()).toEqual([
    ['Pre-gym', ['Banana toast']],
    ['Snack', ['Banana toast']],
  ])
  await user.click(screen.getByRole('button', { name: 'Breakfast' }))
  expect(rows()).toHaveLength(0)
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

test("a card opens the recipe's page: its name, its numbers and facts, the ingredients as a list and the steps in order", async () => {
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
  // A breakfast that is also a snack stands under both; either card opens it.
  const [underBreakfast] = screen.getAllByRole('button', { name: /Overnight oats/ })
  await user.click(underBreakfast)

  expect(screen.getByRole('heading', { level: 2, name: 'Overnight oats' })).toBeInTheDocument()
  expect(screen.getByText('380 kcal · 18 g protein per serving')).toBeInTheDocument()
  // How often it was cooked is kept in the data and said nowhere since v2.30.
  expect(screen.getByText('Breakfast, snack · 1 serving · 5 min')).toBeInTheDocument()
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
  await user.click(screen.getByRole('button', { name: /^Banana toast/ }))
  expect(screen.getAllByText(/Toast the bread|Eat it warm/).map(p => p.textContent)).toEqual(['Toast the bread.\nSlice a banana over it.', 'Eat it warm.'])
  expect(screen.queryByRole('list')).toBeNull()
})

test('Kitchen on the page goes back to the cards as they were left - the same meal, the same search - with the focus on the card', async () => {
  const user = userEvent.setup()
  seed(SAMPLE)
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'Snack' }))
  await user.type(screen.getByRole('searchbox', { name: 'Search recipes' }), 'oats')
  await user.click(screen.getByRole('button', { name: /^Overnight oats/ }))

  await user.click(screen.getByRole('button', { name: 'Kitchen' }))
  expect(screen.getByRole('button', { name: 'Snack' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('searchbox', { name: 'Search recipes' })).toHaveValue('oats')
  expect(screen.getByRole('button', { name: /^Overnight oats/ })).toHaveFocus()
})

test('opened on a recipe, Kitchen starts on its page', () => {
  seed(SAMPLE)
  render(<KitchenView recipeId="r1" />)
  expect(screen.getByRole('heading', { level: 2, name: 'Lentil soup' })).toBeInTheDocument()
})

// --- writing one ------------------------------------------------------------------

test('a recipe can be saved with only its name, and its page says that nothing is written yet', async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'New recipe' }))
  const save = screen.getByRole('button', { name: 'Save' })
  expect(save).toBeDisabled()
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Greek yogurt with berries')
  expect(save).toBeEnabled()
  await user.click(save)

  expect(getData().recipes[0]).toMatchObject({ title: 'Greek yogurt with berries', text: '' })
  expect(screen.getByRole('heading', { level: 2, name: 'Greek yogurt with berries' })).toBeInTheDocument()
  expect(screen.getByText('Nothing written yet.')).toBeInTheDocument()
})

test('New recipe asks for a name and the recipe, and the saved recipe opens on its page', async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'New recipe' }))
  const name = screen.getByRole('textbox', { name: 'Name' })
  expect(name).toHaveFocus()
  const save = screen.getByRole('button', { name: 'Save' })
  expect(save).toBeDisabled()
  await user.type(name, 'A simple soup')
  expect(save).toBeEnabled()
  await user.type(screen.getByRole('textbox', { name: 'Recipe' }), 'INGREDIENTS{Enter}water{Enter}{Enter}STEPS{Enter}Boil it.')
  // The optional fields wait behind More.
  expect(screen.queryByRole('spinbutton', { name: 'kcal' })).toBeNull()
  await user.click(save)

  expect(getData().recipes).toHaveLength(1)
  expect(getData().recipes[0]).toMatchObject({ title: 'A simple soup', text: 'INGREDIENTS\nwater\n\nSTEPS\nBoil it.' })
  expect(screen.getByRole('heading', { level: 2, name: 'A simple soup' })).toBeInTheDocument()
})

// v2.30: numbers typed into the text fill their fields, the way the Library's
// add line reads a book's length - docs/RESEARCH-KITCHEN.md section 6.3.
test('numbers typed into the recipe fill their fields, More opens to show them, and they are saved', async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'New recipe' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Chicken and rice bowl')
  const more = screen.getByRole('button', { name: 'More' })
  expect(more).toHaveAttribute('aria-expanded', 'false')
  await user.type(screen.getByRole('textbox', { name: 'Recipe' }), 'Per serving: 520 kcal, 38 g protein{Enter}Serves 2, ready in 30 min')

  expect(more).toHaveAttribute('aria-expanded', 'true')
  // The line under the field says it can.
  expect(screen.getByText(/450 kcal or Serves 2 fills its field under More/)).toBeInTheDocument()
  expect(screen.getByRole('spinbutton', { name: 'kcal' })).toHaveValue(520)
  expect(screen.getByRole('spinbutton', { name: 'Protein (g)' })).toHaveValue(38)
  expect(screen.getByRole('spinbutton', { name: 'Servings' })).toHaveValue(2)
  expect(screen.getByRole('spinbutton', { name: 'Minutes' })).toHaveValue(30)

  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().recipes[0]).toMatchObject({ kcal: 520, protein: 38, servings: 2, minutes: 30 })
})

test('a field changed rewrites the number the text says, and a field cleared takes it out of the text', async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'New recipe' }))
  const recipe = screen.getByRole('textbox', { name: 'Recipe' })
  await user.type(recipe, 'Per serving: 450 kcal, 30 g protein')

  fireEvent.change(screen.getByRole('spinbutton', { name: 'kcal' }), { target: { value: '500' } })
  expect(recipe).toHaveValue('Per serving: 500 kcal, 30 g protein')
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Protein (g)' }), { target: { value: '' } })
  expect(recipe).toHaveValue('Per serving: 500 kcal')
})

test('a field filled by hand where the text says nothing leaves the text as it is, and is saved', async () => {
  const user = userEvent.setup()
  render(<KitchenView />)
  await user.click(screen.getByRole('button', { name: 'New recipe' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Banana toast')
  const recipe = screen.getByRole('textbox', { name: 'Recipe' })
  await user.type(recipe, 'Toast the bread and slice a banana over it.')
  await user.click(screen.getByRole('button', { name: 'More' }))
  await user.type(screen.getByRole('spinbutton', { name: 'kcal' }), '300')
  expect(recipe).toHaveValue('Toast the bread and slice a banana over it.')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().recipes[0]).toMatchObject({ kcal: 300, text: 'Toast the bread and slice a banana over it.' })
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

// v2.30: Cook is gone, and what only Cook did with it - docs/RESEARCH-KITCHEN.md
// section 6.1. A recipe's page reads the recipe and edits it.
test("a recipe's page offers Edit, and nothing to cook from, and says nothing of how often it was cooked", () => {
  seed([{ title: 'Overnight oats', text: 'INGREDIENTS\noats\nmilk', mealTypes: ['breakfast'], servings: 1, cooked: 6 }])
  render(<KitchenView recipeId="r0" />)
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cook' })).toBeNull()
  expect(screen.getByText('Breakfast · 1 serving')).toBeInTheDocument()
  expect(screen.queryByText(/Cooked/)).toBeNull()
})
