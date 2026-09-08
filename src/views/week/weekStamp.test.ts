import { expect, test } from 'vitest'
import { planWeekStamp, weekStampMessage } from './weekStamp'
import { defaultData } from '../../lib/storage'
import { addDays, todayKey, weekOf } from '../../lib/dates'

const WEEK = weekOf('2026-09-02')
const [MON, TUE, WED, THU, FRI, SAT, SUN] = WEEK
/** Every weekday, so nothing in these tests turns on which days the map names. */
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

function withMapping(weekdays: number[], templateId: string) {
  const data = defaultData()
  for (const w of weekdays) data.settings.weekdayTemplates[w] = templateId
  return data
}

/**
 * Two rules meet in this plan, and the day the stamp is made from is given to
 * it rather than read off the clock inside it - a fixture week written as
 * literal dates would otherwise pass this morning and fail the morning those
 * dates went by.
 *
 * The first rule is the owner's: "if you put it in mid-week, then the week
 * template should start from the day you put it in, and not put anything on
 * the days already past." The second is older: one press has to be safe to
 * press by accident, so the plan never names a day that already carries a
 * template, whatever the weekday map says about it - a deliberate stamp
 * outranks a standing rule, the same way ensureDay treats it.
 */
test('stamping a week from a Wednesday fills Wednesday to Sunday and leaves Monday and Tuesday alone', () => {
  const plan = planWeekStamp(WEEK, withMapping(ALL_WEEKDAYS, 'work'), WED)
  expect(Object.keys(plan.stamps).sort()).toEqual([WED, THU, FRI, SAT, SUN])
  expect(plan.stamps[MON]).toBeUndefined()
  expect(plan.stamps[TUE]).toBeUndefined()
  // Only the days it could ever act on are counted, so the bar's own decision
  // about whether to draw the button reads the same rule.
  expect(plan.mapped).toBe(5)
})

test('the day being stamped from is one of the days stamped, not the first one skipped', () => {
  const plan = planWeekStamp(WEEK, withMapping(ALL_WEEKDAYS, 'work'), THU)
  expect(plan.stamps[THU]).toBe('work')
})

test('stamping from the Monday fills all seven', () => {
  const plan = planWeekStamp(WEEK, withMapping(ALL_WEEKDAYS, 'work'), MON)
  expect(Object.keys(plan.stamps)).toHaveLength(7)
  expect(plan.mapped).toBe(7)
})

test('a week wholly in the past changes nothing at all, and has nothing the button could ever do', () => {
  const plan = planWeekStamp(WEEK, withMapping(ALL_WEEKDAYS, 'work'), addDays(SUN, 1))
  expect(plan.stamps).toEqual({})
  expect(plan.mapped).toBe(0)
})

test('an empty day that is already past is still left empty - what did not happen did not happen', () => {
  const data = withMapping(ALL_WEEKDAYS, 'work')
  data.days[MON] = { date: MON, tasks: [] }
  const plan = planWeekStamp(WEEK, data, WED)
  expect(plan.stamps[MON]).toBeUndefined()
})

test('a day that already has a template of its own is left alone wherever it falls', () => {
  const data = withMapping(ALL_WEEKDAYS, 'work')
  data.days[TUE] = { date: TUE, tasks: [], templateId: 'rest' }
  data.days[FRI] = { date: FRI, tasks: [], templateId: 'rest' }
  const plan = planWeekStamp(WEEK, data, MON)
  expect(Object.keys(plan.stamps).sort()).toEqual([MON, WED, THU, SAT, SUN])
  expect(plan.mapped).toBe(7)
})

test('a weekday the plan does not name is not stamped and is not counted', () => {
  const plan = planWeekStamp(WEEK, withMapping([1, 2, 3, 4, 5], 'work'), MON)
  expect(Object.keys(plan.stamps)).toHaveLength(5)
  expect(plan.stamps[MON]).toBe('work')
  expect(plan.stamps[SAT]).toBeUndefined()
  expect(plan.mapped).toBe(5)
})

test('with no weekday plan there is nothing mapped and nothing to stamp', () => {
  const plan = planWeekStamp(WEEK, defaultData(), MON)
  expect(plan.mapped).toBe(0)
  expect(plan.stamps).toEqual({})
})

/**
 * The default, and the one place in this module a clock belongs: the button
 * is pressed today, so today is where the week starts. The week is derived
 * from todayKey() rather than written down, which is what keeps this true
 * whatever day of the week it is run on.
 */
test('with no day given the week starts from today, and today itself is stamped', () => {
  const today = todayKey()
  const plan = planWeekStamp(weekOf(today), withMapping(ALL_WEEKDAYS, 'work'))
  expect(plan.stamps[today]).toBe('work')
  expect(Object.keys(plan.stamps).every(day => day >= today)).toBe(true)
})

test('the message says how many days, or that there was nothing left to do', () => {
  expect(weekStampMessage({ stamps: {}, mapped: 3 })).toBe('Nothing left to stamp this week.')
  expect(weekStampMessage({ stamps: { [MON]: 'work' }, mapped: 3 })).toBe('1 day stamped from your weekday plan.')
  expect(weekStampMessage({ stamps: { [MON]: 'work', [TUE]: 'work' }, mapped: 3 })).toBe('2 days stamped from your weekday plan.')
})
