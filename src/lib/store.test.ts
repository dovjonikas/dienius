import { beforeEach, expect, test, vi } from 'vitest'
import { actions, getData, getSaveOk, subscribe } from './store'
import { defaultData, loadData, STORAGE_KEY } from './storage'
import { dayScore } from '../widgets/day-plan/score'
import { PRESETS } from './themes'
import type { AppData } from './types'

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

test('rolloverUnfinished keeps moving a task marked unbounded past the push bound', () => {
  actions.addTask('2026-09-01', 'Standing task')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.rolloverUnfinished('2026-09-01')
  actions.rolloverUnfinished('2026-09-02')
  expect(getData().days['2026-09-03'].tasks[0].pushCount).toBe(2)

  actions.setTaskUnbounded('2026-09-03', id, true)
  const result = actions.rolloverUnfinished('2026-09-03')
  expect(result).toEqual({ moved: 1, held: 0 })
  const moved = getData().days['2026-09-04'].tasks[0]
  expect(moved.pushCount).toBe(3)
  expect(moved.unbounded).toBe(true)

  // And it keeps going indefinitely, not just for one extra push.
  const again = actions.rolloverUnfinished('2026-09-04')
  expect(again).toEqual({ moved: 1, held: 0 })
  expect(getData().days['2026-09-05'].tasks[0].pushCount).toBe(4)
})

test('rolloverUnfinished does not clear unbounded when pushing a task forward, unlike core', () => {
  actions.addTask('2026-09-01', 'Standing task')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.setTaskUnbounded('2026-09-01', id, true)
  actions.rolloverUnfinished('2026-09-01')
  const moved = getData().days['2026-09-02'].tasks[0]
  expect(moved.unbounded).toBe(true)
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

test('pushTask moves exactly one task to the next day, leaving the rest of the day untouched', () => {
  actions.addTask('2026-09-01', 'Trim me')
  actions.addTask('2026-09-01', 'Leave me')
  const id = getData().days['2026-09-01'].tasks[0].id
  const result = actions.pushTask('2026-09-01', id)
  expect(result).toBe(true)
  expect(getData().days['2026-09-01'].tasks.map(t => t.title)).toEqual(['Leave me'])
  const moved = getData().days['2026-09-02'].tasks[0]
  expect(moved.title).toBe('Trim me')
  expect(moved.pushCount).toBe(1)
})

test('pushTask refuses to push a task already at the push bound, and leaves it in place', () => {
  actions.addTask('2026-09-01', 'Maxed')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t => (t.id === id ? { ...t, pushCount: 2 } : t)),
      },
    },
  })
  const result = actions.pushTask('2026-09-01', id)
  expect(result).toBe(false)
  expect(getData().days['2026-09-01'].tasks.map(t => t.title)).toEqual(['Maxed'])
  expect(getData().days['2026-09-02']).toBeUndefined()
})

test('pushTask moves a task marked unbounded even though it is already past the push bound', () => {
  actions.addTask('2026-09-01', 'Standing errand')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t =>
          t.id === id ? { ...t, pushCount: 5, unbounded: true } : t,
        ),
      },
    },
  })
  const result = actions.pushTask('2026-09-01', id)
  expect(result).toBe(true)
  const moved = getData().days['2026-09-02'].tasks[0]
  expect(moved.pushCount).toBe(6)
  expect(moved.unbounded).toBe(true)
})

test('a task written to storage before unbounded existed loads and pushes exactly as an ordinary task would', () => {
  const legacy = {
    templates: [],
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'legacy-1', title: 'From before unbounded existed', done: false, pushCount: 2 }],
      },
    },
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

  actions.resetForTests(loadData())
  const loadedTask = getData().days['2026-09-01'].tasks[0]
  expect(loadedTask.unbounded).toBeUndefined()

  // Already at the bound, and never marked unbounded - held, not moved.
  const result = actions.rolloverUnfinished('2026-09-01')
  expect(result).toEqual({ moved: 0, held: 1 })
})

test('pushTask on a missing task or day does not throw and reports no push happened', () => {
  expect(actions.pushTask('2026-09-01', 'nothing-here')).toBe(false)
  actions.addTask('2026-09-01', 'Real task')
  expect(actions.pushTask('2026-09-01', 'still-not-here')).toBe(false)
})

