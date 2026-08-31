import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'

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
