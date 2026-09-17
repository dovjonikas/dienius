import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayView } from '../../widgets/day-plan/DayView'
import { TaskDetail } from '../../widgets/day-plan/TaskDetail'
import { actions, getData, useAppData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import type { Task } from '../../lib/types'
import { RecipeSelect, mealBindingValue, readMealBinding } from './RecipeBinding'

/**
 * A meal on the day - Kitchen, since v2.27. A task whose category is Meals
 * may point at a recipe or leave a kind of meal open: the card says which,
 * and a press on it opens the recipe, or Kitchen on that meal's recipes to
 * choose from. The detail sheet is where it is chosen. A meal pointing at
 * nothing, or a task in another category, is the task it always was. Every
 * recipe here is a generic one.
 */

const DATE = '2026-09-01'

function seedDay(tasks: Partial<Task>[]) {
  const data = defaultData()
  data.recipes = [
    { id: 'soup', title: 'Lentil soup', text: 'INGREDIENTS\nred lentils' },
    { id: 'oats', title: 'Overnight oats', text: 'Oats and milk.' },
  ]
  data.days[DATE] = {
    date: DATE,
    tasks: tasks.map((t, i) => ({ id: `t${i}`, title: `Task ${i}`, done: false, ...t })),
  }
  actions.resetForTests(data)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  actions.resetForTests(defaultData())
})

function card(title: string): HTMLElement {
  const list = document.querySelector('.task-list') as HTMLElement
  return within(list).getByText(title).closest('li') as HTMLElement
}

test("a meal's card names its recipe, or its kind of meal, and a press opens it in Kitchen", async () => {
  const user = userEvent.setup()
  seedDay([
    { title: 'Lunch', time: '12:30', category: 'meal', recipeId: 'soup' },
    { title: 'Dinner', time: '19:00', category: 'meal', mealType: 'dinner' },
    { title: 'Breakfast', time: '07:30', category: 'meal', recipeId: 'gone' },
    { title: 'Walk', time: '13:00', category: 'health', recipeId: 'soup' },
  ])
  const onOpenKitchen = vi.fn()
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} onOpenKitchen={onOpenKitchen} />)

  await user.click(within(card('Lunch')).getByRole('button', { name: 'Recipe: Lentil soup' }))
  expect(onOpenKitchen).toHaveBeenLastCalledWith({ recipeId: 'soup' })

  await user.click(within(card('Dinner')).getByRole('button', { name: 'Dinner recipes' }))
  expect(onOpenKitchen).toHaveBeenLastCalledWith({ meal: 'dinner' })

  // A recipe removed elsewhere, and a walk that is not a meal: nothing.
  expect(within(card('Breakfast')).queryByRole('button', { name: /recipe/i })).toBeNull()
  expect(within(card('Walk')).queryByRole('button', { name: /recipe/i })).toBeNull()
  // The press opens Kitchen and nothing on the card.
  expect(document.querySelector('.task-detail')).toBeNull()
})

function openDetail() {
  function Harness() {
    const data = useAppData()
    const day = data.days[DATE]
    if (!day?.tasks[0]) return null
    return <TaskDetail task={day.tasks[0]} tasks={day.tasks} date={DATE} library={data.library} onClose={() => {}} />
  }
  return render(<Harness />)
}

test("the detail sheet chooses a meal's recipe or its kind of meal, and only for a meal", async () => {
  const user = userEvent.setup()
  seedDay([{ title: 'Lunch', category: 'meal' }])
  const { unmount } = openDetail()
  const select = screen.getByRole('combobox', { name: 'Recipe' })
  expect(select).toHaveValue('')

  await user.selectOptions(select, 'Lunch recipes')
  expect(getData().days[DATE].tasks[0]).toMatchObject({ mealType: 'lunch' })
  expect(getData().days[DATE].tasks[0].recipeId).toBeUndefined()

  await user.selectOptions(select, 'Lentil soup')
  expect(getData().days[DATE].tasks[0]).toMatchObject({ recipeId: 'soup' })
  expect(getData().days[DATE].tasks[0].mealType).toBeUndefined()

  await user.selectOptions(select, 'No recipe')
  expect(getData().days[DATE].tasks[0].recipeId).toBeUndefined()
  expect(getData().days[DATE].tasks[0].mealType).toBeUndefined()
  unmount()

  seedDay([{ title: 'Deep work', category: 'core' }])
  openDetail()
  expect(screen.queryByRole('combobox', { name: 'Recipe' })).toBeNull()
})

test('the recipe select offers no recipe, the six kinds of meal to choose on the day and every recipe by name, and reads a removed recipe as its kind of meal', async () => {
  const user = userEvent.setup()
  const recipes = [
    { id: 'soup', title: 'Lentil soup', text: 'a text' },
    { id: 'oats', title: 'Apple and oats', text: 'a text' },
  ]
  const onChange = vi.fn()
  const { rerender } = render(<RecipeSelect label="Recipe" recipes={recipes} recipeId="soup" onChange={onChange} />)
  const select = screen.getByRole('combobox', { name: 'Recipe' })
  expect([...select.querySelectorAll('option')].map(o => o.textContent)).toEqual([
    'No recipe',
    'Breakfast recipes',
    'Lunch recipes',
    'Dinner recipes',
    'Pre-gym recipes',
    'Post-gym recipes',
    'Snack recipes',
    'Apple and oats',
    'Lentil soup',
  ])
  expect(select).toHaveValue('recipe:soup')

  await user.selectOptions(select, 'Snack recipes')
  expect(onChange).toHaveBeenLastCalledWith({ mealType: 'snack' })

  rerender(<RecipeSelect label="Recipe" recipes={recipes} recipeId="gone" mealType="dinner" onChange={onChange} />)
  expect(select).toHaveValue('meal:dinner')

  expect(mealBindingValue({ recipeId: 'gone' }, recipes)).toBe('')
  expect(readMealBinding('recipe:soup')).toEqual({ recipeId: 'soup' })
  expect(readMealBinding('meal:lunch')).toEqual({ mealType: 'lunch' })
  expect(readMealBinding('meal:brunch')).toEqual({})
  expect(readMealBinding('')).toEqual({})
})
