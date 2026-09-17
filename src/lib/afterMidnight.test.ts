import { expect, test } from 'vitest'
import { defaultData } from './storage'
import { awayOn, awaySince } from './away'
import { carriedIntervals, runningOn } from './shiftDay'
import { clockMinutesOn } from './wallClock'
import type { AppData, Task } from './types'

// Lithuania's clock - docs/RESEARCH-SHIFTS.md section 4.4.
process.env.TZ = 'Europe/Vilnius'

/**
 * What is still true after midnight - rotating shifts, stage 4,
 * docs/RESEARCH-SHIFTS.md section 4.5. A block is its start date's, and at
 * half past midnight last night's shift is still running; a session, an away
 * and a slot all have to know. Generic names and times only.
 */

const YESTERDAY = '2026-09-16'
const TODAY = '2026-09-17'

function shift(over: Partial<Task> = {}): Task {
  return { id: 'night', title: 'Night shift', done: false, time: '22:00', minutes: 480, ...over }
}

function plan(yesterday: Task[], today: Task[] = []): AppData {
  const data = defaultData()
  data.days[YESTERDAY] = { date: YESTERDAY, tasks: yesterday }
  data.days[TODAY] = { date: TODAY, tasks: today }
  return data
}

test("these tests run on Lithuania's clock", () => {
  expect(new Date(2026, 9, 25, 12).getTimezoneOffset()).toBe(-120)
})

test("a moment reads on a date's clock as minutes past that date's midnight, past 1440 on the days after it", () => {
  expect(clockMinutesOn(YESTERDAY, new Date(2026, 8, 17, 1, 30))).toBe(24 * 60 + 90)
  expect(clockMinutesOn(TODAY, new Date(2026, 8, 17, 1, 30))).toBe(90)
  expect(clockMinutesOn('2026-10-24', new Date(2026, 9, 25, 3, 30))).toBe(24 * 60 + 210)
})

test("at half past midnight last night's shift is what is running, with its real time left, and yesterday's date", () => {
  const running = runningOn(plan([shift()]), TODAY, 30)
  expect(running).toEqual({ task: shift(), date: YESTERDAY, left: 330 })
})

test("today's own block that has started wins over last night's, and a ticked shift or one that has ended is not running", () => {
  const early = { id: 'early', title: 'Early call', done: false, time: '00:15', minutes: 45 }
  expect(runningOn(plan([shift()], [early]), TODAY, 30)?.task.id).toBe('early')
  expect(runningOn(plan([shift({ done: true })]), TODAY, 30)).toBeUndefined()
  expect(runningOn(plan([shift()]), TODAY, 6 * 60)).toBeUndefined()
})

test('the time left on the night the clocks go back is an hour more than the clock face shows', () => {
  const data = defaultData()
  data.days['2026-10-24'] = { date: '2026-10-24', tasks: [shift()] }
  expect(runningOn(data, '2026-10-24', 23 * 60)?.left).toBe(8 * 60)
  expect(runningOn(data, '2026-10-25', 60)?.left).toBe(6 * 60)
})

test("last night's shift is busy time on today's clock up to where it ends, and nothing of a block that ended by midnight", () => {
  const evening = { id: 'evening', title: 'Evening', done: false, time: '20:00', minutes: 240 }
  expect(carriedIntervals(plan([shift(), evening]), TODAY)).toEqual([{ start: 0, end: 360 }])
})

test('away set last night is still away after midnight, and says it was yesterday, until today has its own', () => {
  const data = plan([])
  data.days[YESTERDAY] = { ...data.days[YESTERDAY], away: '22:00' }
  const mark = awayOn(data, TODAY, 30)
  expect(mark).toEqual({ date: YESTERDAY, time: '22:00' })
  expect(awaySince(mark!, TODAY)).toBe('22:00 yesterday')

  data.days[TODAY] = { ...data.days[TODAY], away: '07:10' }
  expect(awayOn(data, TODAY, 8 * 60)).toEqual({ date: TODAY, time: '07:10' })
  expect(awaySince(awayOn(data, TODAY, 8 * 60)!, TODAY)).toBe('07:10')
  expect(awayOn(plan([]), TODAY, 30)).toBeUndefined()
})

test("last night's away lasts until the day wakes: after the sleep it wakes from, a new day has begun", () => {
  const data = plan([])
  data.days[YESTERDAY] = { ...data.days[YESTERDAY], away: '15:00' }
  // The default schedule wakes at 07:00.
  expect(awayOn(data, TODAY, 6 * 60 + 59)).toEqual({ date: YESTERDAY, time: '15:00' })
  expect(awayOn(data, TODAY, 7 * 60)).toBeUndefined()
  expect(awayOn(data, TODAY, 15 * 60)).toBeUndefined()
})
