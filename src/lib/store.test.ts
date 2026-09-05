import { beforeEach, expect, test, vi } from 'vitest'
import { actions, getData, getSaveOk, subscribe } from './store'
import { defaultData, loadData, STORAGE_KEY } from './storage'
import { dayScore } from '../widgets/day-plan/score'
import { PRESETS } from './themes'
import { MAX_RULES_PER_GOAL, type AppData } from './types'

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
  expect(result).toEqual({ moved: 1, held: 0, skipped: 0 })
  expect(getData().days['2026-09-01'].tasks.map(t => t.title)).toEqual(['Done thing'])
  expect(getData().days['2026-09-02'].tasks.map(t => t.title)).toEqual(['Not done'])
})

// This used to assert two Gyms, which was the bug rather than the contract:
// a task pushed from a template day and the same template stamped onto the
// day it landed on are the same intention, and a day holding both is what
// made the timeline draw two columns. They merge now - see taskIdentity.ts.
test('a pushed template task and a re-stamp of the same template merge rather than doubling', () => {
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

  actions.stamp({ '2026-09-02': t.id })
  const titles = getData().days['2026-09-02'].tasks.map(task => task.title)
  expect(titles.filter(title => title === 'Gym')).toHaveLength(1)
})

// The source of a daily series was pushed like a one-off, and the next day
// held the task twice: the instance the series had made when the day was
// opened, and the source arriving with a push count. The rollover e2e test
// found it in v1.11; the source stays, the way an instance already did.
test('rolloverUnfinished leaves the source of a series alone when tomorrow gets an instance anyway', () => {
  actions.addTask('2026-09-01', 'Water the plants')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.setTaskRepeat('2026-09-01', id, 'daily')
  actions.ensureDay('2026-09-02')
  expect(getData().days['2026-09-02'].tasks.map(t => t.title)).toEqual(['Water the plants'])

  const result = actions.rolloverUnfinished('2026-09-01')
  expect(result).toEqual({ moved: 0, held: 0, skipped: 1 })
  expect(getData().days['2026-09-01'].tasks.map(t => t.title)).toEqual(['Water the plants'])
  expect(getData().days['2026-09-02'].tasks.map(t => t.title)).toEqual(['Water the plants'])
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

// The merge keeps what the day earned rather than replacing it: a task that
// has been carried once is still a task that has been carried once.
test('pushCount survives the re-stamp that merges a pushed task back into its template', () => {
  const t = actions.addTemplate({
    name: 'Work day',
    color: '#8ab6f9',
    blocks: [{ time: '09:00', title: 'Gym' }],
  })
  actions.stamp({ '2026-09-01': t.id })
  actions.rolloverUnfinished('2026-09-01')
  expect(getData().days['2026-09-02'].tasks.find(task => task.title === 'Gym')?.pushCount).toBe(1)

  actions.stamp({ '2026-09-02': t.id })
  const afterRestamp = getData().days['2026-09-02'].tasks.filter(task => task.title === 'Gym')
  expect(afterRestamp).toHaveLength(1)
  expect(afterRestamp[0].pushCount).toBe(1)
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
  expect(result).toEqual({ moved: 0, held: 1, skipped: 0 })
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
  expect(result).toEqual({ moved: 1, held: 1, skipped: 0 })
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
  expect(result).toEqual({ moved: 1, held: 0, skipped: 0 })
  const moved = getData().days['2026-09-04'].tasks[0]
  expect(moved.pushCount).toBe(3)
  expect(moved.unbounded).toBe(true)

  // And it keeps going indefinitely, not just for one extra push.
  const again = actions.rolloverUnfinished('2026-09-04')
  expect(again).toEqual({ moved: 1, held: 0, skipped: 0 })
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
  expect(result).toEqual({ moved: 1, held: 0, skipped: 0 })
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
  expect(result).toEqual({ moved: 0, held: 1, skipped: 0 })
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
  // Substance, not stamps - see withoutStamps below. The round trip is about
  // the task being back to what it was; its updatedAt has to move regardless,
  // because another device may only ever have seen the placed version and
  // still needs to be told it was taken back.
  expect(withoutStamps(getData().days['2026-09-01'].tasks[0])).toEqual(withoutStamps(before))
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
  expect(entry?.id).toBeTruthy()
})

test('addIfThen without a color leaves it undefined', () => {
  actions.addIfThen({ trigger: 'It is 22:30', action: 'Phone goes on the charger' })
  expect(getData().ifThens[0].color).toBeUndefined()
})

test('updateIfThen replaces the entry with the same id in place', () => {
  const entry = actions.addIfThen({ trigger: 'Old trigger', action: 'Old action' })!
  actions.updateIfThen({ ...entry, trigger: 'New trigger', action: 'New action', color: '#f5b0a7' })
  expect(getData().ifThens).toHaveLength(1)
  expect(getData().ifThens[0]).toMatchObject({ trigger: 'New trigger', action: 'New action', color: '#f5b0a7' })
})

test('deleteIfThen removes only the matching entry', () => {
  const a = actions.addIfThen({ trigger: 'Trigger A', action: 'Action A' })!
  actions.addIfThen({ trigger: 'Trigger B', action: 'Action B' })
  actions.deleteIfThen(a.id)
  expect(getData().ifThens).toHaveLength(1)
  expect(getData().ifThens[0].trigger).toBe('Trigger B')
})

/**
 * A rule belongs to a goal now, and the cap on how many one goal can carry
 * refuses rather than evicting. These replace the two tests that covered the
 * old day-type and time-of-day scoping and the rotation's `lastSurfaced`
 * bookkeeping, both of which went with the day view's surfacing.
 */
test('addIfThen files a rule under a goal, and leaves goalId undefined when none is given', () => {
  const goal = actions.addGoal({ title: 'Ship something' }, '2026-09-01')
  const filed = actions.addIfThen({ trigger: 'I stall', action: 'I open today', goalId: goal!.id })
  expect(getData().ifThens.find(e => e.id === filed!.id)?.goalId).toBe(goal!.id)

  actions.addIfThen({ trigger: 'Unfiled trigger', action: 'Unfiled action' })
  expect(getData().ifThens.find(e => e.trigger === 'Unfiled trigger')?.goalId).toBeUndefined()
})

test('addIfThen refuses a sixth rule under one goal rather than dropping the oldest', () => {
  const goal = actions.addGoal({ title: 'Be strong at forty' }, '2026-09-01')!
  for (let i = 0; i < MAX_RULES_PER_GOAL; i++) {
    expect(actions.addIfThen({ trigger: `Trigger ${i}`, action: `Action ${i}`, goalId: goal.id })).not.toBeNull()
  }
  expect(actions.addIfThen({ trigger: 'One too many', action: 'Nope', goalId: goal.id })).toBeNull()
  expect(getData().ifThens).toHaveLength(MAX_RULES_PER_GOAL)
  expect(getData().ifThens[0].trigger).toBe('Trigger 0')
})

test('assignIfThenGoal files an unfiled rule, and takes it back out again', () => {
  const goal = actions.addGoal({ title: 'Ship something' }, '2026-09-01')!
  const rule = actions.addIfThen({ trigger: 'I stall', action: 'I open today' })!

  expect(actions.assignIfThenGoal(rule.id, goal.id)).toBe(true)
  expect(getData().ifThens[0].goalId).toBe(goal.id)

  expect(actions.assignIfThenGoal(rule.id, undefined)).toBe(true)
  expect(getData().ifThens[0].goalId).toBeUndefined()
})

test('assignIfThenGoal refuses to overfill a goal, and leaves the rule where it was', () => {
  const goal = actions.addGoal({ title: 'Be strong at forty' }, '2026-09-01')!
  for (let i = 0; i < MAX_RULES_PER_GOAL; i++) {
    actions.addIfThen({ trigger: `Trigger ${i}`, action: `Action ${i}`, goalId: goal.id })
  }
  const spare = actions.addIfThen({ trigger: 'Spare', action: 'Waiting' })!

  expect(actions.assignIfThenGoal(spare.id, goal.id)).toBe(false)
  expect(getData().ifThens.find(e => e.id === spare.id)?.goalId).toBeUndefined()
})

test('setTheme updates the mode and leaves the rest of settings, and the rest of theme, untouched', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: {
      ...defaultData().settings,
      theme: { presetId: 'midnight', overrides: { midnight: { accent: '#e0553b' } }, mode: 'light' },
      enabledWidgets: ['day-plan', 'if-then', 'a-future-widget'],
      timelineExpanded: false,
      dayLayoutFocus: 'both',
    },
  })
  actions.setTheme('dark')
  expect(getData().settings.theme.mode).toBe('dark')
  expect(getData().settings.theme.presetId).toBe('midnight')
  expect(getData().settings.theme.overrides).toEqual({ midnight: { accent: '#e0553b' } })
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

// setDayLayoutFocus - docs/LAYOUT-WIDE.md section 5, mirroring
// setTimelineExpanded exactly: one app-wide setting, no other field
// touched.

test('setDayLayoutFocus changes only dayLayoutFocus, leaving the rest of settings untouched', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: { ...defaultData().settings, enabledWidgets: ['day-plan', 'if-then', 'a-future-widget'], timelineExpanded: true },
  })
  expect(getData().settings.dayLayoutFocus).toBe('both')
  actions.setDayLayoutFocus('calendar')
  expect(getData().settings.dayLayoutFocus).toBe('calendar')
  expect(getData().settings.enabledWidgets).toEqual(['day-plan', 'if-then', 'a-future-widget'])
  expect(getData().settings.timelineExpanded).toBe(true)
  actions.setDayLayoutFocus('tasks')
  expect(getData().settings.dayLayoutFocus).toBe('tasks')
  actions.setDayLayoutFocus('both')
  expect(getData().settings.dayLayoutFocus).toBe('both')
})

