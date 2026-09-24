import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { kindOnDate } from './dayKinds'
import { importSummary } from '../views/TemplateJsonSettings'
import type { AppData, Task } from './types'

/**
 * A templates file pasted again, and again - the owner's shift brief of
 * 2026-09-25, stage 2, and docs/TEMPLATE-JSON.md section 6. The owner's
 * journal writes the file and the owner pastes it whenever the rota or a
 * day changes: nothing may ever have to be erased to be imported again.
 * A date behind today is left as it was lived; today and the dates ahead
 * follow the file wherever they still hold what the file gave them; a
 * ticked block, one moved by hand and a task written by hand stay; and
 * today is cut at now. Every template, block and recipe here is invented.
 */

/** A file of five kinds: a day shift, two nights, a free day and the day after nights. */
function file(day: object[], roster: Record<string, string>): string {
  return JSON.stringify({
    templates: [
      { name: 'Day shift', type: 'shift', kind: 'D', blocks: day },
      {
        name: 'Night shift',
        type: 'night',
        kind: 'N',
        afterNight: 'N2',
        blocks: [
          { time: '18:00', title: 'Travel in', minutes: 45 },
          { time: '19:00', title: 'Shift', minutes: 720, core: true, ongoing: true },
          { time: '01:00', title: 'Night meal', minutes: 30, afterMidnight: true },
          { time: '07:15', title: 'Travel home', minutes: 45, afterMidnight: true },
        ],
      },
      { name: 'Second night', type: 'night', kind: 'N2', blocks: [{ time: '19:00', title: 'Shift', minutes: 720, core: true, ongoing: true }] },
      { name: 'Free day', kind: 'L', afterNight: 'P', blocks: [{ time: '09:00', title: 'Long breakfast', minutes: 45 }, { time: '11:00', title: 'Something outside', minutes: 90 }] },
      { name: 'After nights', type: 'rest', kind: 'P', blocks: [{ time: '12:00', title: 'Late breakfast', minutes: 30 }] },
    ],
    roster,
  })
}

/** The day shift as it was first written. */
const DAY_ONE = [
  { time: '06:00', title: 'Travel in', minutes: 45 },
  { time: '07:00', title: 'Shift', minutes: 720, core: true, ongoing: true },
  { time: '12:00', title: 'Lunch', minutes: 30, recipes: ['A lentil soup'] },
  { time: '15:00', title: 'Coffee', minutes: 15 },
  { time: '19:30', title: 'Travel home', minutes: 45 },
]

/**
 * The day shift written again: Travel in a quarter earlier, Lunch another
 * recipe, Coffee renamed Tea - a block of another title, to the file - Travel
 * home gone, and Stretch new.
 */
const DAY_TWO = [
  { time: '05:45', title: 'Travel in', minutes: 45 },
  { time: '07:00', title: 'Shift', minutes: 720, core: true, ongoing: true },
  { time: '12:00', title: 'Lunch', minutes: 30, recipes: ['A bean bowl'] },
  { time: '15:00', title: 'Tea', minutes: 15 },
  { time: '20:30', title: 'Stretch', minutes: 15 },
]

/** Two weeks of the rota, as the file writes it. */
const ROSTER = {
  '2030-01-07': 'D',
  '2030-01-08': 'D',
  '2030-01-09': 'L',
  '2030-01-10': 'D',
  '2030-01-11': 'D',
  '2030-01-12': 'N',
  '2030-01-13': 'N',
  '2030-01-14': 'L',
  '2030-01-15': 'L',
  '2030-01-16': 'D',
  '2030-01-17': 'L',
  '2030-01-18': 'D',
}

/** The same rota, with one day shift made a night. */
const ROSTER_TWO = { ...ROSTER, '2030-01-16': 'N' }

const at = (day: number, hour: number, minute = 0) => vi.setSystemTime(new Date(2030, 0, day, hour, minute))
const tasksOn = (date: string): Task[] => getData().days[date]?.tasks ?? []
const titled = (date: string, title: string) => tasksOn(date).find(t => t.title === title)!
/** A date's own tasks as time and title, in order - last night's hours left out. */
const own = (date: string) =>
  tasksOn(date)
    .filter(t => !t.nightOf)
    .map(t => `${t.time ?? '--:--'} ${t.title}`)
    .sort()
const recipeOf = (date: string, title: string) => getData().recipes.find(r => r.id === titled(date, title).recipeId)?.title

