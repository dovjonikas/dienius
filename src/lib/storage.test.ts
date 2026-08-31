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

test('a template written before day types existed loads with type undefined', () => {
  const legacy = JSON.stringify({
    templates: [{ id: 't1', name: 'Work', color: '#a7c4f5', blocks: [{ id: 'b1', title: 'Gym' }] }],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  const loaded = loadData()
  expect(loaded.templates[0].type).toBeUndefined()
  expect(loaded.templates[0].blocks[0].core).toBeUndefined()
})

test('a day plan written before day types existed loads with dayType undefined', () => {
  const legacy = JSON.stringify({
    templates: [],
    days: { '2026-09-01': { date: '2026-09-01', tasks: [{ id: 'x1', title: 'Old task', done: false }] } },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  const loaded = loadData()
  expect(loaded.days['2026-09-01'].dayType).toBeUndefined()
  expect(loaded.days['2026-09-01'].tasks[0].core).toBeUndefined()
})

test('validate accepts a template with a known type and a task or block marked core', () => {
  const good = JSON.stringify({
    templates: [{
      id: 't1', name: 'Night shift', color: '#c9b3f0', type: 'shift',
      blocks: [{ id: 'b1', time: '19:00', title: 'Clock in', core: true }],
    }],
    days: {
      '2026-09-01': {
        date: '2026-09-01', templateId: 't1', dayType: 'shift',
        tasks: [{ id: 'x1', title: 'Clock in', time: '19:00', done: false, fromTemplate: true, core: true }],
      },
    },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, good)
  const loaded = loadData()
  expect(loaded.templates[0].type).toBe('shift')
  expect(loaded.days['2026-09-01'].dayType).toBe('shift')
  expect(loaded.days['2026-09-01'].tasks[0].core).toBe(true)
})

test('validate rejects a template with an unknown day type', () => {
  const bad = JSON.stringify({
    templates: [{ id: 't1', name: 'Work', color: '#a7c4f5', type: 'weekend', blocks: [] }],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, bad)
  expect(loadData()).toEqual(defaultData())
})

test('validate rejects a day plan with an unknown day type', () => {
  const bad = JSON.stringify({
    templates: [],
    days: { '2026-09-01': { date: '2026-09-01', dayType: 'weekend', tasks: [] } },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, bad)
  expect(loadData()).toEqual(defaultData())
})

test('validate rejects a task or block whose core flag is not a boolean', () => {
  const badTask = JSON.stringify({
    templates: [],
    days: { '2026-09-01': { date: '2026-09-01', tasks: [{ id: 'x1', title: 'Bad', done: false, core: 'yes' }] } },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, badTask)
  expect(loadData()).toEqual(defaultData())

  const badBlock = JSON.stringify({
    templates: [{ id: 't1', name: 'Work', color: '#a7c4f5', blocks: [{ id: 'b1', title: 'Gym', core: 1 }] }],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, badBlock)
  expect(loadData()).toEqual(defaultData())
})

test('a payload written before the if-then board existed has no ifThens key and still loads', () => {
  const legacy = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  const loaded = loadData()
  expect(loaded.ifThens).toEqual([])
})

test('loading a payload from before the if-then board existed enables the widget on it, since there is no way to turn it off', () => {
  const legacy = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  expect(loadData().settings.enabledWidgets).toEqual(['day-plan', 'if-then'])
})

// Migration must run exactly once per payload, not on every load. The
// ifThens key's presence is what marks a payload as already migrated - see
// normalizeLoaded in storage.ts. Without this, a future settings toggle
// that lets someone turn the if-then widget off would find it silently
// back on the next time the app loads.
test('a payload that has already been migrated and had the widget removed from enabledWidgets does not get it added back', () => {
  const alreadyMigrated = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
    ifThens: [],
  })
  localStorage.setItem(STORAGE_KEY, alreadyMigrated)
  expect(loadData().settings.enabledWidgets).toEqual(['day-plan'])
})

test('importJson leaves enabledWidgets untouched for a backup that has already been migrated', () => {
  const alreadyMigrated = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
    ifThens: [],
  })
  expect(importJson(alreadyMigrated).settings.enabledWidgets).toEqual(['day-plan'])
})

test('validate rejects an if-then entry missing an id, or with a non-string trigger or action', () => {
  const missingId = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
    ifThens: [{ trigger: 'I get home', action: 'Set a timer' }],
  })
  localStorage.setItem(STORAGE_KEY, missingId)
  expect(loadData().ifThens).toEqual([])

  const badTrigger = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
    ifThens: [{ id: 'i1', trigger: 42, action: 'Set a timer' }],
  })
  localStorage.setItem(STORAGE_KEY, badTrigger)
  expect(loadData().ifThens).toEqual([])
})

test('validate accepts a well-formed if-then entry, tagged or not', () => {
  const good = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
    ifThens: [
      { id: 'i1', trigger: 'I get home and the kitchen is a mess', action: 'Set a ten minute timer for the sink', color: '#a7c4f5' },
      { id: 'i2', trigger: 'It is 22:30', action: 'Phone goes on the charger in the hallway' },
    ],
  })
  localStorage.setItem(STORAGE_KEY, good)
  const loaded = loadData()
  expect(loaded.ifThens).toHaveLength(2)
  expect(loaded.ifThens[0].color).toBe('#a7c4f5')
  expect(loaded.ifThens[1].color).toBeUndefined()
})

test('importJson backfills ifThens and the if-then widget for a legacy backup file', () => {
  const legacy = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'dark', enabledWidgets: ['day-plan'] },
  })
  const imported = importJson(legacy)
  expect(imported.ifThens).toEqual([])
  expect(imported.settings.enabledWidgets).toEqual(['day-plan', 'if-then'])
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
