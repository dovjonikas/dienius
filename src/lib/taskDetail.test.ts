import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { MAX_HIGHLIGHTS } from './types'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function seed(count = 1): string[] {
  for (let i = 0; i < count; i++) actions.addTask(DATE, `Task ${i + 1}`)
  return getData().days[DATE].tasks.map(t => t.id)
}

function task(id: string) {
  return getData().days[DATE].tasks.find(t => t.id === id)!
}

// --- time and title ------------------------------------------------------

test('setting a time anchors a task, and clearing it makes it a float again', () => {
  const [id] = seed()
  actions.setTaskTime(DATE, id, '09:30')
  expect(task(id).time).toBe('09:30')
  actions.setTaskTime(DATE, id, undefined)
  expect(task(id).time).toBeUndefined()
})

// An empty string is the shape a cleared field produces, and it has to mean
// the same as undefined rather than becoming a task anchored at "".
test('an empty time string clears the anchor rather than storing a blank one', () => {
  const [id] = seed()
  actions.setTaskTime(DATE, id, '09:30')
  actions.setTaskTime(DATE, id, '')
  expect(task(id).time).toBeUndefined()
})

test('a retitled task keeps everything else about itself', () => {
  const [id] = seed()
  actions.setTaskTime(DATE, id, '09:30')
  actions.setTaskTitle(DATE, id, '  Deep work  ')
  expect(task(id).title).toBe('Deep work')
  expect(task(id).time).toBe('09:30')
})

test('a blank title is refused rather than leaving a nameless card', () => {
  const [id] = seed()
  actions.setTaskTitle(DATE, id, '   ')
  expect(task(id).title).toBe('Task 1')
})

// --- notes ---------------------------------------------------------------

test('a note is stored trimmed, and emptying it removes it rather than storing a blank', () => {
  const [id] = seed()
  actions.setTaskNote(DATE, id, '  chapter on shame  ')
  expect(task(id).note).toBe('chapter on shame')
  actions.setTaskNote(DATE, id, '   ')
  expect(task(id).note).toBeUndefined()
})

// --- highlights ----------------------------------------------------------

test('a task can be marked key and unmarked again', () => {
  const [id] = seed()
  actions.toggleTaskHighlight(DATE, id)
  expect(task(id).highlight).toBe(true)
  actions.toggleTaskHighlight(DATE, id)
  expect(task(id).highlight).toBe(false)
})

// The cap refuses rather than dropping the oldest: swapping one out silently
// would make the cap invisible and the choice arbitrary.
test('the fourth key task is refused, and the three already marked are untouched', () => {
  const ids = seed(MAX_HIGHLIGHTS + 1)
  for (let i = 0; i < MAX_HIGHLIGHTS; i++) actions.toggleTaskHighlight(DATE, ids[i])
  actions.toggleTaskHighlight(DATE, ids[MAX_HIGHLIGHTS])

  expect(task(ids[MAX_HIGHLIGHTS]).highlight).toBeFalsy()
  expect(getData().days[DATE].tasks.filter(t => t.highlight)).toHaveLength(MAX_HIGHLIGHTS)
})

test('unmarking one frees the slot immediately', () => {
  const ids = seed(MAX_HIGHLIGHTS + 1)
  for (let i = 0; i < MAX_HIGHLIGHTS; i++) actions.toggleTaskHighlight(DATE, ids[i])
  actions.toggleTaskHighlight(DATE, ids[0])
  actions.toggleTaskHighlight(DATE, ids[MAX_HIGHLIGHTS])
  expect(task(ids[MAX_HIGHLIGHTS]).highlight).toBe(true)
})

// The cap is per day, not per app - three that matter today says nothing
// about tomorrow.
test('the cap is counted per day', () => {
  const ids = seed(MAX_HIGHLIGHTS)
  ids.forEach(id => actions.toggleTaskHighlight(DATE, id))
  actions.addTask('2026-09-02', 'Tomorrow')
  const other = getData().days['2026-09-02'].tasks[0].id
  actions.toggleTaskHighlight('2026-09-02', other)
  expect(getData().days['2026-09-02'].tasks[0].highlight).toBe(true)
})

test('highlighting a task that is not there does nothing rather than throwing', () => {
  seed()
  expect(() => actions.toggleTaskHighlight(DATE, 'not-a-task')).not.toThrow()
})

// --- sub-steps -----------------------------------------------------------

test('steps are added in order, tick independently, and delete one at a time', () => {
  const [id] = seed()
  actions.addSubtask(DATE, id, 'Outline')
  actions.addSubtask(DATE, id, 'Draft')
  expect(task(id).subtasks!.map(s => s.title)).toEqual(['Outline', 'Draft'])

  const first = task(id).subtasks![0].id
  actions.toggleSubtask(DATE, id, first)
  expect(task(id).subtasks!.map(s => s.done)).toEqual([true, false])

  actions.deleteSubtask(DATE, id, first)
  expect(task(id).subtasks!.map(s => s.title)).toEqual(['Draft'])
})

test('a blank step is refused - an empty line is not a step', () => {
  const [id] = seed()
  actions.addSubtask(DATE, id, '   ')
  expect(task(id).subtasks ?? []).toHaveLength(0)
})

// Steps are not tasks: ticking every one of them off says nothing about the
// task itself, which is still something a person has to decide is done.
test('finishing every step does not finish the task', () => {
  const [id] = seed()
  actions.addSubtask(DATE, id, 'Outline')
  actions.toggleSubtask(DATE, id, task(id).subtasks![0].id)
  expect(task(id).done).toBe(false)
})

// --- repeat --------------------------------------------------------------

test('a repeat is set and cleared', () => {
  const [id] = seed()
  actions.setTaskRepeat(DATE, id, 'weekdays')
  expect(task(id).repeat).toBe('weekdays')
  actions.setTaskRepeat(DATE, id, undefined)
  expect(task(id).repeat).toBeUndefined()
})

// --- library binding by hand ---------------------------------------------

test('a task can be bound to a library item by hand and unbound again', () => {
  const [id] = seed()
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  actions.addLibraryItem(list.id, 'The Odyssey, 24')
  const itemId = getData().library[0].items[0].id

  actions.setTaskLibraryRef(DATE, id, { listId: list.id, itemId })
  expect(task(id).libraryRef).toEqual({ listId: list.id, itemId })

  // Bound by hand, it advances exactly as one scheduled from the Library does.
  actions.toggleTask(DATE, id)
  expect(getData().library[0].items[0].progress).toBe(1)

  actions.setTaskLibraryRef(DATE, id, undefined)
  expect(task(id).libraryRef).toBeUndefined()
})
