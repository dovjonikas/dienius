import { beforeEach, expect, test } from 'vitest'
import { actions, getData, subscribe } from './store'
import { defaultData, loadData, STORAGE_KEY } from './storage'
import { dayScore } from '../widgets/day-plan/score'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('addTask adds a task to the given day', () => {
  actions.addTask('2026-09-01', 'Call mom', '14:00')
  const day = getData().days['2026-09-01']
  expect(day.tasks).toHaveLength(1)
  expect(day.tasks[0]).toMatchObject({ title: 'Call mom', time: '14:00', done: false })
})

test('toggleTask flips done', () => {
  actions.addTask('2026-09-01', 'Gym')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.toggleTask('2026-09-01', id)
  expect(getData().days['2026-09-01'].tasks[0].done).toBe(true)
  actions.toggleTask('2026-09-01', id)
  expect(getData().days['2026-09-01'].tasks[0].done).toBe(false)
})

test('deleteTask removes only the matching task, leaving the rest of the day untouched', () => {
  actions.addTask('2026-09-01', 'Keep')
  actions.addTask('2026-09-01', 'Remove me')
  const toRemove = getData().days['2026-09-01'].tasks[1].id
  actions.deleteTask('2026-09-01', toRemove)
  const remaining = getData().days['2026-09-01'].tasks
  expect(remaining.map(t => t.title)).toEqual(['Keep'])
})

test('deleteTask on a day with no plan does not throw, and leaves no task behind', () => {
  expect(() => actions.deleteTask('2026-09-01', 'nothing-here')).not.toThrow()
  expect(getData().days['2026-09-01']?.tasks ?? []).toEqual([])
})

test('rolloverUnfinished moves unfinished tasks to the next day', () => {
  actions.addTask('2026-09-01', 'Done thing')
  actions.addTask('2026-09-01', 'Not done')
  const doneId = getData().days['2026-09-01'].tasks[0].id
  actions.toggleTask('2026-09-01', doneId)
  const result = actions.rolloverUnfinished('2026-09-01')
  expect(result).toEqual({ moved: 1, held: 0 })
  expect(getData().days['2026-09-01'].tasks.map(t => t.title)).toEqual(['Done thing'])
  expect(getData().days['2026-09-02'].tasks.map(t => t.title)).toEqual(['Not done'])
})

test('rolloverUnfinished clears fromTemplate so the next stamp does not wipe it', () => {
  const t = actions.addTemplate({
    name: 'Work day',
    color: '#8ab6f9',
    blocks: [{ time: '09:00', title: 'Gym' }],
  })
  actions.stamp({ '2026-09-01': t.id })
  actions.rolloverUnfinished('2026-09-01')
  const moved = getData().days['2026-09-02'].tasks[0]
  expect(moved.title).toBe('Gym')
  expect(moved.fromTemplate).toBe(false)

  // Re-stamping the day it landed on must not wipe it, since it is no
  // longer tied to a template.
  actions.stamp({ '2026-09-02': t.id })
  const titles = getData().days['2026-09-02'].tasks.map(task => task.title)
  expect(titles).toContain('Gym')
  expect(titles.filter(title => title === 'Gym')).toHaveLength(2)
})

test('rolloverUnfinished clears core, so a required task from a shift day does not become required on whatever day it lands on next', () => {
  const shift = actions.addTemplate({
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [{ time: '19:00', title: 'File incident report', core: true }],
  })
  const rest = actions.addTemplate({
    name: 'Rest day',
    color: '#cde39e',
    type: 'rest',
    blocks: [],
  })
  actions.stamp({ '2026-09-01': shift.id, '2026-09-02': rest.id })
  actions.rolloverUnfinished('2026-09-01')

  const landed = getData().days['2026-09-02'].tasks.find(t => t.title === 'File incident report')
  expect(landed?.core).toBeFalsy()

  // The rest day it landed on still reports no plan: nothing on it is
  // core, so the pushed task does not silently turn a rest day into one
  // with a required task on it.
  const score = dayScore(getData().days['2026-09-02'].tasks, getData().days['2026-09-02'].dayType)
  expect(score).toEqual({ planned: false })
})

test('pushCount survives a re-stamp of the day a pushed task landed on', () => {
  const t = actions.addTemplate({
    name: 'Work day',
    color: '#8ab6f9',
    blocks: [{ time: '09:00', title: 'Gym' }],
  })
  actions.stamp({ '2026-09-01': t.id })
  actions.rolloverUnfinished('2026-09-01')
  const pushed = getData().days['2026-09-02'].tasks.find(task => task.title === 'Gym')
  expect(pushed?.pushCount).toBe(1)

  // Re-stamping the day it landed on treats it as a manual task (fromTemplate
  // is false after a push) and must leave it, and its pushCount, untouched.
  actions.stamp({ '2026-09-02': t.id })
  const afterRestamp = getData().days['2026-09-02'].tasks.filter(task => task.title === 'Gym')
  expect(afterRestamp).toHaveLength(2)
  expect(afterRestamp.find(task => task.fromTemplate === false)?.pushCount).toBe(1)
})

