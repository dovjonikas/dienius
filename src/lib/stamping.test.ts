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
