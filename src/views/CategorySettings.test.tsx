import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategorySettings, usageSentence } from './CategorySettings'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import type { AppData, Task } from '../lib/types'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function task(over: Partial<Task> = {}): Task {
  return { id: crypto.randomUUID(), title: 'Something', done: false, ...over }
}

function seed(patch: Partial<AppData>): void {
  actions.resetForTests({ ...defaultData(), ...patch })
}

function row(label: string): HTMLElement {
  return screen.getByText(label).closest('li') as HTMLElement
}

test('the six the app ships are listed, in the order the swatch row draws them', () => {
  render(<CategorySettings />)
  const labels = screen.getAllByRole('listitem').map(li => li.querySelector('.category-row-label')?.textContent)
  expect(labels).toEqual(['Deep work', 'Routine', 'Health', 'Meals', 'Commute', 'Personal'])
})

test('a rename is written, and the row shows it', async () => {
  const user = userEvent.setup()
  render(<CategorySettings />)

  await user.click(within(row('Commute')).getByRole('button', { name: 'Edit' }))
  const field = screen.getByLabelText('Name')
  await user.clear(field)
  await user.type(field, 'Errands')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(getData().categories.find(c => c.id === 'commute')?.label).toBe('Errands')
  expect(screen.getByText('Errands')).toBeTruthy()
})

/**
 * The delete, which is the only part of this screen with a real decision in
 * it. Three things have to be true at once: it says what it is about to
 * touch, it has already chosen where that goes, and the tasks actually land
 * there.
 */
test('the delete dialog states what uses the category, once, as a fact', async () => {
  const user = userEvent.setup()
  seed({
    templates: [{ id: 't1', name: 'W', color: '#a7c4f5', blocks: [{ id: 'b1', title: 'Walk', category: 'health' }] }],
    backlog: [{ id: 'k1', title: 'Physio', category: 'health' }],
    days: { '2026-09-01': { date: '2026-09-01', tasks: [task({ category: 'health' }), task({ category: 'health' })] } },
  })
  render(<CategorySettings />)

  await user.click(within(row('Health')).getByRole('button', { name: 'Delete' }))
  expect(screen.getByText('Delete Health?')).toBeTruthy()
  expect(screen.getByText('2 tasks, 1 template block and 1 backlog item use it.')).toBeTruthy()
})

test('the target is already chosen, so the ordinary path is one press', async () => {
  const user = userEvent.setup()
  seed({ days: { '2026-09-01': { date: '2026-09-01', tasks: [task({ category: 'health' })] } } })
  render(<CategorySettings />)

  await user.click(within(row('Health')).getByRole('button', { name: 'Delete' }))
  // The first remaining category, which is the one at the top of the list.
  expect(screen.getByRole('button', { name: 'Deep work' })).toHaveAttribute('aria-pressed', 'true')

  await user.click(screen.getByRole('button', { name: 'Delete and move' }))
  const after = getData()
  expect(after.categories.map(c => c.id)).not.toContain('health')
  expect(after.days['2026-09-01'].tasks[0].category).toBe('core')
})

test('nothing using it means no sentence and a plain Delete', async () => {
  const user = userEvent.setup()
  render(<CategorySettings />)

  await user.click(within(row('Commute')).getByRole('button', { name: 'Delete' }))
  const dialog = within(screen.getByRole('group', { name: 'Delete Commute' }))
  expect(screen.queryByText(/use it\./)).toBeNull()
  expect(dialog.queryByRole('button', { name: 'Delete and move' })).toBeNull()

  await user.click(dialog.getByRole('button', { name: 'Delete' }))
  expect(getData().categories.map(c => c.id)).not.toContain('commute')
})

test('"Keep it" changes nothing at all', async () => {
  const user = userEvent.setup()
  render(<CategorySettings />)

  await user.click(within(row('Health')).getByRole('button', { name: 'Delete' }))
  await user.click(screen.getByRole('button', { name: 'Keep it' }))
  expect(getData().categories).toHaveLength(6)
})

test('the last one says why it cannot go, on the button rather than by hiding it', () => {
  seed({ categories: [{ id: 'core', label: 'Deep work' }] })
  render(<CategorySettings />)

  const button = within(row('Deep work')).getByRole('button', { name: 'Delete' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('title', 'There has to be one')
})

/**
 * A colour has to be readable, and a new one has to have a colour at all -
 * there is no built-in pair behind an id somebody made up for it to fall
 * back to.
 */
test('adding one takes a name and a colour, and lands at the end of the list', async () => {
  const user = userEvent.setup()
  render(<CategorySettings />)

  await user.click(screen.getByRole('button', { name: 'Add a category' }))
  expect(screen.getByRole('button', { name: 'Add it' })).toBeDisabled()

  await user.type(screen.getByLabelText('Name'), 'Gym')
  // Still refused: a name alone is not enough for a category with no pair
  // in the stylesheet behind it.
  expect(screen.getByRole('button', { name: 'Add it' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: "The app's own colour" })).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Green' }))
  await user.click(screen.getByRole('button', { name: 'Add it' }))

  const list = getData().categories
  expect(list[6]).toMatchObject({ label: 'Gym', color: '#4fa46a' })
})

test('one of the six can be given a colour and handed back its own', async () => {
  const user = userEvent.setup()
  render(<CategorySettings />)

  await user.click(within(row('Health')).getByRole('button', { name: 'Edit' }))
  await user.click(screen.getByRole('button', { name: 'Rose' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().categories.find(c => c.id === 'health')?.color).toBe('#d1698f')

  await user.click(within(row('Health')).getByRole('button', { name: 'Edit' }))
  await user.click(screen.getByRole('button', { name: "The app's own colour" }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().categories.find(c => c.id === 'health')?.color).toBeUndefined()
})

test('the sentence names only the parts that are not zero, and joins them the way a person would', () => {
  expect(usageSentence({ tasks: 14, blocks: 2, backlog: 1 })).toBe('14 tasks, 2 template blocks and 1 backlog item')
  expect(usageSentence({ tasks: 1, blocks: 0, backlog: 0 })).toBe('1 task')
  expect(usageSentence({ tasks: 0, blocks: 3, backlog: 2 })).toBe('3 template blocks and 2 backlog items')
  expect(usageSentence({ tasks: 0, blocks: 0, backlog: 0 })).toBe('')
})
