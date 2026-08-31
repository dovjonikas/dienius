import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayView } from './DayView'
import { actions } from '../../lib/store'
import { defaultData } from '../../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('quick add creates a task on Enter', async () => {
  const user = userEvent.setup()
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.type(screen.getByPlaceholderText(/add a task/i), '14:00 Call mom{Enter}')
  expect(screen.getByText('Call mom')).toBeInTheDocument()
  expect(screen.getByText('14:00')).toBeInTheDocument()
})

test('clicking a task toggles done', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Gym')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('checkbox', { name: /gym/i }))
  expect(screen.getByRole('checkbox', { name: /gym/i })).toBeChecked()
})

test('rollover button moves unfinished tasks to tomorrow', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Unfinished')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: /move .* to tomorrow/i }))
  expect(screen.queryByText('Unfinished')).not.toBeInTheDocument()
})

test('arrows navigate between days', async () => {
  const user = userEvent.setup()
  let navigated = ''
  render(<DayView date="2026-09-01" onDateChange={d => (navigated = d)} />)
  await user.click(screen.getByRole('button', { name: 'Next day' }))
  expect(navigated).toBe('2026-09-02')
})
