import { expect, test } from 'vitest'
import { pickIfThenRule, timeBandFor } from './select'
import type { IfThenEntry } from '../../lib/types'

function entry(overrides: Partial<IfThenEntry> & { id: string; trigger: string; action: string }): IfThenEntry {
  return { ...overrides }
}

// -- timeBandFor: boundaries -------------------------------------------

test('timeBandFor reads the small hours and late morning as morning', () => {
  expect(timeBandFor(new Date(2026, 0, 1, 0, 0))).toBe('morning')
  expect(timeBandFor(new Date(2026, 0, 1, 11, 59))).toBe('morning')
})

test('timeBandFor switches to day exactly at noon and holds until 18:00', () => {
  expect(timeBandFor(new Date(2026, 0, 1, 12, 0))).toBe('day')
  expect(timeBandFor(new Date(2026, 0, 1, 17, 59))).toBe('day')
})

test('timeBandFor switches to evening exactly at 18:00 and holds to midnight', () => {
  expect(timeBandFor(new Date(2026, 0, 1, 18, 0))).toBe('evening')
  expect(timeBandFor(new Date(2026, 0, 1, 23, 59))).toBe('evening')
})

// -- pickIfThenRule: no rules / one rule --------------------------------

test('no rules at all surfaces nothing', () => {
  expect(pickIfThenRule([], 'full', 'day', '2026-09-01')).toBeNull()
})

test('a single rule with no restrictions surfaces on any day type and any band', () => {
  const e = entry({ id: '1', trigger: 'It is 22:30', action: 'Phone on the charger' })
  expect(pickIfThenRule([e], 'full', 'morning', '2026-09-01')).toEqual(e)
  expect(pickIfThenRule([e], 'night', 'evening', '2026-09-01')).toEqual(e)
})

// -- old data with neither new field -------------------------------------

test('an entry saved before dayTypes and when existed is treated as applying every day, any time', () => {
  const e: IfThenEntry = { id: '1', trigger: 'Old trigger', action: 'Old action' }
  expect(pickIfThenRule([e], 'shift', 'evening', '2026-09-01')).toEqual(e)
})

// -- day type matching ----------------------------------------------------

test('a rule scoped to night days does not surface on a rest day', () => {
  const e = entry({ id: '1', trigger: 'Shift starts', action: 'Lay out the sleep mask', dayTypes: ['night'] })
  expect(pickIfThenRule([e], 'rest', 'day', '2026-09-01')).toBeNull()
})

test('a rule scoped to night days surfaces on a night day', () => {
  const e = entry({ id: '1', trigger: 'Shift starts', action: 'Lay out the sleep mask', dayTypes: ['night'] })
  expect(pickIfThenRule([e], 'night', 'day', '2026-09-01')).toEqual(e)
})

test('a rule scoped to several day types surfaces on any of them', () => {
  const e = entry({ id: '1', trigger: 'Long day', action: 'Drink water', dayTypes: ['shift', 'night'] })
  expect(pickIfThenRule([e], 'shift', 'day', '2026-09-01')).toEqual(e)
  expect(pickIfThenRule([e], 'night', 'day', '2026-09-01')).toEqual(e)
  expect(pickIfThenRule([e], 'full', 'day', '2026-09-01')).toBeNull()
})

test('only the rule matching today\'s type is offered, not one scoped elsewhere', () => {
  const nightOnly = entry({ id: '1', trigger: 'Night trigger', action: 'Night action', dayTypes: ['night'] })
  const restOnly = entry({ id: '2', trigger: 'Rest trigger', action: 'Rest action', dayTypes: ['rest'] })
  expect(pickIfThenRule([nightOnly, restOnly], 'rest', 'day', '2026-09-01')).toEqual(restOnly)
})

// -- time band matching, including boundaries ------------------------------

test('an evening-only rule does not surface in the morning', () => {
  const e = entry({ id: '1', trigger: 'Wind down', action: 'Dim the lights', when: 'evening' })
  expect(pickIfThenRule([e], 'full', 'morning', '2026-09-01')).toBeNull()
  expect(pickIfThenRule([e], 'full', 'day', '2026-09-01')).toBeNull()
})

