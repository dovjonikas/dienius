import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EveningClose } from './EveningClose'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

// Lithuania's clock - docs/RESEARCH-SHIFTS.md section 4.4.
process.env.TZ = 'Europe/Vilnius'

/**
 * The close of a night, on the page it is read on - the owner's brief of
 * 2026-09-25, before the freeze. The night ends when its sleep begins the
 * morning after, so its card comes at eight on today's page and closes the
 * night, not the morning; never while the shift runs; and on the nights the
 * clocks change, at eight on the wall all the same. Every name is invented.
 */

const FILE = (night: string, morning: string) =>
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
          { time: '02:30', title: 'Snack', minutes: 20, core: true, afterMidnight: true },
        ],
      },
      { name: 'After nights', type: 'rest', kind: 'P', sleep: { from: '08:30', to: '13:30' }, blocks: [{ time: '16:00', title: 'Walk', minutes: 60, core: true }] },
    ],
    roster: { [night]: 'N', [morning]: 'P' },
  })

const DISMISSED_KEY = 'dienius:evening-dismissed'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe.each([
  { name: 'an ordinary night', night: '2026-10-07', morning: '2026-10-08' },
  { name: 'the night the clocks go back', night: '2026-10-24', morning: '2026-10-25' },
  { name: 'the night the clocks go forward', night: '2027-03-27', morning: '2027-03-28' },
])('$name', ({ night, morning }) => {
  const at = (date: string, clock: string) => {
    const [y, m, d] = date.split('-').map(Number)
    const [h, min] = clock.split(':').map(Number)
    return new Date(y, m - 1, d, h, min)
  }

  beforeEach(() => {
    vi.setSystemTime(at(night, '12:00'))
    actions.resetForTests(defaultData())
    const { read } = actions.importTemplatesJson(FILE(night, morning))
    expect(read.error).toBeUndefined()
  })

  test('nothing while the shift runs, nothing before eight, and at eight on the wall the night is closed on the morning page', async () => {
    const user = userEvent.setup()
    for (const clock of ['23:00']) {
      vi.setSystemTime(at(night, clock))
      const { container, unmount } = render(<EveningClose date={night} />)
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
    for (const clock of ['02:30', '06:59', '07:59']) {
      vi.setSystemTime(at(morning, clock))
      const { container, unmount } = render(<EveningClose date={morning} />)
      expect(container, clock).toBeEmptyDOMElement()
      unmount()
    }

    vi.setSystemTime(at(morning, '08:00'))
    render(<EveningClose date={morning} />)
    const card = screen.getByRole('complementary', { name: 'Closing the day' })
    expect(card).toHaveTextContent('That was the night')
    // The night's own sentence: its shift and its snack after midnight, and not the morning's walk.
    expect(card).toHaveTextContent('of 2')

    await act(() => user.click(screen.getByRole('button', { name: 'Close the day' })))
    expect(localStorage.getItem(DISMISSED_KEY)).toBe(night)
    expect(screen.queryByRole('complementary', { name: 'Closing the day' })).toBeNull()
  })
})

test("a night's card says the North signature at its foot, as every close does", () => {
  vi.setSystemTime(new Date(2026, 9, 7, 12, 0))
  actions.resetForTests(defaultData())
  actions.importTemplatesJson(FILE('2026-10-07', '2026-10-08'))
  actions.setPicture('An introduction line.\n\nFIRST HEADING\na line under it\n---\nA signature line.')
  vi.setSystemTime(new Date(2026, 9, 8, 8, 30))
  const { container } = render(<EveningClose date="2026-10-08" />)
  expect(screen.getByRole('complementary', { name: 'Closing the day' })).toHaveTextContent('That was the night')
  expect(container.querySelector('.evening-close-north')?.textContent).toBe('A signature line.')
})

test('a push the morning after goes to today, the date after the night', async () => {
  vi.setSystemTime(new Date(2026, 9, 7, 12, 0))
  actions.resetForTests(defaultData())
  actions.importTemplatesJson(FILE('2026-10-07', '2026-10-08'))
  actions.addTask('2026-10-07', 'Paperwork')
  // The journey in and the shift were lived, as the clock ends them in the app.
  for (const task of getData().days['2026-10-07'].tasks) if (task.title !== 'Paperwork') actions.toggleTask('2026-10-07', task.id)
  vi.setSystemTime(new Date(2026, 9, 8, 8, 0))
  render(<EveningClose date="2026-10-08" />)
  expect(screen.getByRole('button', { name: 'Push 1 to today' })).toBeInTheDocument()
})
