import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { cycleDates, kindAfterDraft, readCycle, readDraft, writeCycle, writeDraft } from './rosterDraft'
import type { AppData, Template } from './types'

/**
 * The roster's draft - rotating shifts, v2.29 stage 6, and
 * docs/RESEARCH-SHIFTS.md section 2.5. Taps and cycles build a draft, kept on
 * this device under its own key until it is applied or thrown away: a
 * half-built month survives a reload, and it is not a plan anybody else should
 * see. Nothing here touches the plan.
 */

const KIND = (id: string, name: string, letter: string, order: number): Template =>
  ({ id, name, color: '#a7c4f5', blocks: [], dayKind: { letter, order } }) as Template

function plan(): AppData {
  const data = defaultData()
  data.templates = [KIND('day', 'Day shift', 'D', 0), KIND('night', 'Night shift', 'N', 1), { id: 'plain', name: 'Working day', color: '#a7e3bd', blocks: [] } as Template]
  data.days = { '2026-09-16': { date: '2026-09-16', templateId: 'night', tasks: [] } }
  return data
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(plan())
})

test('a draft is kept on this device, under its own key, and never in the plan', () => {
  writeDraft({ dates: { '2026-09-17': 'day', '2026-09-18': null } })

  expect(readDraft().dates).toEqual({ '2026-09-17': 'day', '2026-09-18': null })
  expect(localStorage.getItem('dienius:roster-draft')).toContain('2026-09-17')
  // The plan is untouched: a draft reaches it only through Apply.
  expect(getData().days['2026-09-17']).toBeUndefined()
  expect(JSON.stringify(getData())).not.toContain('roster')
})

test('a draft that is not a draft reads as empty', () => {
  localStorage.setItem('dienius:roster-draft', 'half written {')
  expect(readDraft().dates).toEqual({})

  localStorage.setItem('dienius:roster-draft', JSON.stringify({ dates: 'a string' }))
  expect(readDraft().dates).toEqual({})

  // A date that is not a date, and a kind that is neither an id nor nothing.
  localStorage.setItem('dienius:roster-draft', JSON.stringify({ dates: { 'not a date': 'day', '2026-09-17': 7, '2026-09-18': 'day' } }))
  expect(readDraft().dates).toEqual({ '2026-09-18': 'day' })
})

test('a cycle fills a stretch, repeating its kinds, and stops where it is told', () => {
  const filled = cycleDates({ kinds: ['day', 'day', 'night'], from: '2026-09-14' }, '2026-09-20')
  expect(filled).toEqual({
    '2026-09-14': 'day',
    '2026-09-15': 'day',
    '2026-09-16': 'night',
    '2026-09-17': 'day',
    '2026-09-18': 'day',
    '2026-09-19': 'night',
    '2026-09-20': 'day',
  })
})

test('a cycle with no kinds fills nothing, and neither does a stretch that ends before it starts', () => {
  expect(cycleDates({ kinds: [], from: '2026-09-14' }, '2026-09-20')).toEqual({})
  expect(cycleDates({ kinds: ['day'], from: '2026-09-21' }, '2026-09-20')).toEqual({})
  // One day is a stretch of one.
  expect(cycleDates({ kinds: ['day', 'night'], from: '2026-09-20' }, '2026-09-20')).toEqual({ '2026-09-20': 'day' })
})

test('the last cycle is kept on the device too, because next month is usually the same pattern moved on', () => {
  expect(readCycle()).toBeUndefined()
  writeCycle({ kinds: ['day', 'night'], from: '2026-09-14' })
  expect(readCycle()).toEqual({ kinds: ['day', 'night'], from: '2026-09-14' })

  localStorage.setItem('dienius:roster-cycle', JSON.stringify({ kinds: [1, 2], from: 'whenever' }))
  expect(readCycle()).toBeUndefined()
})

test('what a date is after a draft: the draft first, then the plan, and a dangling kind is none', () => {
  const data = getData()
  const draft = { dates: { '2026-09-17': 'day', '2026-09-16': null, '2026-09-19': 'gone' } }

  // The draft's own answer, where it has one.
  expect(kindAfterDraft(data, draft, '2026-09-17')?.id).toBe('day')
  // A draft that takes the kind off, over a date the plan says is a night.
  expect(kindAfterDraft(data, draft, '2026-09-16')).toBeUndefined()
  // A kind that is no longer a kind degrades to none, like every dangling id -
  // an id that names nothing, and an id that names an ordinary template.
  expect(kindAfterDraft(data, draft, '2026-09-19')).toBeUndefined()
  expect(kindAfterDraft(data, { dates: { '2026-09-20': 'plain' } }, '2026-09-20')).toBeUndefined()
  expect(kindAfterDraft({ ...data, days: { '2026-09-21': { date: '2026-09-21', templateId: 'plain', tasks: [] } } }, { dates: {} }, '2026-09-21')).toBeUndefined()
  // No draft for the date: what the plan says.
  expect(kindAfterDraft(data, { dates: {} }, '2026-09-16')?.id).toBe('night')
  expect(kindAfterDraft(data, { dates: {} }, '2026-09-15')).toBeUndefined()
})
