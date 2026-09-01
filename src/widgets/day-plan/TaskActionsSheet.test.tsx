import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Task } from '../../lib/types'
import { TaskActionsSheet } from './TaskActionsSheet'

function float(id: string, minutes?: number): Task {
  return { id, title: id, done: false, minutes }
}

function anchor(id: string, time: string, minutes?: number): Task {
  return { id, title: id, done: false, time, minutes }
}

test('opens as a dialog named after the task, focused on mount', () => {
  render(
    <TaskActionsSheet
      task={float('Guitar', 20)}
      tasks={[float('Guitar', 20), anchor('Shift', '09:00', 240)]}
      onPlace={() => {}}
      onUnanchor={() => {}}
      onClose={() => {}}
    />,
  )
  const dialog = screen.getByRole('dialog', { name: /guitar/i })
  expect(dialog).toHaveFocus()
})

test('a float lists every gap it is allowed into, smallest first', async () => {
  const tasks = [
    float('Guitar', 20),
    anchor('Morning shift', '07:00', 120), // ends 09:00
    anchor('Evening call', '18:00', 30), // gap 09:00-18:00, 9h
  ]
  render(<TaskActionsSheet task={float('Guitar', 20)} tasks={tasks} onPlace={() => {}} onUnanchor={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('button', { name: /9h free.*09:00 to 18:00/i })).toBeInTheDocument()
})

test('tapping a gap places the float at that gap\'s own start and closes', async () => {
  const user = userEvent.setup()
  const onPlace = vi.fn()
  const onClose = vi.fn()
  const tasks = [
    float('Guitar', 20),
    anchor('Morning shift', '07:00', 120),
    anchor('Evening call', '18:00', 30),
  ]
  render(<TaskActionsSheet task={float('Guitar', 20)} tasks={tasks} onPlace={onPlace} onUnanchor={onClose} onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: /9h free/i }))
  expect(onPlace).toHaveBeenCalledWith('Guitar', '09:00')
  expect(onClose).toHaveBeenCalled()
})

test('a gap too small for the float is not offered', () => {
  const tasks = [
    float('Deep work', 300),
    anchor('Morning shift', '07:00', 120),
    anchor('Evening call', '13:00', 30), // gap 09:00-13:00, 4h - too small for 5h
  ]
  render(<TaskActionsSheet task={float('Deep work', 300)} tasks={tasks} onPlace={() => {}} onUnanchor={() => {}} onClose={() => {}} />)
  expect(screen.queryByRole('button', { name: /free/i })).not.toBeInTheDocument()
  expect(screen.getByText(/no free gaps/i)).toBeInTheDocument()
})

test('an unsized float is offered every gap that exists, since fit is unknown rather than false', () => {
  const tasks = [
    float('Call grandma'),
    anchor('Morning shift', '07:00', 120),
    anchor('Evening call', '18:00', 30),
  ]
  render(<TaskActionsSheet task={float('Call grandma')} tasks={tasks} onPlace={() => {}} onUnanchor={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('button', { name: /9h free/i })).toBeInTheDocument()
})

test('no gaps at all shows the plain message, not a dead control', () => {
  render(<TaskActionsSheet task={float('Guitar', 20)} tasks={[float('Guitar', 20)]} onPlace={() => {}} onUnanchor={() => {}} onClose={() => {}} />)
  expect(screen.getByText(/no free gaps/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /free/i })).not.toBeInTheDocument()
})

test('an anchor offers exactly one action: remove time', async () => {
  const user = userEvent.setup()
  const onUnanchor = vi.fn()
  const onClose = vi.fn()
  const task = anchor('Shift', '09:00', 240)
  render(<TaskActionsSheet task={task} tasks={[task]} onPlace={() => {}} onUnanchor={onUnanchor} onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: /remove time/i }))
  expect(onUnanchor).toHaveBeenCalledWith('Shift')
  expect(onClose).toHaveBeenCalled()
})

test('an anchor never shows the float messaging', () => {
  const task = anchor('Shift', '09:00', 240)
  render(<TaskActionsSheet task={task} tasks={[task]} onPlace={() => {}} onUnanchor={() => {}} onClose={() => {}} />)
  expect(screen.queryByText(/no free gaps/i)).not.toBeInTheDocument()
})

test('escape closes the sheet', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(
    <TaskActionsSheet task={float('Guitar', 20)} tasks={[float('Guitar', 20)]} onPlace={() => {}} onUnanchor={() => {}} onClose={onClose} />,
  )
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
})

test('the close button closes the sheet', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(
    <TaskActionsSheet task={float('Guitar', 20)} tasks={[float('Guitar', 20)]} onPlace={() => {}} onUnanchor={() => {}} onClose={onClose} />,
  )
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalled()
})
