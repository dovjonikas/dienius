import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Task } from '../../lib/types'
import { TaskGapOffers } from './TaskGapOffers'

function float(id: string, minutes?: number, done = false): Task {
  return { id, title: id, done, minutes }
}

function anchor(id: string, time: string, minutes?: number): Task {
  return { id, title: id, done: false, time, minutes }
}

test('announces itself as a labelled dialog named for the task', () => {
  const tasks = [anchor('Meeting', '09:00', 60), float('Guitar practice', 20)]
  render(
    <TaskGapOffers task={float('Guitar practice', 20)} tasks={tasks} dayType="full" onPlace={() => {}} onClose={() => {}} />,
  )
  const dialog = screen.getByRole('dialog', { name: 'Guitar practice' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
})

test('focus lands on the dialog itself on open', () => {
  const tasks = [float('Guitar', 20)]
  render(<TaskGapOffers task={float('Guitar', 20)} tasks={tasks} dayType="full" onPlace={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('dialog')).toHaveFocus()
})

test('a task that fits several gaps lists each one with time, duration and neighbours', async () => {
  const user = userEvent.setup()
  const onPlace = vi.fn()
  const tasks = [anchor('Meeting', '09:00', 60), anchor('Gym', '18:00', 60), float('Guitar', 20)]
  render(<TaskGapOffers task={float('Guitar', 20)} tasks={tasks} dayType="full" onPlace={onPlace} onClose={() => {}} />)
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  const middle = screen.getByRole('button', { name: /10:00.*18:00/ })
  expect(middle).toHaveTextContent('between Meeting and Gym')
  await user.click(middle)
  expect(onPlace).toHaveBeenCalledWith('Guitar', '10:00')
})

test('a gap at the edge of the window names only the side that has a neighbour', () => {
  const tasks = [anchor('Meeting', '09:00', 60), float('Guitar', 20)]
  render(<TaskGapOffers task={float('Guitar', 20)} tasks={tasks} dayType="full" onPlace={() => {}} onClose={() => {}} />)
  const before = screen.getByRole('button', { name: /07:00.*09:00/ })
  expect(before).toHaveTextContent('before Meeting')
  const after = screen.getByRole('button', { name: /10:00.*23:00/ })
  expect(after).toHaveTextContent('after Meeting')
})

test('a task with no size says so plainly instead of listing anything', () => {
  const tasks = [float('Guitar')]
  render(<TaskGapOffers task={float('Guitar')} tasks={tasks} dayType="full" onPlace={() => {}} onClose={() => {}} />)
  expect(screen.getByText(/size isn't set/i)).toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

test('a task already anchored says so plainly', () => {
  const tasks = [anchor('Meeting', '09:00', 60)]
  render(<TaskGapOffers task={anchor('Meeting', '09:00', 60)} tasks={tasks} dayType="full" onPlace={() => {}} onClose={() => {}} />)
  expect(screen.getByText(/already has a time/i)).toBeInTheDocument()
})

test('an unsized anchor elsewhere in the day says gaps are not known, matching the timeline\'s own wording', () => {
  const tasks = [anchor('Mystery shift', '09:00'), float('Guitar', 20)]
  render(<TaskGapOffers task={float('Guitar', 20)} tasks={tasks} dayType="full" onPlace={() => {}} onClose={() => {}} />)
  expect(screen.getByText(/not every timed task above has a size yet/i)).toBeInTheDocument()
})

test('a task too big for anything today says so without listing anything', () => {
  const tasks = [anchor('Work', '07:00', 950), float('Big errand', 90)]
  render(<TaskGapOffers task={float('Big errand', 90)} tasks={tasks} dayType="full" onPlace={() => {}} onClose={() => {}} />)
  expect(screen.getByText(/no gap today is 1h30 or longer/i)).toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

test('more than four gaps shows only four, with a way to reveal the rest', async () => {
  const user = userEvent.setup()
  // Six anchors, each 90 minutes, spaced with a 20-minute gap between every
  // pair - seven gaps in total (one edge gap plus six interior ones minus
  // the trailing edge), all fitting a 10-minute float.
  const tasks: Task[] = []
  let t = 7 * 60
  for (let i = 0; i < 6; i++) {
    tasks.push(anchor(`A${i}`, clock(t), 90))
    t += 90 + 20
  }
  tasks.push(float('Guitar', 10))
  render(<TaskGapOffers task={float('Guitar', 10)} tasks={tasks} dayType="full" onPlace={() => {}} onClose={() => {}} />)
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
  const more = screen.getByRole('button', { name: /show \d+ more/i })
  await user.click(more)
  expect(screen.getAllByRole('listitem').length).toBeGreaterThan(4)
  expect(screen.queryByRole('button', { name: /show.*more/i })).not.toBeInTheDocument()
})

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

test('the explicit close button calls onClose', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const tasks = [float('Guitar', 20)]
  render(<TaskGapOffers task={float('Guitar', 20)} tasks={tasks} dayType="full" onPlace={() => {}} onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: /close/i }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('pressing Escape calls onClose', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const tasks = [float('Guitar', 20)]
  render(<TaskGapOffers task={float('Guitar', 20)} tasks={tasks} dayType="full" onPlace={() => {}} onClose={onClose} />)
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('tapping the scrim behind the sheet calls onClose', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const tasks = [float('Guitar', 20)]
  const { container } = render(
    <TaskGapOffers task={float('Guitar', 20)} tasks={tasks} dayType="full" onPlace={() => {}} onClose={onClose} />,
  )
  const scrim = container.querySelector('.task-gap-offers-scrim')!
  await user.click(scrim)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('Tab wraps from the last focusable control back to the first, trapping focus in the sheet', async () => {
  const user = userEvent.setup()
  const tasks = [anchor('Meeting', '09:00', 60), float('Guitar', 20)]
  render(<TaskGapOffers task={float('Guitar', 20)} tasks={tasks} dayType="full" onPlace={() => {}} onClose={() => {}} />)
  const close = screen.getByRole('button', { name: /close/i })
  const rows = screen.getAllByRole('button').filter(b => b !== close)
  const lastRow = rows[rows.length - 1]
  lastRow.focus()
  await user.tab()
  expect(close).toHaveFocus()
  await user.tab({ shift: true })
  expect(lastRow).toHaveFocus()
})
