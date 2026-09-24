import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { realMinutes } from './wallClock'
import { wakingDayOn } from './shiftDay'
import { dayPath, dayRecord } from './archive'

// Lithuania's clock - docs/RESEARCH-SHIFTS.md section 4.4.
process.env.TZ = 'Europe/Vilnius'

/**
 * A night shift on the nights a clock can break it - the owner's shift brief
 * of 2026-09-25, stage 5: the night the clocks go back, the night they go
 * forward, the last night of a month and of a year. A night shift from 19:00
 * to 07:00 on the wall, its snack at 02:30 and its journey home at 07:15 and
 * 07:40 after midnight, and the day after nights, which sleeps in the
 * morning. Every name is invented.
 */

const FILE = (roster: Record<string, string>) =>
  JSON.stringify({
    templates: [
      {
        name: 'Night shift',
        type: 'night',
        kind: 'N',
        sleep: { from: '08:30', to: '15:30' },
        blocks: [
          { time: '18:00', title: 'Travel in', minutes: 45 },
          { time: '19:00', title: 'Shift', minutes: 720, core: true, ongoing: true },
          { time: '02:30', title: 'Snack', minutes: 20, afterMidnight: true },
          { time: '07:15', title: 'Travel home', minutes: 25, afterMidnight: true },
          { time: '07:40', title: 'Wind down', minutes: 30, afterMidnight: true },
        ],
      },
      // The day after nights wakes from a sleep in the morning, after the journey home.
      { name: 'After nights', type: 'rest', kind: 'P', sleep: { from: '08:30', to: '15:30' }, blocks: [{ time: '16:00', title: 'Walk', minutes: 60 }] },
    ],
    roster,
  })

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min)
const task = (date: string, title: string) => getData().days[date].tasks.find(t => t.title === title)!
const night = (date: string, of: string) =>
  getData()
    .days[date].tasks.filter(t => t.nightOf === of)
    .map(t => `${t.time} ${t.title}`)
    .sort()

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  actions.resetForTests(defaultData())
})

afterEach(() => {
  vi.useRealTimers()
})

test("these tests run on Lithuania's clock: 25 October 2026 has twenty-five hours, 28 March 2027 twenty-three", () => {
  expect(at(2026, 10, 26, 0).getTime() - at(2026, 10, 25, 0).getTime()).toBe(25 * 3600_000)
  expect(at(2027, 3, 29, 0).getTime() - at(2027, 3, 28, 0).getTime()).toBe(23 * 3600_000)
})

/** No timed task of a date stands in the sleep it wakes from or tonight's. */
function outOfSleep(date: string, today: string) {
  const day = wakingDayOn(getData(), date, today)
  for (const sleep of [day.woke, day.tonight]) {
    if (!sleep) continue
    for (const t of getData().days[date].tasks.filter(t => t.time && t.minutes)) {
      const [h, m] = t.time!.split(':').map(Number)
      const start = h * 60 + m
      expect(Math.min(start + t.minutes!, sleep.end) - Math.max(start, sleep.start), `${date} ${t.title} in a sleep`).toBeLessThanOrEqual(0)
    }
  }
}

describe.each([
  { name: 'the clocks go back', night: '2026-10-24', morning: '2026-10-25', hours: 13 },
  { name: 'the clocks go forward', night: '2027-03-27', morning: '2027-03-28', hours: 11 },
])('the night $name', ({ night: date, morning, hours }) => {
  test(`the shift from 19:00 to 07:00 lasts ${hours} hours, ends by itself at 07:00 and not before, and the night's hours are the morning's at their times`, () => {
    const [y, m, d] = date.split('-').map(Number)
    vi.setSystemTime(at(y, m, d, 8))
    actions.importTemplatesJson(FILE({ [date]: 'N', [morning]: 'P' }))
    expect(realMinutes(date, 19 * 60, 720)).toBe(hours * 60)
    expect(night(morning, date)).toEqual(['02:30 Snack', '07:15 Travel home', '07:40 Wind down'])

    // A minute before seven on the wall, the shift is still on; at seven it has ended by itself.
    const [my, mm, md] = morning.split('-').map(Number)
    vi.setSystemTime(at(my, mm, md, 6, 59))
    actions.endSelfEndingBlocks(at(my, mm, md, 6, 59))
    expect(task(date, 'Shift').done).toBe(false)
    vi.setSystemTime(at(my, mm, md, 7, 0))
    actions.endSelfEndingBlocks(at(my, mm, md, 7, 0))
    expect(task(date, 'Shift')).toMatchObject({ done: true, doneAt: at(my, mm, md, 7, 0).toISOString() })

    // Nothing of either date in a sleep; and the archive says the night as it was.
    outOfSleep(date, date)
    outOfSleep(morning, date)
    expect(dayRecord(getData(), date)!.tasks.find(t => t.title === 'Shift')).toMatchObject({ time: '19:00', minutes: 720, done: true, doneAt: at(my, mm, md, 7, 0).toISOString() })
    expect(dayRecord(getData(), morning)!.tasks.filter(t => t.from === 'night').map(t => [t.time, t.title, t.night])).toEqual([
      ['02:30', 'Snack', date],
      ['07:15', 'Travel home', date],
      ['07:40', 'Wind down', date],
    ])
  })
})

describe('the last night of a month, and of a year', () => {
  test("its hours are the next month's first morning, and the next year's, and the archive files them there", () => {
    vi.setSystemTime(at(2026, 10, 30, 8))
    actions.importTemplatesJson(FILE({ '2026-10-31': 'N', '2026-11-01': 'P', '2026-12-31': 'N', '2027-01-01': 'P' }))
    expect(night('2026-11-01', '2026-10-31')).toEqual(['02:30 Snack', '07:15 Travel home', '07:40 Wind down'])
    expect(night('2027-01-01', '2026-12-31')).toEqual(['02:30 Snack', '07:15 Travel home', '07:40 Wind down'])
    expect(getData().days['2026-10-31'].tasks.filter(t => t.nightOf)).toEqual([])
    expect(dayPath('2026-11-01')).toBe('archive/days/2026/11/2026-11-01.json')
    expect(dayPath('2027-01-01')).toBe('archive/days/2027/01/2027-01-01.json')
    expect(dayRecord(getData(), '2027-01-01')!.tasks.filter(t => t.from === 'night').map(t => t.night)).toEqual(['2026-12-31', '2026-12-31', '2026-12-31'])
    outOfSleep('2026-11-01', '2026-10-30')
    outOfSleep('2027-01-01', '2026-10-30')
  })
})
