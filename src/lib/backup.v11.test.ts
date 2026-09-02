import { expect, test } from 'vitest'
import { defaultData, exportJson, importJson, validate } from './storage'
import type { AppData } from './types'

/**
 * The round trip for everything v1.1 added.
 *
 * A backup is the only copy of anything in this app - there is no server to
 * fall back on - so a field that survives being written and not being read
 * back is silent data loss. Each of these fields went in one at a time, and
 * this is the test that says they all come out.
 */
function full(): AppData {
  const data = defaultData()

  data.library = [
    {
      id: 'books',
      name: 'Books',
      unit: 'chapter',
      unitShort: 'ch',
      unitPlural: 'chapters',
      items: [
        { id: 'b1', title: 'Daring Greatly', total: 12, progress: 4 },
        { id: 'b2', title: 'A podcast', progress: 40 },
        { id: 'b3', title: 'Deep Work', total: 8, progress: 8, finished: '2026-08-20' },
      ],
    },
  ]

  data.settings.sleepProfiles = [
    { id: 'default', name: 'Sleep schedule', window: { start: '23:00', end: '07:00' } },
    { id: 'shift', name: 'Shift', window: { start: '09:00', end: '17:00' } },
  ]

  data.templates = [
    {
      id: 't1',
      name: 'Working day',
      color: '#a7c4f5',
      type: 'full',
      sleepProfileId: 'shift',
      blocks: [
        {
          id: 'blk1',
          time: '19:00',
          title: 'Reading',
          minutes: 45,
          core: true,
          unbounded: true,
          category: 'personal',
          libraryListId: 'books',
        },
      ],
    },
  ]

  data.days['2026-09-01'] = {
    date: '2026-09-01',
    templateId: 't1',
    dayType: 'full',
    sleepProfileId: 'shift',
    tasks: [
      {
        id: 'k1',
        title: 'Daring Greatly',
        done: false,
        time: '19:00',
        minutes: 45,
        category: 'personal',
        core: true,
        unbounded: true,
        pushCount: 2,
        note: 'chapter on shame',
        highlight: true,
        repeat: 'weekdays',
        libraryRef: { listId: 'books', itemId: 'b1' },
        subtasks: [
          { id: 's1', title: 'Find where I left off', done: true },
          { id: 's2', title: 'Read one chapter', done: false },
        ],
      },
    ],
  }

  data.inbox = [{ id: 'i1', text: 'Book the dentist', captured: '2026-09-01T08:00:00.000Z' }]

  return data
}

test('a payload carrying every v1.1 field validates', () => {
  expect(validate(JSON.parse(exportJson(full())))).toBe(true)
})

test('every v1.1 field survives export and re-import byte for byte', () => {
  const before = full()
  expect(importJson(exportJson(before))).toEqual(before)
})

test('the task detail fields in particular come back whole', () => {
  const task = importJson(exportJson(full())).days['2026-09-01'].tasks[0]
  expect(task.note).toBe('chapter on shame')
  expect(task.highlight).toBe(true)
  expect(task.repeat).toBe('weekdays')
  expect(task.libraryRef).toEqual({ listId: 'books', itemId: 'b1' })
  expect(task.subtasks).toHaveLength(2)
  expect(task.subtasks![0].done).toBe(true)
})

test('the template block keeps its category and its library binding', () => {
  const block = importJson(exportJson(full())).templates[0].blocks[0]
  expect(block.category).toBe('personal')
  expect(block.libraryListId).toBe('books')
})

test('a library item with no total is not turned into one with a zero', () => {
  const item = importJson(exportJson(full())).library[0].items[1]
  expect(item.total).toBeUndefined()
  expect(item.progress).toBe(40)
})

// --- what a crafted or corrupt file is refused ---------------------------

function withLibrary(library: unknown) {
  return { ...JSON.parse(exportJson(defaultData())), library }
}

test('a library that is not a list is refused', () => {
  expect(validate(withLibrary({ books: [] }))).toBe(false)
})

test('a list with no unit is refused - every count would have nothing to be in', () => {
  expect(validate(withLibrary([{ id: 'l', name: 'Books', items: [] }]))).toBe(false)
})

test('a fractional or negative progress count is refused rather than rounded silently', () => {
  const list = (progress: unknown) => [{ id: 'l', name: 'B', unit: 'ch', items: [{ id: 'i', title: 'T', progress }] }]
  expect(validate(withLibrary(list(4.5)))).toBe(false)
  expect(validate(withLibrary(list(-1)))).toBe(false)
  expect(validate(withLibrary(list('4')))).toBe(false)
  expect(validate(withLibrary(list(4)))).toBe(true)
})

test('an absurd count is refused - it would break every label that renders it', () => {
  const list = [{ id: 'l', name: 'B', unit: 'ch', items: [{ id: 'i', title: 'T', total: 1e9 }] }]
  expect(validate(withLibrary(list))).toBe(false)
})

test('a subtask missing its done flag is refused', () => {
  const payload = JSON.parse(exportJson(defaultData()))
  payload.days['2026-09-01'] = {
    date: '2026-09-01',
    tasks: [{ id: 't', title: 'T', done: false, subtasks: [{ id: 's', title: 'S' }] }],
  }
  expect(validate(payload)).toBe(false)
})

test('a repeat this app does not have is refused', () => {
  const payload = JSON.parse(exportJson(defaultData()))
  payload.days['2026-09-01'] = {
    date: '2026-09-01',
    tasks: [{ id: 't', title: 'T', done: false, repeat: 'fortnightly' }],
  }
  expect(validate(payload)).toBe(false)
})

test('a library ref missing half of itself is refused', () => {
  const payload = JSON.parse(exportJson(defaultData()))
  payload.days['2026-09-01'] = {
    date: '2026-09-01',
    tasks: [{ id: 't', title: 'T', done: false, libraryRef: { listId: 'books' } }],
  }
  expect(validate(payload)).toBe(false)
})

// A payload written before any of this existed still has to load - that is
// the entire promise a local-first app makes about its own backups.
test('a backup from before the library existed still loads, with an empty one', () => {
  const old = JSON.parse(exportJson(defaultData()))
  delete old.library
  delete old.inbox
  expect(validate(old)).toBe(true)
  expect(importJson(JSON.stringify(old)).library).toEqual([])
})
