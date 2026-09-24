import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { kindOnDate } from './dayKinds'
import { rosterApplied, routineNotes } from './shiftDay'
import type { AppData, Routine, SleepProfile, Task, Template } from './types'

/**
 * A kind of day put on a date by hand - the rail's chip, the month's paint -
 * over what the roster gave it, and the other way round. The owner's report
 * of 2026-09-23: a free day by the roster, a shift put on it by hand, and
 * sometimes both days' blocks on the date, or the free day's not gone.
 *
 * Every case here goes through the store's own actions, the way a press
 * does, and every name and time is invented. Rotating shifts,
 * docs/RESEARCH-SHIFTS.md sections 2.4, 6.2, 6.3 and 10.
 */

process.env.TZ = 'Europe/Vilnius'

test("this file runs on Lithuania's clock: 25 October 2026 has twenty-five hours", () => {
  expect((new Date(2026, 9, 26).getTime() - new Date(2026, 9, 25).getTime()) / 3_600_000).toBe(25)
})

const PROFILES: SleepProfile[] = [
  { id: 'default', name: 'Nights', window: { start: '23:00', end: '07:00' } },
  { id: 'early', name: 'Early', window: { start: '22:00', end: '05:30' } },
  { id: 'daytime', name: 'Daytime', window: { start: '08:30', end: '14:30' } },
]

function kind(id: string, name: string, letter: string, order: number, over: Partial<Template>): Template {
  return { id, name, color: '#a7c4f5', blocks: [], dayKind: { letter, order }, ...over }
}

const DAY = kind('day', 'Day shift', 'D', 0, {
  type: 'shift',
  sleepProfileId: 'early',
  blocks: [
    { id: 'd-travel', time: '06:00', title: 'Travel in', minutes: 45, category: 'commute' },
    { id: 'd-shift', time: '07:00', title: 'Shift', minutes: 720, category: 'core', core: true, unbounded: true },
    { id: 'd-lunch', time: '12:00', title: 'Lunch', minutes: 30, category: 'meal', mealType: 'lunch' },
  ],
})
const FREE = kind('free', 'Free day', 'L', 1, {
  type: 'full',
  sleepProfileId: 'default',
  blocks: [
    { id: 'l-breakfast', time: '09:00', title: 'Long breakfast', minutes: 45, category: 'meal', mealType: 'breakfast' },
    { id: 'l-outside', time: '14:00', title: 'Something outside', minutes: 90, category: 'health' },
    { id: 'l-late', time: '22:30', title: 'Late reading', minutes: 30, category: 'personal' },
  ],
})
const NIGHT = kind('night', 'Night shift', 'N', 2, {
  type: 'night',
  sleepProfileId: 'daytime',
  blocks: [
    { id: 'n-shift', time: '19:00', title: 'Shift', minutes: 720, category: 'core', core: true, unbounded: true },
    { id: 'n-meal', time: '01:00', title: 'Night meal', minutes: 30, category: 'meal', mealType: 'dinner', afterMidnight: true },
    { id: 'n-home', time: '07:15', title: 'Travel home', minutes: 45, category: 'commute', afterMidnight: true },
  ],
})
/** An ordinary template, not a kind. */
const PLAIN: Template = {
  id: 'plain',
  name: 'Errands',
  color: '#a7e3bd',
  blocks: [{ id: 'p-shop', time: '10:00', title: 'The big shop', minutes: 60, category: 'personal' }],
}

/** An evening routine on the free day, at a time the day shift's earlier sleep runs into, and the free day's does not. */
const WALK: Routine = {
  id: 'walk',
  title: 'Evening walk',
  category: 'health',
  minutes: 30,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  times: { free: '21:45' },
}

const GYM: Routine = {
  id: 'gym',
  title: 'Gym',
  category: 'health',
  minutes: 60,
  kindMinutes: { day: 45, free: 90, night: 60 },
  core: true,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  times: { day: '20:10', free: '11:30', night: '15:30' },
}

// A week, Wednesday to Tuesday, on the same shape the owner's roster has.
const TUE = '2026-09-22'
const WED = '2026-09-23'
const THU = '2026-09-24'
const FRI = '2026-09-25'
const SAT = '2026-09-26'
const MON = '2026-09-28'
const TUE_NEXT = '2026-09-29'
const ROSTER: Record<string, string> = { [TUE]: 'free', [WED]: 'free', [THU]: 'day', [FRI]: 'day', [SAT]: 'free', [MON]: 'night', [TUE_NEXT]: 'night' }

function plan(): AppData {
  const data = defaultData()
  data.settings = { ...data.settings, sleepProfiles: PROFILES }
  data.templates = [DAY, FREE, NIGHT, PLAIN]
  data.routines = [GYM, WALK]
  return data
}

const titles = (date: string) => (getData().days[date]?.tasks ?? []).map(t => t.title).sort()
const task = (date: string, title: string): Task | undefined => getData().days[date]?.tasks.find(t => t.title === title)
const nightTasks = (date: string, of: string) => (getData().days[date]?.tasks ?? []).filter(t => t.nightOf === of).map(t => t.title).sort()

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 22, 9, 0))
  actions.resetForTests(plan())
  actions.applyRoster(ROSTER)
})

