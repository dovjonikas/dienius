import { beforeEach, expect, test, vi } from 'vitest'
import { defaultData, loadData, saveData, importJson, exportJson, STORAGE_KEY } from './storage'

beforeEach(() => localStorage.clear())

test('loadData returns default data when storage is empty', () => {
  const data = loadData()
  expect(data.templates).toEqual([])
  expect(data.days).toEqual({})
  expect(data.settings.theme).toBe('light')
})

test('saveData then loadData round-trips', () => {
  const data = defaultData()
  data.templates.push({ id: 't1', name: 'Work day', color: '#8ab6f9', blocks: [] })
  expect(saveData(data)).toBe(true)
  expect(loadData().templates[0].name).toBe('Work day')
})

test('loadData falls back to defaults on corrupt JSON', () => {
  localStorage.setItem(STORAGE_KEY, '{not json')
  expect(loadData().templates).toEqual([])
})

test('importJson round-trips through exportJson', () => {
  const data = defaultData()
  data.days['2026-09-01'] = { date: '2026-09-01', tasks: [] }
  const imported = importJson(exportJson(data))
  expect(imported.days['2026-09-01'].date).toBe('2026-09-01')
})

test('importJson rejects invalid payloads', () => {
  expect(() => importJson('{"hello": 1}')).toThrow('Invalid Dienius backup file')
  expect(() => importJson('not json')).toThrow('Invalid Dienius backup file')
})

test('saveData returns false when localStorage.setItem throws', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem')
  spy.mockImplementation(() => {
    throw new Error('quota exceeded')
  })
  const data = defaultData()
  expect(saveData(data)).toBe(false)
  spy.mockRestore()
})

test('loadData falls back to defaults on schema mismatch', () => {
  localStorage.setItem(STORAGE_KEY, '{"hello": 1, "world": 2}')
  expect(loadData().templates).toEqual([])
  expect(loadData().days).toEqual({})
  expect(loadData().settings.theme).toBe('light')
})

test('a payload with the right top-level shape but empty inner objects is rejected', () => {
  // This is the exact shape that used to pass the old validate(): an array
  // for templates and objects for days/settings, but with none of their
  // required fields. TemplatesView crashed on t.blocks.length once it
  // reached the screen.
  const malformed = '{"templates":[{}],"days":{},"settings":{}}'
  localStorage.setItem(STORAGE_KEY, malformed)
  expect(loadData()).toEqual(defaultData())
  expect(() => importJson(malformed)).toThrow('Invalid Dienius backup file')
})

test('validate rejects a day whose tasks are malformed', () => {
  const malformed = JSON.stringify({
    templates: [],
    days: { '2026-09-01': { date: '2026-09-01', tasks: [{ title: 'no id or done' }] } },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, malformed)
  expect(loadData()).toEqual(defaultData())
})

test('validate rejects settings missing enabledWidgets or with a bad theme', () => {
  const badTheme = JSON.stringify({ templates: [], days: {}, settings: { theme: 'sepia', enabledWidgets: [] } })
  localStorage.setItem(STORAGE_KEY, badTheme)
  expect(loadData()).toEqual(defaultData())

  const missingWidgets = JSON.stringify({ templates: [], days: {}, settings: { theme: 'light' } })
  localStorage.setItem(STORAGE_KEY, missingWidgets)
  expect(loadData()).toEqual(defaultData())
})

test('validate accepts a task with no pushCount, defaulting it on read', () => {
  const noPushCount = JSON.stringify({
    templates: [],
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'x1', title: 'From before the field existed', done: false }],
      },
    },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, noPushCount)
  const loaded = loadData()
  expect(loaded.days['2026-09-01'].tasks[0].pushCount).toBeUndefined()
  expect(loaded.days['2026-09-01'].tasks[0].title).toBe('From before the field existed')
})

test('validate rejects a task whose pushCount is not a non-negative integer', () => {
  const negative = JSON.stringify({
    templates: [],
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'x1', title: 'Bad', done: false, pushCount: -1 }],
      },
    },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, negative)
  expect(loadData()).toEqual(defaultData())

  const fractional = JSON.stringify({
    templates: [],
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'x1', title: 'Bad', done: false, pushCount: 1.5 }],
      },
    },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, fractional)
  expect(loadData()).toEqual(defaultData())
})

test('a well-formed payload still passes validate', () => {
  const good = JSON.stringify({
    templates: [{ id: 't1', name: 'Work', color: '#a7c4f5', blocks: [{ id: 'b1', time: '09:00', title: 'Gym' }] }],
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        templateId: 't1',
        tasks: [{ id: 'x1', title: 'Gym', time: '09:00', done: false, fromTemplate: true }],
      },
    },
    settings: { theme: 'dark', enabledWidgets: ['day-plan'] },
  })
  localStorage.setItem(STORAGE_KEY, good)
  expect(loadData().templates[0].name).toBe('Work')
  expect(loadData().days['2026-09-01'].tasks[0].title).toBe('Gym')
})
