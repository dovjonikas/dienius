import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Task } from '../../lib/types'
import { TaskActionsSheet } from './TaskActionsSheet'
import { CategorySettings } from '../../views/CategorySettings'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

/**
 * Blocks that end by themselves, on the screen - the owner's brief of
 * 2026-09-22, part 1. The rules are lib/selfEnding.test.ts; here is where a
 * person says a block did not happen, sees that it did not, and tells a
 * category its blocks end by themselves.
 */

function noop() {}

const HANDLERS = {
  onPlace: noop,
  onUnanchor: noop,
  onPush: noop,
  onSetOngoing: noop,
  onDelete: noop,
  onClose: noop,
}

const shift: Task = { id: 'shift', title: 'Shift', done: false, time: '07:00', minutes: 720, unbounded: true }

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('a block that ends by itself can be said not to have happened, from its actions', async () => {
  const user = userEvent.setup()
  const onSetMissed = vi.fn()
  const onClose = vi.fn()
  render(<TaskActionsSheet task={shift} tasks={[shift]} {...HANDLERS} onClose={onClose} endsItself onSetMissed={onSetMissed} />)

  await user.click(screen.getByRole('button', { name: 'Shift did not happen' }))
  expect(onSetMissed).toHaveBeenCalledWith('shift', true)
  expect(onClose).toHaveBeenCalled()
})

test('once said, the way back is offered instead', async () => {
  const user = userEvent.setup()
  const onSetMissed = vi.fn()
  const missed = { ...shift, missed: true }
  render(<TaskActionsSheet task={missed} tasks={[missed]} {...HANDLERS} endsItself onSetMissed={onSetMissed} />)

  expect(screen.queryByRole('button', { name: 'Shift did not happen' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Shift happened after all' }))
  expect(onSetMissed).toHaveBeenCalledWith('shift', false)
})

test('an ordinary block has neither', () => {
  const report: Task = { id: 'report', title: 'Write the report', done: false, time: '09:00', minutes: 60 }
  render(<TaskActionsSheet task={report} tasks={[report]} {...HANDLERS} endsItself={false} onSetMissed={noop} />)
  expect(screen.queryByRole('button', { name: /did not happen|happened after all/ })).toBeNull()
})

test("a category is told in its editor that its blocks end by themselves, and Commute's already do", async () => {
  const user = userEvent.setup()
  render(<CategorySettings />)

  const commute = screen.getByText('Commute').closest('li')!
  await user.click(within(commute).getByRole('button', { name: 'Edit' }))
  expect(within(commute).getByRole('switch', { name: 'Its blocks end by themselves' })).toHaveAttribute('aria-checked', 'true')
  await user.click(within(commute).getByRole('button', { name: 'Cancel' }))

  const health = screen.getByText('Health').closest('li')!
  await user.click(within(health).getByRole('button', { name: 'Edit' }))
  const toggle = within(health).getByRole('switch', { name: 'Its blocks end by themselves' })
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  await user.click(toggle)
  expect(within(health).getByText('Its blocks are done once their time is over.')).toBeInTheDocument()
  await user.click(within(health).getByRole('button', { name: 'Save' }))

  expect(getData().categories.find(c => c.id === 'health')?.endsItself).toBe(true)
})