test('rolloverUnfinished increments pushCount on tasks it moves', () => {
  actions.addTask('2026-09-01', 'Not done')
  actions.rolloverUnfinished('2026-09-01')
  const task = getData().days['2026-09-02'].tasks[0]
  expect(task.pushCount).toBe(1)

  actions.rolloverUnfinished('2026-09-02')
  const twicePushed = getData().days['2026-09-03'].tasks[0]
  expect(twicePushed.pushCount).toBe(2)
})

test('rolloverUnfinished holds back a task that has already been pushed twice', () => {
  actions.addTask('2026-09-01', 'Chronically postponed')
  actions.rolloverUnfinished('2026-09-01')
  actions.rolloverUnfinished('2026-09-02')
  // Now at pushCount 2, sitting in 2026-09-03. A third rollover must not move it.
  const result = actions.rolloverUnfinished('2026-09-03')
  expect(result).toEqual({ moved: 0, held: 1 })
  expect(getData().days['2026-09-03'].tasks.map(t => t.title)).toEqual(['Chronically postponed'])
  expect(getData().days['2026-09-04']).toBeUndefined()
})

test('rolloverUnfinished moves tasks below the bound and holds back tasks at the bound in the same call', () => {
  // Push "Maxed task" on its own for two days until it sits at the bound.
  actions.addTask('2026-09-01', 'Maxed task')
  actions.rolloverUnfinished('2026-09-01')
  actions.rolloverUnfinished('2026-09-02')
  expect(getData().days['2026-09-03'].tasks[0].pushCount).toBe(2)

  // A fresh task joins it on the same day.
  actions.addTask('2026-09-03', 'Fresh task')
  const result = actions.rolloverUnfinished('2026-09-03')
  expect(result).toEqual({ moved: 1, held: 1 })
  expect(getData().days['2026-09-03'].tasks.map(t => t.title)).toEqual(['Maxed task'])
  expect(getData().days['2026-09-04'].tasks.map(t => t.title)).toEqual(['Fresh task'])
})

test('a task written to storage before pushCount existed loads and pushes correctly', () => {
  const legacy = {
    templates: [],
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'legacy-1', title: 'From before the field existed', done: false }],
      },
    },
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

  actions.resetForTests(loadData())
  const loadedTask = getData().days['2026-09-01'].tasks[0]
  expect(loadedTask.pushCount).toBeUndefined()

  const result = actions.rolloverUnfinished('2026-09-01')
  expect(result).toEqual({ moved: 1, held: 0 })
  const moved = getData().days['2026-09-02'].tasks[0]
  expect(moved.title).toBe('From before the field existed')
  expect(moved.pushCount).toBe(1)
})

test('addTemplate assigns ids and stamp applies it', () => {
  const t = actions.addTemplate({
    name: 'Work day',
    color: '#8ab6f9',
    blocks: [{ time: '09:00', title: 'Gym' }],
  })
  actions.stamp({ '2026-09-01': t.id })
  expect(getData().days['2026-09-01'].templateId).toBe(t.id)
  expect(getData().days['2026-09-01'].tasks[0].title).toBe('Gym')
})

test('addTemplate carries the day type and stamping carries it and core through to the day', () => {
  const t = actions.addTemplate({
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [
      { time: '19:00', title: 'Clock in', core: true },
      { time: '21:00', title: 'Break', core: false },
    ],
  })
  expect(t.type).toBe('shift')
  actions.stamp({ '2026-09-01': t.id })
  const day = getData().days['2026-09-01']
  expect(day.dayType).toBe('shift')
  expect(day.tasks.find(task => task.title === 'Clock in')?.core).toBe(true)
  expect(day.tasks.find(task => task.title === 'Break')?.core).toBeFalsy()
})

test('deleting a template after stamping it does not change the day type already baked onto the day', () => {
  const t = actions.addTemplate({
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [{ time: '19:00', title: 'Clock in', core: true }],
  })
  actions.stamp({ '2026-09-01': t.id })
  actions.deleteTemplate(t.id)
  expect(getData().days['2026-09-01'].dayType).toBe('shift')
})

test('updateTemplate replaces the template with the same id in place, leaving other templates untouched', () => {
  const a = actions.addTemplate({ name: 'A', color: '#f9d48a', blocks: [] })
  const b = actions.addTemplate({ name: 'B', color: '#a7c4f5', blocks: [] })
  actions.updateTemplate({ ...a, name: 'A renamed', color: '#c9b3f0' })
  const templates = getData().templates
  expect(templates).toHaveLength(2)
  expect(templates.find(t => t.id === a.id)).toMatchObject({ name: 'A renamed', color: '#c9b3f0' })
  expect(templates.find(t => t.id === b.id)).toMatchObject({ name: 'B', color: '#a7c4f5' })
})

test('updateTemplate with an id that matches nothing leaves every template as it was', () => {
  const a = actions.addTemplate({ name: 'A', color: '#f9d48a', blocks: [] })
  actions.updateTemplate({ id: 'no-such-id', name: 'Ghost', color: '#c9b3f0', blocks: [] })
  const templates = getData().templates
  expect(templates).toHaveLength(1)
  expect(templates[0]).toMatchObject({ id: a.id, name: 'A' })
})

