import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { applyPlan } from '../widgets/day-plan/replan'
import { applyLowDayPlan } from '../widgets/day-plan/lowDay'
import type { AppData, Task } from './types'

/**
 * A routine's task that leaves its date by hand - deleted, cleared, moved,
 * pushed, sent on by a replan or a low day - leaves a skip behind, so composing
 * the date again does not put it back; and where it lands, it lands as placed
 * by hand, so composing that date does not move it or take it away.
 * docs/RESEARCH-SHIFTS.md sections 2.3 and 6.3. Generic names only.
 */

const DATE = '2026-09-18'
const NEXT = '2026-09-19'

function routineTask(over: Partial<Task> = {}): Task {
  return {
    id: 'training-task',
    title: 'Training',
    done: false,
    time: '17:00',
    minutes: 60,
    category: 'health',
    routineId: 'training',
    fromRoutine: { title: 'Training', time: '17:00', minutes: 60, category: 'health' },
    ...over,
  }
}

function plan(): AppData {
  const data = defaultData()
  data.days[DATE] = {
    date: DATE,
    tasks: [routineTask(), { id: 'own', title: 'Written by hand', done: false, time: '09:00' }],
  }
  return data
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(plan())
})

test("deleting a routine's task leaves a skip for its routine, and deleting a task written by hand leaves none", () => {
  actions.deleteTask(DATE, 'own')
  expect(getData().days[DATE].routineSkips).toBeUndefined()
  actions.deleteTask(DATE, 'training-task')
  expect(getData().days[DATE].routineSkips).toEqual(['training'])
})

test("clearing a day leaves a skip for every routine whose task was on it", () => {
  actions.clearDay(DATE)
  expect(getData().days[DATE].routineSkips).toEqual(['training'])
})

test("moving a routine's task to another date leaves a skip, and it lands there still its routine's but placed by hand", () => {
  expect(actions.moveTaskToDay(DATE, NEXT, 'training-task')).toBe(true)
  expect(getData().days[DATE].routineSkips).toEqual(['training'])
  const landed = getData().days[NEXT].tasks.find(t => t.id === 'training-task')!
  expect(landed.routineId).toBe('training')
  expect(landed.fromRoutine).toBeUndefined()
})

test("pushing a routine's task, alone or with the rest of the day, does the same", () => {
  expect(actions.pushTask(DATE, 'training-task')).toBe(true)
  expect(getData().days[DATE].routineSkips).toEqual(['training'])
  expect(getData().days[NEXT].tasks.find(t => t.id === 'training-task')?.fromRoutine).toBeUndefined()

  actions.resetForTests(plan())
  actions.rolloverUnfinished(DATE)
  expect(getData().days[DATE].routineSkips).toEqual(['training'])
  expect(getData().days[NEXT].tasks.find(t => t.id === 'training-task')?.fromRoutine).toBeUndefined()
})

test("a routine's task the next date already has stays where it is, and leaves no skip", () => {
  const data = plan()
  data.days[NEXT] = { date: NEXT, tasks: [routineTask({ id: 'tomorrows' })] }
  actions.resetForTests(data)
  actions.rolloverUnfinished(DATE)
  expect(getData().days[DATE].tasks.map(t => t.id)).toContain('training-task')
  expect(getData().days[DATE].routineSkips).toBeUndefined()
})

test("a replan or a low day that sends a routine's task on leaves a skip, and it lands placed by hand", () => {
  const replanned = applyPlan(plan(), DATE, { kind: 'shift', moves: [], tomorrow: ['training-task'], drop: [], keep: [], summary: '' }, () => 'new')
  expect(replanned.days[DATE].routineSkips).toEqual(['training'])
  expect(replanned.days[NEXT].tasks.find(t => t.id === 'training-task')?.fromRoutine).toBeUndefined()

  const lowered = applyLowDayPlan(plan(), DATE, { kind: 'low', keep: [], stay: [], tomorrow: ['training-task'], summary: '' })
  expect(lowered.days[DATE].routineSkips).toEqual(['training'])
  expect(lowered.days[NEXT].tasks.find(t => t.id === 'training-task')?.fromRoutine).toBeUndefined()
})

test('a replan that sets a routine\'s task aside keeps it on the day, and leaves no skip', () => {
  const replanned = applyPlan(plan(), DATE, { kind: 'shift', moves: [], tomorrow: [], drop: ['training-task'], keep: [], summary: '' }, () => 'new')
  expect(replanned.days[DATE].routineSkips).toBeUndefined()
  expect(replanned.days[DATE].tasks.find(t => t.id === 'training-task')?.setAside).toBe(true)
})

test('a skip is written once however many times its routine leaves', () => {
  const data = plan()
  data.days[DATE] = { ...data.days[DATE], routineSkips: ['training'] }
  actions.resetForTests(data)
  actions.deleteTask(DATE, 'training-task')
  expect(getData().days[DATE].routineSkips).toEqual(['training'])
})
