import { afterEach, beforeEach, expect, test } from 'vitest'
import { buildDemoData } from './demo'
import { DEMO_STORAGE_KEY, isDemoMode, setDemoModeForTests } from './demoMode'
import { loadData, saveData, STORAGE_KEY, defaultData, validate } from './storage'
import { todayKey } from './dates'

const TODAY = '2026-09-03'

beforeEach(() => {
  localStorage.clear()
  setDemoModeForTests(false)
})

afterEach(() => {
  setDemoModeForTests(false)
})

/**
 * The isolation is the feature. A demo that can touch a real plan is not a
 * demo, it is a bug waiting for somebody who was only looking.
 */

test('demo data never goes near the real key', () => {
  saveData({ ...defaultData(), templates: [{ id: 'real', name: 'Mine', color: '#a7c4f5', blocks: [] }] })
  const realBefore = localStorage.getItem(STORAGE_KEY)

  setDemoModeForTests(true)
  saveData(loadData())

  expect(localStorage.getItem(STORAGE_KEY)).toBe(realBefore)
  expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeTruthy()
})

test('the app reads the demo key while demo mode is on, and the real one when it is off', () => {
  saveData({ ...defaultData(), templates: [{ id: 'real', name: 'Mine', color: '#a7c4f5', blocks: [] }] })

  setDemoModeForTests(true)
  loadData()
  expect(loadData().templates.map(t => t.name)).toEqual(['Working day', 'Rest day'])

  setDemoModeForTests(false)
  expect(loadData().templates.map(t => t.name)).toEqual(['Mine'])
})

test('writing while in demo mode leaves the real plan untouched', () => {
  saveData({ ...defaultData(), templates: [{ id: 'real', name: 'Mine', color: '#a7c4f5', blocks: [] }] })

  setDemoModeForTests(true)
  loadData()
  saveData({ ...loadData(), templates: [] })

  setDemoModeForTests(false)
  expect(loadData().templates.map(t => t.name)).toEqual(['Mine'])
})

// Clicking around the demo and reloading should show it as you left it, not
// reset it under you. It is thrown away on the way out instead, which is the
// moment somebody actually means "I am done here".
test('a demo that has been used reloads as it was left, not as a fresh sample', () => {
  setDemoModeForTests(true)
  saveData({ ...loadData(), inbox: [{ id: 'typed', text: 'Something I typed', captured: TODAY }] })

  expect(loadData().inbox.map(i => i.text)).toEqual(['Something I typed'])
})

test('with no demo mode there is nothing to seed', () => {
  expect(loadData().templates).toEqual([])
  expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull()
  expect(isDemoMode()).toBe(false)
})

// --- what the sample week actually contains -------------------------------

/**
 * An empty app cannot make its own case, and neither can one stuffed with
 * every control switched on. What this has to be is somebody's ordinary
 * fortnight.
 */
test('the sample week passes the same validation a real backup does', () => {
  expect(validate(JSON.parse(JSON.stringify(buildDemoData(defaultData(), TODAY))))).toBe(true)
})

test('there is history behind today and a plan ahead of it', () => {
  const data = buildDemoData(defaultData(), TODAY)
  const dates = Object.keys(data.days).sort()
  expect(dates[0] < TODAY).toBe(true)
  expect(dates.at(-1)! > TODAY).toBe(true)
  expect(dates).toHaveLength(14)
})

// A demo where every day is 90% finished is a brochure, and the whole argument
// of this app is that it is built for the days that are not.
test('not every past day went well', () => {
  const data = buildDemoData(defaultData(), TODAY)
  const rates = Object.entries(data.days)
    .filter(([date]) => date < TODAY)
    .map(([, day]) => day.tasks.filter(t => t.done).length / day.tasks.length)
  expect(Math.min(...rates)).toBeLessThan(0.5)
  expect(Math.max(...rates)).toBe(1)
})

test('today is part-finished, with something carried and something untimed', () => {
  const today = buildDemoData(defaultData(), TODAY).days[TODAY]
  expect(today.tasks.some(t => t.done)).toBe(true)
  expect(today.tasks.some(t => !t.done)).toBe(true)
  expect(today.tasks.some(t => (t.pushCount ?? 0) > 0)).toBe(true)
  expect(today.tasks.some(t => t.time === undefined)).toBe(true)
})

test('the parts of the app that need data to say anything have some', () => {
  const data = buildDemoData(defaultData(), TODAY)
  expect(data.goals.length).toBeGreaterThan(0)
  expect(data.library[0].items.length).toBeGreaterThan(1)
  expect(data.library[0].items.some(i => i.finished)).toBe(true)
  expect(data.ifThens.length).toBeGreaterThan(0)
  expect(data.inbox.length).toBeGreaterThan(0)
  expect(Object.keys(data.settings.weekdayTemplates)).toHaveLength(7)
})

// A demo that generates a different week each time is one you cannot
// screenshot, cannot describe, and cannot debug.
test('the same day always builds the same week', () => {
  expect(JSON.stringify(buildDemoData(defaultData(), TODAY))).toBe(JSON.stringify(buildDemoData(defaultData(), TODAY)))
})

test('it builds around whatever today is, not a date frozen into the file', () => {
  const data = buildDemoData(defaultData(), todayKey())
  expect(data.days[todayKey()]).toBeDefined()
})