test('deleteTemplate removes the template but keeps stamped days, templateId included', () => {
  // A stamped day genuinely happened - deleting the template it was stamped
  // from does not undo that. templateId is left dangling on purpose rather
  // than cleared: every place that reads it (DayView, CalendarView,
  // yearGrid) already resolves a missing template to "no template" instead
  // of throwing, so clearing the reference would only erase real history to
  // satisfy call sites that already handle its absence correctly.
  const t = actions.addTemplate({ name: 'X', color: '#f9d48a', blocks: [] })
  actions.stamp({ '2026-09-01': t.id })
  actions.deleteTemplate(t.id)
  expect(getData().templates).toHaveLength(0)
  expect(getData().days['2026-09-01']).toBeDefined()
  expect(getData().days['2026-09-01'].templateId).toBe(t.id)
})

test('state persists to localStorage', () => {
  actions.addTask('2026-09-01', 'Persist me')
  const raw = localStorage.getItem('dienius:data')!
  expect(raw).toContain('Persist me')
})

test('addIfThen adds an entry with an optional color tag', () => {
  const entry = actions.addIfThen({
    trigger: 'I get home and the kitchen is a mess',
    action: 'I set a timer for ten minutes and do only the sink',
    color: '#a7c4f5',
  })
  expect(getData().ifThens).toHaveLength(1)
  expect(getData().ifThens[0]).toMatchObject({
    trigger: 'I get home and the kitchen is a mess',
    action: 'I set a timer for ten minutes and do only the sink',
    color: '#a7c4f5',
  })
  expect(entry.id).toBeTruthy()
})

test('addIfThen without a color leaves it undefined', () => {
  actions.addIfThen({ trigger: 'It is 22:30', action: 'Phone goes on the charger' })
  expect(getData().ifThens[0].color).toBeUndefined()
})

test('updateIfThen replaces the entry with the same id in place', () => {
  const entry = actions.addIfThen({ trigger: 'Old trigger', action: 'Old action' })
  actions.updateIfThen({ ...entry, trigger: 'New trigger', action: 'New action', color: '#f5b0a7' })
  expect(getData().ifThens).toHaveLength(1)
  expect(getData().ifThens[0]).toMatchObject({ trigger: 'New trigger', action: 'New action', color: '#f5b0a7' })
})

test('deleteIfThen removes only the matching entry', () => {
  const a = actions.addIfThen({ trigger: 'Trigger A', action: 'Action A' })
  actions.addIfThen({ trigger: 'Trigger B', action: 'Action B' })
  actions.deleteIfThen(a.id)
  expect(getData().ifThens).toHaveLength(1)
  expect(getData().ifThens[0].trigger).toBe('Trigger B')
})

test('setTheme updates the theme and leaves the rest of settings untouched', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: { theme: 'light', enabledWidgets: ['day-plan', 'if-then', 'a-future-widget'] },
  })
  actions.setTheme('dark')
  expect(getData().settings.theme).toBe('dark')
  expect(getData().settings.enabledWidgets).toEqual(['day-plan', 'if-then', 'a-future-widget'])
  actions.setTheme('light')
  expect(getData().settings.theme).toBe('light')
})

test('importData replaces the whole store with the imported payload', () => {
  actions.addTask('2026-09-01', 'Will be replaced')
  const backup = defaultData()
  backup.templates.push({ id: 't1', name: 'Imported', color: '#a7c4f5', blocks: [] })
  actions.importData(JSON.stringify(backup))
  expect(getData().templates).toHaveLength(1)
  expect(getData().templates[0].name).toBe('Imported')
  // The prior day's task is gone - import replaces the store, it does not merge.
  expect(getData().days).toEqual({})
})

test('importData throws on an invalid payload and leaves the current store completely untouched', () => {
  actions.addTask('2026-09-01', 'Must survive a bad import')
  expect(() => actions.importData('not json')).toThrow('Invalid Dienius backup file')
  expect(getData().days['2026-09-01'].tasks[0].title).toBe('Must survive a bad import')
})

test('subscribe is notified on every commit, and the returned function unsubscribes it', () => {
  let calls = 0
  const unsubscribe = subscribe(() => {
    calls++
  })
  actions.addTask('2026-09-01', 'First')
  expect(calls).toBe(1)
  actions.addTask('2026-09-01', 'Second')
  expect(calls).toBe(2)

  unsubscribe()
  actions.addTask('2026-09-01', 'Third')
  expect(calls).toBe(2)
})

test('unsubscribing one listener does not affect another still subscribed', () => {
  let a = 0
  let b = 0
  const unsubscribeA = subscribe(() => {
    a++
  })
  subscribe(() => {
    b++
  })
  actions.addTask('2026-09-01', 'One')
  unsubscribeA()
  actions.addTask('2026-09-01', 'Two')
  expect(a).toBe(1)
  expect(b).toBe(2)
})