afterEach(() => {
  vi.useRealTimers()
})

test('the roster lays the week: each date its kind, the gym at that kind\'s time and length, and the nights on the mornings after', () => {
  expect(titles(WED)).toEqual(['Evening walk', 'Gym', 'Late reading', 'Long breakfast', 'Something outside'])
  expect(task(WED, 'Gym')).toMatchObject({ time: '11:30', minutes: 90, core: true })
  expect(task(THU, 'Gym')).toMatchObject({ time: '20:10', minutes: 45 })
  expect(task(MON, 'Gym')).toMatchObject({ time: '15:30', minutes: 60 })
  expect(nightTasks(TUE_NEXT, MON)).toEqual(['Night meal', 'Travel home'])
})

// --- a) a free day made a day shift by hand -------------------------------------------

test('a free day given the day shift by hand holds the day shift\'s blocks only, its gym at the shift\'s time, and the days around it follow', () => {
  // Tuesday's late reading sits at 22:30, free while Wednesday wakes from the
  // free day's sleep at 23:00.
  expect(task(TUE, 'Late reading')).toMatchObject({ time: '22:30' })

  actions.stamp({ [WED]: DAY.id })

  expect(kindOnDate(getData(), WED)?.id).toBe('day')
  expect(titles(WED)).toEqual(['Evening walk', 'Gym', 'Lunch', 'Shift', 'Travel in'])
  expect(task(WED, 'Gym')).toMatchObject({ time: '20:10', minutes: 45, core: true })
  // Every task on the day is the day shift's or the gym's - nothing of the
  // free day's is left, and nothing is doubled.
  const origins = getData().days[WED].tasks.map(t => t.origin?.type === 'template' ? t.origin.sourceId : t.routineId)
  expect(origins.sort()).toEqual(['day', 'day', 'day', 'gym', 'walk'])
  // The night before now ends in the day shift's sleep from 22:00, so
  // Tuesday's walk at 21:45 runs into it: the day says so and gives it no
  // time rather than guessing one. Its gym keeps its free-day time.
  expect(task(TUE, 'Gym')).toMatchObject({ time: '11:30', minutes: 90 })
  expect(task(TUE, 'Evening walk')?.time).toBeUndefined()
  expect(routineNotes(getData(), TUE).get('walk')).toBe('Runs into sleep')
})

// --- b) a free day made a night by hand ---------------------------------------------

test('a free day given the night shift by hand takes the night\'s blocks, and its hours after midnight land on the next day only', () => {
  actions.stamp({ [WED]: NIGHT.id })

  expect(titles(WED)).toEqual(['Evening walk', 'Gym', 'Shift'])
  expect(task(WED, 'Gym')).toMatchObject({ time: '15:30', minutes: 60 })
  // Thursday keeps its own day shift, and holds the night's meal and the
  // journey home as last night's - once each, and nowhere else.
  expect(nightTasks(THU, WED)).toEqual(['Night meal', 'Travel home'])
  expect(titles(THU)).toEqual(['Evening walk', 'Gym', 'Lunch', 'Night meal', 'Shift', 'Travel home', 'Travel in'])
  expect(nightTasks(FRI, WED)).toEqual([])
  expect(getData().days[WED].tasks.filter(t => t.nightOf)).toEqual([])
})

// --- c) a shift made a free day by hand -----------------------------------------------

test('a day shift made a free day by hand loses the shift\'s blocks, and nothing is doubled', () => {
  actions.stamp({ [THU]: FREE.id })

  expect(titles(THU)).toEqual(['Evening walk', 'Gym', 'Late reading', 'Long breakfast', 'Something outside'])
  expect(task(THU, 'Gym')).toMatchObject({ time: '11:30', minutes: 90 })
  expect(getData().days[THU].tasks.filter(t => t.title === 'Shift')).toEqual([])
})

test('a night made a free day by hand takes its hours after midnight off the next morning', () => {
  expect(nightTasks(TUE_NEXT, MON)).toEqual(['Night meal', 'Travel home'])

  actions.stamp({ [MON]: FREE.id })

  expect(titles(MON)).toEqual(['Evening walk', 'Gym', 'Late reading', 'Long breakfast', 'Something outside'])
  expect(nightTasks(TUE_NEXT, MON)).toEqual([])
  // Tuesday is still its own night shift, with its own night on Wednesday.
  expect(titles(TUE_NEXT)).toEqual(['Evening walk', 'Gym', 'Shift'])
  expect(nightTasks('2026-09-30', TUE_NEXT)).toEqual(['Night meal', 'Travel home'])
})

// --- d) the roster over a hand stamp ---------------------------------------------------

