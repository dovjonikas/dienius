import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from '../store'
import { defaultData } from '../storage'
import type { AppData, Template } from '../types'

/**
 * `actions.clearDay` - see its doc comment in store/days.ts.
 *
 * The moment it exists for is a week template stamped on a Wednesday
 * afternoon, which fills two days that have already been half lived. The
 * rule it has to keep is the one this app keeps everywhere else: deleting
 * what arrived leaves it deleted. A clear that a re-open undid would be the
 * loudest possible way to break it.
 */

// 2026-09-10 is a Thursday, so the weekday map below reaches it wherever the
// suite is run.
const THURSDAY = '2026-09-10'

const WORKDAY: Template = {
  id: 'work',
  name: 'Workday',
  color: '#a7c4f5',
  blocks: [
    { id: 'b1', title: 'Commute', time: '08:00', minutes: 30 },
    { id: 'b2', title: 'Deep work', time: '09:00', minutes: 120 },
  ],
}

function withThursdayMapped(days: AppData['days'] = {}): AppData {
  const data = defaultData()
  data.templates = [WORKDAY]
  data.settings.weekdayTemplates = { 4: 'work' }
  data.days = days
  return data
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('it takes every task off the day, including the ones that are done and the ones set aside', () => {
  actions.resetForTests(
    withThursdayMapped({
      [THURSDAY]: {
        date: THURSDAY,
        tasks: [
          { id: 'a', title: 'Commute', time: '08:00', done: true },
          { id: 'b', title: 'Deep work', time: '09:00', done: false },
          { id: 'c', title: 'Dentist', time: '15:00', done: false, setAside: true },
        ],
      },
    }),
  )

  expect(actions.clearDay(THURSDAY)?.cleared).toBe(3)
  expect(getData().days[THURSDAY].tasks).toEqual([])
})

test('a cleared day stays cleared: the weekday template does not stamp itself back on', () => {
  actions.resetForTests(
    withThursdayMapped({
      [THURSDAY]: {
        date: THURSDAY,
        templateId: 'work',
        autoApplied: true,
        tasks: [
          { id: 'a', title: 'Commute', time: '08:00', done: false },
          { id: 'b', title: 'Deep work', time: '09:00', done: false },
        ],
      },
    }),
  )

  actions.clearDay(THURSDAY)
  actions.ensureDay(THURSDAY)
  expect(getData().days[THURSDAY].tasks).toEqual([])
})

/**
 * The harder half of the same promise: a day nobody has opened yet has no
 * `autoApplied`, so clearing it without writing one would leave the weekday
 * map free to stamp the whole template back on the first open.
 */
test('a day nobody had opened yet is cleared for good too', () => {
  actions.resetForTests(
    withThursdayMapped({
      [THURSDAY]: {
        date: THURSDAY,
        tasks: [{ id: 'a', title: 'Dentist', time: '15:00', done: false }],
      },
    }),
  )

  actions.clearDay(THURSDAY)
  actions.ensureDay(THURSDAY)
  expect(getData().days[THURSDAY].tasks).toEqual([])
  expect(getData().days[THURSDAY].autoApplied).toBe(true)
})

test('a repeat that had an instance here does not generate itself again', () => {
  const data = withThursdayMapped({
    '2026-09-09': {
      date: '2026-09-09',
      tasks: [{ id: 'source', title: 'Medication', time: '08:00', done: false, repeat: 'daily' }],
    },
    [THURSDAY]: {
      date: THURSDAY,
      autoApplied: true,
      tasks: [{ id: 'instance', title: 'Medication', time: '08:00', done: false, repeatOf: 'source' }],
    },
  })
  data.settings.weekdayTemplates = {}
  actions.resetForTests(data)

  actions.clearDay(THURSDAY)
  expect(getData().days[THURSDAY].repeatSkips).toEqual(['source'])
  actions.ensureDay(THURSDAY)
  expect(getData().days[THURSDAY].tasks).toEqual([])
})

/**
 * What a clear is not an opinion about. The plan goes; what somebody wrote
 * on the day, and the facts about the day itself, stay.
 */
test('it keeps the journal and the day\'s own facts, and drops the template it was planned from', () => {
  actions.resetForTests(
    withThursdayMapped({
      [THURSDAY]: {
        date: THURSDAY,
        templateId: 'work',
        dayType: 'full',
        replannedOn: '2026-09-10',
        sleepProfileId: 'late',
        away: '14:00',
        journal: 'It rained all afternoon.',
        autoApplied: true,
        tasks: [{ id: 'a', title: 'Commute', time: '08:00', done: false }],
      },
    }),
  )

  actions.clearDay(THURSDAY)
  const day = getData().days[THURSDAY]
  expect(day.journal).toBe('It rained all afternoon.')
  expect(day.sleepProfileId).toBe('late')
  expect(day.away).toBe('14:00')
  expect(day.templateId).toBeUndefined()
  expect(day.dayType).toBeUndefined()
  expect(day.replannedOn).toBeUndefined()
})

test('the undo puts the whole day back exactly as it was', () => {
  actions.resetForTests(
    withThursdayMapped({
      [THURSDAY]: {
        date: THURSDAY,
        templateId: 'work',
        autoApplied: true,
        tasks: [{ id: 'a', title: 'Commute', time: '08:00', done: true }],
      },
    }),
  )
  actions.clearDay(THURSDAY)!.undo()

  // The stamps `commit` writes on the way back are not part of what came
  // back - see ARCHITECTURE section 7, timestamps are written by diffing -
  // so the day is read for what it holds rather than compared whole.
  const day = getData().days[THURSDAY]
  expect(day.templateId).toBe('work')
  expect(day.autoApplied).toBe(true)
  expect(day.tasks.map(t => ({ id: t.id, title: t.title, time: t.time, done: t.done }))).toEqual([
    { id: 'a', title: 'Commute', time: '08:00', done: true },
  ])
})

test('a day with nothing on it reports nothing to clear rather than writing an empty day', () => {
  actions.resetForTests(withThursdayMapped())
  expect(actions.clearDay(THURSDAY)).toBeNull()
  expect(getData().days[THURSDAY]).toBeUndefined()
})