test('pushTask refuses a task that is already done, and leaves it in place', () => {
  actions.addTask('2026-09-01', 'Finished')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.toggleTask('2026-09-01', id)
  const result = actions.pushTask('2026-09-01', id)
  expect(result).toBe(false)
  expect(getData().days['2026-09-01'].tasks.map(t => t.title)).toEqual(['Finished'])
  expect(getData().days['2026-09-02']).toBeUndefined()
})

test('setTaskMinutes sets a size on a task that had none', () => {
  actions.addTask('2026-09-01', 'Guitar')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.setTaskMinutes('2026-09-01', id, 20)
  expect(getData().days['2026-09-01'].tasks[0].minutes).toBe(20)
})

test('setTaskMinutes changes an existing size, and clears it back to unsized with undefined', () => {
  actions.addTask('2026-09-01', 'Guitar')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.setTaskMinutes('2026-09-01', id, 20)
  actions.setTaskMinutes('2026-09-01', id, 30)
  expect(getData().days['2026-09-01'].tasks[0].minutes).toBe(30)
  actions.setTaskMinutes('2026-09-01', id, undefined)
  expect(getData().days['2026-09-01'].tasks[0].minutes).toBeUndefined()
})

test('setTaskUnbounded(true) marks a task exempt from the push bound', () => {
  actions.addTask('2026-09-01', 'Standing task')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.setTaskUnbounded('2026-09-01', id, true)
  expect(getData().days['2026-09-01'].tasks[0].unbounded).toBe(true)
})

test('setTaskUnbounded(false) reverses the exemption, and stores no stray field for an ordinary task', () => {
  actions.addTask('2026-09-01', 'Standing task')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.setTaskUnbounded('2026-09-01', id, true)
  actions.setTaskUnbounded('2026-09-01', id, false)
  expect(getData().days['2026-09-01'].tasks[0].unbounded).toBeUndefined()
})

test('reversing unbounded on a task already past the bound puts it right back into do-or-delete territory', () => {
  actions.addTask('2026-09-01', 'Standing task')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t =>
          t.id === id ? { ...t, pushCount: 2, unbounded: true } : t,
        ),
      },
    },
  })
  actions.setTaskUnbounded('2026-09-01', id, false)
  const result = actions.pushTask('2026-09-01', id)
  expect(result).toBe(false)
})

test('placeFloat gives a float a time, turning it into an anchor', () => {
  actions.addTask('2026-09-01', 'Guitar')
  const id = getData().days['2026-09-01'].tasks[0].id
  const result = actions.placeFloat('2026-09-01', id, '14:30')
  expect(result).toBe(true)
  expect(getData().days['2026-09-01'].tasks[0].time).toBe('14:30')
})

test('placeFloat leaves every other field on the task untouched', () => {
  actions.addTask('2026-09-01', 'Guitar')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.setTaskMinutes('2026-09-01', id, 20)
  actions.placeFloat('2026-09-01', id, '14:30')
  expect(getData().days['2026-09-01'].tasks[0]).toMatchObject({ title: 'Guitar', minutes: 20, done: false })
})

test('placeFloat refuses a task that already has a time, and leaves it in place', () => {
  actions.addTask('2026-09-01', 'Shift', '09:00')
  const id = getData().days['2026-09-01'].tasks[0].id
  const result = actions.placeFloat('2026-09-01', id, '14:30')
  expect(result).toBe(false)
  expect(getData().days['2026-09-01'].tasks[0].time).toBe('09:00')
})

test('placeFloat on a missing task or day does not throw and reports no placement happened', () => {
  expect(actions.placeFloat('2026-09-01', 'nothing-here', '14:00')).toBe(false)
  actions.addTask('2026-09-01', 'Real task')
  expect(actions.placeFloat('2026-09-01', 'still-not-here', '14:00')).toBe(false)
})

test('unanchorTask clears a task\'s time, returning it to the tray as a float', () => {
  actions.addTask('2026-09-01', 'Call mom', '14:00')
  const id = getData().days['2026-09-01'].tasks[0].id
  const result = actions.unanchorTask('2026-09-01', id)
  expect(result).toBe(true)
  expect(getData().days['2026-09-01'].tasks[0].time).toBeUndefined()
})

test('unanchorTask leaves every other field on the task untouched', () => {
  actions.addTask('2026-09-01', 'Call mom', '14:00')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.setTaskMinutes('2026-09-01', id, 20)
  actions.unanchorTask('2026-09-01', id)
  expect(getData().days['2026-09-01'].tasks[0]).toMatchObject({ title: 'Call mom', minutes: 20, done: false })
})