test('the roster laid over a date stamped by hand says what will change, and a tick survives the same kind laid again - and another kind laid over it', () => {
  actions.stamp({ [WED]: DAY.id })
  actions.toggleTask(WED, task(WED, 'Shift')!.id)

  // The same kind again: the preview lists nothing for it, and the tick stays.
  const same = rosterApplied(getData(), { [WED]: DAY.id }, TUE)
  expect(same.composed.map(c => c.date)).toEqual([])
  actions.applyRoster({ [WED]: DAY.id })
  expect(task(WED, 'Shift')).toMatchObject({ done: true })

  // The free day again: the preview names Wednesday, and Apply makes it.
  const back = rosterApplied(getData(), { [WED]: FREE.id }, TUE)
  expect(back.composed.map(c => c.date)).toEqual([WED])
  actions.applyRoster({ [WED]: FREE.id })
  // The ticked shift stays, as what the day did - the shift brief of 2026-09-25, stage 4.
  expect(titles(WED)).toEqual(['Evening walk', 'Gym', 'Late reading', 'Long breakfast', 'Shift', 'Something outside'])
  expect(task(WED, 'Shift')).toMatchObject({ done: true })
})

// --- e) the same template twice ---------------------------------------------------------

test('the same kind put on a date a second time doubles nothing, and keeps a tick', () => {
  actions.stamp({ [WED]: DAY.id })
  actions.toggleTask(WED, task(WED, 'Lunch')!.id)

  actions.stamp({ [WED]: DAY.id })

  expect(titles(WED)).toEqual(['Evening walk', 'Gym', 'Lunch', 'Shift', 'Travel in'])
  expect(task(WED, 'Lunch')).toMatchObject({ done: true })
})

test('the same night put on a date a second time doubles nothing on the morning after either', () => {
  actions.stamp({ [WED]: NIGHT.id })
  actions.stamp({ [WED]: NIGHT.id })

  expect(titles(WED)).toEqual(['Evening walk', 'Gym', 'Shift'])
  expect(nightTasks(THU, WED)).toEqual(['Night meal', 'Travel home'])
})

// --- f) an ordinary template and a kind, over each other ------------------------------

test('an ordinary template put on a free day takes the free day off it, blocks and gym, and the date is no kind', () => {
  actions.stamp({ [WED]: PLAIN.id })

  expect(kindOnDate(getData(), WED)).toBeUndefined()
  expect(titles(WED)).toEqual(['The big shop'])
})

test('a kind put on a date with an ordinary template takes that template off it', () => {
  actions.stamp({ [WED]: PLAIN.id })
  actions.stamp({ [WED]: DAY.id })

  expect(titles(WED)).toEqual(['Evening walk', 'Gym', 'Lunch', 'Shift', 'Travel in'])
})

// --- what two devices can leave, and an open heals ---------------------------------------

test('a date holding two tasks of one block - the way two devices composing it apart leave it - is one of each again when it is opened', () => {
  // The other device's copy of Wednesday's free day, arrived by sync: the
  // same blocks under other ids, one of them ticked there.
  const data = getData()
  const twins = data.days[WED].tasks.map(t => ({ ...t, id: `${t.id}-twin`, done: t.title === 'Long breakfast' }))
  actions.resetForTests({ ...data, days: { ...data.days, [WED]: { ...data.days[WED], tasks: [...data.days[WED].tasks, ...twins] } } })
  expect(getData().days[WED].tasks).toHaveLength(10)

  actions.ensureDay(WED)

  expect(titles(WED)).toEqual(['Evening walk', 'Gym', 'Late reading', 'Long breakfast', 'Something outside'])
  // The ticked twin is the one kept.
  expect(task(WED, 'Long breakfast')).toMatchObject({ done: true })
})

test('what a hand wrote on a date stays through every change of kind', () => {
  actions.addTask(WED, 'Call the bank', '13:00')
  actions.stamp({ [WED]: DAY.id })
  expect(task(WED, 'Call the bank')).toMatchObject({ time: '13:00' })
  actions.stamp({ [WED]: NIGHT.id })
  expect(task(WED, 'Call the bank')).toMatchObject({ time: '13:00' })
  actions.stamp({ [WED]: FREE.id })
  expect(task(WED, 'Call the bank')).toMatchObject({ time: '13:00' })
  expect(titles(WED)).toEqual(['Call the bank', 'Evening walk', 'Gym', 'Late reading', 'Long breakfast', 'Something outside'])
})

test('a block that runs into the next day\'s new sleep is not moved: only a routine is measured', () => {
  actions.stamp({ [WED]: DAY.id })
  // Tuesday's late reading is a block, not a routine, so it stays where the
  // free day put it, whatever Wednesday's sleep does now; the gym is clear.
  expect(task(TUE, 'Late reading')).toMatchObject({ time: '22:30' })
  expect(routineNotes(getData(), TUE).has('gym')).toBe(false)
})

test('the same ordinary template put on a date a second time doubles nothing, and keeps a tick', () => {
  actions.stamp({ [WED]: PLAIN.id })
  actions.toggleTask(WED, task(WED, 'The big shop')!.id)

  actions.stamp({ [WED]: PLAIN.id })

  expect(titles(WED)).toEqual(['The big shop'])
  expect(task(WED, 'The big shop')).toMatchObject({ done: true })
})
