import { beforeEach, expect, test, vi } from 'vitest'
import { defaultData, loadData, saveData, importJson, exportJson, STORAGE_KEY } from './storage'
import type { Template } from './types'

beforeEach(() => localStorage.clear())

// What loadData() falls back to for a payload that fails full validation
// but still carries a salvageable theme.mode of 'light' next to whatever
// is actually wrong with it - see salvageTheme in storage.ts. Distinct from
// defaultData() itself: a truly empty install gets mode 'system', but a
// payload that explicitly said 'light' keeps that explicit choice even
// when something else in it is corrupt.
function salvagedLightData() {
  const fallback = defaultData()
  return { ...fallback, settings: { ...fallback.settings, theme: { presetId: 'dark', overrides: {}, mode: 'light' as const } } }
}

test('loadData returns default data when storage is empty', () => {
  const data = loadData()
  expect(data.templates).toEqual([])
  expect(data.days).toEqual({})
  // A fresh install has never expressed a preference, so it follows the
  // system live rather than defaulting to a fixed light or dark - see
  // docs/THEMES.md section 4.
  expect(data.settings.theme).toEqual({ presetId: 'dark', overrides: {}, mode: 'system' })
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

test('loadData salvages a valid theme from a payload that otherwise fails validation', () => {
  // Reproduces the disagreement between this and the pre-paint script in
  // index.html: a valid dark theme sitting next to a malformed template.
  // The script commits to dark before React mounts because it never looks
  // past settings.theme; without this salvage, loadData() would discard
  // the whole payload and hand React back the light default, reverting the
  // page right after it mounted.
  const partiallyCorrupt = JSON.stringify({
    templates: [{}],
    days: {},
    settings: { theme: 'dark', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, partiallyCorrupt)
  const loaded = loadData()
  // The rest of the payload is still safely discarded.
  expect(loaded.templates).toEqual([])
  expect(loaded.days).toEqual({})
  // But the mode the pre-paint script already committed to survives.
  expect(loaded.settings.theme.mode).toBe('dark')
})

test('loadData does not salvage an invalid theme value out of a corrupt payload', () => {
  const corrupt = JSON.stringify({
    templates: [{}],
    days: {},
    settings: { theme: 'sepia', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, corrupt)
  // Nothing salvageable, so this is the ordinary fresh-install default.
  expect(loadData().settings.theme.mode).toBe('system')
})

test('loadData falls back to the system-mode default when there is nothing salvageable at all', () => {
  localStorage.setItem(STORAGE_KEY, '{not json')
  expect(loadData().settings.theme.mode).toBe('system')

  localStorage.setItem(STORAGE_KEY, '[1,2,3]')
  expect(loadData().settings.theme.mode).toBe('system')
})

test('loadData falls back to defaults on schema mismatch', () => {
  localStorage.setItem(STORAGE_KEY, '{"hello": 1, "world": 2}')
  expect(loadData().templates).toEqual([])
  expect(loadData().days).toEqual({})
  expect(loadData().settings.theme.mode).toBe('system')
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
  expect(loadData()).toEqual(salvagedLightData())
})

test('validate rejects settings missing enabledWidgets or with a bad theme', () => {
  const badTheme = JSON.stringify({ templates: [], days: {}, settings: { theme: 'sepia', enabledWidgets: [] } })
  localStorage.setItem(STORAGE_KEY, badTheme)
  expect(loadData()).toEqual(defaultData())

  const missingWidgets = JSON.stringify({ templates: [], days: {}, settings: { theme: 'light' } })
  localStorage.setItem(STORAGE_KEY, missingWidgets)
  expect(loadData()).toEqual(salvagedLightData())
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
  expect(loadData()).toEqual(salvagedLightData())

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
  expect(loadData()).toEqual(salvagedLightData())
})

test('validate accepts a task and a template block with no minutes, same as before the field existed', () => {
  const noMinutes = JSON.stringify({
    templates: [
      { id: 't1', name: 'Old template', color: '#8ab6f9', blocks: [{ id: 'b1', title: 'Gym' }] },
    ],
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'x1', title: 'From before sizes existed', done: false }],
      },
    },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, noMinutes)
  const loaded = loadData()
  expect(loaded.days['2026-09-01'].tasks[0].minutes).toBeUndefined()
  expect(loaded.templates[0].blocks[0].minutes).toBeUndefined()
})

test('validate accepts a task and a template block with a whole-minute size', () => {
  const sized = JSON.stringify({
    templates: [
      { id: 't1', name: 'Sized', color: '#8ab6f9', blocks: [{ id: 'b1', title: 'Gym', minutes: 90 }] },
    ],
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'x1', title: 'Guitar', done: false, minutes: 20 }],
      },
    },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, sized)
  const loaded = loadData()
  expect(loaded.days['2026-09-01'].tasks[0].minutes).toBe(20)
  expect(loaded.templates[0].blocks[0].minutes).toBe(90)
})