test('unanchorTask refuses a task that is already a float, and leaves it in place', () => {
  actions.addTask('2026-09-01', 'Guitar')
  const id = getData().days['2026-09-01'].tasks[0].id
  const result = actions.unanchorTask('2026-09-01', id)
  expect(result).toBe(false)
  expect(getData().days['2026-09-01'].tasks[0].time).toBeUndefined()
})

test('unanchorTask on a missing task or day does not throw and reports nothing happened', () => {
  expect(actions.unanchorTask('2026-09-01', 'nothing-here')).toBe(false)
  actions.addTask('2026-09-01', 'Real task', '09:00')
  expect(actions.unanchorTask('2026-09-01', 'still-not-here')).toBe(false)
})

test('placeFloat followed by unanchorTask round-trips a task back to exactly its original shape', () => {
  actions.addTask('2026-09-01', 'Guitar')
  const id = getData().days['2026-09-01'].tasks[0].id
  const before = getData().days['2026-09-01'].tasks[0]
  actions.placeFloat('2026-09-01', id, '14:30')
  actions.unanchorTask('2026-09-01', id)
  expect(getData().days['2026-09-01'].tasks[0]).toEqual(before)
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

test('addTemplate carries a block\'s unbounded flag through to stamping, skipping the push bound from day one', () => {
  const t = actions.addTemplate({
    name: 'Ongoing project',
    color: '#c9b3f0',
    blocks: [
      { time: '19:00', title: 'Standing item', unbounded: true },
      { time: '21:00', title: 'Ordinary item' },
    ],
  })
  actions.stamp({ '2026-09-01': t.id })
  const day = getData().days['2026-09-01']
  expect(day.tasks.find(task => task.title === 'Standing item')?.unbounded).toBe(true)
  expect(day.tasks.find(task => task.title === 'Ordinary item')?.unbounded).toBeFalsy()
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

test('addIfThen accepts dayTypes and when, and leaves them undefined when not given', () => {
  const scoped = actions.addIfThen({
    trigger: 'Shift starts',
    action: 'Lay out the sleep mask',
    dayTypes: ['night'],
    when: 'evening',
  })
  expect(getData().ifThens.find(e => e.id === scoped.id)).toMatchObject({ dayTypes: ['night'], when: 'evening' })

  actions.addIfThen({ trigger: 'Unscoped trigger', action: 'Unscoped action' })
  const unscoped = getData().ifThens.find(e => e.trigger === 'Unscoped trigger')
  expect(unscoped?.dayTypes).toBeUndefined()
  expect(unscoped?.when).toBeUndefined()
})

test('markIfThenSurfaced sets lastSurfaced on only the matching entry', () => {
  const a = actions.addIfThen({ trigger: 'Trigger A', action: 'Action A' })
  actions.addIfThen({ trigger: 'Trigger B', action: 'Action B' })
  actions.markIfThenSurfaced(a.id, '2026-09-01')
  const [entryA, entryB] = getData().ifThens
  expect(entryA.lastSurfaced).toBe('2026-09-01')
  expect(entryB.lastSurfaced).toBeUndefined()
})

test('setTheme updates the mode and leaves the rest of settings, and the rest of theme, untouched', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: {
      theme: { presetId: 'sketchbook', overrides: { sketchbook: { accent: '#e0553b' } }, mode: 'light' },
      enabledWidgets: ['day-plan', 'if-then', 'a-future-widget'],
      timelineExpanded: false,
    },
  })
  actions.setTheme('dark')
  expect(getData().settings.theme.mode).toBe('dark')
  expect(getData().settings.theme.presetId).toBe('sketchbook')
  expect(getData().settings.theme.overrides).toEqual({ sketchbook: { accent: '#e0553b' } })
  expect(getData().settings.enabledWidgets).toEqual(['day-plan', 'if-then', 'a-future-widget'])
  actions.setTheme('system')
  expect(getData().settings.theme.mode).toBe('system')
})

test('setTimelineExpanded flips whether the day view timeline grid is shown, leaving the rest of settings untouched', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: { ...defaultData().settings, enabledWidgets: ['day-plan', 'if-then', 'a-future-widget'] },
  })
  expect(getData().settings.timelineExpanded).toBe(false)
  actions.setTimelineExpanded(true)
  expect(getData().settings.timelineExpanded).toBe(true)
  expect(getData().settings.enabledWidgets).toEqual(['day-plan', 'if-then', 'a-future-widget'])
  actions.setTimelineExpanded(false)
  expect(getData().settings.timelineExpanded).toBe(false)
})