// setSleepWindow / setNightSleepWindow - a set-once setting the same way as
// the two above: changed once in Settings, read live by every day of the
// matching type, never touching the rest of settings.

test('setSleepProfileWindow changes one schedule and nothing else in settings', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: { ...defaultData().settings, enabledWidgets: ['day-plan', 'if-then'], timelineExpanded: true },
  })
  expect(getData().settings.sleepProfiles[0].window).toEqual({ start: '23:00', end: '07:00' })
  actions.setSleepProfileWindow('default', { start: '22:30', end: '06:15' })
  expect(getData().settings.sleepProfiles[0].window).toEqual({ start: '22:30', end: '06:15' })
  expect(getData().settings.enabledWidgets).toEqual(['day-plan', 'if-then'])
  expect(getData().settings.timelineExpanded).toBe(true)
})

test('a second schedule is seeded from the default rather than from nothing', () => {
  actions.resetForTests(defaultData())
  actions.setSleepProfileWindow('default', { start: '22:00', end: '06:00' })
  actions.addSleepProfile('Shift')
  const profiles = getData().settings.sleepProfiles
  expect(profiles).toHaveLength(2)
  expect(profiles[1].name).toBe('Shift')
  expect(profiles[1].window).toEqual({ start: '22:00', end: '06:00' })
})

