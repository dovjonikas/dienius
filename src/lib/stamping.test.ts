import { applyStamps } from './stamping'
import type { DayPlan, Template } from './types'

const workDay: Template = {
  id: 't1',
  name: 'Work day',
  color: '#8ab6f9',
  blocks: [
    { id: 'b1', time: '09:00', title: 'Gym' },
    { id: 'b2', time: '10:00', title: 'Deep work' },
  ],
}

test('applying a template copies its blocks as tasks', () => {
  const days = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  const day = days['2026-09-01']
  expect(day.templateId).toBe('t1')
  expect(day.tasks).toHaveLength(2)
  expect(day.tasks[0]).toMatchObject({ time: '09:00', title: 'Gym', done: false, fromTemplate: true })
})

test('a stamped day arrives already sized when its template blocks carry minutes', () => {
  const sized: Template = {
    id: 't4',
    name: 'Full day',
    color: '#8ab6f9',
    blocks: [
      { id: 'b1', time: '09:00', title: 'Gym', minutes: 90 },
      { id: 'b2', title: 'Guitar', minutes: 20 },
      { id: 'b3', title: 'No size on this one' },
    ],
  }
  const days = applyStamps({}, [sized], { '2026-09-01': 't4' })
  const tasks = days['2026-09-01'].tasks
  expect(tasks.find(t => t.title === 'Gym')?.minutes).toBe(90)
  expect(tasks.find(t => t.title === 'Guitar')?.minutes).toBe(20)
  expect(tasks.find(t => t.title === 'No size on this one')?.minutes).toBeUndefined()
})

test('re-stamping updates minutes from the current block, not the prior task', () => {
  const shift: Template = {
    id: 't5',
    name: 'Shift',
    color: '#c9b3f0',
    blocks: [{ id: 'b1', time: '19:00', title: 'Clock in', minutes: 480 }],
  }
  const stamped = applyStamps({}, [shift], { '2026-09-01': 't5' })
  expect(stamped['2026-09-01'].tasks[0].minutes).toBe(480)

  const resized: Template = { ...shift, blocks: [{ ...shift.blocks[0], minutes: 420 }] }
  const restamped = applyStamps(stamped, [resized], { '2026-09-01': 't5' })
  expect(restamped['2026-09-01'].tasks[0].minutes).toBe(420)
})

test('applying keeps manual tasks and replaces old template tasks', () => {
  const existing: DayPlan = {
    date: '2026-09-01',
    templateId: 'old',
    tasks: [
      { id: 'x1', title: 'Old block', done: false, fromTemplate: true },
      { id: 'x2', title: 'Call mom', done: false },
    ],
  }
  const days = applyStamps({ '2026-09-01': existing }, [workDay], { '2026-09-01': 't1' })
  const titles = days['2026-09-01'].tasks.map(t => t.title)
  expect(titles).toEqual(['Gym', 'Deep work', 'Call mom'])
})

test('stamping null removes template tasks but keeps manual tasks', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks.push({ id: 'm1', title: 'Manual', done: false })
  const cleared = applyStamps(stamped, [workDay], { '2026-09-01': null })
  expect(cleared['2026-09-01'].templateId).toBeUndefined()
  expect(cleared['2026-09-01'].tasks.map(t => t.title)).toEqual(['Manual'])
})

test('does not mutate the input days object', () => {
  const days: Record<string, DayPlan> = {}
  applyStamps(days, [workDay], { '2026-09-01': 't1' })
  expect(days).toEqual({})
})

test('unknown template id leaves the day untouched', () => {
  const days = applyStamps({}, [workDay], { '2026-09-01': 'missing' })
  expect(days['2026-09-01']).toBeUndefined()
})

test('re-stamping the same template preserves done state of matching blocks', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  const gymId = stamped['2026-09-01'].tasks.find(t => t.title === 'Gym')!.id
  stamped['2026-09-01'].tasks = stamped['2026-09-01'].tasks.map(t =>
    t.id === gymId ? { ...t, done: true } : t,
  )
  const restamped = applyStamps(stamped, [workDay], { '2026-09-01': 't1' })
  const tasks = restamped['2026-09-01'].tasks
  expect(tasks.find(t => t.title === 'Gym')?.done).toBe(true)
  expect(tasks.find(t => t.title === 'Deep work')?.done).toBe(false)
})

