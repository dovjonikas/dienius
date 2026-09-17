import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayView } from '../../widgets/day-plan/DayView'
import { TaskDetail } from '../../widgets/day-plan/TaskDetail'
import { actions, getData, useAppData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import type { Task } from '../../lib/types'

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

// Since v2.30 chosen from Kitchen in small rather than from one long select -
// docs/RESEARCH-KITCHEN.md section 6.5: a day's meal has one recipe, and a
// press chooses it, or takes it away again.
test("the detail sheet chooses a meal's recipe from Kitchen, or its kind of meal, and only for a meal", async () => {
  const user = userEvent.setup()
  seedDay([{ title: 'Lunch', category: 'meal' }])
  const { unmount } = openDetail()
  const field = () => screen.getByRole('button', { name: /^Recipe for Lunch: / })
  expect(field()).toHaveTextContent('No recipe')

  await user.click(field())
  await user.click(within(screen.getByRole('group', { name: 'Or choose on the day' })).getByRole('button', { name: 'Lunch' }))
  expect(getData().days[DATE].tasks[0]).toMatchObject({ mealType: 'lunch' })
  expect(getData().days[DATE].tasks[0].recipeId).toBeUndefined()

  await user.click(field())
  await user.click(within(screen.getByRole('group', { name: 'No meal yet' })).getByRole('button', { name: 'Lentil soup' }))
  expect(getData().days[DATE].tasks[0]).toMatchObject({ recipeId: 'soup' })
  expect(getData().days[DATE].tasks[0].mealType).toBeUndefined()
  expect(field()).toHaveTextContent('Lentil soup')

  await user.click(field())
  await user.click(within(screen.getByRole('group', { name: 'No meal yet' })).getByRole('button', { name: 'Lentil soup' }))
  expect(getData().days[DATE].tasks[0].recipeId).toBeUndefined()
  expect(getData().days[DATE].tasks[0].mealType).toBeUndefined()
  unmount()

  seedDay([{ title: 'Deep work', category: 'core' }])
  openDetail()
  expect(screen.queryByRole('button', { name: /^Recipe for / })).toBeNull()
})

