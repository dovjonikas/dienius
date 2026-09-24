import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { kindOnDate, resolveAfterNight } from './dayKinds'
import { rosterApplied } from './shiftDay'
import { rosterPreview } from './rosterPreview'
import type { AppData, Routine, SleepProfile, Template } from './types'

/**
 * A kind of day after a night - docs/RESEARCH-SHIFTS.md section 2.6. A rest
 * day after a night shift is not the rest day after a day shift: the morning
 * is the night's, the sleep is the day's, the gym is later. The owner asked
 * (2026-09-23) for a way that does not make the roster carry a second
 * letter to remember: the rest day's template names the kind it becomes
 * after a night, and every door a kind comes through - the roster, the
 * templates file, a hand - resolves it, and says so. When the night before
 * a date arrives or goes, the date follows.
 *
 * Every name and time here is invented.
 */

process.env.TZ = 'Europe/Vilnius'

test("this file runs on Lithuania's clock: 25 October 2026 has twenty-five hours", () => {
  expect((new Date(2026, 9, 26).getTime() - new Date(2026, 9, 25).getTime()) / 3_600_000).toBe(25)
})

const PROFILES: SleepProfile[] = [
  { id: 'default', name: 'Nights', window: { start: '23:00', end: '07:00' } },
  { id: 'daytime', name: 'Daytime', window: { start: '08:30', end: '14:30' } },
]

function kind(id: string, name: string, letter: string, order: number, over: Partial<Template>): Template {
  return { id, name, color: '#a7c4f5', blocks: [], dayKind: { letter, order }, ...over }
}

const DAY = kind('day', 'Day shift', 'D', 0, {
  type: 'shift',
  blocks: [{ id: 'd-shift', time: '07:00', title: 'Shift', minutes: 720, category: 'core', core: true, unbounded: true }],
})
const NIGHT = kind('night', 'Night shift', 'N', 1, {
  type: 'night',
  sleepProfileId: 'daytime',
  blocks: [
    { id: 'n-shift', time: '19:00', title: 'Shift', minutes: 720, category: 'core', core: true, unbounded: true },
    { id: 'n-home', time: '07:15', title: 'Travel home', minutes: 45, category: 'commute', afterMidnight: true },
  ],
})
/** The rest day, which after a night is the after-nights kind. */
const REST = kind('rest', 'Rest day', 'L', 2, {
  type: 'rest',
  dayKind: { letter: 'L', order: 2, afterNight: 'after' },
  blocks: [{ id: 'l-breakfast', time: '09:00', title: 'Long breakfast', minutes: 45, category: 'meal', mealType: 'breakfast' }],
})
const AFTER = kind('after', 'After nights', 'P', 3, {
  type: 'rest',
  blocks: [{ id: 'p-breakfast', time: '16:00', title: 'Late breakfast', minutes: 30, category: 'meal', mealType: 'breakfast' }],
})

const GYM: Routine = {
  id: 'gym',
  title: 'Gym',
  category: 'health',
  minutes: 60,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  times: { day: '20:10', rest: '11:30', after: '17:00' },
}

const TUE = '2026-09-22'
const WED = '2026-09-23'
const THU = '2026-09-24'
const FRI = '2026-09-25'
const SAT = '2026-09-26'

function plan(over: Partial<AppData> = {}): AppData {
  const data = defaultData()
  data.templates = [DAY, NIGHT, REST, AFTER]
  data.routines = [GYM]
  data.settings = { ...data.settings, sleepProfiles: PROFILES }
  return { ...data, ...over }
}

const kindOn = (date: string) => kindOnDate(getData(), date)?.name
const gymAt = (date: string) => getData().days[date]?.tasks.find(t => t.routineId === 'gym')?.time
const titles = (date: string) => (getData().days[date]?.tasks ?? []).map(t => t.title).sort()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 22, 9, 0))
  localStorage.clear()
  actions.resetForTests(plan())
})

afterEach(() => {
  vi.useRealTimers()
})

// --- the rule itself ----------------------------------------------------------------

test('a kind after a night is the kind it names; after anything else, or after nothing, it is itself', () => {
  const templates = [DAY, NIGHT, REST, AFTER]
  expect(resolveAfterNight(templates, REST, NIGHT)).toBe(AFTER)
  expect(resolveAfterNight(templates, REST, DAY)).toBe(REST)
  expect(resolveAfterNight(templates, REST, undefined)).toBe(REST)
  // The after-nights kind names nothing of its own, so after a night it stays.
  expect(resolveAfterNight(templates, AFTER, NIGHT)).toBe(AFTER)
  // A day shift names nothing, and is itself after a night.
  expect(resolveAfterNight(templates, DAY, NIGHT)).toBe(DAY)
})

