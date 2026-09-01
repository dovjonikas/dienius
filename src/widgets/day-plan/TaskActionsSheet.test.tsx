import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Task } from '../../lib/types'
import { TaskActionsSheet } from './TaskActionsSheet'

function float(id: string, minutes?: number, extra: Partial<Task> = {}): Task {
  return { id, title: id, done: false, minutes, ...extra }
}

function anchor(id: string, time: string, minutes?: number, extra: Partial<Task> = {}): Task {
  return { id, title: id, done: false, time, minutes, ...extra }
}

function noop() {}

const HANDLERS = {
  onPlace: noop,
  onUnanchor: noop,
  onPush: noop,
  onSetOngoing: noop,
  onDelete: noop,
  onClose: noop,
}

test('opens as a dialog named after the task, focused on mount', () => {
  render(
    <TaskActionsSheet
      task={float('Guitar', 20)}
      tasks={[float('Guitar', 20), anchor('Shift', '09:00', 240)]}
      {...HANDLERS}
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
  render(<TaskActionsSheet task={float('Guitar', 20)} tasks={tasks} {...HANDLERS} />)
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
  render(<TaskActionsSheet task={float('Guitar', 20)} tasks={tasks} {...HANDLERS} onPlace={onPlace} onClose={onClose} />)
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
  render(<TaskActionsSheet task={float('Deep work', 300)} tasks={tasks} {...HANDLERS} />)
  expect(screen.queryByRole('button', { name: /free/i })).not.toBeInTheDocument()
  expect(screen.getByText(/no free gaps/i)).toBeInTheDocument()
})

test('an unsized float is offered every gap that exists, since fit is unknown rather than false', () => {
  const tasks = [
    float('Call grandma'),
    anchor('Morning shift', '07:00', 120),
    anchor('Evening call', '18:00', 30),
  ]
  render(<TaskActionsSheet task={float('Call grandma')} tasks={tasks} {...HANDLERS} />)
  expect(screen.getByRole('button', { name: /9h free/i })).toBeInTheDocument()
})

test('no gaps at all shows the plain message, not a dead control', () => {
  render(<TaskActionsSheet task={float('Guitar', 20)} tasks={[float('Guitar', 20)]} {...HANDLERS} />)
  expect(screen.getByText(/no free gaps/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /free/i })).not.toBeInTheDocument()
})

test('an anchor offers exactly one placement action: remove time', async () => {
  const user = userEvent.setup()
  const onUnanchor = vi.fn()
  const onClose = vi.fn()
  const task = anchor('Shift', '09:00', 240)
  render(<TaskActionsSheet task={task} tasks={[task]} {...HANDLERS} onUnanchor={onUnanchor} onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: /remove time/i }))
  expect(onUnanchor).toHaveBeenCalledWith('Shift')
  expect(onClose).toHaveBeenCalled()
})

test('an anchor never shows the float messaging', () => {
  const task = anchor('Shift', '09:00', 240)
  render(<TaskActionsSheet task={task} tasks={[task]} {...HANDLERS} />)
  expect(screen.queryByText(/no free gaps/i)).not.toBeInTheDocument()
})

test('a float under the bound offers a push action', async () => {
  const user = userEvent.setup()
  const onPush = vi.fn()
  const onClose = vi.fn()
  const task = float('Guitar', 20)
  render(<TaskActionsSheet task={task} tasks={[task]} {...HANDLERS} onPush={onPush} onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: /push guitar to tomorrow/i }))
  expect(onPush).toHaveBeenCalledWith('Guitar')
  expect(onClose).toHaveBeenCalled()
})

test('an anchor never offers a push action - only floats do', () => {
  const task = anchor('Shift', '09:00', 240)
  render(<TaskActionsSheet task={task} tasks={[task]} {...HANDLERS} />)
  expect(screen.queryByRole('button', { name: /push shift/i })).not.toBeInTheDocument()
})

test('a task at the push bound opens with its own do-or-delete sentence, and offers marking it ongoing', async () => {
  const user = userEvent.setup()
  const onSetOngoing = vi.fn()
  const onClose = vi.fn()
  const task = float('Errand', 20, { pushCount: 2 })
  render(<TaskActionsSheet task={task} tasks={[task]} {...HANDLERS} onSetOngoing={onSetOngoing} onClose={onClose} />)
  expect(screen.getByText(/pushed twice - do it today, let it go, or mark it ongoing/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /push errand to tomorrow/i })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /mark errand as ongoing/i }))
  expect(onSetOngoing).toHaveBeenCalledWith('Errand', true)
  expect(onClose).toHaveBeenCalled()
})

test('a task not at the bound shows no do-or-delete sentence and no mark-ongoing action', () => {
  const task = float('Errand', 20)
  render(<TaskActionsSheet task={task} tasks={[task]} {...HANDLERS} />)
  expect(screen.queryByText(/do it today, let it go/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /mark .* as ongoing/i })).not.toBeInTheDocument()
})

test('an ongoing task offers to stop treating it as ongoing, not to mark it ongoing again', async () => {
  const user = userEvent.setup()
  const onSetOngoing = vi.fn()
  const onClose = vi.fn()
  const task = float('Standing task', 20, { pushCount: 6, unbounded: true })
  render(<TaskActionsSheet task={task} tasks={[task]} {...HANDLERS} onSetOngoing={onSetOngoing} onClose={onClose} />)
  expect(screen.queryByRole('button', { name: /^mark standing task as ongoing/i })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /stop treating standing task as ongoing/i }))
  expect(onSetOngoing).toHaveBeenCalledWith('Standing task', false)
  expect(onClose).toHaveBeenCalled()
})

test('deleting is offered as "let go" at the bound and plain "delete" otherwise', async () => {
  const user = userEvent.setup()
  const onDelete = vi.fn()
  const onClose = vi.fn()
  const maxed = float('Errand', 20, { pushCount: 2 })
  render(<TaskActionsSheet task={maxed} tasks={[maxed]} {...HANDLERS} onDelete={onDelete} onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: 'Let go of Errand' }))
  expect(onDelete).toHaveBeenCalledWith('Errand')
  expect(onClose).toHaveBeenCalled()
})

test('a fresh task offers plain delete wording', () => {
  const task = float('Guitar', 20)
  render(<TaskActionsSheet task={task} tasks={[task]} {...HANDLERS} />)
  expect(screen.getByRole('button', { name: 'Delete Guitar' })).toBeInTheDocument()
})

test('a done task offers nothing but delete - no placement, push or ongoing controls', () => {
  const task = float('Finished', 20, { done: true, unbounded: true })
  render(<TaskActionsSheet task={task} tasks={[task]} {...HANDLERS} />)
  expect(screen.queryByText(/no free gaps/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /free/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /push finished/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete Finished' })).toBeInTheDocument()
})

test('escape closes the sheet', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(
    <TaskActionsSheet task={float('Guitar', 20)} tasks={[float('Guitar', 20)]} {...HANDLERS} onClose={onClose} />,
  )
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
})

test('the close button closes the sheet', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(
    <TaskActionsSheet task={float('Guitar', 20)} tasks={[float('Guitar', 20)]} {...HANDLERS} onClose={onClose} />,
  )
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalled()
})
