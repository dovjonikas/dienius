import { expect, test } from 'vitest'
import { ensuredDay } from './ensureDay'
import { defaultData } from './storage'
import { addDays } from './dates'
import type { AppData, Template } from './types'

// 2026-09-10 is a Thursday. Which day is "today" is given to the function
// rather than read off the clock inside it, so these dates mean the same
// thing whenever the suite is run.
const THURSDAY = '2026-09-10'
const THE_DAY_BEFORE = addDays(THURSDAY, -1)
const THE_DAY_AFTER = addDays(THURSDAY, 1)

const WORKDAY: Template = {
  id: 'work',
  name: 'Workday',
  color: '#a7c4f5',
  blocks: [
    { id: 'b1', title: 'Commute', time: '08:00', minutes: 30 },
    { id: 'b2', title: 'Deep work', time: '09:00', minutes: 120 },
  ],
}

function withThursdayMapped(): AppData {
  const data = defaultData()
  data.templates = [WORKDAY]
  data.settings.weekdayTemplates = { 4: 'work' }
  return data
}

/**
 * Everything a day gets on its own, worked out without writing it. This is
 * what `actions.ensureDay` commits and what the replan sheet shows for a day
 * nobody has opened: the two have to agree, so they are one function.
 */
test('a day whose weekday names a template is stamped from it, and marked as having been through this', () => {
  const data = withThursdayMapped()
  const ensured = ensuredDay(data, THURSDAY, THURSDAY)
  expect(ensured?.changed).toBe(true)
  expect(ensured?.days[THURSDAY].templateId).toBe('work')
  expect(ensured?.days[THURSDAY].autoApplied).toBe(true)
  expect(ensured?.days[THURSDAY].tasks.map(t => t.title)).toEqual(['Commute', 'Deep work'])
})

test('a day still ahead is stamped the same way, so a week can be looked at before it starts', () => {
  const ensured = ensuredDay(withThursdayMapped(), THURSDAY, THE_DAY_BEFORE)
  expect(ensured?.days[THURSDAY].templateId).toBe('work')
})

/**
 * The map does not reach backwards, which is the same rule "Stamp week"
 * keeps. Scrolling back to look at a Thursday nobody opened is not a reason
 * to fill it in: a plan stamped onto a day that was already over is a plan
 * nobody made, and the month grid draws it a ratio and Review counts it in
 * "where the plan and the week disagreed" as though it had been real. The day
 * is still marked as having been through this, because it has - it was
 * opened, and it was owed nothing.
 */
test('opening a past day that the weekday map names does not stamp it', () => {
  const ensured = ensuredDay(withThursdayMapped(), THURSDAY, THE_DAY_AFTER)
  expect(ensured?.changed).toBe(false)
  expect(ensured?.days[THURSDAY].templateId).toBeUndefined()
  expect(ensured?.days[THURSDAY].tasks).toEqual([])
  expect(ensured?.days[THURSDAY].autoApplied).toBe(true)
})

test('a repeat still lands on a day already past - a series that was running was running, which is a fact rather than an invention', () => {
  const data = withThursdayMapped()
  data.days['2026-09-08'] = {
    date: '2026-09-08',
    tasks: [{ id: 'pills', title: 'Take the pills', time: '08:00', done: false, repeat: 'daily' }],
  }
  const ensured = ensuredDay(data, THURSDAY, THE_DAY_AFTER)
  expect(ensured?.changed).toBe(true)
  expect(ensured?.days[THURSDAY].tasks.map(t => t.title)).toEqual(['Take the pills'])
  expect(ensured?.days[THURSDAY].templateId).toBeUndefined()
})

test('a day already stamped by hand keeps its own template - a deliberate choice outranks a standing rule', () => {
  const data = withThursdayMapped()
  data.templates.push({ id: 'off', name: 'Day off', color: '#cde39e', blocks: [{ id: 'x', title: 'Long walk', time: '10:00' }] })
  data.days[THURSDAY] = { date: THURSDAY, templateId: 'off', tasks: [{ id: 't', title: 'Long walk', time: '10:00', done: false, fromTemplate: true }] }
  const ensured = ensuredDay(data, THURSDAY, THURSDAY)
  expect(ensured?.days[THURSDAY].templateId).toBe('off')
  expect(ensured?.days[THURSDAY].tasks.map(t => t.title)).toEqual(['Long walk'])
  expect(ensured?.changed).toBe(false)
})

test('a day that has been through this once answers null, so the caller can tell nothing-to-do from did-nothing', () => {
  const data = withThursdayMapped()
  data.days[THURSDAY] = { date: THURSDAY, tasks: [], autoApplied: true }
  expect(ensuredDay(data, THURSDAY, THURSDAY)).toBeNull()
})

test('repeats owed to the day are generated onto it, and a series the day skipped stays skipped', () => {
  const data = defaultData()
  data.days['2026-09-08'] = {
    date: '2026-09-08',
    tasks: [
      { id: 'pills', title: 'Take the pills', time: '08:00', done: false, repeat: 'daily' },
      { id: 'stretch', title: 'Stretch', done: false, repeat: 'daily' },
    ],
  }
  data.days[THURSDAY] = { date: THURSDAY, tasks: [], repeatSkips: ['stretch'] }
  const ensured = ensuredDay(data, THURSDAY, THURSDAY)
  expect(ensured?.changed).toBe(true)
  expect(ensured?.days[THURSDAY].tasks.map(t => [t.title, t.repeatOf])).toEqual([['Take the pills', 'pills']])
})

test('it is pure: the state it was given is untouched', () => {
  const data = withThursdayMapped()
  const before = JSON.stringify(data)
  ensuredDay(data, THURSDAY, THURSDAY)
  expect(JSON.stringify(data)).toBe(before)
  expect(data.days[THURSDAY]).toBeUndefined()
})

test('a day with nothing owed to it is still marked as seen, and is empty rather than absent', () => {
  const ensured = ensuredDay(defaultData(), THURSDAY, THURSDAY)
  expect(ensured?.changed).toBe(false)
  expect(ensured?.days[THURSDAY]).toEqual({ date: THURSDAY, tasks: [], autoApplied: true })
})
