import { expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MealsPicker, mealsLine } from './MealsPicker'
import type { MealType } from '../../lib/types'

/**
 * A set of meals chosen in place - Kitchen, v2.32: one line that says them,
 * and the six under it once it is pressed. Every name here is a generic one.
 */

function Held({ start = [] as MealType[], onChange = (_: MealType[]) => {} }) {
  const [meals, setMeals] = useState<MealType[]>(start)
  return (
    <MealsPicker
      meals={meals}
      label="Meals for a bean bowl"
      onChange={next => {
        setMeals(next)
        onChange(next)
      }}
    />
  )
}

test('the line says the meals, the first as a name and the rest in lower case, or that there is none', () => {
  expect(mealsLine(['lunch', 'dinner'])).toBe('Lunch, dinner')
  expect(mealsLine(['pre-gym'])).toBe('Pre-gym')
  expect(mealsLine([])).toBe('No meal')
  expect(mealsLine([], 'No meal yet')).toBe('No meal yet')
})

test('a press opens the six, each is switched at once, and the line says what is chosen', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Held start={['dinner']} onChange={onChange} />)
  const line = screen.getByRole('button', { name: 'Meals for a bean bowl: Dinner' })
  expect(line).toHaveAttribute('aria-expanded', 'false')
  await user.click(line)
  const six = within(screen.getByRole('group', { name: 'Meals for a bean bowl' })).getAllByRole('button')
  expect(six.map(b => b.textContent)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Pre-gym', 'Post-gym', 'Snack'])
  await user.click(screen.getByRole('button', { name: 'Lunch' }))
  // In the app's order, whichever was pressed first.
  expect(onChange).toHaveBeenLastCalledWith(['lunch', 'dinner'])
  expect(screen.getByRole('button', { name: 'Lunch' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'Dinner' }))
  expect(onChange).toHaveBeenLastCalledWith(['lunch'])
  expect(screen.getByRole('button', { name: 'Meals for a bean bowl: Lunch' })).toBeInTheDocument()
})

test('Escape closes it and gives the focus back to the line, and a press outside closes it too', async () => {
  const user = userEvent.setup()
  render(
    <>
      <Held />
      <button type="button">Elsewhere</button>
    </>,
  )
  const line = screen.getByRole('button', { name: 'Meals for a bean bowl: No meal' })
  await user.click(line)
  await user.click(screen.getByRole('button', { name: 'Snack' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('group', { name: 'Meals for a bean bowl' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Meals for a bean bowl: Snack' })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: 'Meals for a bean bowl: Snack' }))
  expect(screen.getByRole('group', { name: 'Meals for a bean bowl' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
  expect(screen.queryByRole('group', { name: 'Meals for a bean bowl' })).toBeNull()
})
