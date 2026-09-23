import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplatesView } from './TemplatesView'
import { CalendarView } from './CalendarView'
import { TemplateJsonSettings } from './TemplateJsonSettings'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { addDays, todayKey } from '../lib/dates'
import type { AppData, Template } from '../lib/types'

/**
 * A kind after a night on the three screens that say it - RESEARCH-SHIFTS
 * section 2.6: the template editor, where the rest day names the kind it is
 * after a night; the roster's preview, which says which date is read that
 * way; and the templates file's preview, the same. Every name here is invented.
 */

const KIND = (id: string, name: string, letter: string, order: number, over: Partial<Template> = {}): Template =>
  ({ id, name, color: '#a7c4f5', blocks: [], dayKind: { letter, order }, ...over }) as Template

function plan(over: Partial<AppData> = {}): AppData {
  const data = defaultData()
  data.templates = [
    KIND('night', 'Night shift', 'N', 0, { type: 'night' }),
    KIND('rest', 'Rest day', 'L', 1, { type: 'rest', dayKind: { letter: 'L', order: 1, afterNight: 'after' } }),
    KIND('after', 'After nights', 'P', 2, { type: 'rest' }),
  ]
  return { ...data, ...over }
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(plan())
})

test('the editor offers the other kinds as what this kind is after a night, and saves the choice with the mark', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)

  await user.click(screen.getByRole('button', { name: 'Edit Rest day' }))
  const after = screen.getByRole('combobox', { name: 'After a night, this day is' })
  expect(after).toHaveValue('after')
  expect(within(after).getAllByRole('option').map(o => o.textContent)).toEqual(['Itself', 'Night shift', 'After nights'])

  await user.selectOptions(after, 'Itself')
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates.find(t => t.id === 'rest')!.dayKind).toEqual({ letter: 'L', order: 1 })

  await user.click(screen.getByRole('button', { name: 'Edit Rest day' }))
  await user.selectOptions(screen.getByRole('combobox', { name: 'After a night, this day is' }), 'After nights')
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates.find(t => t.id === 'rest')!.dayKind).toEqual({ letter: 'L', order: 1, afterNight: 'after' })

  // A template with no letter is no kind, and is not asked.
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.click(screen.getByRole('button', { name: /^A day/ }))
  expect(screen.queryByRole('combobox', { name: 'After a night, this day is' })).toBeNull()
})

test("the roster's preview says a rest day after a night is read as the after-nights kind", async () => {
  const user = userEvent.setup()
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Roster' }))
  const cell = (date: string) => document.querySelector<HTMLElement>(`[data-date="${date}"]`)!
  const first = addDays(todayKey(), 1)
  const second = addDays(todayKey(), 2)
  // A tap walks N, L, P: one tap on the first date is a night, two on the second a rest day.
  await user.click(cell(first))
  await user.click(cell(second))
  await user.click(cell(second))

  await user.click(screen.getByRole('button', { name: 'Apply' }))
  const preview = screen.getByRole('group', { name: 'What Apply will do' })
  const rows = within(preview).getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('Night shift')
  expect(rows[1]).toHaveTextContent('P')
  expect(rows[1]).toHaveTextContent('After nights')
  expect(rows[1]).toHaveTextContent('Rest day after a night')

  await user.click(screen.getByRole('button', { name: 'Apply 2 days' }))
  expect(getData().days[second].templateId).toBe('after')
})

test("the templates file's preview says it on the date's row", async () => {
  const user = userEvent.setup()
  render(<TemplateJsonSettings />)
  const first = addDays(todayKey(), 1)
  const second = addDays(todayKey(), 2)
  await user.click(screen.getByRole('textbox', { name: 'Templates and roster as JSON' }))
  await user.paste(JSON.stringify({ roster: { [first]: 'N', [second]: 'L' } }))
  await user.click(screen.getByRole('button', { name: 'Preview' }))

  const rows = within(screen.getByRole('list', { name: 'Dates in the file' })).getAllByRole('listitem')
  expect(rows[1]).toHaveTextContent('P, After nights')
  expect(rows[1]).toHaveTextContent('Rest day after a night is After nights.')
})
