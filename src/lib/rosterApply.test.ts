import { beforeEach, expect, test } from 'vitest'
import { actions, getData, onStateCommitted } from './store'
import { defaultData } from './storage'
import { addDays, todayKey } from './dates'
import type { AppData, Routine, Template } from './types'

/**
 * Applying a roster, and every other door a kind of day arrives through -
 * rotating shifts, v2.29 stage 7, and docs/RESEARCH-SHIFTS.md section 6.2.
 *
 * Applying is one commit over every date the draft holds, it is idempotent,
 * and the undo puts the plan back. And a kind means the same day whichever
 * door it came through: the month's stamp, the rail's chip and the weekday map
 * all compose it, or a kind stamped from one of them would arrive with its
 * blocks and none of its routines. Every name here is a generic one.
 */

const KIND = (id: string, name: string, letter: string, order: number, blocks: Template['blocks'] = []): Template =>
  ({ id, name, color: '#a7c4f5', blocks, dayKind: { letter, order } }) as Template

const TRAINING = (times: Record<string, string>): Routine =>
  ({ id: 'gym', title: 'Training', minutes: 60, weekdays: [0, 1, 2, 3, 4, 5, 6], times }) as Routine

function plan(over: Partial<AppData> = {}): AppData {
  const data = defaultData()
  data.templates = [
    KIND('day', 'Day shift', 'D', 0, [{ id: 'shift', title: 'On shift', time: '07:00', minutes: 480, category: 'core' }]),
    KIND('rest', 'Rest day', 'R', 1),
    { id: 'plain', name: 'Working day', color: '#a7e3bd', blocks: [{ id: 'b', title: 'Deep work', time: '09:00', minutes: 120 }] } as Template,
  ]
  data.routines = [TRAINING({ day: '17:00', rest: '10:00' })]
  return { ...data, ...over }
}

const tomorrow = () => addDays(todayKey(), 1)
const titles = (date: string) => (getData().days[date]?.tasks ?? []).map(t => t.title)

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(plan())
})

test('applying a roster stamps each date and composes its routines', () => {
  const date = tomorrow()
  actions.applyRoster({ [date]: 'day' })

  expect(getData().days[date].templateId).toBe('day')
  expect(titles(date)).toEqual(['On shift', 'Training'])
  expect(getData().days[date].tasks.find(t => t.title === 'Training')).toMatchObject({ time: '17:00', minutes: 60, routineId: 'gym' })
})

test('applying the same roster again leaves the plan exactly as it is', () => {
  const date = tomorrow()
  actions.applyRoster({ [date]: 'day' })
  const after = getData()

  actions.applyRoster({ [date]: 'day' })
  expect(getData()).toBe(after)
})

test('applying the same roster again writes nothing at all, so nothing syncs for it', () => {
  const date = tomorrow()
  actions.applyRoster({ [date]: 'day' })

  let writes = 0
  const off = onStateCommitted(() => writes++)
  actions.applyRoster({ [date]: 'day' })
  off()
  expect(writes).toBe(0)
})

test('the undo puts every day back as it was', () => {
  const date = tomorrow()
  const before = getData()
  const { undo } = actions.applyRoster({ [date]: 'day', [addDays(date, 1)]: 'rest' })
  expect(getData().days[date]).toBeDefined()

  undo()
  // The days as they were. Everything else about the plan is untouched by an
  // apply; a commit stamps entities for sync, so the whole object is not the
  // same object it was.
  expect(getData().days).toEqual(before.days)
})

test("a date behind today is not in a roster's reach", () => {
  const yesterday = addDays(todayKey(), -1)
  actions.applyRoster({ [yesterday]: 'day' })
  expect(getData().days[yesterday]).toBeUndefined()
})

test("the month's stamp and the rail's chip bring a kind's routines with it", () => {
  const date = tomorrow()
  actions.stamp({ [date]: 'day' })
  expect(titles(date)).toEqual(['On shift', 'Training'])

  // Stamping another kind over it takes the first kind's tasks and gives the
  // second kind's, routines and all.
  actions.stamp({ [date]: 'rest' })
  expect(titles(date)).toEqual(['Training'])
  expect(getData().days[date].tasks[0]).toMatchObject({ time: '10:00' })

  // And taking the kind off takes its routines with it.
  actions.stamp({ [date]: null })
  expect(titles(date)).toEqual([])
})

test('a stamp of a template that is not a kind is the stamp it always was', () => {
  const date = tomorrow()
  actions.stamp({ [date]: 'plain' })
  expect(titles(date)).toEqual(['Deep work'])
})

test('a kind stamped on a day that is over still composes, because a hand put it there', () => {
  const yesterday = addDays(todayKey(), -1)
  actions.stamp({ [yesterday]: 'day' })
  expect(titles(yesterday)).toEqual(['On shift', 'Training'])
})

test('the weekday map brings the routines too, the first time a day is opened', () => {
  const date = addDays(todayKey(), 2)
  actions.setWeekdayTemplate(new Date(`${date}T12:00:00`).getDay(), 'day')
  actions.ensureDay(date)

  expect(getData().days[date].templateId).toBe('day')
  expect(titles(date)).toEqual(['On shift', 'Training'])
})

// --- a routine that changed, and the days already stamped from it - section 6.4 ----------------

test('the days ahead follow a routine that changed, and the days behind are never touched', () => {
  const yesterday = addDays(todayKey(), -1)
  const ahead = tomorrow()
  actions.applyRoster({ [ahead]: 'day' })
  actions.stamp({ [yesterday]: 'day' })
  expect(getData().days[ahead].tasks.find(t => t.routineId === 'gym')).toMatchObject({ time: '17:00' })

  actions.updateRoutine('gym', { title: 'Training', minutes: 90, weekdays: [0, 1, 2, 3, 4, 5, 6], times: { day: '18:00', rest: '10:00' } })
  const { undo } = actions.followRoutines()

  expect(getData().days[ahead].tasks.find(t => t.routineId === 'gym')).toMatchObject({ time: '18:00', minutes: 90 })
  // A lived day says what it was.
  expect(getData().days[yesterday].tasks.find(t => t.routineId === 'gym')).toMatchObject({ time: '17:00' })

  undo()
  expect(getData().days[ahead].tasks.find(t => t.routineId === 'gym')).toMatchObject({ time: '17:00' })
})

test('an instance moved by hand keeps where it was put', () => {
  const ahead = tomorrow()
  actions.applyRoster({ [ahead]: 'day' })
  const task = getData().days[ahead].tasks.find(t => t.routineId === 'gym')!
  actions.setTaskTime(ahead, task.id, '20:00')

  actions.updateRoutine('gym', { title: 'Training', minutes: 60, weekdays: [0, 1, 2, 3, 4, 5, 6], times: { day: '18:00' } })
  actions.followRoutines()

  expect(getData().days[ahead].tasks.find(t => t.routineId === 'gym')).toMatchObject({ time: '20:00' })
})
