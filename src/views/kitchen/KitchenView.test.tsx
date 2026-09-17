import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KitchenView } from './KitchenView'
import { actions } from '../../lib/store'
import { defaultData } from '../../lib/storage'
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
