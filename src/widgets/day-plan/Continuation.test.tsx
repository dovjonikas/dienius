import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayView } from './DayView'
import { actions } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { addDays, todayKey } from '../../lib/dates'

/**
 * The day after a night shift - rotating shifts, v2.29 stage 9, and
 * docs/RESEARCH-SHIFTS.md section 3.3. A block belongs to the date it starts
 * on, so the shift is yesterday's; what the morning shows is its last hours,
 * at the top of the day, named for what it is and not one of today's tasks.
 */

beforeEach(() => {
  localStorage.clear()
})

test("the morning after a night shift draws the shift's last hours at the top, named for yesterday", () => {
  const today = todayKey()
  const yesterday = addDays(today, -1)
  actions.resetForTests({
    ...defaultData(),
    settings: { ...defaultData().settings, timelineExpanded: true },
    days: {
      [yesterday]: { date: yesterday, tasks: [{ id: 'n', title: 'Night shift', time: '22:00', minutes: 480, done: false }] },
      [today]: { date: today, tasks: [{ id: 'w', title: 'Walk', time: '15:00', minutes: 30, done: false }] },
    },
  })
  render(<DayView date={today} onDateChange={() => {}} onOpenNorth={() => {}} />)

  expect(screen.getByText('Night shift, from yesterday')).toBeInTheDocument()
  expect(screen.getByText('until 06:00')).toBeInTheDocument()
})

test('a morning with nothing carried into it draws no continuation', () => {
  const today = todayKey()
  actions.resetForTests({
    ...defaultData(),
    settings: { ...defaultData().settings, timelineExpanded: true },
    days: { [today]: { date: today, tasks: [{ id: 'w', title: 'Walk', time: '15:00', minutes: 30, done: false }] } },
  })
  render(<DayView date={today} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(screen.queryByText(/from yesterday/)).toBeNull()
})
