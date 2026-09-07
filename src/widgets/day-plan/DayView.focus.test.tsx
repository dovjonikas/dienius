import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { DayView } from './DayView'
import { actions } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { clearClockTools, clockTools } from '../../lib/clockTools'

/**
 * The header and the focus strip never say the same line twice.
 *
 * A focus session puts a strip at the top of the app with the task's name,
 * its countdown and the session's controls, on every tab. On Today the
 * header's own line said the same task and the same countdown directly
 * under it - the README's hero showed the two stacked - and CONVENTIONS
 * section 23 is about exactly that. While the session is on the running
 * task the header keeps the clock alone; the moment it ends, or the session
 * is about some other task, the header says the running task again.
 */

const TODAY = '2026-09-02'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${TODAY}T15:20:00`))
  localStorage.clear()
  clearClockTools()
  actions.resetForTests({
    ...defaultData(),
    days: {
      [TODAY]: {
        date: TODAY,
        tasks: [
          { id: 'email', title: 'Draft the launch email', done: false, time: '15:00', minutes: 60 },
          { id: 'gym', title: 'Gym', done: false, time: '17:30', minutes: 60 },
        ],
      },
    },
  })
})

afterEach(() => {
  clearClockTools()
  vi.useRealTimers()
})

test('while a focus session runs on the running task, the header keeps the clock and leaves the task to the strip', () => {
  const { container } = render(<DayView date={TODAY} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(container.querySelector('.day-now-task')).toHaveTextContent('Draft the launch email')

  act(() => clockTools.startFocus(TODAY, 'email'))
  expect(container.querySelector('.day-now-task')).toBeNull()
  expect(container.querySelector('.day-now-left')).toBeNull()
  expect(container.querySelector('.day-now-clock')).toHaveTextContent('15:20')

  act(() => clockTools.endFocus())
  expect(container.querySelector('.day-now-task')).toHaveTextContent('Draft the launch email')
})

test('a session on some other task leaves the header saying what is running', () => {
  const { container } = render(<DayView date={TODAY} onDateChange={() => {}} onOpenNorth={() => {}} />)
  act(() => clockTools.startFocus(TODAY, 'gym'))
  expect(container.querySelector('.day-now-task')).toHaveTextContent('Draft the launch email')
})