test('validate rejects a task whose minutes is negative or fractional', () => {
  const negative = JSON.stringify({
    templates: [],
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'x1', title: 'Bad', done: false, minutes: -5 }],
      },
    },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, negative)
  expect(loadData()).toEqual(salvagedLightData())

  const fractional = JSON.stringify({
    templates: [],
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'x1', title: 'Bad', done: false, minutes: 12.5 }],
      },
    },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, fractional)
  expect(loadData()).toEqual(salvagedLightData())
})

test('validate rejects a template block whose minutes is not a number', () => {
  const badBlock = JSON.stringify({
    templates: [
      { id: 't1', name: 'Bad', color: '#8ab6f9', blocks: [{ id: 'b1', title: 'Gym', minutes: '90' }] },
    ],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, badBlock)
  expect(loadData()).toEqual(salvagedLightData())
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
  expect(loadData()).toEqual(salvagedLightData())
})

test('validate rejects a day plan with an unknown day type', () => {
  const bad = JSON.stringify({
    templates: [],
    days: { '2026-09-01': { date: '2026-09-01', dayType: 'weekend', tasks: [] } },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, bad)
  expect(loadData()).toEqual(salvagedLightData())
})

test('validate rejects a task or block whose core flag is not a boolean', () => {
  const badTask = JSON.stringify({
    templates: [],
    days: { '2026-09-01': { date: '2026-09-01', tasks: [{ id: 'x1', title: 'Bad', done: false, core: 'yes' }] } },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, badTask)
  expect(loadData()).toEqual(salvagedLightData())

  const badBlock = JSON.stringify({
    templates: [{ id: 't1', name: 'Work', color: '#a7c4f5', blocks: [{ id: 'b1', title: 'Gym', core: 1 }] }],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, badBlock)
  expect(loadData()).toEqual(salvagedLightData())
})

test('a task or block written before unbounded existed loads with unbounded undefined', () => {
  const legacy = JSON.stringify({
    templates: [{ id: 't1', name: 'Work', color: '#a7c4f5', blocks: [{ id: 'b1', title: 'Gym' }] }],
    days: { '2026-09-01': { date: '2026-09-01', tasks: [{ id: 'x1', title: 'Old task', done: false }] } },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  const loaded = loadData()
  expect(loaded.templates[0].blocks[0].unbounded).toBeUndefined()
  expect(loaded.days['2026-09-01'].tasks[0].unbounded).toBeUndefined()
})

test('validate accepts a task or block marked unbounded', () => {
  const good = JSON.stringify({
    templates: [{
      id: 't1', name: 'Ongoing', color: '#c9b3f0',
      blocks: [{ id: 'b1', time: '19:00', title: 'Standing item', unbounded: true }],
    }],
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'x1', title: 'Standing item', time: '19:00', done: false, pushCount: 5, unbounded: true }],
      },
    },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, good)
  const loaded = loadData()
  expect(loaded.templates[0].blocks[0].unbounded).toBe(true)
  expect(loaded.days['2026-09-01'].tasks[0].unbounded).toBe(true)
})

test('validate rejects a task or block whose unbounded flag is not a boolean', () => {
  const badTask = JSON.stringify({
    templates: [],
    days: { '2026-09-01': { date: '2026-09-01', tasks: [{ id: 'x1', title: 'Bad', done: false, unbounded: 'yes' }] } },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, badTask)
  expect(loadData()).toEqual(salvagedLightData())

  const badBlock = JSON.stringify({
    templates: [{ id: 't1', name: 'Work', color: '#a7c4f5', blocks: [{ id: 'b1', title: 'Gym', unbounded: 1 }] }],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, badBlock)
  expect(loadData()).toEqual(salvagedLightData())
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

test('loading a payload from before the if-then board existed leaves enabledWidgets untouched, with no phantom widget added', () => {
  const legacy = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  expect(loadData().settings.enabledWidgets).toEqual(['day-plan'])
})

// The if-then board briefly lived in the widget registry, under the id
// 'if-then' - see docs/TIMELINE.md section 6 for why it moved to a single
// surfaced rule inline on the day view instead. Every real install from
// that window has 'if-then' sitting in its enabledWidgets, since there was
// never a settings toggle to remove it by hand; loading must not leave
// that dead id in place forever.
test('a leftover if-then widget id from before the relocation is stripped out on load, migrated or not', () => {
  const unmigrated = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan', 'if-then'] },
  })
  localStorage.setItem(STORAGE_KEY, unmigrated)
  expect(loadData().settings.enabledWidgets).toEqual(['day-plan'])

  const alreadyMigrated = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan', 'if-then'] },
    ifThens: [],
  })
  localStorage.setItem(STORAGE_KEY, alreadyMigrated)
  expect(loadData().settings.enabledWidgets).toEqual(['day-plan'])
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

test('an if-then entry from before dayTypes and when existed loads exactly as it always did', () => {
  const legacy = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
    ifThens: [{ id: 'i1', trigger: 'Old trigger', action: 'Old action' }],
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  const loaded = loadData()
  expect(loaded.ifThens).toHaveLength(1)
  expect(loaded.ifThens[0].dayTypes).toBeUndefined()
  expect(loaded.ifThens[0].when).toBeUndefined()
  expect(loaded.ifThens[0].lastSurfaced).toBeUndefined()
})

test('validate accepts a well-formed dayTypes array, when band, and lastSurfaced date on an if-then entry', () => {
  const good = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
    ifThens: [
      { id: 'i1', trigger: 'Shift starts', action: 'Lay out the mask', dayTypes: ['shift', 'night'], when: 'evening', lastSurfaced: '2026-08-30' },
    ],
  })
  localStorage.setItem(STORAGE_KEY, good)
  const loaded = loadData()
  expect(loaded.ifThens[0]).toMatchObject({
    dayTypes: ['shift', 'night'],
    when: 'evening',
    lastSurfaced: '2026-08-30',
  })
})

test('validate rejects an if-then entry with an unknown day type or when value', () => {
  const badDayType = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
    ifThens: [{ id: 'i1', trigger: 'Trigger', action: 'Action', dayTypes: ['weekend'] }],
  })
  localStorage.setItem(STORAGE_KEY, badDayType)
  expect(loadData().ifThens).toEqual([])

  const badWhen = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
    ifThens: [{ id: 'i1', trigger: 'Trigger', action: 'Action', when: 'noon' }],
  })
  localStorage.setItem(STORAGE_KEY, badWhen)
  expect(loadData().ifThens).toEqual([])
})

