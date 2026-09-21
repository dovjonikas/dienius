import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { DayView } from './DayView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { addDays, todayKey } from '../../lib/dates'
import { routineNotes } from '../../lib/shiftDay'
import type { AppData, Routine, Template } from '../../lib/types'

/**
 * A routine that lands on a day with no time says why - rotating shifts, v2.29
 * stage 9, and docs/RESEARCH-SHIFTS.md section 2.3. A kind with no time for it
 * "needs a time"; a time that is not free says what it runs into. The app never
 * guesses a time, so the day has to say it did not. Every name here is a
 * generic one.
 */

const KIND = (id: string, name: string, letter: string, order: number, blocks: Template['blocks'] = []): Template =>
  ({ id, name, color: '#a7c4f5', blocks, dayKind: { letter, order } }) as Template

const ROUTINE = (over: Partial<Routine>): Routine =>
  ({ id: 'gym', title: 'Training', minutes: 60, weekdays: [0, 1, 2, 3, 4, 5, 6], times: {}, ...over }) as Routine

function plan(): AppData {
  const data = defaultData()
  data.templates = [KIND('day', 'Day shift', 'D', 0, [{ id: 'shift', title: 'On shift', time: '07:00', minutes: 480, category: 'core' }])]
  data.routines = [
    ROUTINE({ id: 'gym', title: 'Training', times: { day: '09:00' } }),
    ROUTINE({ id: 'read', title: 'Language practice', minutes: 20, times: {} }),
    ROUTINE({ id: 'walk', title: 'Walk', minutes: 30, times: { day: '17:00' } }),
    ROUTINE({ id: 'late', title: 'Stretching', minutes: 60, times: { day: '22:30' } }),
  ]
  return data
}

const DATE = addDays(todayKey(), 1)

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(plan())
  actions.applyRoster({ [DATE]: 'day' })
})

test('each routine without a time on a date says why, and one at its time says nothing', () => {
  const notes = routineNotes(getData(), DATE)
  expect(notes.get('gym')).toBe('Runs into On shift')
  expect(notes.get('read')).toBe('Needs a time on Day shift')
  expect(notes.has('walk')).toBe(false)
})

// Sleep is what a late routine most often runs into, and it is said as that:
// not as a block of the day's, and not as nothing.
test('a routine whose time runs into the night says it runs into sleep', () => {
  expect(routineNotes(getData(), DATE).get('late')).toBe('Runs into sleep')
})

// The night the clocks go forward in Vilnius has no 03:30. A routine kept at
// that time is not moved to one the app would be guessing, and the day says
// why it has none. Set on the plan directly: the date is behind today, where
// the roster does not reach.
test('on the night the clock skips its time, a routine says so', () => {
  const data = getData()
  data.settings = { ...data.settings, sleepProfiles: [{ id: 'default', name: 'Nights', window: { start: '01:00', end: '02:00' } }] }
  data.routines = [ROUTINE({ id: 'early', title: 'Stretching', minutes: 20, times: { day: '03:30' } })]
  data.days = { ...data.days, '2026-03-29': { date: '2026-03-29', tasks: [], templateId: 'day' } }
  expect(routineNotes(data, '2026-03-29').get('early')).toBe('The clock skips 03:30 that night')
})

test('a date with no kind has no routines to explain', () => {
  expect(routineNotes(getData(), addDays(DATE, 1)).size).toBe(0)
})

test('the day says it on the routine itself', () => {
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(screen.getByText('Runs into On shift')).toBeInTheDocument()
  expect(screen.getByText('Needs a time on Day shift')).toBeInTheDocument()
  // A routine at its time says its time, and nothing about where it went.
  const walk = screen.getByRole('checkbox', { name: 'Walk' }).closest('li')!
  expect(within(walk).getByText('17:00')).toBeInTheDocument()
  expect(walk.querySelector('.task-routine-note')).toBeNull()
})
