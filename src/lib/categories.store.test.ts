import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { categorySlice, categoryUsage } from './store/categories'
import { defaultData } from './storage'
import type { AppData, BacklogItem, DayPlan, Task, Template } from './types'

/**
 * The list the owner authors, and the one part of it with a real decision in
 * it - what happens to everything pointing at a category that is deleted.
 *
 * The rule is that a delete offers to move what it would orphan, in one
 * commit, with one undo. A dangling id would degrade to "no category" safely
 * enough, which is exactly why it is the wrong answer: a day quietly loses
 * its colour and nothing is said about it.
 */

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

function day(date: string, tasks: Task[]): Record<string, DayPlan> {
  return { [date]: { date, tasks } }
}

test('a new category lands at the end of the list, with the colour that was picked', () => {
  const made = actions.addCategory({ label: 'Gym', color: '#4fa46a' })
  expect(made).toBeDefined()
  const list = getData().categories
  expect(list).toHaveLength(7)
  expect(list[6]).toMatchObject({ label: 'Gym', color: '#4fa46a' })
})

test('a new category with no name, or a colour that will not read, is refused', () => {
  expect(actions.addCategory({ label: '   ', color: '#4fa46a' })).toBeUndefined()
  expect(actions.addCategory({ label: 'Gym', color: 'not a colour' })).toBeUndefined()
  expect(getData().categories).toHaveLength(6)
})

test('renaming one leaves every id alone, so nothing on disk has to be rewritten', () => {
  actions.updateCategory('commute', { label: 'Errands' })
  const list = getData().categories
  expect(list.map(c => c.id)).toEqual(['core', 'routine', 'health', 'meal', 'commute', 'personal'])
  expect(list.find(c => c.id === 'commute')?.label).toBe('Errands')
})

test('clearing a colour brings the app’s own pair back, and only a default has one', () => {
  actions.updateCategory('health', { color: '#d1698f' })
  expect(getData().categories.find(c => c.id === 'health')?.color).toBe('#d1698f')
  actions.updateCategory('health', { color: null })
  expect(getData().categories.find(c => c.id === 'health')?.color).toBeUndefined()
})

test('an unreadable colour is refused rather than clamped to something nobody chose', () => {
  actions.updateCategory('health', { label: 'Body', color: '#zzzzzz' })
  const health = getData().categories.find(c => c.id === 'health')
  // Neither half of the patch lands: a refused write is refused whole, so
  // nobody ends up with the rename and not the colour and no idea why.
  expect(health?.label).toBe('Health')
  expect(health?.color).toBeUndefined()
})

test('the order is the array’s own, and a drag moves one place in it', () => {
  actions.reorderCategories(0, 2)
  expect(getData().categories.map(c => c.id)).toEqual(['routine', 'health', 'core', 'meal', 'commute', 'personal'])
  // Out of range does nothing rather than throwing: the caller is a pointer
  // drag, and a finger that leaves the list is not an error.
  actions.reorderCategories(0, 99)
  expect(getData().categories[0].id).toBe('routine')
})

test('a delete moves every task, template block and backlog item onto the target, in one commit', () => {
  const templates: Template[] = [
    {
      id: 't1',
      name: 'Weekday',
      color: '#a7c4f5',
      blocks: [
        { id: 'b1', title: 'Walk', category: 'health' },
        { id: 'b2', title: 'Standup', category: 'core' },
      ],
    },
  ]
  const backlog: BacklogItem[] = [{ id: 'k1', title: 'Physio', category: 'health' }]
  seed({
    templates,
    backlog,
    days: day('2026-09-01', [
      task({ title: 'Run', category: 'health' }),
      task({ title: 'Write', category: 'core' }),
    ]),
  })

  actions.deleteCategory('health', 'personal')

  const after = getData()
  expect(after.categories.map(c => c.id)).not.toContain('health')
  expect(after.days['2026-09-01'].tasks.map(t => t.category)).toEqual(['personal', 'core'])
  expect(after.templates[0].blocks.map(b => b.category)).toEqual(['personal', 'core'])
  expect(after.backlog[0].category).toBe('personal')
})

test('the last category cannot be deleted, because there is nowhere to move to', () => {
  seed({ categories: [{ id: 'core', label: 'Deep work' }] })
  actions.deleteCategory('core', undefined)
  expect(getData().categories).toHaveLength(1)
})

test('a delete to a target that does not exist changes nothing', () => {
  actions.deleteCategory('health', 'not-a-category')
  expect(getData().categories).toHaveLength(6)
  actions.deleteCategory('health', 'health')
  expect(getData().categories).toHaveLength(6)
})

test('one undo puts back the category and everything the delete rewrote', () => {
  seed({
    backlog: [{ id: 'k1', title: 'Physio', category: 'health' }],
    days: day('2026-09-01', [task({ title: 'Run', category: 'health' })]),
  })
  const before = categorySlice(getData())

  actions.deleteCategory('health', 'personal')
  expect(getData().days['2026-09-01'].tasks[0].category).toBe('personal')

  actions.restoreCategories(before)
  const after = getData()
  expect(after.categories.map(c => c.id)).toContain('health')
  expect(after.days['2026-09-01'].tasks[0].category).toBe('health')
  expect(after.backlog[0].category).toBe('health')
})

test('a delete with nothing pointing at it needs no target at all', () => {
  actions.deleteCategory('commute', undefined)
  expect(getData().categories.map(c => c.id)).not.toContain('commute')
})

/**
 * The count on the dialog. A fact about a button, not a warning - so it has
 * to be exactly right, and it has to be zero when it is zero.
 */
test('the usage count reads the three places a category can be pointed at, and nowhere else', () => {
  seed({
    templates: [{ id: 't1', name: 'W', color: '#a7c4f5', blocks: [{ id: 'b1', title: 'Walk', category: 'health' }] }],
    backlog: [
      { id: 'k1', title: 'Physio', category: 'health' },
      { id: 'k2', title: 'Other', category: 'core' },
    ],
    days: {
      ...day('2026-09-01', [task({ category: 'health' }), task({ category: 'health' })]),
      ...day('2026-09-02', [task({ category: 'core' })]),
    },
  })
  expect(categoryUsage(getData(), 'health')).toEqual({ tasks: 2, blocks: 1, backlog: 1 })
  expect(categoryUsage(getData(), 'meal')).toEqual({ tasks: 0, blocks: 0, backlog: 0 })
})
