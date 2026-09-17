import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { cleanRoutine } from './routines'
import { dayKinds, isDayKind, kindOnDate, nextKind } from './dayKinds'
import type { AppData, Template } from './types'

/**
 * Kinds of day and routines, rotating shifts' stage 2: the helpers every later
 * stage reads them through, and the store's four ways of writing them. Generic
 * names and times only.
 */

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function template(id: string, over: Partial<Template> = {}): Template {
  return { id, name: `Template ${id}`, color: '#a7c4f5', blocks: [], ...over }
}

// --- what a kind is -------------------------------------------------------------------------

test('a day template with a mark is a kind, and a week template or a template without one is not', () => {
  expect(isDayKind(template('a', { dayKind: { letter: 'D', order: 0 } }))).toBe(true)
  expect(isDayKind(template('b'))).toBe(false)
  expect(isDayKind(template('c', { kind: 'week', dayKind: { letter: 'W', order: 1 } }))).toBe(false)
})

test('the kinds come in their order, a tie in order falls back to the name, and nothing else is listed', () => {
  const templates = [
    template('night', { name: 'Night', dayKind: { letter: 'N', order: 2 } }),
    template('plain'),
    template('rest', { name: 'Rest', dayKind: { letter: 'R', order: 0 } }),
    template('b-day', { name: 'Bday', dayKind: { letter: 'B', order: 1 } }),
    template('a-day', { name: 'Aday', dayKind: { letter: 'A', order: 1 } }),
    template('week', { kind: 'week', dayKind: { letter: 'W', order: 0 } }),
  ]
  expect(dayKinds(templates).map(t => t.id)).toEqual(['rest', 'a-day', 'b-day', 'night'])
})

test("a date's kind is the kind template stamped on it, and a day with another template, a dangling id or no day has none", () => {
  const data: AppData = defaultData()
  data.templates = [template('k', { dayKind: { letter: 'D', order: 0 } }), template('plain')]
  data.days['2026-09-01'] = { date: '2026-09-01', templateId: 'k', tasks: [] }
  data.days['2026-09-02'] = { date: '2026-09-02', templateId: 'plain', tasks: [] }
  data.days['2026-09-03'] = { date: '2026-09-03', templateId: 'gone', tasks: [] }
  expect(kindOnDate(data, '2026-09-01')?.id).toBe('k')
  expect(kindOnDate(data, '2026-09-02')).toBeUndefined()
  expect(kindOnDate(data, '2026-09-03')).toBeUndefined()
  expect(kindOnDate(data, '2026-09-04')).toBeUndefined()
})

test('a tap walks the kinds in order and wraps round to the first, and from no kind it starts at the first', () => {
  const templates = [
    template('rest', { dayKind: { letter: 'R', order: 0 } }),
    template('day', { dayKind: { letter: 'D', order: 1 } }),
    template('night', { dayKind: { letter: 'N', order: 2 } }),
  ]
  expect(nextKind(templates, undefined)?.id).toBe('rest')
  expect(nextKind(templates, 'rest')?.id).toBe('day')
  expect(nextKind(templates, 'night')?.id).toBe('rest')
  // A date carrying something that is no longer a kind starts the walk again.
  expect(nextKind(templates, 'plain')?.id).toBe('rest')
  expect(nextKind([template('plain')], undefined)).toBeUndefined()
})

// --- a routine as it is written -----------------------------------------------------------------

test('a routine is written trimmed, its length whole and in range, its weekdays once each in order, and only real times', () => {
  const kinds = ['k1', 'k2']
  expect(
    cleanRoutine(
      { title: '  Training  ', category: 'health', minutes: 45.4, weekdays: [5, 1, 3, 1, 9, -1], times: { k1: '17:00', k2: '9:00', gone: '08:00', k3: '' } },
      kinds,
    ),
  ).toEqual({ title: 'Training', category: 'health', minutes: 45, weekdays: [1, 3, 5], times: { k1: '17:00' } })
  expect(cleanRoutine({ title: 'Long', minutes: 5000, weekdays: [0], times: {} }, kinds)?.minutes).toBe(720)
  expect(cleanRoutine({ title: 'Short', minutes: 0, weekdays: [0], times: {} }, kinds)?.minutes).toBe(1)
})

test('a routine with no title or no weekday is not written at all', () => {
  expect(cleanRoutine({ title: '   ', minutes: 30, weekdays: [1], times: {} }, [])).toBeUndefined()
  expect(cleanRoutine({ title: 'Training', minutes: 30, weekdays: [], times: {} }, [])).toBeUndefined()
  expect(cleanRoutine({ title: 'Training', minutes: 30, weekdays: [8], times: {} }, [])).toBeUndefined()
})

// --- the store ---------------------------------------------------------------------------------

test('a day template is marked a kind with a cleaned letter, unmarked with nothing, and a week template is refused', () => {
  const day = actions.addTemplate({ name: 'A day', color: '#a7c4f5', blocks: [] })
  const week = actions.addTemplate({ name: 'A week', color: '#a7c4f5', kind: 'week', blocks: [] })
  actions.setDayKind(day.id, { letter: ' nx ', order: 3 })
  expect(getData().templates.find(t => t.id === day.id)?.dayKind).toEqual({ letter: 'NX', order: 3 })
  actions.setDayKind(day.id, { letter: 'toolong', order: 1.7 })
  expect(getData().templates.find(t => t.id === day.id)?.dayKind).toEqual({ letter: 'TO', order: 1 })
  actions.setDayKind(week.id, { letter: 'W', order: 0 })
  expect(getData().templates.find(t => t.id === week.id)?.dayKind).toBeUndefined()
  actions.setDayKind(day.id, null)
  expect(getData().templates.find(t => t.id === day.id)).not.toHaveProperty('dayKind')
  // A letter with nothing in it is no mark.
  actions.setDayKind(day.id, { letter: '  ', order: 0 })
  expect(getData().templates.find(t => t.id === day.id)).not.toHaveProperty('dayKind')
})

test('a routine is added, changed and removed through the store, and one that is not a routine is not added', () => {
  const kind = actions.addTemplate({ name: 'A day', color: '#a7c4f5', blocks: [] })
  actions.setDayKind(kind.id, { letter: 'D', order: 0 })
  const added = actions.addRoutine({ title: 'Training', minutes: 60, weekdays: [1, 3], times: { [kind.id]: '17:00' } })
  expect(added).toMatchObject({ title: 'Training', minutes: 60, weekdays: [1, 3], times: { [kind.id]: '17:00' } })
  expect(getData().routines).toHaveLength(1)

  actions.updateRoutine(added!.id, { title: 'Training', minutes: 90, weekdays: [2], times: {} })
  expect(getData().routines[0]).toMatchObject({ id: added!.id, minutes: 90, weekdays: [2], times: {} })
  // A change that would leave no routine changes nothing.
  actions.updateRoutine(added!.id, { title: '', minutes: 90, weekdays: [2], times: {} })
  expect(getData().routines[0].title).toBe('Training')

  expect(actions.addRoutine({ title: 'Nothing', minutes: 30, weekdays: [], times: {} })).toBeUndefined()
  actions.removeRoutine(added!.id)
  expect(getData().routines).toEqual([])
})
