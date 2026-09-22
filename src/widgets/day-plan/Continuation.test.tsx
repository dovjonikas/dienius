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

// The night's own hours on the morning after - section 10 - are drawn in the
// night template's colour, not the morning's: the colour they came from.
test("a night's block on the morning after wears the night's colour, and the morning's own the morning's", () => {
  const today = todayKey()
  const yesterday = addDays(today, -1)
  actions.resetForTests({
    ...defaultData(),
    settings: { ...defaultData().settings, timelineExpanded: true },
    templates: [
      { id: 'night', name: 'Night shift', color: '#c9b3f0', blocks: [] },
      { id: 'rest', name: 'Rest day', color: '#b8e0c8', blocks: [] },
    ],
    days: {
      [yesterday]: { date: yesterday, templateId: 'night', tasks: [] },
      [today]: {
        date: today,
        templateId: 'rest',
        tasks: [
          { id: 'h', title: 'Drive home', time: '07:00', minutes: 30, done: false, fromTemplate: true, nightOf: yesterday, origin: { type: 'template', sourceId: 'night', blockId: 'home' } },
          { id: 'w', title: 'Walk', time: '15:00', minutes: 30, done: false },
        ],
      },
    },
  })
  const { container } = render(<DayView date={today} onDateChange={() => {}} onOpenNorth={() => {}} />)
  const block = (title: string) =>
    [...container.querySelectorAll<HTMLElement>('.timeline-anchor')].find(b => b.textContent?.includes(title))!
  expect(block('Drive home').style.background).toContain('201, 179, 240')
  expect(block('Walk').style.background).toContain('184, 224, 200')
})
