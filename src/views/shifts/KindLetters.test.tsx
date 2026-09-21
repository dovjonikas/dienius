import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { CalendarView } from '../CalendarView'
import { WeekView } from '../week/WeekView'
import { DayView } from '../../widgets/day-plan/DayView'
import { actions } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { addDays, todayKey } from '../../lib/dates'
import type { AppData, Template } from '../../lib/types'

/**
 * A date's kind, by its letter, wherever the date is drawn - rotating shifts,
 * v2.29 stage 9, and docs/RESEARCH-SHIFTS.md section 2.1. The roster draws a
 * kind as its letter; the day, the week and the month drew the same date as a
 * template's dot and name, so a rota laid out as letters came back as colours.
 * The letter stands where the dot stood, on the date the kind is stamped on -
 * a night shift's date is the evening it starts. Every name here is generic.
 */

const KIND = (id: string, name: string, letter: string, order: number): Template =>
  ({ id, name, color: '#a7c4f5', blocks: [], dayKind: { letter, order } }) as Template

const PLAIN: Template = { id: 'plain', name: 'Working day', color: '#a7e3bd', blocks: [] } as Template

function plan(stamps: Record<string, string>): AppData {
  const data = defaultData()
  data.templates = [KIND('day', 'Day shift', 'D', 0), KIND('night', 'Night shift', 'N', 1), PLAIN]
  data.days = Object.fromEntries(Object.entries(stamps).map(([date, templateId]) => [date, { date, tasks: [], templateId }]))
  return data
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const cell = (date: string) => document.querySelector<HTMLElement>(`[data-date="${date}"]`)!

test("the month draws a stamped kind's letter on its date, and a plain template none", () => {
  const today = todayKey()
  const tomorrow = addDays(today, 1)
  actions.resetForTests(plan({ [today]: 'night', [tomorrow]: 'plain' }))
  render(<CalendarView onOpenDay={() => {}} />)

  expect(cell(today).querySelector('.kind-mark')?.textContent).toBe('N')
  expect(cell(tomorrow).querySelector('.kind-mark')).toBeNull()
})

test("the week's column head draws the kind's letter where a template's dot stands", () => {
  const today = todayKey()
  actions.resetForTests(plan({ [today]: 'day' }))
  render(<WeekView date={today} onDateChange={() => {}} onOpenDay={() => {}} />)

  const chip = screen.getByRole('button', { name: /^Day shift on / })
  expect(chip.querySelector('.kind-mark')?.textContent).toBe('D')
  expect(chip.querySelector('.template-chip-dot')).toBeNull()
})

test("the day's masthead draws the kind's letter where a template's dot stands", () => {
  const today = todayKey()
  actions.resetForTests(plan({ [today]: 'night' }))
  const { container } = render(<DayView date={today} onDateChange={() => {}} onOpenNorth={() => {}} />)

  const chip = container.querySelector<HTMLElement>('.day-template')!
  expect(within(chip).getByText('Night shift')).toBeInTheDocument()
  expect(chip.querySelector('.kind-mark')?.textContent).toBe('N')
  expect(chip.querySelector('.template-chip-dot')).toBeNull()
})