test('the way back is only taken when asked, and only where one kind stands in for exactly one other', () => {
  const templates = [DAY, NIGHT, REST, AFTER]
  expect(resolveAfterNight(templates, AFTER, DAY)).toBe(AFTER)
  expect(resolveAfterNight(templates, AFTER, DAY, { reverse: true })).toBe(REST)
  expect(resolveAfterNight(templates, AFTER, NIGHT, { reverse: true })).toBe(AFTER)
  // Two kinds naming the same after-nights kind: the way back is not guessed.
  const DAY_TOO = { ...DAY, dayKind: { letter: 'D', order: 0, afterNight: 'after' } }
  expect(resolveAfterNight([DAY_TOO, NIGHT, REST, AFTER], AFTER, DAY, { reverse: true })).toBe(AFTER)
  // A kind naming itself, or a template that is no kind, names nothing.
  const SELF = { ...REST, dayKind: { letter: 'L', order: 2, afterNight: 'rest' } }
  expect(resolveAfterNight([DAY, NIGHT, SELF, AFTER], SELF, NIGHT)).toBe(SELF)
  const GONE = { ...AFTER, dayKind: undefined }
  expect(resolveAfterNight([DAY, NIGHT, REST, GONE], REST, NIGHT)).toBe(REST)
})

// --- the roster -----------------------------------------------------------------------

test('a roster of nights then rest days makes the first rest day the after-nights kind, composed as it, and the second a rest day', () => {
  actions.applyRoster({ [WED]: 'night', [THU]: 'night', [FRI]: 'rest', [SAT]: 'rest' })

  expect([WED, THU, FRI, SAT].map(kindOn)).toEqual(['Night shift', 'Night shift', 'After nights', 'Rest day'])
  // The morning after the last night holds that night's journey home and the after-nights day, with the gym at its time.
  expect(titles(FRI)).toEqual(['Gym', 'Late breakfast', 'Travel home'])
  expect(getData().days[FRI].tasks.find(t => t.title === 'Travel home')).toMatchObject({ nightOf: THU, time: '07:15' })
  expect(gymAt(FRI)).toBe('17:00')
  expect(gymAt(SAT)).toBe('11:30')
})

test('the preview says which date is read as the kind after a night, and from which', () => {
  const preview = rosterPreview(getData(), { [WED]: 'night', [THU]: 'rest', [FRI]: 'rest' }, TUE)
  const dates = preview.weeks.flatMap(w => w.dates)
  expect(dates.map(d => [d.date, d.letter, d.resolved?.why ?? '', d.resolved?.from.name ?? ''])).toEqual([
    [WED, 'N', '', ''],
    [THU, 'P', 'after-night', 'Rest day'],
    [FRI, 'L', '', ''],
  ])
  const applied = rosterApplied(getData(), { [WED]: 'night', [THU]: 'rest' }, TUE)
  expect(applied.composed.find(c => c.date === THU)?.resolved).toMatchObject({ why: 'after-night', from: REST })
})

test('applying the same roster again changes nothing: the after-nights day is what the rest day after a night already is', () => {
  actions.applyRoster({ [WED]: 'night', [THU]: 'rest' })
  const after = getData()
  actions.applyRoster({ [WED]: 'night', [THU]: 'rest' })
  expect(getData()).toBe(after)
})

test('the after-nights kind written on the roster after a day shift is taken as written', () => {
  actions.applyRoster({ [WED]: 'day', [THU]: 'after' })
  expect(kindOn(THU)).toBe('After nights')
})

// --- a hand ---------------------------------------------------------------------------

test('a rest day put by hand on the date after a night is the after-nights kind', () => {
  actions.applyRoster({ [WED]: 'night' })
  actions.stamp({ [THU]: 'rest' })
  expect(kindOn(THU)).toBe('After nights')
  expect(gymAt(THU)).toBe('17:00')
})

test('a night put before a rest day turns that rest day into the after-nights kind, and the day after it stays a rest day', () => {
  actions.applyRoster({ [WED]: 'day', [THU]: 'rest', [FRI]: 'rest' })
  expect(kindOn(THU)).toBe('Rest day')

  actions.stamp({ [WED]: 'night' })
  expect([WED, THU, FRI].map(kindOn)).toEqual(['Night shift', 'After nights', 'Rest day'])
  expect(titles(THU)).toEqual(['Gym', 'Late breakfast', 'Travel home'])
  expect(gymAt(THU)).toBe('17:00')
})

test('when the night before an after-nights day goes, the day is a rest day again', () => {
  actions.applyRoster({ [WED]: 'night', [THU]: 'rest' })
  expect(kindOn(THU)).toBe('After nights')

  actions.stamp({ [WED]: 'day' })
  expect([WED, THU].map(kindOn)).toEqual(['Day shift', 'Rest day'])
  expect(titles(THU)).toEqual(['Gym', 'Long breakfast'])
  expect(gymAt(THU)).toBe('11:30')
})

test('a date behind today is not turned by a change before it', () => {
  // Yesterday an after-nights day by hand, over a night the day before.
  actions.stamp({ ['2026-09-20']: 'night', ['2026-09-21']: 'rest' })
  expect(kindOn('2026-09-21')).toBe('After nights')
  actions.stamp({ ['2026-09-20']: 'day' })
  expect(kindOn('2026-09-21')).toBe('After nights')
})
