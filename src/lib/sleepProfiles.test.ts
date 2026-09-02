import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { STORAGE_KEY, defaultData, exportJson, importJson, loadData } from './storage'
import { sleepProfileWindow, windowFor } from '../widgets/day-plan/capacity'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function profiles() {
  return getData().settings.sleepProfiles
}

// --- the list ------------------------------------------------------------

test('a fresh install has exactly one schedule, at the historical hours', () => {
  expect(profiles()).toEqual([
    { id: 'default', name: 'Sleep schedule', window: { start: '23:00', end: '07:00' } },
  ])
})

test('a second schedule is seeded from the first rather than from nothing', () => {
  actions.setSleepProfileWindow('default', { start: '22:00', end: '06:00' })
  actions.addSleepProfile('Shift')
  expect(profiles()).toHaveLength(2)
  expect(profiles()[1].window).toEqual({ start: '22:00', end: '06:00' })
})

test('a schedule can be renamed without touching its hours', () => {
  actions.addSleepProfile('Shift')
  actions.renameSleepProfile(profiles()[1].id, 'Nights abroad')
  expect(profiles()[1].name).toBe('Nights abroad')
  expect(profiles()[1].window).toEqual({ start: '23:00', end: '07:00' })
})

// Something has to be the default, and every reader treats profiles[0] as it.
test('the first schedule can never be deleted', () => {
  actions.deleteSleepProfile('default')
  expect(profiles()).toHaveLength(1)
})

// --- assignment ----------------------------------------------------------

test('a day and a template each point at a schedule by id', () => {
  actions.addSleepProfile('Shift')
  const shift = profiles()[1].id
  const template = actions.addTemplate({ name: 'Nights', color: '#a7c4f5', sleepProfileId: shift, blocks: [] })
  actions.addTask(DATE, 'Clock in')
  actions.setDaySleepProfile(DATE, shift)

  expect(getData().templates.find(t => t.id === template.id)!.sleepProfileId).toBe(shift)
  expect(getData().days[DATE].sleepProfileId).toBe(shift)
})

test('deleting a schedule clears it off every day and template that used it', () => {
  actions.addSleepProfile('Shift')
  const shift = profiles()[1].id
  const template = actions.addTemplate({ name: 'Nights', color: '#a7c4f5', sleepProfileId: shift, blocks: [] })
  actions.addTask(DATE, 'Clock in')
  actions.setDaySleepProfile(DATE, shift)

  actions.deleteSleepProfile(shift)

  expect(getData().templates.find(t => t.id === template.id)!.sleepProfileId).toBeUndefined()
  expect(getData().days[DATE].sleepProfileId).toBeUndefined()
})

// --- resolution ----------------------------------------------------------

test('a schedule resolves to its own window, and anything unknown to the first', () => {
  const sleep = {
    profiles: [
      { id: 'default', name: 'Sleep schedule', window: { start: '23:00', end: '07:00' } },
      { id: 'shift', name: 'Shift', window: { start: '09:00', end: '17:00' } },
    ],
  }
  expect(sleepProfileWindow('shift', sleep)).toEqual({ start: '09:00', end: '17:00' })
  expect(sleepProfileWindow(undefined, sleep)).toEqual({ start: '23:00', end: '07:00' })
  // A day can outlive the schedule it pointed at - somebody deletes the one
  // they set up for a job they no longer have.
  expect(sleepProfileWindow('deleted-long-ago', sleep)).toEqual({ start: '23:00', end: '07:00' })
  expect(windowFor('shift', sleep)).toEqual({ start: 17 * 60, end: 24 * 60 })
})

// --- migration -----------------------------------------------------------
//
// Every install that ever existed carries a nightSleepWindow, because it was
// a field rather than a choice. Carrying all of them forward would hand a
// second schedule to everybody who never worked a night in their life.

function storeLegacy(payload: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

const LEGACY_SETTINGS = {
  theme: { presetId: 'dark', overrides: {}, mode: 'dark' },
  enabledWidgets: ['day-plan'],
}

test('a legacy pair of windows becomes one schedule when the night one was never used', () => {
  storeLegacy({
    templates: [],
    days: {},
    settings: {
      ...LEGACY_SETTINGS,
      sleepWindow: { start: '22:00', end: '06:00' },
      nightSleepWindow: { start: '09:00', end: '17:00' },
    },
  })
  expect(loadData().settings.sleepProfiles).toEqual([
    { id: 'default', name: 'Sleep schedule', window: { start: '22:00', end: '06:00' } },
  ])
})

test('a night window that was changed and actually used becomes a second schedule', () => {
  storeLegacy({
    templates: [{ id: 't1', name: 'Nights', color: '#a7c4f5', type: 'night', blocks: [] }],
    days: {},
    settings: {
      ...LEGACY_SETTINGS,
      sleepWindow: { start: '23:00', end: '07:00' },
      nightSleepWindow: { start: '09:00', end: '17:00' },
    },
  })
  expect(loadData().settings.sleepProfiles).toEqual([
    { id: 'default', name: 'Sleep schedule', window: { start: '23:00', end: '07:00' } },
    { id: 'shift', name: 'Shift', window: { start: '09:00', end: '17:00' } },
  ])
})

test('a payload with no sleep settings at all lands on the historical default', () => {
  storeLegacy({ templates: [], days: {}, settings: LEGACY_SETTINGS })
  expect(loadData().settings.sleepProfiles[0].window).toEqual({ start: '23:00', end: '07:00' })
})

// --- backup --------------------------------------------------------------

test('every schedule survives export and re-import unchanged', () => {
  const data = defaultData()
  data.settings.sleepProfiles = [
    { id: 'default', name: 'Sleep schedule', window: { start: '22:30', end: '06:15' } },
    { id: 'shift', name: 'Shift', window: { start: '08:00', end: '16:00' } },
  ]
  expect(importJson(exportJson(data)).settings.sleepProfiles).toEqual(data.settings.sleepProfiles)
})