test('an evening-only rule surfaces in the evening', () => {
  const e = entry({ id: '1', trigger: 'Wind down', action: 'Dim the lights', when: 'evening' })
  expect(pickIfThenRule([e], 'full', 'evening', '2026-09-01')).toEqual(e)
})

test('when: "any" behaves exactly like an absent when', () => {
  const e = entry({ id: '1', trigger: 'Always', action: 'Always', when: 'any' })
  expect(pickIfThenRule([e], 'full', 'morning', '2026-09-01')).toEqual(e)
  expect(pickIfThenRule([e], 'full', 'evening', '2026-09-01')).toEqual(e)
})

// -- relevance ranking: specificity beats a generic rule -------------------

test('a rule targeted to today\'s type and band outranks a generic rule that also matches', () => {
  const generic = entry({ id: '1', trigger: 'Generic trigger', action: 'Generic action' })
  const targeted = entry({
    id: '2',
    trigger: 'Targeted trigger',
    action: 'Targeted action',
    dayTypes: ['night'],
    when: 'evening',
  })
  expect(pickIfThenRule([generic, targeted], 'night', 'evening', '2026-09-01')).toEqual(targeted)
})

test('a rule targeted on one axis outranks one targeted on neither, but not one targeted on both', () => {
  const generic = entry({ id: '1', trigger: 'Generic', action: 'Generic' })
  const oneAxis = entry({ id: '2', trigger: 'One axis', action: 'One axis', when: 'day' })
  const bothAxes = entry({ id: '3', trigger: 'Both axes', action: 'Both axes', dayTypes: ['full'], when: 'day' })
  expect(pickIfThenRule([generic, oneAxis], 'full', 'day', '2026-09-01')).toEqual(oneAxis)
  expect(pickIfThenRule([oneAxis, bothAxes], 'full', 'day', '2026-09-01')).toEqual(bothAxes)
})

// -- least-recently-shown tie-break -----------------------------------------

test('among equally relevant rules, the one never shown before is picked over one already shown', () => {
  const shown = entry({ id: '1', trigger: 'Shown before', action: 'Shown before', lastSurfaced: '2026-08-20' })
  const neverShown = entry({ id: '2', trigger: 'Never shown', action: 'Never shown' })
  expect(pickIfThenRule([shown, neverShown], 'full', 'day', '2026-09-01')).toEqual(neverShown)
})

test('every rule already shown recently still resolves to the least-recently-shown one', () => {
  const shownEarlier = entry({ id: '1', trigger: 'Shown earlier', action: 'Shown earlier', lastSurfaced: '2026-08-20' })
  const shownLater = entry({ id: '2', trigger: 'Shown later', action: 'Shown later', lastSurfaced: '2026-08-28' })
  expect(pickIfThenRule([shownLater, shownEarlier], 'full', 'day', '2026-09-01')).toEqual(shownEarlier)
})

// -- stability within a single date -----------------------------------------

test('a rule already marked as surfaced for this exact date keeps being the pick', () => {
  const alreadyToday = entry({
    id: '1',
    trigger: 'Already today',
    action: 'Already today',
    lastSurfaced: '2026-09-01',
  })
  const neverShown = entry({ id: '2', trigger: 'Never shown', action: 'Never shown' })
  // Without the stability rule, neverShown would win on the "never shown"
  // tie-break - the point of this test is that today's own pick does not
  // flip once it has already been recorded for today.
  expect(pickIfThenRule([alreadyToday, neverShown], 'full', 'day', '2026-09-01')).toEqual(alreadyToday)
})

test('a rule surfaced on a previous date does not lock in for a new date', () => {
  const shownYesterday = entry({
    id: '1',
    trigger: 'Shown yesterday',
    action: 'Shown yesterday',
    lastSurfaced: '2026-08-31',
  })
  const neverShown = entry({ id: '2', trigger: 'Never shown', action: 'Never shown' })
  expect(pickIfThenRule([shownYesterday, neverShown], 'full', 'day', '2026-09-01')).toEqual(neverShown)
})