test('importJson backfills ifThens for a legacy backup file without adding a widget id for it', () => {
  const legacy = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'dark', enabledWidgets: ['day-plan'] },
  })
  const imported = importJson(legacy)
  expect(imported.ifThens).toEqual([])
  expect(imported.settings.enabledWidgets).toEqual(['day-plan'])
})

// --- color and CSS-value validation -------------------------------------
//
// Security finding: none of these validators used to check the string
// looked anything like a color, so a crafted backup could set
// Template.color, IfThenEntry.color, or a ThemeOverrides value to a CSS
// url() and plant a real network beacon the moment the app rendered it -
// verified live against a running page. Rejecting a bad value here fails
// the whole payload's validate(), the same treatment an out-of-range
// Task.minutes or an unknown DayType already gets - see the tests above for
// both. Because loadData()/importJson only ever replace state after
// validate() succeeds, a backup that fails this check changes nothing.

test('validate rejects a template whose color is a CSS url() value rather than a real hex color', () => {
  const beacon = JSON.stringify({
    templates: [{ id: 't1', name: 'Work', color: 'url("https://attacker.example/beacon.png")', blocks: [] }],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, beacon)
  expect(loadData().templates).toEqual([])
})

test('validate rejects an if-then entry whose color is a CSS url() value', () => {
  const beacon = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
    ifThens: [{ id: 'i1', trigger: 'Trigger', action: 'Action', color: 'url(https://attacker.example/x)' }],
  })
  localStorage.setItem(STORAGE_KEY, beacon)
  expect(loadData().ifThens).toEqual([])
})

