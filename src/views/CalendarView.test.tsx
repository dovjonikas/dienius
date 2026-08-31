import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarView } from './CalendarView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('clicking a day outside stamp mode opens it', async () => {
  const user = userEvent.setup()
  let opened = ''
  render(<CalendarView onOpenDay={d => (opened = d)} />)
  await user.click(screen.getAllByRole('gridcell')[10])
  expect(opened).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('stamping a day stages it and save commits it', async () => {
  const user = userEvent.setup()
  const t = actions.addTemplate({
    name: 'Work day',
    color: '#a7c4f5',
    blocks: [{ time: '09:00', title: 'Gym' }],
  })
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  await user.click(screen.getAllByRole('gridcell')[10])
  expect(getData().days).toEqual({})
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const stamped = Object.values(getData().days)
  expect(stamped).toHaveLength(1)
  expect(stamped[0].templateId).toBe(t.id)
  expect(stamped[0].tasks[0].title).toBe('Gym')
})

test('clicking a stamped day again stages removal', async () => {
  const user = userEvent.setup()
  const t = actions.addTemplate({ name: 'Work day', color: '#a7c4f5', blocks: [] })
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  const cell = screen.getAllByRole('gridcell')[10]
  await user.click(cell)
  await user.click(cell)
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const days = Object.values(getData().days)
  expect(days.every(d => d.templateId !== t.id)).toBe(true)
})
