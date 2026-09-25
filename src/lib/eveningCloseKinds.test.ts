import { beforeEach, describe, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { DEFAULT_EVENING_CLOSE, closingAt, closingDay } from './eveningClose'
import type { Task } from './types'

/**
 * The evening close follows the kind of day - the owner's brief of
 * 2026-09-25, before the freeze. The card comes half an hour before the sleep
 * that ends the day, which is the next date's (a sleep belongs to the day it
 * wakes into): a day shift before its early bedtime, a free day before its
 * late one, and a night the morning after, closing the night rather than the
 * morning. Never while a shift is still running; and a date with no kind
 * keeps the time in Settings, as every evening did before kinds.
 *
 * Every name is invented; the bedtimes are the ones the brief names - a day
 * shift's at 22:00, a free day's at 23:00, and 08:30 the morning after a
 * night.
 */

const FILE = JSON.stringify({
  templates: [
    { name: 'Day shift', type: 'shift', kind: 'D', sleep: { from: '22:00', to: '06:00' }, blocks: [{ time: '07:00', title: 'Shift', minutes: 720, core: true, ongoing: true }] },
    { name: 'Free day', type: 'full', kind: 'L', sleep: { from: '23:00', to: '07:30' }, blocks: [{ time: '16:00', title: 'Walk', minutes: 60 }] },
    {
      name: 'First night',
      type: 'night',
      kind: 'N',
      sleep: { from: '01:30', to: '10:00' },
      blocks: [
        { time: '18:00', title: 'Travel in', minutes: 45 },
        { time: '19:00', title: 'Shift', minutes: 720, core: true, ongoing: true },
        { time: '02:30', title: 'Snack', minutes: 20, afterMidnight: true },
        { time: '07:15', title: 'Travel home', minutes: 25, afterMidnight: true },
      ],
    },
    {
      name: 'Second night',
      type: 'night',
      kind: 'N2',
      sleep: { from: '08:30', to: '15:00' },
      blocks: [
        { time: '19:00', title: 'Shift', minutes: 720, core: true, ongoing: true },
        { time: '02:30', title: 'Snack', minutes: 20, afterMidnight: true },
      ],
    },
    { name: 'After nights', type: 'rest', kind: 'P', sleep: { from: '08:30', to: '13:30' }, blocks: [{ time: '16:00', title: 'Walk', minutes: 60, core: true }] },
  ],
  // Monday 5 October: two days, two nights, the day after, three free days, a day again.
  roster: {
    '2026-10-05': 'D',
    '2026-10-06': 'D',
    '2026-10-07': 'N',
    '2026-10-08': 'N2',
    '2026-10-09': 'P',
    '2026-10-10': 'L',
    '2026-10-11': 'L',
    '2026-10-12': 'L',
    '2026-10-13': 'D',
  },
})

const minutes = (clock: string) => {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}
const never = () => false

/** The date whose day the card closes at `clock` on `today`, or null. */
function closes(today: string, clock: string, dismissed: (date: string) => boolean = never): string | null {
  return closingAt(getData(), today, minutes(clock), dismissed)?.date ?? null
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  const { read } = actions.importTemplatesJson(FILE)
  expect(read.error).toBeUndefined()
})

