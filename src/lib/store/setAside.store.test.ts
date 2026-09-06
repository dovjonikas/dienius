import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from '../store'
import { defaultData } from '../storage'
import type { Task } from '../types'

/**
 * Setting a block aside and bringing it back, from the store's side.
 *
 * The rule the whole thing rests on: nothing an interruption touches leaves
 * the day. A block set aside is still on the day, marked, and one press
 * puts it back - see widgets/day-plan/setAside.ts for where "back" is, and
 * DECISIONS "Set aside, not deleted" for why it is not simply deleted.
 */

const DATE = '2026-09-16'
const NEXT = '2026-09-17'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function dayWith(tasks: Partial<Task>[]) {
  const data = defaultData()
  data.days[DATE] = {
    date: DATE,
    tasks: tasks.map((t, i) => ({ id: `t${i + 1}`, title: `Task ${i + 1}`, done: false, ...t })),
  }
  actions.resetForTests(data)
}

const tasks = (date = DATE) => getData().days[date]?.tasks ?? []

test('a block set aside stays on the day, marked, and keeps the time it had', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60 }])
  actions.setTaskAside(DATE, 't1')

  expect(tasks()).toHaveLength(1)
  expect(tasks()[0]).toMatchObject({ title: 'Gym', time: '18:00', minutes: 60, setAside: true })
})

test('setting aside one that is already aside changes nothing, so the same press twice is one press', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60, setAside: true }])
  const before = getData()
  actions.setTaskAside(DATE, 't1')
  expect(getData().days[DATE]).toEqual(before.days[DATE])
})

test('coming back today puts it at the offered time and takes the mark off', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60, setAside: true }])
  actions.returnSetAside(DATE, { taskId: 't1', time: '20:30', minutes: 60, shortened: false, tomorrow: false, line: '20:30 - 21:30' })

  expect(tasks()[0]).toMatchObject({ title: 'Gym', time: '20:30', minutes: 60 })
  expect(tasks()[0].setAside).toBeUndefined()
})

test('coming back shorter is the shorter length, said once and stored once', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 120, setAside: true }])
  actions.returnSetAside(DATE, { taskId: 't1', time: '22:00', minutes: 60, wasMinutes: 120, shortened: true, tomorrow: false, line: 'x' })

  expect(tasks()[0]).toMatchObject({ time: '22:00', minutes: 60 })
})

test('tomorrow moves it to the next day at the time it had, and off today', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60, setAside: true }])
  actions.returnSetAside(DATE, { taskId: 't1', shortened: false, tomorrow: true, line: 'Tomorrow, at the time it had' })

  expect(tasks()).toEqual([])
  expect(tasks(NEXT)).toHaveLength(1)
  expect(tasks(NEXT)[0]).toMatchObject({ title: 'Gym', time: '18:00', minutes: 60 })
  expect(tasks(NEXT)[0].setAside).toBeUndefined()
})

test('a block tomorrow already has by identity is not added a second time', () => {
  const data = defaultData()
  const gym = { id: 't1', title: 'Gym', time: '18:00', minutes: 60, done: false, setAside: true, origin: { type: 'template' as const, sourceId: 'w', blockId: 'b1' } }
  data.days[DATE] = { date: DATE, tasks: [gym] }
  data.days[NEXT] = { date: NEXT, tasks: [{ ...gym, id: 'twin', setAside: undefined }] }
  actions.resetForTests(data)

  actions.returnSetAside(DATE, { taskId: 't1', shortened: false, tomorrow: true, line: 'x' })
  expect(tasks(NEXT).map(t => t.id)).toEqual(['twin'])
})

test('bringing back one that is not waiting does nothing at all', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60 }])
  const before = getData()
  actions.returnSetAside(DATE, { taskId: 't1', time: '20:00', minutes: 60, shortened: false, tomorrow: false, line: 'x' })
  expect(getData().days[DATE]).toEqual(before.days[DATE])
})

test('the undo puts it back exactly as it was waiting', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 120, setAside: true }])
  const undo = actions.returnSetAside(DATE, { taskId: 't1', time: '22:00', minutes: 60, wasMinutes: 120, shortened: true, tomorrow: false, line: 'x' })
  undo?.()

  expect(tasks()[0]).toMatchObject({ time: '18:00', minutes: 120, setAside: true })
})

test('the undo of a tomorrow brings it back to today and off tomorrow', () => {
  dayWith([{ title: 'Gym', time: '18:00', minutes: 60, setAside: true }])
  const undo = actions.returnSetAside(DATE, { taskId: 't1', shortened: false, tomorrow: true, line: 'x' })
  undo?.()

  expect(tasks()).toHaveLength(1)
  expect(tasks()[0].setAside).toBe(true)
  expect(tasks(NEXT)).toEqual([])
})