test('setThemePreset changes only the preset id', () => {
  actions.resetForTests(defaultData())
  actions.setThemePreset('sketchbook')
  expect(getData().settings.theme.presetId).toBe('sketchbook')
  expect(getData().settings.theme.mode).toBe(defaultData().settings.theme.mode)
})

test('setThemeOverride writes one token under the current preset id without disturbing other presets\' patches', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: {
      theme: { presetId: 'sketchbook', overrides: { slate: { accent: '#111111' } }, mode: 'dark' },
      enabledWidgets: [],
      timelineExpanded: false,
    },
  })
  actions.setThemeOverride('sketchbook', 'accent', '#e0553b')
  expect(getData().settings.theme.overrides).toEqual({
    slate: { accent: '#111111' },
    sketchbook: { accent: '#e0553b' },
  })
  actions.setThemeOverride('sketchbook', 'mark', '#ffcc00')
  expect(getData().settings.theme.overrides.sketchbook).toEqual({ accent: '#e0553b', mark: '#ffcc00' })
})

test('resetThemeOverrides clears only the named preset\'s patch', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: {
      theme: {
        presetId: 'sketchbook',
        overrides: { slate: { accent: '#111111' }, sketchbook: { accent: '#e0553b' } },
        mode: 'dark',
      },
      enabledWidgets: [],
      timelineExpanded: false,
    },
  })
  actions.resetThemeOverrides('sketchbook')
  expect(getData().settings.theme.overrides).toEqual({ slate: { accent: '#111111' } })
})

test('unsetThemeOverride removes one token, leaving the preset\'s other overrides and other presets\' patches alone', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: {
      theme: {
        presetId: 'sketchbook',
        overrides: { slate: { accent: '#111111' }, sketchbook: { accent: '#e0553b', mark: '#ffcc00' } },
        mode: 'dark',
      },
      enabledWidgets: [],
      timelineExpanded: false,
    },
  })
  actions.unsetThemeOverride('sketchbook', 'accent')
  expect(getData().settings.theme.overrides).toEqual({
    slate: { accent: '#111111' },
    sketchbook: { mark: '#ffcc00' },
  })
})

test('unsetThemeOverride drops the preset\'s own entry once its last token is removed', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: {
      theme: { presetId: 'sketchbook', overrides: { sketchbook: { accent: '#e0553b' } }, mode: 'dark' },
      enabledWidgets: [],
      timelineExpanded: false,
    },
  })
  actions.unsetThemeOverride('sketchbook', 'accent')
  expect(getData().settings.theme.overrides).toEqual({})
})

