import { beforeEach, describe, expect, test } from 'vitest'
import { applyStamps, columnFor } from './stamping'
import { actions, getData } from './store'
import { defaultData, loadData, STORAGE_KEY } from './storage'
import type { Template } from './types'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

// 2026-09-07 is a Monday, 2026-09-08 a Tuesday, 2026-09-12 a Saturday.
const MONDAY = '2026-09-07'
const TUESDAY = '2026-09-08'
const SATURDAY = '2026-09-12'

function weekTemplate(over: Partial<Template> = {}): Template {
  return {
    id: 'wk',
    name: 'My week',
    color: '#a7c4f5',
    kind: 'week',
    blocks: [
      { id: 'mon-1', title: 'Gym: Upper', time: '07:00', weekday: 1 },
      { id: 'mon-2', title: 'Deep work', time: '09:00', weekday: 1 },
      { id: 'tue-1', title: 'Gym: Lower', time: '07:00', weekday: 2 },
      { id: 'sat-1', title: 'Long walk', time: '10:00', weekday: 6 },
    ],
    ...over,
  }
}

/**
 * A week template is seven days' worth of blocks in one list, each saying
 * which weekday it belongs to. The two kinds share one entity on purpose: the
 * only thing that genuinely differs is which blocks a date takes, and that is
 * one filter. Everything after it - matching, keeping what a day earned, not
 * duplicating a pushed task - is the same code for both.
 */
describe('which blocks a date takes', () => {
  test('a week template hands over the column for that weekday and nothing else', () => {
    const t = weekTemplate()
    expect(columnFor(t, MONDAY).blocks.map(b => b.title)).toEqual(['Gym: Upper', 'Deep work'])
    expect(columnFor(t, TUESDAY).blocks.map(b => b.title)).toEqual(['Gym: Lower'])
    expect(columnFor(t, SATURDAY).blocks.map(b => b.title)).toEqual(['Long walk'])
  })

  test('a weekday with no blocks stamps an empty day rather than the whole template', () => {
    const days = applyStamps({}, [weekTemplate()], { '2026-09-09': 'wk' })
    expect(days['2026-09-09'].tasks).toEqual([])
    expect(days['2026-09-09'].templateId).toBe('wk')
  })

  // A day template is every template ever saved before this existed. Its
  // blocks have no weekday and it must keep handing over all of them.
  test('a day template is untouched: every block, on every date', () => {
    const day: Template = {
      id: 'd',
      name: 'Workday',
      color: '#a7c4f5',
      blocks: [
        { id: 'a', title: 'Standup', time: '09:00' },
        { id: 'b', title: 'Lunch', time: '13:00' },
      ],
    }
    expect(columnFor(day, MONDAY).blocks).toHaveLength(2)
    expect(columnFor(day, SATURDAY).blocks).toHaveLength(2)
  })

  /**
   * A block on a week template with no weekday belongs to no column. That is
   * a defect rather than a state, but it degrades the way a dangling id does
   * instead of throwing: one bad block cannot cost somebody their week.
   */
  test('a block with no weekday on a week template stamps onto nothing, and breaks nothing', () => {
    const t = weekTemplate({ blocks: [{ id: 'lost', title: 'Nowhere' }, { id: 'mon', title: 'Gym', weekday: 1 }] })
    const days = applyStamps({}, [t], { [MONDAY]: 'wk' })
    expect(days[MONDAY].tasks.map(x => x.title)).toEqual(['Gym'])
  })
})

/**
 * A week is not seven copies of the same day. Saturday is a rest day and
 * Wednesday is a night shift, and both are the same template.
 */
describe('what a column can override', () => {
  test('a column names its own day type; the template\'s own stands where it does not', () => {
    const t = weekTemplate({ type: 'full', weekDays: { 6: { type: 'rest' } } })
    expect(columnFor(t, MONDAY).type).toBe('full')
    expect(columnFor(t, SATURDAY).type).toBe('rest')

    const days = applyStamps({}, [t], { [MONDAY]: 'wk', [SATURDAY]: 'wk' })
    expect(days[MONDAY].dayType).toBe('full')
    expect(days[SATURDAY].dayType).toBe('rest')
  })

  test('a column names its own sleep schedule too', () => {
    const t = weekTemplate({ sleepProfileId: 'ordinary', weekDays: { 3: { sleepProfileId: 'night-shift' } } })
    expect(columnFor(t, MONDAY).sleepProfileId).toBe('ordinary')
    expect(columnFor(t, '2026-09-09').sleepProfileId).toBe('night-shift')
  })

  /**
   * Sleep is looked up when a day is drawn rather than written onto it at
   * stamp time - the way it has always worked for day templates. Pinning it
   * here would change how every existing template behaves, which is not this
   * feature's to do.
   */
  test('stamping does not write a sleep schedule onto the day', () => {
    const t = weekTemplate({ weekDays: { 1: { sleepProfileId: 'night-shift' } } })
    const days = applyStamps({}, [t], { [MONDAY]: 'wk' })
    expect(days[MONDAY].sleepProfileId).toBeUndefined()
  })
})

/**
 * Re-stamping is the same machinery for both kinds, and this is the case that
 * would break if it were not: a block id is unique across the whole template,
 * so Monday's block can never match Tuesday's task.
 */
