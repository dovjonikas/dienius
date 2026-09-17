import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KitchenView } from './KitchenView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import type { AppData } from '../../lib/types'

/**
 * A recipe put into a template from its own page, the way a book is -
 * Kitchen, v2.30, docs/RESEARCH-KITCHEN.md section 6.5. A template, then one
 * of its meal blocks for the recipe to join, or a new meal block at a time and
 * a length. Every recipe and template here is a generic one.
 */

function plan(over: Partial<AppData> = {}): AppData {
  const data = defaultData()
  data.recipes = [{ id: 'soup', title: 'Lentil soup', text: '', mealTypes: ['dinner'] }]
  data.templates = [
    {
      id: 'weekday',
      name: 'Weekday',
      color: '#a7c4f5',
      blocks: [
        { id: 'work', time: '09:00', title: 'Work', minutes: 480, category: 'work' },
        { id: 'dinner', time: '19:00', title: 'Dinner', minutes: 45, category: 'meal', recipeIds: ['other'], recipeId: 'other' },
      ],
    },
  ]
  return { ...data, ...over }
}

beforeEach(() => {
  actions.resetForTests(plan())
})

async function openAdd() {
  const user = userEvent.setup()
  render(<KitchenView recipeId="soup" />)
  await user.click(screen.getByRole('button', { name: 'Add to template' }))
  return user
}

test("with no template to put it in, the page says where templates are made", async () => {
  actions.resetForTests(plan({ templates: [] }))
  await openAdd()
  expect(screen.getByText('No templates yet - build one first, in the Templates tab.')).toBeInTheDocument()
})

test("a recipe joins one of a template's meal blocks, and the page says where it went", async () => {
  const user = await openAdd()
  const blocks = screen.getByRole('radiogroup', { name: 'Into' })
  // Only the meal blocks, and a new one.
  expect(within(blocks).getAllByRole('radio').map(r => r.closest('label')?.textContent)).toEqual(['19:00 Dinner', 'A new meal block'])
  await user.click(within(blocks).getByRole('radio', { name: '19:00 Dinner' }))
  await user.click(screen.getByRole('button', { name: 'Add' }))

  expect(getData().templates[0].blocks[1]).toMatchObject({ recipeIds: ['other', 'soup'] })
  expect(screen.getByRole('status')).toHaveTextContent('Added to Dinner on Weekday.')
})

test('a recipe can make a new meal block, named for its meal, at a time and a length', async () => {
  const user = await openAdd()
  await user.click(within(screen.getByRole('radiogroup', { name: 'Into' })).getByRole('radio', { name: 'A new meal block' }))
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Dinner')
  await user.click(screen.getByRole('button', { name: 'Add' }))

  const added = getData().templates[0].blocks.at(-1)!
  expect(added).toMatchObject({ title: 'Dinner', category: 'meal', recipeIds: ['soup'], recipeId: 'soup' })
})

test('Cancel and Add give the keys back to Add to template, not to the page', async () => {
  const user = await openAdd()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('radiogroup', { name: 'Into' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Add to template' })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: 'Add to template' }))
  await user.click(screen.getByRole('button', { name: 'Add' }))
  expect(screen.getByRole('status')).toHaveTextContent('Added to Dinner on Weekday.')
  expect(screen.getByRole('button', { name: 'Add to template' })).toHaveFocus()
})