function start(): void {
  const data: AppData = defaultData()
  data.recipes = [
    { id: 'soup', title: 'A lentil soup', text: '' },
    { id: 'bowl', title: 'A bean bowl', text: '' },
  ]
  actions.resetForTests(data)
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  at(7, 8)
  start()
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * The owner's week: the file imported on the 7th; the 7th lived with two
 * blocks ticked, the 8th with one moved by hand, the 9th with a line written
 * by hand; and ahead, a Lunch on the 11th moved by hand, a line written on
 * the 18th, and on the 10th - today, when the file comes again - Travel home
 * ticked early. The file comes again on the 10th at one in the afternoon.
 */
function liveThreeDaysThenPasteAgain(roster = ROSTER_TWO): ReturnType<typeof actions.importTemplatesJson> {
  actions.importTemplatesJson(file(DAY_ONE, ROSTER))
  actions.toggleTask('2030-01-07', titled('2030-01-07', 'Lunch').id)
  actions.toggleTask('2030-01-07', titled('2030-01-07', 'Travel home').id)
  actions.setTaskTime('2030-01-08', titled('2030-01-08', 'Coffee').id, '15:30')
  actions.addTask('2030-01-09', 'Call a friend', '17:00')
  actions.setTaskTime('2030-01-11', titled('2030-01-11', 'Lunch').id, '12:30')
  actions.addTask('2030-01-18', 'Call the bank', '16:00')
  at(10, 13)
  actions.toggleTask('2030-01-10', titled('2030-01-10', 'Travel home').id)
  return actions.importTemplatesJson(file(DAY_TWO, roster))
}

describe('the file pasted again', () => {
  test('a date behind today is left exactly as it was lived', () => {
    actions.importTemplatesJson(file(DAY_ONE, ROSTER))
    actions.toggleTask('2030-01-07', titled('2030-01-07', 'Lunch').id)
    actions.setTaskTime('2030-01-08', titled('2030-01-08', 'Coffee').id, '15:30')
    actions.addTask('2030-01-09', 'Call a friend', '17:00')
    at(10, 13)
    const lived = ['2030-01-07', '2030-01-08', '2030-01-09'].map(date => getData().days[date])
    actions.importTemplatesJson(file(DAY_TWO, ROSTER_TWO))
    expect(['2030-01-07', '2030-01-08', '2030-01-09'].map(date => getData().days[date])).toEqual(lived)
    expect(own('2030-01-07')).toContain('19:30 Travel home')
  })

  test('a date ahead that nobody touched follows the file: a time moved, a recipe changed, a block renamed, one taken away and one added', () => {
    liveThreeDaysThenPasteAgain()
    expect(own('2030-01-18')).toEqual(['05:45 Travel in', '07:00 Shift', '12:00 Lunch', '15:00 Tea', '16:00 Call the bank', '20:30 Stretch'])
    expect(recipeOf('2030-01-18', 'Lunch')).toBe('A bean bowl')
    // What the day keeps of the block it follows: its id, and the echo of what it was given now.
    expect(titled('2030-01-18', 'Travel in').fromBlock).toMatchObject({ time: '05:45' })
  })

  test('what a person did ahead stays: a block moved by hand keeps its time, and a line written by hand is nobody else', () => {
    liveThreeDaysThenPasteAgain()
    expect(titled('2030-01-11', 'Lunch').time).toBe('12:30')
    // The field the person did not touch still follows the file.
    expect(recipeOf('2030-01-11', 'Lunch')).toBe('A bean bowl')
    expect(titled('2030-01-18', 'Call the bank')).toMatchObject({ time: '16:00' })
  })

  test('today is cut at now: what has ended stays as it was lived, what is still running or ahead follows the file, and a ticked block stays', () => {
    liveThreeDaysThenPasteAgain()
    // Travel in and Lunch ended this morning: as they were, time and recipe.
    expect(titled('2030-01-10', 'Travel in').time).toBe('06:00')
    expect(recipeOf('2030-01-10', 'Lunch')).toBe('A lentil soup')
    // Coffee is still ahead and its block has gone, so Tea is in its place;
    // Stretch is new and ahead, so it arrives.
    expect(own('2030-01-10')).toEqual(['06:00 Travel in', '07:00 Shift', '12:00 Lunch', '15:00 Tea', '19:30 Travel home', '20:30 Stretch'])
    // Travel home was ticked this morning, so it stays although its block went.
    expect(titled('2030-01-10', 'Travel home').done).toBe(true)
  })

  test('a key block the file adds arrives unmarked on a date that already has its three key tasks', () => {
    const keyed = DAY_ONE.map((b, i) => (i < 3 ? { ...b, key: true } : b))
    actions.importTemplatesJson(file(keyed, ROSTER))
    at(10, 5)
    actions.importTemplatesJson(file([...keyed, { time: '21:00', title: 'Plan tomorrow', minutes: 10, key: true }], ROSTER))
    expect(titled('2030-01-11', 'Plan tomorrow').highlight).toBe(false)
    expect(tasksOn('2030-01-11').filter(t => t.highlight)).toHaveLength(3)
  })

  test('a block the file adds arrives today only where it has not ended yet', () => {
    actions.importTemplatesJson(file(DAY_ONE, ROSTER))
    at(10, 21)
    actions.importTemplatesJson(file([...DAY_ONE, { time: '08:00', title: 'Stand-up', minutes: 15 }, { time: '21:30', title: 'Read', minutes: 30 }], ROSTER))
    expect(own('2030-01-10')).not.toContain('08:00 Stand-up')
    expect(own('2030-01-10')).toContain('21:30 Read')
    expect(own('2030-01-11')).toContain('08:00 Stand-up')
  })

  test('a kind the file changes is stamped anew on that date, and the date after it follows - no other date is stamped', () => {
    liveThreeDaysThenPasteAgain()
    const kinds = (dates: string[]) => dates.map(date => kindOnDate(getData(), date)?.dayKind?.letter)
    expect(kinds(['2030-01-15', '2030-01-16', '2030-01-17', '2030-01-18'])).toEqual(['L', 'N', 'P', 'D'])
    expect(own('2030-01-16')).toEqual(['18:00 Travel in', '19:00 Shift'])
    // The night's hours are on the morning after, and the free day there is the day after nights.
    expect(tasksOn('2030-01-17').filter(t => t.nightOf === '2030-01-16').map(t => t.title)).toEqual(['Night meal', 'Travel home'])
    expect(own('2030-01-17')).toEqual(['12:00 Late breakfast'])
  })

  test('the same file pasted twice changes nothing the second time', () => {
    liveThreeDaysThenPasteAgain()
    const once = getData()
    const { read } = actions.importTemplatesJson(file(DAY_TWO, ROSTER_TWO))
    expect(getData()).toBe(once)
    expect(read.refresh).toEqual({ ahead: [], behind: 0, kept: 0 })
    expect(new Set(read.templates.map(t => t.action))).toEqual(new Set(['unchanged']))
  })

  test('the preview says how many dates ahead follow the file, how many dates behind are left, and how many ticked blocks stay', () => {
    const { read } = liveThreeDaysThenPasteAgain()
    // Ahead: today, the 11th and the 18th carry the day shift the file changed;
    // the 16th is a night now, which the roster says. Behind: the 7th and the 8th.
    expect(read.refresh).toEqual({ ahead: ['2030-01-10', '2030-01-11', '2030-01-18'], behind: 2, kept: 1 })
    expect(importSummary(read)).toContain('3 dates ahead refreshed, 2 past dates untouched, 1 ticked block kept.')
  })
})

describe("today's kind changed by the file", () => {
  test('what today has lived stays - a block that ended, and a ticked one - and the new kind arrives where it has not ended', () => {
    actions.importTemplatesJson(file(DAY_ONE, ROSTER))
    at(10, 10)
    actions.toggleTask('2030-01-10', titled('2030-01-10', 'Coffee').id)
    actions.importTemplatesJson(file(DAY_ONE, { ...ROSTER, '2030-01-10': 'L' }))
    expect(kindOnDate(getData(), '2030-01-10')?.dayKind?.letter).toBe('L')
    // The day shift's Travel in ended at a quarter to seven; Coffee was
    // ticked; the shift itself, Lunch and Travel home had not ended and go.
    // Of the free day, Long breakfast ended at a quarter to ten.
    expect(own('2030-01-10')).toEqual(['06:00 Travel in', '11:00 Something outside', '15:00 Coffee'])
    expect(titled('2030-01-10', 'Coffee').done).toBe(true)
  })
})

describe('a day opened after its template changed', () => {
  test('today keeps what has ended as it was, and the rest follows the template', () => {
    actions.importTemplatesJson(file(DAY_ONE, ROSTER))
    at(10, 13)
    actions.ensureDay('2030-01-10')
    const data = getData()
    const day = data.templates.find(t => t.name === 'Day shift')!
    actions.updateTemplate({ ...day, blocks: day.blocks.map(b => (b.title === 'Lunch' || b.title === 'Coffee' ? { ...b, title: `${b.title}, changed` } : b)) })
    actions.ensureDay('2030-01-10')
    actions.ensureDay('2030-01-11')
    expect(own('2030-01-10')).toContain('12:00 Lunch')
    expect(own('2030-01-10')).toContain('15:00 Coffee, changed')
    expect(own('2030-01-11')).toContain('12:00 Lunch, changed')
  })

  test('a note written on a block reaches today even where the block has ended: it is words about the block, not what the day did', () => {
    actions.importTemplatesJson(file(DAY_ONE, ROSTER))
    at(10, 13)
    actions.ensureDay('2030-01-10')
    const day = getData().templates.find(t => t.name === 'Day shift')!
    actions.updateTemplate({ ...day, blocks: day.blocks.map(b => (b.title === 'Travel in' ? { ...b, note: 'Take the early bus.', time: '05:30' } : b)) })
    actions.ensureDay('2030-01-10')
    expect(titled('2030-01-10', 'Travel in')).toMatchObject({ time: '06:00', note: 'Take the early bus.' })
  })
})
