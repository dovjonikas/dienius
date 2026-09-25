import { beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
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


// Another recipe in two presses - the owner's decisions before the freeze,
// 2026-09-25, stage 3. A second mark on the meal's card opens its meal's
// recipes in place, each with its kcal and protein, and one press puts one on
// it - on a meal still to eat, and on one already ticked, under Done.
test("a meal's card opens its meal's recipes in place, with kcal and protein, and one press puts another on it - ticked or not", async () => {
  const user = userEvent.setup()
  const data = defaultData()
  data.recipes = [
    { id: 'bowl', title: 'A bean bowl', text: '', mealTypes: ['lunch'], kcal: 520, protein: 38 },
    { id: 'soup', title: 'Lentil soup', text: '', mealTypes: ['lunch'], kcal: 410 },
    { id: 'oats', title: 'Overnight oats', text: '', mealTypes: ['breakfast'], kcal: 380, protein: 18 },
  ]
  data.days[DATE] = { date: DATE, tasks: [{ id: 'lunch', title: 'Lunch', time: '12:30', done: false, category: 'meal', mealType: 'lunch', recipeId: 'bowl' }] }
  actions.resetForTests(data)
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} onOpenKitchen={() => {}} />)

  // The first press: the meal's recipes, in place, with their numbers - and not breakfast's.
  await user.click(within(card('Lunch')).getByRole('button', { name: 'Another recipe for Lunch' }))
  const list = within(card('Lunch')).getByRole('list', { name: 'Recipes for Lunch' })
  expect(within(list).getAllByRole('button').map(b => b.textContent)).toEqual(['A bean bowl520 kcal · 38 g protein', 'Lentil soup410 kcal'])
  expect(within(list).getByRole('button', { name: /A bean bowl/ })).toHaveAttribute('aria-pressed', 'true')

  // The second: it is on the meal, the meal kept with it, and the list shut.
  await user.click(within(list).getByRole('button', { name: /Lentil soup/ }))
  expect(getData().days[DATE].tasks[0]).toMatchObject({ recipeId: 'soup', mealType: 'lunch' })
  expect(within(card('Lunch')).queryByRole('list', { name: 'Recipes for Lunch' })).toBeNull()
  expect(within(card('Lunch')).getByRole('button', { name: 'Recipe: Lentil soup' })).toBeInTheDocument()

  // Ticked and under Done: the same two presses once Done is open.
  act(() => actions.toggleTask(DATE, 'lunch'))
  await user.click(document.querySelector('.done-toggle') as HTMLElement)
  const done = document.querySelector('.task-list-done') as HTMLElement
  const ticked = within(done).getByText('Lunch').closest('li') as HTMLElement
  await user.click(within(ticked).getByRole('button', { name: 'Another recipe for Lunch' }))
  await user.click(within(within(ticked).getByRole('list', { name: 'Recipes for Lunch' })).getByRole('button', { name: /A bean bowl/ }))
  expect(getData().days[DATE].tasks[0]).toMatchObject({ recipeId: 'bowl', mealType: 'lunch', done: true })
})

// The owner's meal blocks carry a kind of meal and no recipe: the recipe is
// chosen on the day, and the same two presses choose it.
test('a meal left open is chosen in place in two presses, with the numbers beside each recipe', async () => {
  const user = userEvent.setup()
  const data = defaultData()
  data.recipes = [
    { id: 'bowl', title: 'A bean bowl', text: '', mealTypes: ['dinner'], kcal: 520, protein: 38 },
    { id: 'soup', title: 'Lentil soup', text: '', mealTypes: ['dinner'], protein: 21 },
  ]
  data.days[DATE] = { date: DATE, tasks: [{ id: 'dinner', title: 'Dinner', time: '19:00', done: false, category: 'meal', mealType: 'dinner' }] }
  actions.resetForTests(data)
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} onOpenKitchen={() => {}} />)

  await user.click(within(card('Dinner')).getByRole('button', { name: 'Choose a recipe for Dinner' }))
  const list = within(card('Dinner')).getByRole('list', { name: 'Recipes for Dinner' })
  expect(within(list).getAllByRole('button').map(b => b.textContent)).toEqual(['A bean bowl520 kcal · 38 g protein', 'Lentil soup21 g protein'])
  expect(within(list).getAllByRole('button').every(b => b.getAttribute('aria-pressed') === 'false')).toBe(true)
  await user.click(within(list).getByRole('button', { name: /Lentil soup/ }))
  expect(getData().days[DATE].tasks[0]).toMatchObject({ recipeId: 'soup', mealType: 'dinner' })
  expect(within(card('Dinner')).getByRole('button', { name: 'Recipe: Lentil soup' })).toBeInTheDocument()
  expect(within(card('Dinner')).getByRole('button', { name: 'Another recipe for Dinner' })).toBeInTheDocument()
})
