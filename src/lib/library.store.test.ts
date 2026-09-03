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

// --- how an item is counted, and the pace note beside it --------------------

test('switching between chapters and pages keeps how far through you are', () => {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  const item = actions.addLibraryItem(list.id, 'The War of Art, 20 chapters')!
  actions.setLibraryItemProgress(list.id, item.id, 4, TODAY)

  actions.updateLibraryItem(list.id, item.id, { track: 'pages', total: 139 })
  const after = getData().library[0].items[0]
  // The 4 stays exactly where it was. The app has no way to turn chapters
  // into pages, and inventing a conversion would be worse than showing a
  // number that needs correcting once.
  expect(after.progress).toBe(4)
  expect(after.track).toBe('pages')
  expect(after.total).toBe(139)

  actions.updateLibraryItem(list.id, item.id, { track: null })
  expect(getData().library[0].items[0].track).toBeUndefined()
  expect(getData().library[0].items[0].progress).toBe(4)
})

test('a pace note is kept as written, and cleared by asking for nothing', () => {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  const item = actions.addLibraryItem(list.id, 'Sapiens, 20 chapters')!
  actions.updateLibraryItem(list.id, item.id, { pace: '  one chapter a day  ' })
  expect(getData().library[0].items[0].pace).toBe('one chapter a day')
  actions.updateLibraryItem(list.id, item.id, { pace: null })
  expect(getData().library[0].items[0].pace).toBeUndefined()
})

test('a line that names a shape adds an item of that shape', () => {
  const list = actions.addLibraryList({ name: 'Watching', unit: 'episode' })
  actions.addLibraryItem(list.id, 'Interstellar, movie')
  actions.addLibraryItem(list.id, 'Invincible, 3 seasons')
  actions.addLibraryItem(list.id, 'From, 10 episodes')
  expect(getData().library[0].items).toMatchObject([
    { title: 'Interstellar', track: 'movie' },
    { title: 'Invincible', track: 'series', seasons: 3, season: 1 },
    { title: 'From', track: 'series', total: 10 },
  ])
})

test('taking on the next season starts it at nothing and reopens the item', () => {
  const list = actions.addLibraryList({ name: 'Watching', unit: 'episode' })
  const item = actions.addLibraryItem(list.id, 'Invincible, 3 seasons')!
  actions.updateLibraryItem(list.id, item.id, { total: 8 })
  actions.setLibraryItemProgress(list.id, item.id, 8, TODAY)

  actions.advanceLibrarySeason(list.id, item.id)
  const after = getData().library[0].items[0]
  expect(after).toMatchObject({ season: 2, progress: 0 })
  expect(after.total).toBeUndefined()
  expect(after.finished).toBeUndefined()
})

test('nothing advances a season on something that is not a series', () => {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  const item = actions.addLibraryItem(list.id, 'Sapiens, 20 chapters')!
  actions.advanceLibrarySeason(list.id, item.id)
  expect(getData().library[0].items[0].season).toBeUndefined()
})

// --- putting a list onto a template in one flow ----------------------------
//
// This used to be two screens and a piece of knowledge nobody has: build a
// block in the Templates tab, then find the binding control on it.

test('a session block is added to the template, bound to the list', () => {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  const template = actions.addTemplate({ name: 'Weekday', color: '#6c8cff', blocks: [] })

  expect(
    actions.addLibraryBlockToTemplate(template.id, list.id, { title: 'Reading', time: '21:00', minutes: 30 }),
  ).toBe(true)
  expect(getData().templates[0].blocks).toMatchObject([
    { title: 'Reading', time: '21:00', minutes: 30, libraryListId: list.id },
  ])
})

/**
 * It binds to the list, not to the item it was started from, and that is the
 * whole point of the binding as it already existed: the block says "a reading
 * session", the list says which book, and finishing a book moves the block on
 * to the next one instead of leaving a dead block behind.
 */
test('a second block for the same list is refused rather than added', () => {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  const template = actions.addTemplate({ name: 'Weekday', color: '#6c8cff', blocks: [] })
  actions.addLibraryBlockToTemplate(template.id, list.id, { title: 'Reading', time: '21:00' })

  expect(actions.addLibraryBlockToTemplate(template.id, list.id, { title: 'More reading' })).toBe(false)
  expect(getData().templates[0].blocks).toHaveLength(1)
})

test('the block already there can be changed instead', () => {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  const template = actions.addTemplate({ name: 'Weekday', color: '#6c8cff', blocks: [] })
  actions.addLibraryBlockToTemplate(template.id, list.id, { title: 'Reading', time: '21:00', minutes: 30 })

  expect(
    actions.replaceLibraryBlockOnTemplate(template.id, list.id, { title: 'Reading', time: '22:00', minutes: 45 }),
  ).toBe(true)
  expect(getData().templates[0].blocks).toMatchObject([
    { title: 'Reading', time: '22:00', minutes: 45, libraryListId: list.id },
  ])
  expect(getData().templates[0].blocks).toHaveLength(1)
})

test('a block with no time asked for comes back with none, rather than keeping the old one', () => {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  const template = actions.addTemplate({ name: 'Weekday', color: '#6c8cff', blocks: [] })
  actions.addLibraryBlockToTemplate(template.id, list.id, { title: 'Reading', time: '21:00', minutes: 30 })
  actions.replaceLibraryBlockOnTemplate(template.id, list.id, { title: 'Reading' })
  expect(getData().templates[0].blocks[0].time).toBeUndefined()
  expect(getData().templates[0].blocks[0].minutes).toBeUndefined()
})

test('a template or a list that is not there changes nothing', () => {
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  expect(actions.addLibraryBlockToTemplate('nope', list.id, { title: 'Reading' })).toBe(false)
  const template = actions.addTemplate({ name: 'Weekday', color: '#6c8cff', blocks: [] })
  expect(actions.addLibraryBlockToTemplate(template.id, 'nope', { title: 'Reading' })).toBe(false)
  expect(actions.replaceLibraryBlockOnTemplate(template.id, list.id, { title: 'Reading' })).toBe(false)
  expect(getData().templates[0].blocks).toEqual([])
})