test('validate accepts every hex color length CSS itself recognizes, on a template and an if-then tag', () => {
  for (const hex of ['#abc', '#abcd', '#a7c4f5', '#a7c4f5ff']) {
    const good = JSON.stringify({
      templates: [{ id: 't1', name: 'Work', color: hex, blocks: [] }],
      days: {},
      settings: { theme: 'light', enabledWidgets: [] },
      ifThens: [{ id: 'i1', trigger: 'Trigger', action: 'Action', color: hex }],
    })
    localStorage.setItem(STORAGE_KEY, good)
    const loaded = loadData()
    expect(loaded.templates[0]?.color).toBe(hex)
    expect(loaded.ifThens[0]?.color).toBe(hex)
  }
})

test('validate rejects template and if-then colors that are not hex at all - a name, a semicolon breakout attempt, an empty string', () => {
  for (const bad of ['red', 'rgb(1,2,3)', 'blue; outline: 999px solid red', '', '#gggggg', '#1234567']) {
    const badTemplate = JSON.stringify({
      templates: [{ id: 't1', name: 'Work', color: bad, blocks: [] }],
      days: {},
      settings: { theme: 'light', enabledWidgets: [] },
    })
    localStorage.setItem(STORAGE_KEY, badTemplate)
    expect(loadData().templates).toEqual([])
  }
})

test('validate rejects a theme override color token set to a url() value', () => {
  const beacon = JSON.stringify({
    templates: [], days: {},
    settings: {
      theme: { presetId: 'dark', overrides: { dark: { accent: 'url(https://attacker.example/x)' } }, mode: 'light' },
      enabledWidgets: [],
    },
  })
  localStorage.setItem(STORAGE_KEY, beacon)
  // The whole settings object fails, same as the existing bad-override test - falls back to system mode.
  expect(loadData().settings.theme.mode).toBe('system')
})

test('validate rejects a theme override on bg, one of the tokens confirmed live to reach a background layer', () => {
  const beacon = JSON.stringify({
    templates: [], days: {},
    settings: {
      theme: { presetId: 'dark', overrides: { dark: { bg: 'url("https://attacker.example/beacon.png?id=1")' } }, mode: 'dark' },
      enabledWidgets: [],
    },
  })
  localStorage.setItem(STORAGE_KEY, beacon)
  expect(loadData().settings.theme.mode).toBe('system')
})

test('validate accepts every legitimate non-color override token the app itself can write', () => {
  const good = JSON.stringify({
    templates: [], days: {},
    settings: {
      theme: {
        presetId: 'dark',
        overrides: {
          dark: {
            ruleSize: '24px',
            edge: '225px 14px 255px 15px / 15px 255px 14px 225px',
            fontBody: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            grain: '0.03',
            vignette: '7%',
            shadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 0 0 1px #c7d6da',
          },
        },
        mode: 'light',
      },
      enabledWidgets: [],
    },
  })
  localStorage.setItem(STORAGE_KEY, good)
  const loaded = loadData()
  expect(loaded.settings.theme.overrides.dark).toEqual({
    ruleSize: '24px',
    edge: '225px 14px 255px 15px / 15px 255px 14px 225px',
    fontBody: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    grain: '0.03',
    vignette: '7%',
    shadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 0 0 1px #c7d6da',
  })
})

