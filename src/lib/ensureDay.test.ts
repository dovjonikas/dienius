import { expect, test } from 'vitest'
import { ensuredDay } from './ensureDay'
import { defaultData } from './storage'
import type { AppData, Template } from './types'

// 2026-09-10 is a Thursday.
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
  const ensured = ensuredDay(data, THURSDAY)
  expect(ensured?.changed).toBe(true)
  expect(ensured?.days[THURSDAY].templateId).toBe('work')
  expect(ensured?.days[THURSDAY].autoApplied).toBe(true)
  expect(ensured?.days[THURSDAY].tasks.map(t => t.title)).toEqual(['Commute', 'Deep work'])
})

test('a day already stamped by hand keeps its own template - a deliberate choice outranks a standing rule', () => {
  const data = withThursdayMapped()
  data.templates.push({ id: 'off', name: 'Day off', color: '#cde39e', blocks: [{ id: 'x', title: 'Long walk', time: '10:00' }] })
  data.days[THURSDAY] = { date: THURSDAY, templateId: 'off', tasks: [{ id: 't', title: 'Long walk', time: '10:00', done: false, fromTemplate: true }] }
  const ensured = ensuredDay(data, THURSDAY)
  expect(ensured?.days[THURSDAY].templateId).toBe('off')
  expect(ensured?.days[THURSDAY].tasks.map(t => t.title)).toEqual(['Long walk'])
  expect(ensured?.changed).toBe(false)
})

test('a day that has been through this once answers null, so the caller can tell nothing-to-do from did-nothing', () => {
  const data = withThursdayMapped()
  data.days[THURSDAY] = { date: THURSDAY, tasks: [], autoApplied: true }
  expect(ensuredDay(data, THURSDAY)).toBeNull()
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
  const ensured = ensuredDay(data, THURSDAY)
  expect(ensured?.changed).toBe(true)
  expect(ensured?.days[THURSDAY].tasks.map(t => [t.title, t.repeatOf])).toEqual([['Take the pills', 'pills']])
})

test('it is pure: the state it was given is untouched', () => {
  const data = withThursdayMapped()
  const before = JSON.stringify(data)
  ensuredDay(data, THURSDAY)
  expect(JSON.stringify(data)).toBe(before)
  expect(data.days[THURSDAY]).toBeUndefined()
})

test('a day with nothing owed to it is still marked as seen, and is empty rather than absent', () => {
  const ensured = ensuredDay(defaultData(), THURSDAY)
  expect(ensured?.changed).toBe(false)
  expect(ensured?.days[THURSDAY]).toEqual({ date: THURSDAY, tasks: [], autoApplied: true })
})