// Deleting a schedule has to take every reference to it with it - a day left
// pointing at a deleted id would resolve to the default by accident rather
// than by decision.
test('deleting a schedule clears it off every day and template that used it', () => {
  actions.resetForTests(defaultData())
  actions.addSleepProfile('Shift')
  const shift = getData().settings.sleepProfiles[1].id
  const template = actions.addTemplate({ name: 'Nights', color: '#a7c4f5', blocks: [] })
  actions.updateTemplate({ ...getData().templates[0], sleepProfileId: shift })
  actions.addTask('2026-09-01', 'Clock in')
  actions.setDaySleepProfile('2026-09-01', shift)

  actions.deleteSleepProfile(shift)

  expect(getData().settings.sleepProfiles).toHaveLength(1)
  expect(getData().templates.find(t => t.id === template.id)?.sleepProfileId).toBeUndefined()
  expect(getData().days['2026-09-01'].sleepProfileId).toBeUndefined()
})

test('the first schedule can never be deleted - something has to be the default', () => {
  actions.resetForTests(defaultData())
  actions.deleteSleepProfile('default')
  expect(getData().settings.sleepProfiles).toHaveLength(1)
})

test('setThemePreset changes only the preset id', () => {
  actions.resetForTests(defaultData())
  actions.setThemePreset('midnight')
  expect(getData().settings.theme.presetId).toBe('midnight')
  expect(getData().settings.theme.mode).toBe(defaultData().settings.theme.mode)
})

