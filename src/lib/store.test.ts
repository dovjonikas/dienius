import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
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

test('deleteTemplate removes the template but keeps stamped days', () => {
  const t = actions.addTemplate({ name: 'X', color: '#f9d48a', blocks: [] })
  actions.stamp({ '2026-09-01': t.id })
  actions.deleteTemplate(t.id)
  expect(getData().templates).toHaveLength(0)
  expect(getData().days['2026-09-01']).toBeDefined()
})

test('state persists to localStorage', () => {
  actions.addTask('2026-09-01', 'Persist me')
  const raw = localStorage.getItem('dienius:data')!
  expect(raw).toContain('Persist me')
})
