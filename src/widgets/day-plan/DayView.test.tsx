import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayView } from './DayView'
import { actions, getData } from '../../lib/store'
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
  const tomorrow = getData().days['2026-09-02']
  expect(tomorrow?.tasks.map(t => t.title)).toEqual(['Unfinished'])
})

test('renders without crashing when a day points at a deleted template', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': { date: '2026-09-01', templateId: 'missing-template', tasks: [] },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByPlaceholderText(/add a task/i)).toBeInTheDocument()
  expect(container.querySelector('.day-template')).toBeNull()
})

test('arrows navigate between days', async () => {
  const user = userEvent.setup()
  let navigated = ''
  render(<DayView date="2026-09-01" onDateChange={d => (navigated = d)} />)
  await user.click(screen.getByRole('button', { name: 'Next day' }))
  expect(navigated).toBe('2026-09-02')
})

test('a task that has never been pushed shows no push count', () => {
  actions.addTask('2026-09-01', 'Fresh')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByText(/pushed/i)).not.toBeInTheDocument()
})

test('a task pushed once shows a quiet push count', () => {
  actions.addTask('2026-09-01', 'Once pushed')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t => (t.id === id ? { ...t, pushCount: 1 } : t)),
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  const badge = screen.getByText(/pushed once/i)
  expect(badge).toBeInTheDocument()

  // The push state must be announced along with the task, not only visible.
  const checkbox = screen.getByRole('checkbox', { name: /once pushed/i })
  const describedBy = checkbox.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  expect(document.getElementById(describedBy!)).toBe(badge)
})

test('a task at the push bound offers do or delete instead of another push count badge', () => {
  actions.addTask('2026-09-01', 'Maxed out')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t => (t.id === id ? { ...t, pushCount: 2 } : t)),
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  const note = screen.getByText(/do it today, or let it go/i)
  expect(note).toBeInTheDocument()
  // The note itself must carry the count - it is the only place a maxed
  // task states it, since the separate quiet badge is not shown here.
  expect(note).toHaveTextContent(/pushed twice/i)
  expect(screen.getByRole('button', { name: /let go of maxed out/i })).toBeInTheDocument()

  // The note must be announced along with the task, not only visible.
  const checkbox = screen.getByRole('checkbox', { name: /maxed out/i })
  const describedBy = checkbox.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  expect(document.getElementById(describedBy!)).toBe(note)
})

test('rollover button explains when some tasks moved and some stayed behind', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Fresh task')
  actions.addTask('2026-09-01', 'Maxed task')
  const maxedId = getData().days['2026-09-01'].tasks[1].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t =>
          t.id === maxedId ? { ...t, pushCount: 2 } : t,
        ),
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  const button = screen.getByRole('button', { name: /move 1 to tomorrow/i })
  expect(button).toHaveTextContent(/1 (is )?stay/i)
  await user.click(button)
  expect(screen.queryByText('Fresh task')).not.toBeInTheDocument()
  expect(screen.getByText('Maxed task')).toBeInTheDocument()
})

test('rollover button is not shown when every unfinished task is already at the push bound', () => {
  actions.addTask('2026-09-01', 'Maxed task')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t => (t.id === id ? { ...t, pushCount: 2 } : t)),
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByRole('button', { name: /move .* to tomorrow/i })).not.toBeInTheDocument()
  expect(screen.getByText(/waiting on a decision/i)).toBeInTheDocument()
  expect(screen.queryByText(/need a decision today/i)).not.toBeInTheDocument()
})