test('validate rejects a url() value on every non-color override token category, not only the named color ones', () => {
  const beaconValue = 'url(https://attacker.example/x)'
  for (const token of ['ruleSize', 'edge', 'fontBody', 'grain', 'vignette', 'shadow']) {
    const beacon = JSON.stringify({
      templates: [], days: {},
      settings: {
        theme: { presetId: 'dark', overrides: { dark: { [token]: beaconValue } }, mode: 'light' },
        enabledWidgets: [],
      },
    })
    localStorage.setItem(STORAGE_KEY, beacon)
    expect(loadData().settings.theme.mode).toBe('system')
  }
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

// The migration a real person's existing data goes through: their old
// Settings.theme was a plain 'light' | 'dark' string, and it must survive
// as an explicit mode rather than being silently reset to 'system' - only
// a genuinely fresh install gets that default. See docs/THEMES.md section 4.
test('a legacy light/dark theme string migrates into a ThemeState with that mode, on Slate, with no overrides', () => {
  const legacy = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'dark', enabledWidgets: ['day-plan'] },
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  expect(loadData().settings.theme).toEqual({ presetId: 'dark', overrides: {}, mode: 'dark' })
})

test('a payload already in the new ThemeState shape passes validate and round-trips unchanged', () => {
  const modern = JSON.stringify({
    templates: [],
    days: {},
    settings: {
      theme: { presetId: 'midnight', overrides: { midnight: { accent: '#e0553b' } }, mode: 'system' },
      enabledWidgets: ['day-plan'],
    },
    ifThens: [],
  })
  localStorage.setItem(STORAGE_KEY, modern)
  expect(loadData().settings.theme).toEqual({
    presetId: 'midnight',
    overrides: { midnight: { accent: '#e0553b' } },
    mode: 'system',
  })
})

test('validate rejects a ThemeState with an unknown mode or a non-string override value', () => {
  const badMode = JSON.stringify({
    templates: [], days: {},
    settings: { theme: { presetId: 'dark', overrides: {}, mode: 'sepia' }, enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, badMode)
  expect(loadData().settings.theme.mode).toBe('system')

  const badOverride = JSON.stringify({
    templates: [], days: {},
    settings: { theme: { presetId: 'dark', overrides: { dark: { accent: 123 } }, mode: 'light' }, enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, badOverride)
  expect(loadData().settings.theme.mode).toBe('system')
})

// timelineExpanded, docs/TIMELINE.md section 5 - a single app-wide choice
// of whether the day view's timeline grid is shown, collapsed by default.

test('a brand new install starts with the timeline grid collapsed', () => {
  expect(loadData().settings.timelineExpanded).toBe(false)
})

test('a payload written before the timeline collapse existed has no timelineExpanded key and still loads, defaulting to collapsed', () => {
  const legacy = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  expect(loadData().settings.timelineExpanded).toBe(false)
})

test('a payload with the grid already expanded keeps that choice on load', () => {
  const expanded = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'], timelineExpanded: true },
  })
  localStorage.setItem(STORAGE_KEY, expanded)
  expect(loadData().settings.timelineExpanded).toBe(true)
})

test('validate rejects a non-boolean timelineExpanded', () => {
  const bad = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [], timelineExpanded: 'yes' },
  })
  localStorage.setItem(STORAGE_KEY, bad)
  expect(loadData()).toEqual(salvagedLightData())
})

test('importJson preserves an expanded timeline choice across export and re-import', () => {
  const data = defaultData()
  data.settings.timelineExpanded = true
  const imported = importJson(exportJson(data))
  expect(imported.settings.timelineExpanded).toBe(true)
})

// dayLayoutFocus, docs/LAYOUT-WIDE.md section 5 - a single app-wide choice
// of which pane the wide day view gives the width to, defaulting to
// 'both' (the state that shows the most by default, matching the pattern
// timelineExpanded already established).

test("a brand new install starts with dayLayoutFocus 'both'", () => {
  expect(loadData().settings.dayLayoutFocus).toBe('both')
})

test('a payload written before dayLayoutFocus existed has no such key and still loads, defaulting to both', () => {
  const legacy = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'], timelineExpanded: true },
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  expect(loadData().settings.dayLayoutFocus).toBe('both')
})

test('a payload with dayLayoutFocus already set to calendar or tasks keeps that choice on load', () => {
  for (const focus of ['calendar', 'tasks'] as const) {
    const payload = JSON.stringify({
      templates: [],
      days: {},
      settings: { theme: 'light', enabledWidgets: ['day-plan'], timelineExpanded: false, dayLayoutFocus: focus },
    })
    localStorage.setItem(STORAGE_KEY, payload)
    expect(loadData().settings.dayLayoutFocus).toBe(focus)
  }
})

test('validate rejects a dayLayoutFocus value that is not one of the three literal strings', () => {
  const bad = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [], timelineExpanded: false, dayLayoutFocus: 'day' },
  })
  localStorage.setItem(STORAGE_KEY, bad)
  expect(loadData()).toEqual(salvagedLightData())
})

