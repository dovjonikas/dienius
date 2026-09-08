import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplatesView } from './TemplatesView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { CATEGORY_PALETTE, isCategoryColorReadable, resolvedColor } from '../lib/categories'

// A category, made where it is needed. Before this the answer was Settings,
// which is four screens away from the block being typed.

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.click(screen.getByRole('button', { name: /^A day/ }))
}

test('a category is made from the block row, and the new block takes it', async () => {
  const user = userEvent.setup()
  await openEditor(user)
  const before = getData().categories.length

  await user.click(screen.getByRole('button', { name: 'Make a category' }))
  await user.type(screen.getByLabelText('Category name'), 'Training')
  await user.click(within(screen.getByRole('group', { name: 'Colour' })).getByRole('button', { name: 'Teal' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const made = getData().categories
  expect(made).toHaveLength(before + 1)
  const training = made.find(c => c.label === 'Training')!
  expect(training.color).toBe(CATEGORY_PALETTE.find(c => c.name === 'Teal')!.value)

  // Chosen for the block being typed, without a second press.
  await user.type(screen.getByPlaceholderText('Template name'), 'Workday')
  await user.type(screen.getByPlaceholderText('What happens'), 'Session')
  await user.click(screen.getByRole('button', { name: 'Add a block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0].category).toBe(training.id)
}, 20000)

test('the pencil renames and recolours the one that is chosen', async () => {
  const user = userEvent.setup()
  await openEditor(user)
  const first = getData().categories[0]

  await user.click(screen.getByRole('button', { name: `Edit ${first.label}` }))
  const name = screen.getByLabelText('Category name')
  await user.clear(name)
  await user.type(name, 'Renamed')
  await user.click(within(screen.getByRole('group', { name: 'Colour' })).getByRole('button', { name: 'Violet' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const after = getData().categories.find(c => c.id === first.id)!
  expect(after.label).toBe('Renamed')
  expect(after.color).toBe(CATEGORY_PALETTE.find(c => c.name === 'Violet')!.value)
}, 20000)

test('a colour another category already has is still offered, and says whose', async () => {
  const user = userEvent.setup()
  await openEditor(user)
  const taken = resolvedColor(getData().categories[0])
  const name = CATEGORY_PALETTE.find(c => c.value.toLowerCase() === taken.toLowerCase())?.name

  await user.click(screen.getByRole('button', { name: 'Make a category' }))
  const swatches = within(screen.getByRole('group', { name: 'Colour' }))
  if (name) {
    // Two things may share a colour if that is what somebody wants. The app
    // says so rather than refusing.
    const shared = swatches.getByRole('button', { name: new RegExp(`^${name}, already `) })
    await user.type(screen.getByLabelText('Category name'), 'Second')
    await user.click(shared)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const made = getData().categories.find(c => c.label === 'Second')!
    expect(resolvedColor(made).toLowerCase()).toBe(taken.toLowerCase())
  }
}, 20000)

test('the sheet offers only colours that pass the readability gate', () => {
  // No colour wheel here, unlike Settings: the whole point is speed, and a
  // wheel at speed is how a category ends up with an edge nobody can see.
  for (const swatch of CATEGORY_PALETTE) {
    expect(isCategoryColorReadable(swatch.value), swatch.name).toBe(true)
  }
})

test('the gate itself still refuses an unreadable colour', () => {
  // The store is where the gate is enforced, and nothing about this feature
  // moved it: the sheet only ever offers palette values, and the store still
  // refuses anything that is not a colour it can read.
  expect(actions.addCategory({ label: 'Invisible', color: 'not a colour' })).toBeUndefined()
  expect(getData().categories.some(c => c.label === 'Invisible')).toBe(false)
})

test('a name with nothing in it cannot be saved', async () => {
  const user = userEvent.setup()
  await openEditor(user)
  await user.click(screen.getByRole('button', { name: 'Make a category' }))
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  await user.type(screen.getByLabelText('Category name'), '   ')
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
})

test('Escape closes the sheet without making anything', async () => {
  const user = userEvent.setup()
  await openEditor(user)
  const before = getData().categories.length
  await user.click(screen.getByRole('button', { name: 'Make a category' }))
  await user.type(screen.getByLabelText('Category name'), 'Abandoned')
  await user.keyboard('{Escape}')
  expect(screen.queryByLabelText('Category name')).not.toBeInTheDocument()
  expect(getData().categories).toHaveLength(before)
})