describe('the card comes half an hour before the sleep that ends the day', () => {
  test('a day shift before its bedtime of 22:00: at 21:30', () => {
    expect(closes('2026-10-05', '21:29')).toBeNull()
    expect(closes('2026-10-05', '21:30')).toBe('2026-10-05')
  })

  test('a free day before its bedtime of 23:00: at 22:30, and not at the time in Settings', () => {
    expect(closes('2026-10-10', '21:30')).toBeNull()
    expect(closes('2026-10-10', '22:29')).toBeNull()
    expect(closes('2026-10-10', '22:30')).toBe('2026-10-10')
  })

  test("a free day before a day shift: the day shift's bedtime ends it, so at 21:30", () => {
    expect(closes('2026-10-12', '21:29')).toBeNull()
    expect(closes('2026-10-12', '21:30')).toBe('2026-10-12')
  })

  test("a day shift before the first night: the night's bedtime after midnight ends it, so the card comes at 01:00 and closes the day shift", () => {
    expect(closes('2026-10-06', '23:59')).toBeNull()
    expect(closes('2026-10-07', '00:59')).toBeNull()
    expect(closes('2026-10-07', '01:00')).toBe('2026-10-06')
  })

  test('a night closes the morning after, at 08:00, and it is the night that is closed - not the morning', () => {
    expect(closes('2026-10-08', '07:59')).toBeNull()
    expect(closes('2026-10-08', '08:00')).toBe('2026-10-07')
    // The second night the same, the morning after it.
    expect(closes('2026-10-09', '07:59')).toBeNull()
    expect(closes('2026-10-09', '08:00')).toBe('2026-10-08')
  })

  test('the day after nights, before a free day: at 22:30', () => {
    expect(closes('2026-10-09', '22:29')).toBeNull()
    expect(closes('2026-10-09', '22:30')).toBe('2026-10-09')
  })

  test('a day closed is closed: the morning close of a night, once taken, leaves the morning alone', () => {
    const closed = new Set(['2026-10-07'])
    expect(closes('2026-10-08', '09:00', date => closed.has(date))).toBeNull()
  })
})

describe('never while a shift is running', () => {
  test('in the middle of a night nothing closes - neither the night nor the morning it runs into', () => {
    for (const clock of ['19:30', '23:59']) expect(closes('2026-10-07', clock)).toBeNull()
    for (const clock of ['00:00', '02:30', '06:59']) expect(closes('2026-10-08', clock)).toBeNull()
  })

  test('a shift running past the time the card would come holds it back until the shift is over', () => {
    const data = getData()
    const day = data.days['2026-10-05']
    const overtime: Task = { id: 'overtime', title: 'Overtime', time: '21:00', minutes: 75, unbounded: true, done: false }
    actions.resetForTests({ ...data, days: { ...data.days, '2026-10-05': { ...day, tasks: [...day.tasks, overtime] } } })
    expect(closes('2026-10-05', '21:30')).toBeNull()
    expect(closes('2026-10-05', '22:14')).toBeNull()
    expect(closes('2026-10-05', '22:15')).toBe('2026-10-05')
  })
})

describe('a date with no kind keeps the time in Settings', () => {
  test('at 21:30 by default, at the time set, and only until midnight - yesterday does not close itself', () => {
    actions.resetForTests(defaultData())
    actions.addTask('2026-10-20', 'Something')
    expect(closes('2026-10-20', '21:29')).toBeNull()
    expect(closes('2026-10-20', '21:30')).toBe('2026-10-20')
    expect(closes('2026-10-21', '00:30')).toBeNull()
    actions.setEveningClose({ ...DEFAULT_EVENING_CLOSE, at: '20:00' })
    expect(closes('2026-10-20', '20:00')).toBe('2026-10-20')
  })

  test('switched off, nothing comes on any kind of day', () => {
    actions.setEveningClose({ ...DEFAULT_EVENING_CLOSE, enabled: false })
    expect(closes('2026-10-05', '21:30')).toBeNull()
    expect(closes('2026-10-08', '08:00')).toBeNull()
  })
})

describe('the day a card closes', () => {
  test("a night's day holds its hours on the morning after, and the morning does not count them again", () => {
    const night = closingDay(getData(), '2026-10-07')!
    expect(night.tasks.map(t => t.title).sort()).toEqual(['Shift', 'Snack', 'Travel home', 'Travel in'])
    const morning = closingDay(getData(), '2026-10-08')!
    expect(morning.tasks.map(t => t.title).sort()).toEqual(['Shift', 'Snack'])
    expect(morning.tasks.every(t => t.nightOf !== '2026-10-07')).toBe(true)
  })
})