test('unsetThemeOverride is a no-op for a preset or token that was never overridden', () => {
  actions.resetForTests(defaultData())
  const before = getData()
  actions.unsetThemeOverride('slate', 'accent')
  expect(getData()).toBe(before)
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

// --- stress test: importing the same backup two and three times -----------
//
// SettingsView's Import backup is a full restore, not a merge - see
// docs/DECISIONS.md's export/import round-trip note. Nothing here should
// duplicate on a second or third import of the exact same file: each
// import fully replaces the store (importJson -> commit(next)), so the end
// state after N identical imports is byte-for-byte the same as after one.

test('importing the same backup twice produces identical state, not duplicates', () => {
  const backup = defaultData()
  backup.templates.push({ id: 't1', name: 'Work', color: '#8ab6f9', blocks: [{ id: 'b1', title: 'Gym', time: '09:00' }] })
  backup.days['2026-09-01'] = {
    date: '2026-09-01',
    templateId: 't1',
    tasks: [{ id: 'x1', title: 'Gym', time: '09:00', done: false, fromTemplate: true }],
  }
  const json = JSON.stringify(backup)

  actions.importData(json)
  const afterFirst = getData()
  actions.importData(json)
  const afterSecond = getData()

  expect(afterSecond).toEqual(afterFirst)
  expect(afterSecond.templates).toHaveLength(1)
  expect(afterSecond.days['2026-09-01'].tasks).toHaveLength(1)
})

test('importing the same backup three times still produces exactly one copy of everything in it', () => {
  const backup = defaultData()
  backup.templates.push({ id: 't1', name: 'Work', color: '#8ab6f9', blocks: [] })
  backup.ifThens.push({ id: 'i1', trigger: 'Trigger', action: 'Action' })
  const json = JSON.stringify(backup)

  actions.importData(json)
  actions.importData(json)
  actions.importData(json)

  expect(getData().templates).toHaveLength(1)
  expect(getData().ifThens).toHaveLength(1)
})

test('importing a backup after making local changes discards the local changes, not merges them - a deliberate full restore', () => {
  actions.addTask('2026-09-01', 'Added locally, not in the backup')
  const backup = defaultData()
  backup.templates.push({ id: 't1', name: 'From backup', color: '#8ab6f9', blocks: [] })
  actions.importData(JSON.stringify(backup))
  expect(getData().days['2026-09-01']).toBeUndefined()
  expect(getData().templates).toHaveLength(1)
})

// --- stress test: localStorage full, forced -------------------------------
//
// SettingsView shows "Saving to this browser failed... export a backup"
// when getSaveOk() is false. This is the store-level half of that promise:
// a real forced setItem failure (not just reading the code) still leaves
// every action working against in-memory state, and recovery is automatic
// the moment storage has room again - nothing here requires the person to
// reload or take any recovery action of their own.

test('a forced localStorage failure during commit flips getSaveOk to false but keeps every action working in memory', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  })
  try {
    expect(getSaveOk()).toBe(true)
    actions.addTask('2026-09-01', 'Written while storage is full')
    expect(getSaveOk()).toBe(false)
    // The task is still there in memory even though the write failed - the
    // app keeps working, it just could not persist this change.
    expect(getData().days['2026-09-01'].tasks[0].title).toBe('Written while storage is full')

    // Further actions keep working too, not just the one that first failed.
    actions.addTask('2026-09-01', 'A second task, still in memory only')
    expect(getData().days['2026-09-01'].tasks).toHaveLength(2)
    expect(getSaveOk()).toBe(false)
  } finally {
    spy.mockRestore()
  }
})

test('once localStorage has room again, the very next commit recovers and getSaveOk returns to true', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  })
  actions.addTask('2026-09-01', 'Fails to save')
  expect(getSaveOk()).toBe(false)
  spy.mockRestore()

  actions.addTask('2026-09-01', 'Saves fine now that there is room')
  expect(getSaveOk()).toBe(true)
  const raw = localStorage.getItem(STORAGE_KEY)
  expect(raw).toContain('Saves fine now that there is room')
})

// --- stress test: switching themes with a large data set loaded -----------
//
// The year strip's own `cells` is a useMemo keyed on `[year, data.days,
// data.templates]` - it only recomputes when one of those three actually
// changes reference. setTheme/setThemePreset write into `data.settings`
// through an object spread that leaves `days` and `templates` referentially
// untouched, so a theme change alone must never invalidate that memo. This
// is what actually lets 11 preset switches over 700 stamped days stay cheap
// (see the year-strip render benchmark in the stress-test report) - pinned
// here at the store level, independent of any specific component's memo
// wiring, so the guarantee holds regardless of which view reads theme data.

test('changing the theme preset or mode never changes the object identity of days or templates', () => {
  const t = actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [] })
  actions.stamp({ '2026-09-01': t.id })
  const daysBefore = getData().days
  const templatesBefore = getData().templates

  actions.setThemePreset('sketchbook')
  actions.setTheme('dark')
  actions.setTheme('light')
  actions.setThemePreset('midnight')

  expect(getData().days).toBe(daysBefore)
  expect(getData().templates).toBe(templatesBefore)
})

test('switching all 11 presets and their modes completes in well under 100ms regardless of how much data is loaded', () => {
  const templates = Array.from({ length: 50 }, (_, i) => ({
    id: `t${i}`, name: `Template ${i}`, color: '#8ab6f9', blocks: [],
  }))
  const days: AppData['days'] = {}
  for (let i = 0; i < 700; i++) {
    const key = `2024-01-${String((i % 28) + 1).padStart(2, '0')}-${i}`
    days[key] = { date: key, tasks: [{ id: `${key}-t`, title: 'Task', done: false }] }
  }
  actions.resetForTests({ ...defaultData(), templates, days })

  const t0 = performance.now()
  for (const preset of PRESETS) {
    actions.setThemePreset(preset.id)
    for (const mode of preset.modes) actions.setTheme(mode)
  }
  const elapsed = performance.now() - t0
  expect(elapsed).toBeLessThan(100)
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