test('importJson preserves a calendar/tasks focus choice across export and re-import', () => {
  for (const focus of ['calendar', 'tasks'] as const) {
    const data = defaultData()
    data.settings.dayLayoutFocus = focus
    const imported = importJson(exportJson(data))
    expect(imported.settings.dayLayoutFocus).toBe(focus)
  }
})

// --- stress test: garbage import ----------------------------------------
//
// Every case below either gets rejected (existing data on disk survives
// untouched, matching every other invalid-payload test above) or is
// accepted and loads without throwing, hanging, or producing a value that
// poisons downstream arithmetic. See docs/stress test report for the full
// pass/fail breakdown; these are the regression tests for cases that were
// not already covered by the tests above.

test('importJson rejects an empty file rather than throwing something other than the standard message', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultData(), templates: [{ id: 'keep', name: 'Keep me', color: '#a7c4f5', blocks: [] }] }))
  expect(() => importJson('')).toThrow('Invalid Dienius backup file')
})

test('importJson rejects a bare JSON array, object, primitive or null at the root', () => {
  for (const bad of ['[1,2,3]', '[]', 'null', '42', '"just a string"', 'true']) {
    expect(() => importJson(bad)).toThrow('Invalid Dienius backup file')
  }
})

test('validate accepts a task with an absurdly long title, and it loads unmodified', () => {
  const longTitle = 'x'.repeat(500)
  const payload = JSON.stringify({
    templates: [],
    days: { '2026-09-01': { date: '2026-09-01', tasks: [{ id: 'x1', title: longTitle, done: false }] } },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, payload)
  const loaded = loadData()
  expect(loaded.days['2026-09-01'].tasks[0].title).toHaveLength(500)
})

test('validate accepts a task with an extreme minutes value rather than silently truncating it', () => {
  // isOptionalMinutes only requires a non-negative integer - there is no
  // upper bound, the same as the live size field a person types into by
  // hand (parseMinutesInput has no ceiling either). Downstream arithmetic
  // (capacity.ts, timelineLayout.ts) is separately responsible for staying
  // bounded regardless of how large this gets - see their own tests.
  const payload = JSON.stringify({
    templates: [],
    days: { '2026-09-01': { date: '2026-09-01', tasks: [{ id: 'x1', title: 'Huge estimate', done: false, minutes: 10_000_000 }] } },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, payload)
  expect(loadData().days['2026-09-01'].tasks[0].minutes).toBe(10_000_000)
})

test('a day stored under a key that is not a real date loads without throwing, and is simply never looked up', () => {
  // days is a Record<string, DayPlan> - nothing validates that the key
  // itself looks like a date, only that each value is a well-formed
  // DayPlan. A garbage key is not corruption the app needs to guard
  // against: every reader (DayView, CalendarView, yearGrid) only ever
  // looks a day up by a key it computed itself from a real Date, so an
  // entry filed under a nonsense key is inert - present in the data,
  // never reachable through the UI - not a crash waiting to happen.
  const payload = JSON.stringify({
    templates: [],
    days: { 'not-a-real-date': { date: 'also not a date', tasks: [{ id: 'x1', title: 'Orphaned', done: false }] } },
    settings: { theme: 'light', enabledWidgets: [] },
  })
  localStorage.setItem(STORAGE_KEY, payload)
  expect(() => loadData()).not.toThrow()
  const loaded = loadData()
  expect(loaded.days['not-a-real-date'].tasks[0].title).toBe('Orphaned')
})

test('a roughly 20MB backup file imports well within a second', () => {
  // Built to land close to 20MB as an actual exported *file* would be -
  // exportJson pretty-prints with a 2-space indent, which inflates a
  // compact JSON.stringify by roughly 1.6-1.7x, so the compact-size target
  // below is scaled down accordingly. Sized incrementally rather than by
  // repeatedly re-stringifying the whole growing object, which would make
  // this test itself quadratic and say nothing true about the app.
  const templates = [{ id: 't1', name: 'Work', color: '#8ab6f9', blocks: [{ id: 'b1', time: '09:00', title: 'Gym', minutes: 60 }] }]
  const days: Record<string, unknown> = {}
  let approxSize = 0
  let i = 0
  while (approxSize < 12 * 1024 * 1024) {
    const key = `2020-01-${String((i % 28) + 1).padStart(2, '0')}-${i}`
    const day = {
      date: key,
      tasks: Array.from({ length: 20 }, (_, j) => ({ id: `${key}-${j}`, title: `Task ${j} on synthetic day ${i}`, done: false })),
    }
    days[key] = day
    approxSize += JSON.stringify(day).length + key.length + 4
    i++
  }
  const json = exportJson({ ...defaultData(), templates, days } as unknown as ReturnType<typeof defaultData>)
  expect(json.length).toBeGreaterThan(15 * 1024 * 1024)

  const t0 = performance.now()
  const imported = importJson(json)
  const elapsed = performance.now() - t0
  expect(Object.keys(imported.days)).toHaveLength(i)
  // Generous ceiling to absorb CI variance - the measured cost on a normal
  // dev machine for a file this size is under 200ms; this bound exists to
  // catch a real regression (an accidental O(n^2) walk), not to pin down
  // an exact number.
  expect(elapsed).toBeLessThan(3000)
})

test('export of roughly two years of stamped days across several templates stays a reasonable size and exports well under a second', () => {
  const templates: Template[] = [
    { id: 't1', name: 'Work', color: '#8ab6f9', blocks: [{ id: 'b1', time: '09:00', title: 'Shift', minutes: 480 }] },
    { id: 't2', name: 'Rest', color: '#cde39e', blocks: [{ id: 'b2', title: 'Nothing required' }] },
    { id: 't3', name: 'Night', color: '#c9b3f0', blocks: [{ id: 'b3', time: '22:00', title: 'On shift', minutes: 480 }] },
  ]
  const days: Record<string, unknown> = {}
  let d = new Date(2024, 0, 1)
  for (let i = 0; i < 700; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const template = templates[i % 3]
    days[key] = {
      date: key,
      templateId: template.id,
      tasks: template.blocks.map((b, j) => ({
        id: `${key}-${j}`, time: b.time, title: b.title, done: i % 5 === 0, fromTemplate: true, minutes: b.minutes,
      })),
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  }
  const data = { ...defaultData(), templates, days } as unknown as ReturnType<typeof defaultData>

  const t0 = performance.now()
  const json = exportJson(data)
  const elapsed = performance.now() - t0

  expect(elapsed).toBeLessThan(1000)
  // A real backup this size lands well under a megabyte - worth pinning so
  // a future change that bloats the export shape (a duplicated field, an
  // accidental circular expansion) shows up as a failing number here rather
  // than being noticed only once someone's real export gets large.
  expect(json.length).toBeLessThan(2 * 1024 * 1024)

  // And it survives the round trip.
  const reimported = importJson(json)
  expect(Object.keys(reimported.days)).toHaveLength(700)
})

test('a large payload that is invalid only in its very last entry is rejected quickly, not after a slow full walk', () => {
  const templates = [{ id: 't1', name: 'Work', color: '#8ab6f9', blocks: [] }]
  const days: Record<string, unknown> = {}
  for (let i = 0; i < 5000; i++) {
    const key = `2020-01-${String((i % 28) + 1).padStart(2, '0')}-${i}`
    days[key] = { date: key, tasks: [{ id: `${key}-t`, title: 'Task', done: false }] }
  }
  // The one bad entry, keyed to sort last among the generated keys above.
  days['zzz-last'] = { date: 'zzz-last', tasks: [{ id: 'bad', title: 'Bad', done: 'not a boolean' }] }

  const payload = JSON.stringify({ templates, days, settings: { theme: 'light', enabledWidgets: [] } })
  const t0 = performance.now()
  expect(() => importJson(payload)).toThrow('Invalid Dienius backup file')
  const elapsed = performance.now() - t0
  expect(elapsed).toBeLessThan(1000)
})

test('a bad import never destroys existing data - repeated garbage imports leave the store untouched (verified in store.test.ts for the full store round trip)', () => {
  // storage.ts's own contract: loadData()/importJson() only ever replace
  // state after validate() succeeds, so this file's own responsibility is
  // just confirming validate() actually rejects each garbage shape - the
  // "existing data survives" half of the promise is exercised end to end
  // against the live store in store.test.ts, since surviving data is a
  // property of the store, not of this pure parsing layer.
  const garbage = ['not json', '', '[1,2,3]', '{"templates":[{}],"days":{},"settings":{}}', '{"hello":1}']
  for (const bad of garbage) {
    expect(() => importJson(bad)).toThrow('Invalid Dienius backup file')
  }
})

// sleepWindow and nightSleepWindow - a single set-once setting per window,
// defaulting to the exact inverse of the fixed 07:00-23:00 / 13:00-24:00
// windows this app used before either setting existed, so an install that
// never opens Settings sees no change - see docs/DECISIONS.md.

test('a brand new install starts with the historical sleep window as an explicit default', () => {
  expect(loadData().settings.sleepWindow).toEqual({ start: '23:00', end: '07:00' })
  expect(loadData().settings.nightSleepWindow).toEqual({ start: '00:00', end: '13:00' })
})

test('a payload written before either sleep setting existed has no such key and still loads, defaulting exactly as a fresh install would', () => {
  const legacy = JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'], timelineExpanded: false, dayLayoutFocus: 'both' },
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  expect(loadData().settings.sleepWindow).toEqual({ start: '23:00', end: '07:00' })
  expect(loadData().settings.nightSleepWindow).toEqual({ start: '00:00', end: '13:00' })
})

test('a payload with a custom sleep window already set keeps that choice on load', () => {
  const payload = JSON.stringify({
    templates: [],
    days: {},
    settings: {
      theme: 'light',
      enabledWidgets: ['day-plan'],
      timelineExpanded: false,
      dayLayoutFocus: 'both',
      sleepWindow: { start: '22:00', end: '06:30' },
      nightSleepWindow: { start: '09:00', end: '17:00' },
    },
  })
  localStorage.setItem(STORAGE_KEY, payload)
  expect(loadData().settings.sleepWindow).toEqual({ start: '22:00', end: '06:30' })
  expect(loadData().settings.nightSleepWindow).toEqual({ start: '09:00', end: '17:00' })
})

test('validate rejects a sleepWindow that is not a real "HH:MM" time', () => {
  for (const bad of [
    { start: '25:00', end: '07:00' },
    { start: '23:00', end: '7:00' },
    { start: '23:00', end: '07:60' },
    { start: 2300, end: '07:00' },
    { start: '23:00' },
    { end: '07:00' },
    'not an object',
  ]) {
    const payload = JSON.stringify({
      templates: [],
      days: {},
      settings: { theme: 'light', enabledWidgets: [], timelineExpanded: false, dayLayoutFocus: 'both', sleepWindow: bad },
    })
    localStorage.setItem(STORAGE_KEY, payload)
    expect(loadData()).toEqual(salvagedLightData())
  }
})

test('validate rejects a malformed nightSleepWindow the same way', () => {
  const bad = JSON.stringify({
    templates: [],
    days: {},
    settings: {
      theme: 'light',
      enabledWidgets: [],
      timelineExpanded: false,
      dayLayoutFocus: 'both',
      nightSleepWindow: { start: '13:00', end: 'noon' },
    },
  })
  localStorage.setItem(STORAGE_KEY, bad)
  expect(loadData()).toEqual(salvagedLightData())
})

test('a malformed sleepWindow does not destroy the rest of an otherwise valid backup - the whole file is rejected, nothing partially applied', () => {
  const data = defaultData()
  const template = { id: 't1', name: 'Existing', color: '#a7c4f5', blocks: [] }
  const payload = {
    ...data,
    templates: [template],
    settings: { ...data.settings, sleepWindow: { start: '23:00', end: 'garbage' } },
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  const loaded = loadData()
  expect(loaded.templates).toEqual([])
})

test('importJson preserves a custom sleep window across export and re-import', () => {
  const data = defaultData()
  data.settings.sleepWindow = { start: '22:30', end: '06:15' }
  data.settings.nightSleepWindow = { start: '08:00', end: '16:00' }
  const imported = importJson(exportJson(data))
  expect(imported.settings.sleepWindow).toEqual({ start: '22:30', end: '06:15' })
  expect(imported.settings.nightSleepWindow).toEqual({ start: '08:00', end: '16:00' })
})
