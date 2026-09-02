import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { isItemFinished } from './library'

const DATE = '2026-09-01'
const TODAY = '2026-09-02'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function books() {
  return getData().library.find(l => l.name === 'Books')!
}

function seedBooks() {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter', unitShort: 'ch' })
  actions.addLibraryItem(list.id, 'Daring Greatly, 12 chapters')
  actions.addLibraryItem(list.id, 'The Odyssey, 24 chapters')
  return getData().library.find(l => l.id === list.id)!
}

// --- lists ---------------------------------------------------------------

test('a new list normalises its unit to lowercase and drops an empty short form', () => {
  const list = actions.addLibraryList({ name: 'Books', unit: 'Chapter', unitShort: '  ' })
  expect(list.unit).toBe('chapter')
  expect(list.unitShort).toBeUndefined()
})

test('a list with no unit at all still has one, rather than counting nothings', () => {
  expect(actions.addLibraryList({ name: 'Things', unit: '   ' }).unit).toBe('item')
})

test('renaming the unit lowercases it the same way creating it does', () => {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  actions.updateLibraryList(list.id, { unit: 'PART' })
  expect(getData().library[0].unit).toBe('part')
})

// --- items ---------------------------------------------------------------

test('an item is added from the raw typed line, total and all', () => {
  const list = seedBooks()
  expect(list.items.map(i => [i.title, i.total])).toEqual([
    ['Daring Greatly', 12],
    ['The Odyssey', 24],
  ])
})

test('stepping an item forward and back moves only that item', () => {
  const list = seedBooks()
  actions.stepLibraryItem(list.id, list.items[0].id, 3, TODAY)
  expect(books().items[0].progress).toBe(3)
  expect(books().items[1].progress ?? 0).toBe(0)
  actions.stepLibraryItem(list.id, list.items[0].id, -1, TODAY)
  expect(books().items[0].progress).toBe(2)
})

test('progress never goes below zero however hard it is stepped back', () => {
  const list = seedBooks()
  actions.stepLibraryItem(list.id, list.items[0].id, -5, TODAY)
  expect(books().items[0].progress).toBe(0)
})

test('reaching the total finishes an item and stamps the day it happened', () => {
  const list = seedBooks()
  actions.stepLibraryItem(list.id, list.items[0].id, 12, TODAY)
  expect(books().items[0].finished).toBe(TODAY)
  expect(isItemFinished(books().items[0])).toBe(true)
})

// Stepping back off the last unit has to un-finish it - a derived flag could
// not express this, which is why finished is stored.
test('stepping back off the last unit reopens a finished item', () => {
  const list = seedBooks()
  actions.stepLibraryItem(list.id, list.items[0].id, 12, TODAY)
  actions.stepLibraryItem(list.id, list.items[0].id, -1, TODAY)
  expect(books().items[0].finished).toBeUndefined()
  expect(books().items[0].progress).toBe(11)
})

test('an item can be finished outright and reopened again, whatever the count says', () => {
  const list = seedBooks()
  actions.toggleLibraryItemFinished(list.id, list.items[0].id, TODAY)
  expect(books().items[0].finished).toBe(TODAY)
  expect(books().items[0].progress).toBe(12)
  actions.toggleLibraryItemFinished(list.id, list.items[0].id, TODAY)
  expect(books().items[0].finished).toBeUndefined()
  expect(isItemFinished(books().items[0])).toBe(false)
})

test('setting a total below the current count clamps the count to it', () => {
  const list = seedBooks()
  actions.stepLibraryItem(list.id, list.items[0].id, 9, TODAY)
  actions.setLibraryItemTotal(list.id, list.items[0].id, 5, TODAY)
  expect(books().items[0].progress).toBe(5)
  expect(books().items[0].finished).toBe(TODAY)
})

test('moving an item changes the order, which is what next means on this list', () => {
  const list = seedBooks()
  actions.moveLibraryItem(list.id, list.items[1].id, 0)
  expect(books().items.map(i => i.title)).toEqual(['The Odyssey', 'Daring Greatly'])
})

test('moving an item past either end lands it at that end rather than nowhere', () => {
  const list = seedBooks()
  actions.moveLibraryItem(list.id, list.items[0].id, 99)
  expect(books().items.map(i => i.title)).toEqual(['The Odyssey', 'Daring Greatly'])
})

// --- binding -------------------------------------------------------------

test('scheduling an item puts a task on the day, named after it and bound to it', () => {
  const list = seedBooks()
  expect(actions.scheduleLibraryItem(DATE, list.id, list.items[0].id)).toBe(true)
  const task = getData().days[DATE].tasks[0]
  expect(task.title).toBe('Daring Greatly')
  expect(task.libraryRef).toEqual({ listId: list.id, itemId: list.items[0].id })
})