test('re-stamping after a block is removed from the template drops its task', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks = stamped['2026-09-01'].tasks.map(t =>
    t.title === 'Gym' ? { ...t, done: true } : t,
  )
  const shrunk: Template = { ...workDay, blocks: [workDay.blocks[1]] }
  const restamped = applyStamps(stamped, [shrunk], { '2026-09-01': 't1' })
  const titles = restamped['2026-09-01'].tasks.map(t => t.title)
  expect(titles).toEqual(['Deep work'])
})

test('re-stamping after a block is added to the template arrives unchecked', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks = stamped['2026-09-01'].tasks.map(t => ({ ...t, done: true }))
  const grown: Template = {
    ...workDay,
    blocks: [...workDay.blocks, { id: 'b3', time: '18:00', title: 'Dinner' }],
  }
  const restamped = applyStamps(stamped, [grown], { '2026-09-01': 't1' })
  const dinner = restamped['2026-09-01'].tasks.find(t => t.title === 'Dinner')
  expect(dinner?.done).toBe(false)
  expect(restamped['2026-09-01'].tasks.find(t => t.title === 'Gym')?.done).toBe(true)
})

test('re-stamping the same template still keeps manual tasks', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks.push({ id: 'm1', title: 'Manual task', done: true })
  const restamped = applyStamps(stamped, [workDay], { '2026-09-01': 't1' })
  const manual = restamped['2026-09-01'].tasks.find(t => t.title === 'Manual task')
  expect(manual?.done).toBe(true)
  expect(manual?.fromTemplate).toBeFalsy()
})

test('stamping a typed template carries the type onto the day', () => {
  const shift: Template = {
    id: 't3',
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [
      { id: 'b1', time: '19:00', title: 'Clock in', core: true },
      { id: 'b2', time: '21:00', title: 'Break', core: false },
    ],
  }
  const days = applyStamps({}, [shift], { '2026-09-01': 't3' })
  const day = days['2026-09-01']
  expect(day.dayType).toBe('shift')
  expect(day.tasks.find(t => t.title === 'Clock in')?.core).toBe(true)
  expect(day.tasks.find(t => t.title === 'Break')?.core).toBeFalsy()
})

test('stamping a template with no type leaves dayType absent, same as an old template', () => {
  const days = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  expect(days['2026-09-01'].dayType).toBeUndefined()
})

test('clearing a stamp drops the day type along with the template', () => {
  const shift: Template = {
    id: 't3',
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [{ id: 'b1', time: '19:00', title: 'Clock in', core: true }],
  }
  const stamped = applyStamps({}, [shift], { '2026-09-01': 't3' })
  const cleared = applyStamps(stamped, [shift], { '2026-09-01': null })
  expect(cleared['2026-09-01'].dayType).toBeUndefined()
})

test('re-stamping updates core from the current block, not the prior task', () => {
  const shift: Template = {
    id: 't3',
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [{ id: 'b1', time: '19:00', title: 'Clock in', core: false }],
  }
  const stamped = applyStamps({}, [shift], { '2026-09-01': 't3' })
  expect(stamped['2026-09-01'].tasks[0].core).toBeFalsy()

  const nowCore: Template = { ...shift, blocks: [{ ...shift.blocks[0], core: true }] }
  const restamped = applyStamps(stamped, [nowCore], { '2026-09-01': 't3' })
  expect(restamped['2026-09-01'].tasks[0].core).toBe(true)
})

test('applying a different template does not carry over done state', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks = stamped['2026-09-01'].tasks.map(t => ({ ...t, done: true }))
  const other: Template = {
    id: 't2',
    name: 'Rest day',
    color: '#f5b0a7',
    blocks: [{ id: 'c1', time: '09:00', title: 'Gym' }],
  }
  const restamped = applyStamps(stamped, [workDay, other], { '2026-09-01': 't2' })
  expect(restamped['2026-09-01'].tasks.find(t => t.title === 'Gym')?.done).toBe(false)
})