test('setThemeOverride writes one token under the current preset id without disturbing other presets\' patches', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: {
      ...defaultData().settings,
      theme: { presetId: 'midnight', overrides: { dark: { accent: '#111111' } }, mode: 'dark' },
      enabledWidgets: [],
      timelineExpanded: false,
      dayLayoutFocus: 'both',
    },
  })
  actions.setThemeOverride('midnight', 'accent', '#e0553b')
  expect(getData().settings.theme.overrides).toEqual({
    dark: { accent: '#111111' },
    midnight: { accent: '#e0553b' },
  })
  actions.setThemeOverride('midnight', 'mark', '#ffcc00')
  expect(getData().settings.theme.overrides.midnight).toEqual({ accent: '#e0553b', mark: '#ffcc00' })
})

test('resetThemeOverrides clears only the named preset\'s patch', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: {
      ...defaultData().settings,
      theme: {
        presetId: 'midnight',
        overrides: { dark: { accent: '#111111' }, midnight: { accent: '#e0553b' } },
        mode: 'dark',
      },
      enabledWidgets: [],
      timelineExpanded: false,
      dayLayoutFocus: 'both',
    },
  })
  actions.resetThemeOverrides('midnight')
  expect(getData().settings.theme.overrides).toEqual({ dark: { accent: '#111111' } })
})

test('unsetThemeOverride removes one token, leaving the preset\'s other overrides and other presets\' patches alone', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: {
      ...defaultData().settings,
      theme: {
        presetId: 'midnight',
        overrides: { dark: { accent: '#111111' }, midnight: { accent: '#e0553b', mark: '#ffcc00' } },
        mode: 'dark',
      },
      enabledWidgets: [],
      timelineExpanded: false,
      dayLayoutFocus: 'both',
    },
  })
  actions.unsetThemeOverride('midnight', 'accent')
  expect(getData().settings.theme.overrides).toEqual({
    dark: { accent: '#111111' },
    midnight: { mark: '#ffcc00' },
  })
})

test('unsetThemeOverride drops the preset\'s own entry once its last token is removed', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: {
      ...defaultData().settings,
      theme: { presetId: 'midnight', overrides: { midnight: { accent: '#e0553b' } }, mode: 'dark' },
      enabledWidgets: [],
      timelineExpanded: false,
      dayLayoutFocus: 'both',
    },
  })
  actions.unsetThemeOverride('midnight', 'accent')
  expect(getData().settings.theme.overrides).toEqual({})
})

test('unsetThemeOverride is a no-op for a preset or token that was never overridden', () => {
  actions.resetForTests(defaultData())
  const before = getData()
  actions.unsetThemeOverride('dark', 'accent')
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

  // Compared without the sync timestamps, which are the one thing that is
  // *supposed* to differ: an import is a local write, and the other device
  // needs to know it happened. Everything the backup actually contains has to
  // be identical.
  expect(withoutStamps(afterSecond)).toEqual(withoutStamps(afterFirst))
  expect(afterSecond.templates).toHaveLength(1)
  expect(afterSecond.days['2026-09-01'].tasks).toHaveLength(1)
})

/** The same state with every updatedAt removed, for comparing substance. */
function withoutStamps(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutStamps)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => k !== 'updatedAt' && k !== 'settingsUpdatedAt' && k !== 'tombstones')
        .map(([k, v]) => [k, withoutStamps(v)]),
    )
  }
  return value
}

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

  actions.setThemePreset('midnight')
  actions.setTheme('dark')
  actions.setTheme('light')
  actions.setThemePreset('midnight')

  expect(getData().days).toBe(daysBefore)
  expect(getData().templates).toBe(templatesBefore)
})

/**
 * The cost of a theme switch must not depend on how much is in the store.
 *
 * Measured as a ratio against an empty store rather than against a fixed
 * millisecond budget: this runs alongside seventy other test files on
 * whatever machine CI hands out, and a wall-clock number measures that
 * machine's load as much as this code. A ratio moves with the load on both
 * sides and keeps saying the thing the test is actually for - switching a
 * theme touches settings, and settings do not get bigger when the year does.
 */
function timeThemeSwitches(): number {
  const t0 = performance.now()
  for (const preset of PRESETS) {
    actions.setThemePreset(preset.id)
    for (const mode of preset.modes) actions.setTheme(mode)
  }
  return performance.now() - t0
}

/**
 * The best of several rounds, not one round.
 *
 * A single timing on a machine running seventy other test files measures that
 * machine's scheduler as much as this code, and a round that happens to be
 * preempted reads as a regression. The fastest round is the one that got a
 * clean run at it, which is the only one that says anything about the code.
 */
