import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MealWordSettings } from './MealWordSettings'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'

/**
 * The words a recipe's name starts with, in Settings - Kitchen, v2.32: each
 * word and the meals it says, changed, added and taken away. Every word here
 * is a generic one.
 */

beforeEach(() => {
  actions.resetForTests(defaultData())
})

/** The rows as they read: each word, and what its meals line says. */
function rows(): [string, string][] {
  return [...document.querySelectorAll('.meal-words-row')].map(row => [
    (row.querySelector('input') as HTMLInputElement).value,
    row.querySelector('.meals-picker-words')?.textContent ?? '',
  ])
}

test('a new device lists the six meals by their own names, each for itself', () => {
  render(<MealWordSettings />)
  expect(screen.getByRole('heading', { level: 3, name: 'Kitchen' })).toBeInTheDocument()
  expect(rows()).toEqual([
    ['Breakfast', 'Breakfast'],
    ['Lunch', 'Lunch'],
    ['Dinner', 'Dinner'],
    ['Pre-gym', 'Pre-gym'],
    ['Post-gym', 'Post-gym'],
    ['Snack', 'Snack'],
  ])
})

test("a word's meals are changed in its row, and the list is kept at once", async () => {
  const user = userEvent.setup()
  render(<MealWordSettings />)
  await user.click(screen.getByRole('button', { name: 'Meals for Lunch: Lunch' }))
  await user.click(within(screen.getByRole('group', { name: 'Meals for Lunch' })).getByRole('button', { name: 'Dinner' }))
  expect(getData().settings.mealWords?.[1]).toEqual({ word: 'Lunch', meals: ['lunch', 'dinner'] })
})

test('a word is added with its meals, renamed, and taken away', async () => {
  const user = userEvent.setup()
  render(<MealWordSettings />)
  await user.click(screen.getByRole('button', { name: 'Add a word' }))
  // An empty word is a row to write in, and nothing kept yet.
  expect(rows()).toHaveLength(7)
  await user.type(screen.getByRole('textbox', { name: 'Word 7' }), 'Brunch')
  await user.click(screen.getByRole('button', { name: 'Meals for Brunch: No meal' }))
  const six = within(screen.getByRole('group', { name: 'Meals for Brunch' }))
  await user.click(six.getByRole('button', { name: 'Breakfast' }))
  await user.click(six.getByRole('button', { name: 'Lunch' }))
  expect(getData().settings.mealWords?.at(-1)).toEqual({ word: 'Brunch', meals: ['breakfast', 'lunch'] })

  await user.clear(screen.getByRole('textbox', { name: 'Word 1' }))
  await user.type(screen.getByRole('textbox', { name: 'Word 1' }), 'Morning')
  expect(getData().settings.mealWords?.[0]).toEqual({ word: 'Morning', meals: ['breakfast'] })

  await user.click(screen.getByRole('button', { name: 'Remove Snack' }))
  expect(getData().settings.mealWords?.map(w => w.word)).toEqual(['Morning', 'Lunch', 'Dinner', 'Pre-gym', 'Post-gym', 'Brunch'])
})

test('a word may say no meal at all, and is kept as a word', async () => {
  const user = userEvent.setup()
  render(<MealWordSettings />)
  await user.click(screen.getByRole('button', { name: 'Meals for Snack: Snack' }))
  await user.click(within(screen.getByRole('group', { name: 'Meals for Snack' })).getByRole('button', { name: 'Snack' }))
  expect(getData().settings.mealWords?.at(-1)).toEqual({ word: 'Snack', meals: [] })
  expect(rows().at(-1)).toEqual(['Snack', 'No meal'])
})
