import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthView } from './NorthView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { MAX_RULES_PER_GOAL } from '../../lib/types'

const TODAY = '2026-09-05'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${TODAY}T09:00:00`))
})

function goal(title: string) {
  return actions.addGoal({ title }, '2026-09-01')!
}

/**
 * The North window, and the one promise it makes: every rule sits under the
 * goal it protects.
 *
 * The tests below are about that link and about the two caps. They are not
 * about the goals themselves, which are written in Settings and covered by
 * SettingsView.test.tsx - the distance between the two screens is deliberate
 * and is documented on NorthView itself.
 */

test('a rule written under a goal appears under that goal and not under another', async () => {
  const user = userEvent.setup()
  const ship = goal('Ship something people keep using')
  goal('Be strong at forty')
  render(<NorthView onOpenSettings={() => {}} />)

  const card = screen.getByRole('heading', { name: 'Ship something people keep using' }).closest('article')!
  await user.click(within(card).getByRole('button', { name: 'Write one down' }))
  await user.type(screen.getByLabelText('If'), 'I open the laptop and stall')
  await user.type(screen.getByLabelText('Then'), 'I open today and do the first unticked thing')
  await user.click(screen.getByRole('button', { name: 'Write it down' }))

  expect(getData().ifThens).toHaveLength(1)
  expect(getData().ifThens[0].goalId).toBe(ship.id)

  const other = screen.getByRole('heading', { name: 'Be strong at forty' }).closest('article')!
  expect(within(other).queryByText(/I open the laptop and stall/)).toBeNull()
  expect(within(card).getByText(/I open the laptop and stall/)).toBeTruthy()
})

/**
 * The cap refuses rather than evicting, which means it has to be visible.
 * Quietly dropping the sixth rule would be a limit nobody can see and a
 * sentence somebody thinks they wrote down.
 */
test('a goal with five rules offers no way to write a sixth, and says why', () => {
  const g = goal('Ship something')
  for (let i = 0; i < MAX_RULES_PER_GOAL; i++) {
    actions.addIfThen({ trigger: `Trigger ${i}`, action: `Action ${i}`, goalId: g.id })
  }
  render(<NorthView onOpenSettings={() => {}} />)

  expect(screen.queryByRole('button', { name: 'Add another' })).toBeNull()
  expect(screen.getByText(`${MAX_RULES_PER_GOAL} is the limit here. Delete one to make room.`)).toBeTruthy()
})

test('a rule written before rules had goals waits in its own group, and one press files it', async () => {
  const user = userEvent.setup()
  const g = goal('Ship something')
  const orphan = actions.addIfThen({ trigger: 'I get home and the kitchen is a mess', action: 'I do only the sink' })!
  render(<NorthView onOpenSettings={() => {}} />)

  const unfiled = screen.getByRole('region', { name: 'Rules with no goal' })
  expect(within(unfiled).getByText(/I get home and the kitchen is a mess/)).toBeTruthy()

  await user.click(within(unfiled).getByRole('button', { name: 'Ship something' }))
  expect(getData().ifThens.find(e => e.id === orphan.id)?.goalId).toBe(g.id)
  expect(screen.queryByRole('region', { name: 'Rules with no goal' })).toBeNull()
})

// A dangling id degrades everywhere in this app, and degrading here means the
// rule comes back to the waiting group rather than disappearing with the goal.
test('a rule whose goal was deleted comes back as unfiled rather than vanishing', () => {
  const g = goal('Ship something')
  actions.addIfThen({ trigger: 'I stall', action: 'I open today', goalId: g.id })
  actions.archiveGoal(g.id, TODAY)
  actions.deleteGoal(g.id)

  render(<NorthView onOpenSettings={() => {}} />)
  const unfiled = screen.getByRole('region', { name: 'Rules with no goal' })
  expect(within(unfiled).getByText(/I stall/)).toBeTruthy()
})

// Archiving a direction is not deciding the things that pull you off it never
// happened, so its rules stay with it instead of coming loose.
test('an archived goal keeps its rules rather than spilling them into the waiting group', () => {
  const g = goal('Ship something')
  actions.addIfThen({ trigger: 'I stall', action: 'I open today', goalId: g.id })
  actions.archiveGoal(g.id, TODAY)

  render(<NorthView onOpenSettings={() => {}} />)
  expect(screen.queryByRole('region', { name: 'Rules with no goal' })).toBeNull()
})

test('a full goal is offered but refused for an unfiled rule, so nothing looks broken when pressed', () => {
  const g = goal('Ship something')
  for (let i = 0; i < MAX_RULES_PER_GOAL; i++) {
    actions.addIfThen({ trigger: `Trigger ${i}`, action: `Action ${i}`, goalId: g.id })
  }
  actions.addIfThen({ trigger: 'Waiting', action: 'For room' })

  render(<NorthView onOpenSettings={() => {}} />)
  const unfiled = screen.getByRole('region', { name: 'Rules with no goal' })
  expect(within(unfiled).getByRole('button', { name: 'Ship something' })).toBeDisabled()
})

test('deleting a rule takes two presses, and the first one says so', async () => {
  const user = userEvent.setup()
  const g = goal('Ship something')
  actions.addIfThen({ trigger: 'I stall', action: 'I open today', goalId: g.id })
  render(<NorthView onOpenSettings={() => {}} />)

  await user.click(screen.getByRole('button', { name: 'Delete "I stall"' }))
  expect(getData().ifThens).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: 'Confirm delete "I stall"' }))
  expect(getData().ifThens).toHaveLength(0)
})

test('editing a rule rewrites it in place rather than adding a second one', async () => {
  const user = userEvent.setup()
  const g = goal('Ship something')
  actions.addIfThen({ trigger: 'Old trigger', action: 'Old action', goalId: g.id })
  render(<NorthView onOpenSettings={() => {}} />)

  await user.click(screen.getByRole('button', { name: 'Edit "Old trigger"' }))
  await user.clear(screen.getByLabelText('If'))
  await user.type(screen.getByLabelText('If'), 'New trigger')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(getData().ifThens).toHaveLength(1)
  expect(getData().ifThens[0].trigger).toBe('New trigger')
  expect(getData().ifThens[0].goalId).toBe(g.id)
})

/**
 * Nothing on this screen measures anything - ARCHITECTURE section 6. The one
 * number allowed near a goal is its age, which cannot be earned or lost.
 */
test('a goal shows its age and nothing else that counts', () => {
  const g = actions.addGoal({ title: 'Ship something', why: 'Because renting is not owning.' }, '2026-09-01')!
  actions.addIfThen({ trigger: 'I stall', action: 'I open today', goalId: g.id })
  const { container } = render(<NorthView onOpenSettings={() => {}} />)

  expect(screen.getByText('5 days lived toward this')).toBeTruthy()
  expect(container.querySelector('progress, meter, input[type="checkbox"]')).toBeNull()
  expect(container.textContent).not.toMatch(/%|\b1 of \b|complete|streak/i)
})

test('with no goals at all it offers the one thing to do next', async () => {
  const user = userEvent.setup()
  const onOpenSettings = vi.fn()
  render(<NorthView onOpenSettings={onOpenSettings} />)

  await user.click(screen.getByRole('button', { name: 'Write one down' }))
  expect(onOpenSettings).toHaveBeenCalledTimes(1)
})
