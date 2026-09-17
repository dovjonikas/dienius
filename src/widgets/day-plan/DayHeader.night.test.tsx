import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayHeader, type DayHeaderProps } from './DayHeader'

/**
 * Today's header at night - rotating shifts, stage 4. "Sleep in" counts to the
 * next bedtime: tonight's, which is the next date's schedule, and past midnight
 * where that bedtime is. And after midnight last night's shift is what is
 * running, saying its own time left, since today's grid does not draw it.
 * Generic names and times only.
 */

const PROFILES = [
  { id: 'default', name: 'Nights', window: { start: '23:00', end: '07:00' } },
  { id: 'early', name: 'Early', window: { start: '21:30', end: '05:00' } },
  { id: 'late', name: 'Late', window: { start: '01:00', end: '09:00' } },
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 17, 12, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

function header(over: Partial<DayHeaderProps>) {
  const props: DayHeaderProps = {
    date: '2026-09-17',
    onDateChange: () => {},
    template: undefined,
    score: { planned: false, done: 0, total: 0 } as DayHeaderProps['score'],
    isFullDay: true,
    keyCount: 0,
    nowMinutes: 12 * 60,
    runningTask: undefined,
    runningLeft: undefined,
    sleepProfiles: PROFILES,
    daySleepProfileId: 'default',
    isWide: true,
    dayLayoutFocus: 'both',
    onOpenNorth: () => {},
    ...over,
  }
  return render(<DayHeader {...props} />)
}

test('a bedtime after midnight is counted to, not to midnight', () => {
  header({ daySleepProfileId: 'late', nowMinutes: 23 * 60 })
  expect(screen.getByText('Sleep in 2h')).toBeInTheDocument()
})

test("tonight's bedtime is the next date's: before a day shift it is 21:30", () => {
  header({ daySleepProfileId: 'default', tonightProfileId: 'early', nowMinutes: 20 * 60 })
  expect(screen.getByText('Sleep in 1h 30 min')).toBeInTheDocument()
})

test("last night's shift, running after midnight, says its own time left beside the grid, which does not draw it", () => {
  header({
    nowMinutes: 90,
    runningTask: { id: 'night', title: 'Night shift', done: false, time: '22:00', minutes: 480 },
    runningLeft: 270,
    runningOnGrid: false,
  })
  expect(screen.getByText('Night shift')).toBeInTheDocument()
  expect(screen.getByText('4h 30 min left')).toBeInTheDocument()
})

test("today's own running block leaves its time left to the grid beside it", () => {
  header({
    nowMinutes: 10 * 60,
    runningTask: { id: 'deep', title: 'Deep work', done: false, time: '09:00', minutes: 120 },
    runningLeft: 60,
  })
  expect(screen.getByText('Deep work')).toBeInTheDocument()
  expect(screen.queryByText('1h left')).toBeNull()
})
