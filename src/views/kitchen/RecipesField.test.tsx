import { expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { RecipesField, type MealRecipes } from './RecipesField'
import type { Recipe } from '../../lib/types'

/**
 * The recipes a meal block walks, chosen from Kitchen - v2.30,
 * docs/RESEARCH-KITCHEN.md section 6.5. One line says what the block holds; a
 * press opens Kitchen in small - a search and the recipes in sections by meal,
 * a press to add one or take it away - with the chosen ones in the order they
 * will come round, and the kinds of meal to leave to the day instead. On a day
 * one recipe is chosen and the field closes. Every recipe here is a generic one.
 */

const RECIPES: Recipe[] = [
  { id: 'oats', title: 'Overnight oats', text: '', mealTypes: ['breakfast', 'snack'], kcal: 380 },
  { id: 'eggs', title: 'Scrambled eggs on toast', text: '', mealTypes: ['breakfast'] },
  { id: 'soup', title: 'Lentil soup', text: 'INGREDIENTS\nred lentils', mealTypes: ['lunch', 'dinner'] },
  { id: 'apple', title: 'Apple and almonds', text: '' },
]

function Harness({ start = {}, single = false, onChange = () => {} }: { start?: MealRecipes; single?: boolean; onChange?: (next: MealRecipes) => void }) {
  const [value, setValue] = useState<MealRecipes>(start)
  return (
    <RecipesField
      id="field"
      label="Recipes for Breakfast"
      recipes={RECIPES}
      value={value}
      single={single}
      onChange={next => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

test('the line says what the meal holds: nothing, a kind of meal for the day, a recipe, or a recipe and how many more', () => {
  const { rerender } = render(<RecipesField id="f" label="Recipes" recipes={RECIPES} value={{}} onChange={() => {}} />)
  expect(screen.getByRole('button', { name: /No recipe/ })).toHaveAttribute('aria-expanded', 'false')
  rerender(<RecipesField id="f" label="Recipes" recipes={RECIPES} value={{ mealType: 'lunch' }} onChange={() => {}} />)
  expect(screen.getByRole('button', { name: /Lunch, chosen on the day/ })).toBeInTheDocument()
  rerender(<RecipesField id="f" label="Recipes" recipes={RECIPES} value={{ recipeIds: ['oats'] }} onChange={() => {}} />)
  expect(screen.getByRole('button', { name: /Overnight oats/ })).toBeInTheDocument()
  rerender(<RecipesField id="f" label="Recipes" recipes={RECIPES} value={{ recipeIds: ['oats', 'eggs', 'soup'] }} onChange={() => {}} />)
  expect(screen.getByRole('button', { name: /Overnight oats and 2 more/ })).toBeInTheDocument()
  // A recipe removed on another device is not counted.
  rerender(<RecipesField id="f" label="Recipes" recipes={RECIPES} value={{ recipeIds: ['gone', 'soup'] }} onChange={() => {}} />)
  expect(screen.getByRole('button', { name: /Lentil soup/ })).not.toHaveTextContent(/more/)
})

test('opened, it is Kitchen in small: the recipes by meal, and a press adds one to the walk or takes it away', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  await user.click(screen.getByRole('button', { name: /No recipe/ }))

  const breakfast = screen.getByRole('group', { name: 'Breakfast' })
  expect(within(breakfast).getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
    'Overnight oats',
    'Scrambled eggs on toast',
  ])
  expect(screen.getByRole('group', { name: 'No meal yet' })).toBeInTheDocument()

  await user.click(within(breakfast).getByRole('button', { name: 'Scrambled eggs on toast' }))
  await user.click(within(screen.getByRole('group', { name: 'Lunch' })).getByRole('button', { name: 'Lentil soup' }))
  expect(onChange).toHaveBeenLastCalledWith({ recipeIds: ['eggs', 'soup'] })
  // A recipe under two meals is pressed under both.
  expect(within(screen.getByRole('group', { name: 'Dinner' })).getByRole('button', { name: 'Lentil soup' })).toHaveAttribute('aria-pressed', 'true')

  // The walk, in the order it comes round, each with a way to take it out.
  const walk = screen.getByRole('list', { name: 'Walked in this order' })
  expect(within(walk).getAllByRole('listitem').map(li => li.firstChild?.textContent)).toEqual(['Scrambled eggs on toast', 'Lentil soup'])
  await user.click(within(walk).getByRole('button', { name: 'Take Scrambled eggs on toast out' }))
  expect(onChange).toHaveBeenLastCalledWith({ recipeIds: ['soup'] })

  await user.click(within(screen.getByRole('group', { name: 'Lunch' })).getByRole('button', { name: 'Lentil soup' }))
  expect(onChange).toHaveBeenLastCalledWith({})
})

test('a kind of meal left to the day takes the recipes away, and a recipe takes the kind away', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Harness start={{ recipeIds: ['oats'] }} onChange={onChange} />)
  await user.click(screen.getByRole('button', { name: /Overnight oats/ }))
  const kinds = screen.getByRole('group', { name: 'Or choose on the day' })
  await user.click(within(kinds).getByRole('button', { name: 'Lunch' }))
  expect(onChange).toHaveBeenLastCalledWith({ mealType: 'lunch' })
  expect(within(kinds).getByRole('button', { name: 'Lunch' })).toHaveAttribute('aria-pressed', 'true')

  await user.click(within(screen.getByRole('group', { name: 'Breakfast' })).getByRole('button', { name: 'Overnight oats' }))
  expect(onChange).toHaveBeenLastCalledWith({ recipeIds: ['oats'] })
})

test('the search narrows every section, and Done closes the field', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: /No recipe/ }))
  await user.type(screen.getByRole('searchbox', { name: 'Find a recipe' }), 'lentils')
  expect(screen.queryByRole('group', { name: 'Breakfast' })).toBeNull()
  expect(screen.getByRole('group', { name: 'Lunch' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(screen.getByRole('button', { name: /No recipe/ })).toHaveAttribute('aria-expanded', 'false')
})

test('on a day one recipe is chosen, and choosing it closes the field', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Harness single start={{ recipeIds: ['oats'] }} onChange={onChange} />)
  await user.click(screen.getByRole('button', { name: /Overnight oats/ }))
  expect(screen.queryByRole('list', { name: 'Walked in this order' })).toBeNull()
  // No Done of its own: a day's field sits in the day's sheet, whose Done
  // closes the sheet, and choosing closes the field - or its line does.
  expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
  await user.click(screen.getByRole('button', { name: /^Recipes for Breakfast: / }))
  expect(screen.queryByRole('searchbox')).toBeNull()
  await user.click(screen.getByRole('button', { name: /^Recipes for Breakfast: / }))
  await user.click(within(screen.getByRole('group', { name: 'Lunch' })).getByRole('button', { name: 'Lentil soup' }))
  expect(onChange).toHaveBeenLastCalledWith({ recipeIds: ['soup'] })
  expect(screen.queryByRole('searchbox')).toBeNull()
})