describe('stamping the same week twice', () => {
  test('keeps what the day earned and adds nothing', () => {
    const t = weekTemplate()
    let days = applyStamps({}, [t], { [MONDAY]: 'wk' })
    days = {
      ...days,
      [MONDAY]: { ...days[MONDAY], tasks: days[MONDAY].tasks.map((x, i) => (i === 0 ? { ...x, done: true } : x)) },
    }

    const again = applyStamps(days, [t], { [MONDAY]: 'wk' })
    expect(again[MONDAY].tasks).toHaveLength(2)
    expect(again[MONDAY].tasks[0].done).toBe(true)
  })

  test('a Monday task is never matched by a Tuesday block', () => {
    const t = weekTemplate()
    const monday = applyStamps({}, [t], { [MONDAY]: 'wk' })
    const both = applyStamps(monday, [t], { [TUESDAY]: 'wk' })
    expect(both[MONDAY].tasks.map(x => x.title)).toEqual(['Gym: Upper', 'Deep work'])
    expect(both[TUESDAY].tasks.map(x => x.title)).toEqual(['Gym: Lower'])
  })
})

/**
 * A week template's Monday is not a template somebody could sensibly put on
 * Wednesday, so a weekday map holding it on one day and something else on
 * another would describe a week that does not exist.
 */
describe('the weekday map', () => {
  test('choosing a week template fills all seven weekdays', () => {
    const week = actions.addTemplate({ name: 'My week', color: '#a7c4f5', kind: 'week', blocks: [] })
    actions.setWeekdayTemplate(1, week.id)
    expect(Object.values(getData().settings.weekdayTemplates)).toEqual(Array(7).fill(week.id))
  })

  test('clearing one of its days clears all seven', () => {
    const week = actions.addTemplate({ name: 'My week', color: '#a7c4f5', kind: 'week', blocks: [] })
    actions.setWeekdayTemplate(1, week.id)
    actions.setWeekdayTemplate(4, undefined)
    expect(getData().settings.weekdayTemplates).toEqual({})
  })

  test('a day template still sets and clears exactly one weekday', () => {
    const day = actions.addTemplate({ name: 'Workday', color: '#a7c4f5', blocks: [] })
    actions.setWeekdayTemplate(1, day.id)
    actions.setWeekdayTemplate(2, day.id)
    actions.setWeekdayTemplate(1, undefined)
    expect(getData().settings.weekdayTemplates).toEqual({ 2: day.id })
  })

  // Replacing a week template's grip on the map with a day template on one
  // weekday leaves the other six where they were - the week is still what
  // they say, and taking six days away from somebody who changed one is the
  // kind of helpfulness nobody asked for.
  test('putting a day template on one of its weekdays replaces only that one', () => {
    const week = actions.addTemplate({ name: 'My week', color: '#a7c4f5', kind: 'week', blocks: [] })
    const day = actions.addTemplate({ name: 'Rest', color: '#a7e3bd', blocks: [] })
    actions.setWeekdayTemplate(1, week.id)
    actions.setWeekdayTemplate(0, day.id)

    const map = getData().settings.weekdayTemplates
    expect(map[0]).toBe(day.id)
    expect(map[1]).toBe(week.id)
    expect(map[6]).toBe(week.id)
  })
})

/**
 * Everything about a week template is optional and additive, so a payload
 * written before any of it existed loads exactly as it did, and one written
 * with it survives a round trip.
 */
describe('what loads', () => {
  test('a template saved before week templates existed loads as a day template', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        templates: [{ id: 't', name: 'Workday', color: '#a7c4f5', blocks: [{ id: 'b', title: 'Standup' }] }],
        days: {},
        settings: { theme: 'light', enabledWidgets: [] },
      }),
    )
    const loaded = loadData()
    expect(loaded.templates[0].kind).toBeUndefined()
    expect(loaded.templates[0].blocks[0].weekday).toBeUndefined()
  })

  test('a week template round-trips with its weekdays, overrides and groups', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        templates: [
          {
            id: 'wk',
            name: 'My week',
            color: '#a7c4f5',
            kind: 'week',
            weekDays: { '6': { type: 'rest' } },
            blocks: [{ id: 'b', title: 'Gym', weekday: 1, groupId: 'g1' }],
          },
        ],
        days: {},
        settings: { theme: 'light', enabledWidgets: [] },
      }),
    )
    const loaded = loadData()
    expect(loaded.templates[0]).toMatchObject({ kind: 'week', weekDays: { 6: { type: 'rest' } } })
    expect(loaded.templates[0].blocks[0]).toMatchObject({ weekday: 1, groupId: 'g1' })
  })

  test('a weekday outside the week, or a kind nobody ships, is refused rather than guessed at', () => {
    const bad = (templates: unknown) =>
      JSON.stringify({ templates, days: {}, settings: { theme: 'light', enabledWidgets: [] } })

    localStorage.setItem(STORAGE_KEY, bad([{ id: 'wk', name: 'W', color: '#a7c4f5', blocks: [{ id: 'b', title: 'G', weekday: 9 }] }]))
    expect(loadData().templates).toEqual([])

    localStorage.setItem(STORAGE_KEY, bad([{ id: 'wk', name: 'W', color: '#a7c4f5', kind: 'fortnight', blocks: [] }]))
    expect(loadData().templates).toEqual([])
  })
})