// Two identical cards is not a plan to read twice, it is the same tap
// landing twice - see actions.scheduleLibraryItem.
test('scheduling the same item twice on one day is refused, not silently doubled', () => {
  const list = seedBooks()
  actions.scheduleLibraryItem(DATE, list.id, list.items[0].id)
  expect(actions.scheduleLibraryItem(DATE, list.id, list.items[0].id)).toBe(false)
  expect(getData().days[DATE].tasks).toHaveLength(1)
})

test('a second sitting is allowed once the first is done - that is a real thing to plan', () => {
  const list = seedBooks()
  actions.scheduleLibraryItem(DATE, list.id, list.items[0].id)
  actions.toggleTask(DATE, getData().days[DATE].tasks[0].id)
  expect(actions.scheduleLibraryItem(DATE, list.id, list.items[0].id)).toBe(true)
  expect(getData().days[DATE].tasks).toHaveLength(2)
})

test('ticking a bound task off advances its item, and un-ticking steps it back', () => {
  const list = seedBooks()
  actions.scheduleLibraryItem(DATE, list.id, list.items[0].id)
  const taskId = getData().days[DATE].tasks[0].id
  actions.toggleTask(DATE, taskId)
  expect(books().items[0].progress).toBe(1)
  actions.toggleTask(DATE, taskId)
  expect(books().items[0].progress).toBe(0)
})

test('ticking an unbound task off touches no library at all', () => {
  seedBooks()
  actions.addTask(DATE, 'Call the bank')
  actions.toggleTask(DATE, getData().days[DATE].tasks[0].id)
  expect(books().items.every(i => (i.progress ?? 0) === 0)).toBe(true)
})

// A ref that resolves to nothing behaves like no ref at all - the same
// contract every other dangling id in this app keeps.
test('a task bound to an item that no longer exists still ticks off cleanly', () => {
  const list = seedBooks()
  actions.scheduleLibraryItem(DATE, list.id, list.items[0].id)
  const taskId = getData().days[DATE].tasks[0].id
  actions.deleteLibraryList(list.id)
  expect(() => actions.toggleTask(DATE, taskId)).not.toThrow()
  expect(getData().days[DATE].tasks[0].done).toBe(true)
})

test('deleting a list clears every task binding and every template binding to it', () => {
  const list = seedBooks()
  actions.scheduleLibraryItem(DATE, list.id, list.items[0].id)
  const template = actions.addTemplate({
    name: 'Evening',
    color: '#a7c4f5',
    blocks: [{ title: 'Reading', libraryListId: list.id }],
  })
  actions.deleteLibraryList(list.id)
  expect(getData().library).toHaveLength(0)
  expect(getData().days[DATE].tasks[0].libraryRef).toBeUndefined()
  expect(getData().templates.find(t => t.id === template.id)!.blocks[0].libraryListId).toBeUndefined()
})

test('deleting one item clears the tasks bound to it and leaves the rest of the list alone', () => {
  const list = seedBooks()
  actions.scheduleLibraryItem(DATE, list.id, list.items[0].id)
  actions.deleteLibraryItem(list.id, list.items[0].id)
  expect(books().items.map(i => i.title)).toEqual(['The Odyssey'])
  expect(getData().days[DATE].tasks[0].libraryRef).toBeUndefined()
})

// --- stamping ------------------------------------------------------------

test('a block bound to a list stamps a task named after the next unfinished item', () => {
  const list = seedBooks()
  const template = actions.addTemplate({
    name: 'Evening',
    color: '#a7c4f5',
    blocks: [{ time: '19:00', title: 'Reading', libraryListId: list.id }],
  })
  actions.stamp({ [DATE]: template.id })
  const task = getData().days[DATE].tasks[0]
  expect(task.title).toBe('Daring Greatly')
  expect(task.libraryRef?.itemId).toBe(list.items[0].id)
})

test('a bound block whose list has nothing unfinished left stamps its own title, not an empty one', () => {
  const list = seedBooks()
  actions.toggleLibraryItemFinished(list.id, list.items[0].id, TODAY)
  actions.toggleLibraryItemFinished(list.id, list.items[1].id, TODAY)
  const template = actions.addTemplate({
    name: 'Evening',
    color: '#a7c4f5',
    blocks: [{ time: '19:00', title: 'Reading', libraryListId: list.id }],
  })
  actions.stamp({ [DATE]: template.id })
  const task = getData().days[DATE].tasks[0]
  expect(task.title).toBe('Reading')
  expect(task.libraryRef).toBeUndefined()
})

test('a bound block whose list was deleted stamps an ordinary task rather than failing', () => {
  const list = seedBooks()
  const template = actions.addTemplate({
    name: 'Evening',
    color: '#a7c4f5',
    blocks: [{ time: '19:00', title: 'Reading', libraryListId: list.id }],
  })
  actions.deleteLibraryList(list.id)
  actions.stamp({ [DATE]: template.id })
  expect(getData().days[DATE].tasks[0].title).toBe('Reading')
})
