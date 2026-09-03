import { expect, test } from 'vitest'
import { planWeekStamp, weekStampMessage } from './weekStamp'
import { defaultData } from '../../lib/storage'
import { weekOf } from '../../lib/dates'

const WEEK = weekOf('2026-09-02')
const [MON, TUE] = WEEK

function withMapping(weekdays: number[], templateId: string) {
  const data = defaultData()
  for (const w of weekdays) data.settings.weekdayTemplates[w] = templateId
  return data
}

/**
 * One press has to be safe to press by accident. The plan therefore never
 * names a day that already carries a template, whatever the weekday map says
 * about it - a deliberate stamp outranks a standing rule, the same way
 * ensureDay treats it.
 */
test('the plan names every mapped day that has no template yet', () => {
  const data = withMapping([1, 2, 3, 4, 5], 'work')
  const plan = planWeekStamp(WEEK, data)
  expect(Object.keys(plan.stamps)).toHaveLength(5)
  expect(plan.stamps[MON]).toBe('work')
  expect(plan.mapped).toBe(5)
})

test('a day arranged by hand is left alone, and still counts as mapped', () => {
  const data = withMapping([1, 2], 'work')
  data.days[MON] = { date: MON, tasks: [], templateId: 'rest' }
  const plan = planWeekStamp(WEEK, data)
  expect(plan.stamps).toEqual({ [TUE]: 'work' })
  expect(plan.mapped).toBe(2)
})

test('with no weekday plan there is nothing mapped and nothing to stamp', () => {
  const plan = planWeekStamp(WEEK, defaultData())
  expect(plan.mapped).toBe(0)
  expect(plan.stamps).toEqual({})
})

test('the message says how many days, or that there was nothing left to do', () => {
  expect(weekStampMessage({ stamps: {}, mapped: 3 })).toBe('Every day this week already has a template.')
  expect(weekStampMessage({ stamps: { [MON]: 'work' }, mapped: 3 })).toBe('1 day stamped from your weekday plan.')
  expect(weekStampMessage({ stamps: { [MON]: 'work', [TUE]: 'work' }, mapped: 3 })).toBe('2 days stamped from your weekday plan.')
})