function fastestThemeSwitches(rounds: number): number {
  let best = Infinity
  for (let i = 0; i < rounds; i++) best = Math.min(best, timeThemeSwitches())
  return best
}

test('switching all 11 presets and their modes costs the same whether the store is empty or holds two years', () => {
  const templates = Array.from({ length: 50 }, (_, i) => ({
    id: `t${i}`, name: `Template ${i}`, color: '#8ab6f9', blocks: [],
  }))
  const days: AppData['days'] = {}
  for (let i = 0; i < 700; i++) {
    const key = `2024-01-${String((i % 28) + 1).padStart(2, '0')}-${i}`
    days[key] = { date: key, tasks: [{ id: `${key}-t`, title: 'Task', done: false }] }
  }

  // Alternating rather than one block each, so a machine that gets busier
  // partway through slows both sides equally instead of only the second.
  let onEmpty = Infinity
  let onLoaded = Infinity
  for (let round = 0; round < 3; round++) {
    actions.resetForTests(defaultData())
    onEmpty = Math.min(onEmpty, fastestThemeSwitches(1))
    actions.resetForTests({ ...defaultData(), templates, days })
    onLoaded = Math.min(onLoaded, fastestThemeSwitches(1))
  }

  // Generous on purpose - the point is that it is a constant multiple and not
  // a multiple of 700. A version that walked every day would be orders out,
  // and no amount of scheduler noise turns 700x into 6x.
  expect(onLoaded).toBeLessThan(Math.max(onEmpty * 6, 80))
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

/**
 * Restoring a daily snapshot. Two properties, both of which were broken:
 * it has to reach storage, and it has to win the next sync.
 */
test('a restored snapshot is written to storage, so it survives closing the tab', () => {
  actions.addTask('2026-09-01', 'Today')
  const snapshot = defaultData()
  snapshot.days['2026-01-01'] = {
    date: '2026-01-01',
    tasks: [{ id: 'x', title: 'From the snapshot', done: false }],
  }

  actions.restoreState(snapshot)

  const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AppData
  expect(Object.keys(persisted.days)).toEqual(['2026-01-01'])
  expect(persisted.days['2026-01-01'].tasks[0].title).toBe('From the snapshot')
})

// A restore is a decision about what the plan should be, made now. Left with
// the snapshot's own old timestamps it would lose the next merge to whichever
// device still held the newer version, and the restore would silently undo
// itself a few seconds later.
test('a restored snapshot is stamped now, so it wins the next sync rather than losing to it', () => {
  actions.addTask('2026-09-01', 'Today')
  const before = getData().days['2026-09-01'].tasks[0].updatedAt

  const snapshot = defaultData()
  snapshot.days['2026-01-01'] = {
    date: '2026-01-01',
    tasks: [{ id: 'x', title: 'From the snapshot', done: false, updatedAt: '2020-01-01T00:00:00.000Z' }],
  }
  actions.restoreState(snapshot)

  const restored = getData().days['2026-01-01'].tasks[0]
  expect(restored.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
  expect(restored.updatedAt! >= before!).toBe(true)
})

test('what a restore removes is tombstoned, so it does not come back from the other device', () => {
  actions.addTask('2026-09-01', 'Typed after the snapshot')
  const id = getData().days['2026-09-01'].tasks[0].id

  actions.restoreState(defaultData())

  expect(getData().tombstones?.[`task:${id}`]).toEqual(expect.any(String))
})

/**
 * Moving a task to another day - what a drag across the week commits.
 *
 * The distinction these exist for is that it is not a push. A task dragged
 * onto Friday because that is when the appointment is has nothing to do with
 * a task that keeps failing to happen and getting shunted forward, and
 * counting it would eventually trip the two-push bound on something nobody
 * has ever postponed.
 */
test('moveTaskToDay carries the task and its time to the other day', () => {
  actions.addTask('2026-09-01', 'Dentist', '14:00')
  const id = getData().days['2026-09-01'].tasks[0].id

  expect(actions.moveTaskToDay('2026-09-01', '2026-09-04', id)).toBe(true)
  expect(getData().days['2026-09-01'].tasks).toHaveLength(0)
  expect(getData().days['2026-09-04'].tasks[0]).toMatchObject({ title: 'Dentist', time: '14:00' })
})

test('a moved task is not a pushed one - no pushCount, no cleared core', () => {
  const shift = actions.addTemplate({
    name: 'Shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [{ time: '19:00', title: 'File report', core: true }],
  })
  actions.stamp({ '2026-09-01': shift.id })
  const id = getData().days['2026-09-01'].tasks[0].id

  actions.moveTaskToDay('2026-09-01', '2026-09-02', id)
  const moved = getData().days['2026-09-02'].tasks[0]
  expect(moved.pushCount).toBeUndefined()
  expect(moved.core).toBe(true)
})

test('a task at the push bound can still be moved by hand', () => {
  actions.addTask('2026-09-01', 'Chronically postponed')
  actions.rolloverUnfinished('2026-09-01')
  actions.rolloverUnfinished('2026-09-02')
  const id = getData().days['2026-09-03'].tasks[0].id
  expect(actions.pushTask('2026-09-03', id)).toBe(false)

  // The bound is about the app moving something for you, not about you
  // deciding where it goes.
  expect(actions.moveTaskToDay('2026-09-03', '2026-09-08', id)).toBe(true)
  expect(getData().days['2026-09-08'].tasks[0].pushCount).toBe(2)
})

// The duplication `origin` was added to stop, arriving by a new route.
test('a day that already has the same template block refuses the move', () => {
  const template = actions.addTemplate({
    name: 'Work',
    color: '#8ab6f9',
    blocks: [{ time: '09:00', title: 'Standup' }],
  })
  actions.stamp({ '2026-09-01': template.id, '2026-09-02': template.id })
  const id = getData().days['2026-09-01'].tasks[0].id

  expect(actions.moveTaskToDay('2026-09-01', '2026-09-02', id)).toBe(false)
  expect(getData().days['2026-09-01'].tasks).toHaveLength(1)
  expect(getData().days['2026-09-02'].tasks).toHaveLength(1)
})

// Two tasks called "Call the bank" on one day are two calls - a manual task
// has no identity on purpose, so nothing about this is refused.
test('two manual tasks with the same title can share a day', () => {
  actions.addTask('2026-09-01', 'Call the bank')
  actions.addTask('2026-09-02', 'Call the bank')
  const id = getData().days['2026-09-01'].tasks[0].id

  expect(actions.moveTaskToDay('2026-09-01', '2026-09-02', id)).toBe(true)
  expect(getData().days['2026-09-02'].tasks).toHaveLength(2)
})

test('moving onto the same day, or a task that is not there, reports nothing happened', () => {
  actions.addTask('2026-09-01', 'Dentist', '14:00')
  const id = getData().days['2026-09-01'].tasks[0].id
  expect(actions.moveTaskToDay('2026-09-01', '2026-09-01', id)).toBe(false)
  expect(actions.moveTaskToDay('2026-09-01', '2026-09-02', 'not-a-task')).toBe(false)
  expect(getData().days['2026-09-02']).toBeUndefined()
})

test('the move is exactly reversible, which is what the undo offer relies on', () => {
  actions.addTask('2026-09-01', 'Dentist', '14:00')
  const id = getData().days['2026-09-01'].tasks[0].id
  const before = getData().days['2026-09-01'].tasks[0]

  actions.moveTaskToDay('2026-09-01', '2026-09-04', id)
  actions.moveTaskToDay('2026-09-04', '2026-09-01', id)

  expect(withoutStamps(getData().days['2026-09-01'].tasks[0])).toEqual(withoutStamps(before))
})

/**
 * The store is ten area modules spread into one object - see store.ts. A
 * name defined in two areas would be silently shadowed by whichever spreads
 * last, and the wrong module's version of an action is the kind of bug that
 * passes every test written against the facade.
 */
test('no action is defined in two areas of the store', async () => {
  const { AREAS } = await import('./store')
  const seen = new Map<string, string>()
  for (const [area, group] of Object.entries(AREAS)) {
    for (const name of Object.keys(group)) {
      expect(seen.get(name), `${name} is in both ${seen.get(name)} and ${area}`).toBeUndefined()
      seen.set(name, area)
    }
  }
  // Every area contributes, and the facade carries all of them plus the test seam.
  expect(Object.values(AREAS).every(group => Object.keys(group).length > 0)).toBe(true)
  expect(Object.keys(actions).length).toBe(seen.size + 1)
})
