import { beforeEach, expect, test } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoutinesSection } from './RoutinesSection'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { getUndo, runUndo } from '../../lib/undo'
import type { AppData, Template } from '../../lib/types'

/**
 * The routine editor - rotating shifts, v2.29 stage 5, and
 * docs/RESEARCH-SHIFTS.md section 2.3. A routine is written once: a name, a
 * category, a length, the weekdays it is on, and a time for each kind of day.
 * A kind left without a time still gets the routine, and the day says it needs
 * one - the app never guesses a time. Every name here is a generic one.
 */

const KIND = (id: string, name: string, letter: string, order: number): Template =>
  ({ id, name, color: '#a7c4f5', blocks: [], dayKind: { letter, order } }) as Template

function planWithKinds(): AppData {
  const data = defaultData()
  data.templates = [KIND('day', 'Day shift', 'D', 0), KIND('night', 'Night shift', 'N', 1), { id: 'plain', name: 'Working day', color: '#a7e3bd', blocks: [] } as Template]
  return data
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(planWithKinds())
})

/** Opens the form and fills the parts every test needs. */
async function writeGym(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'New routine' }))
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Training')
  const days = screen.getByRole('group', { name: 'On these days' })
  await user.click(within(days).getByRole('button', { name: 'Monday' }))
  await user.click(within(days).getByRole('button', { name: 'Wednesday' }))
  await user.type(screen.getByRole('textbox', { name: 'Time on Day shift' }), '17:00')
}

test('with no kind of day marked, routines are not offered at all', () => {
  actions.resetForTests({ ...defaultData(), templates: [{ id: 'plain', name: 'Working day', color: '#a7e3bd', blocks: [] } as Template] })
  render(<RoutinesSection />)
  expect(screen.queryByRole('heading', { name: 'Routines' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'New routine' })).toBeNull()
})

test('a routine is written once: a name, its days, a length and a time on each kind', async () => {
  const user = userEvent.setup()
  render(<RoutinesSection />)
  await writeGym(user)
  await user.click(screen.getByRole('button', { name: 'Save routine' }))

  expect(getData().routines).toMatchObject([{ title: 'Training', minutes: 30, weekdays: [1, 3], times: { day: '17:00' } }])
  // What the row says back: its days, its length, its time on each kind, and
  // where it still needs one.
  const row = screen.getByRole('listitem')
  expect(row).toHaveTextContent('Training')
  expect(row).toHaveTextContent('Mon, Wed')
  expect(row).toHaveTextContent('30 min')
  expect(row).toHaveTextContent('D 17:00')
  expect(row).toHaveTextContent('N needs a time')
})

test('a routine waits for a name and for at least one day', async () => {
  const user = userEvent.setup()
  render(<RoutinesSection />)
  await user.click(screen.getByRole('button', { name: 'New routine' }))
  const save = screen.getByRole('button', { name: 'Save routine' })
  expect(save).toBeDisabled()

  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Training')
  expect(save).toBeDisabled()

  await user.click(within(screen.getByRole('group', { name: 'On these days' })).getByRole('button', { name: 'Monday' }))
  expect(save).toBeEnabled()
})

test('a routine is edited in the same form, and the times it keeps are the kinds it was given', async () => {
  const user = userEvent.setup()
  render(<RoutinesSection />)
  await writeGym(user)
  await user.click(screen.getByRole('button', { name: 'Save routine' }))

  await user.click(screen.getByRole('button', { name: 'Edit Training' }))
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Training')
  expect(screen.getByRole('textbox', { name: 'Time on Day shift' })).toHaveValue('17:00')
  await user.type(screen.getByRole('textbox', { name: 'Time on Night shift' }), '09:00')
  await user.click(within(screen.getByRole('group', { name: 'On these days' })).getByRole('button', { name: 'Monday' }))
  await user.click(screen.getByRole('button', { name: 'Save routine' }))

  expect(getData().routines).toHaveLength(1)
  expect(getData().routines[0]).toMatchObject({ weekdays: [3], times: { day: '17:00', night: '09:00' } })
})

test('a routine removed is gone, and the undo puts it back', async () => {
  const user = userEvent.setup()
  render(<RoutinesSection />)
  await writeGym(user)
  await user.click(screen.getByRole('button', { name: 'Save routine' }))

  await user.click(screen.getByRole('button', { name: 'Remove Training' }))
  expect(getData().routines).toEqual([])
  // The offer itself is the app's one undo bar, drawn at the root - see
  // lib/undo.ts; what matters here is that removing armed it.
  expect(getUndo()?.label).toBe('Training removed')
  act(() => runUndo())
  expect(getData().routines).toMatchObject([{ title: 'Training', times: { day: '17:00' } }])
})

test('a time is kept only for a kind, so a template that stops being one leaves no time behind', async () => {
  const user = userEvent.setup()
  render(<RoutinesSection />)
  await writeGym(user)
  await user.click(screen.getByRole('button', { name: 'Save routine' }))

  act(() => actions.setDayKind('day', null))
  await user.click(screen.getByRole('button', { name: 'Edit Training' }))
  expect(screen.queryByRole('textbox', { name: 'Time on Day shift' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Save routine' }))
  expect(getData().routines[0].times).toEqual({})
})

test('a routine whose rule changed offers to update the days ahead, and does nothing until the press', async () => {
  const user = userEvent.setup()
  render(<RoutinesSection />)
  await writeGym(user)
  await user.click(screen.getByRole('button', { name: 'Save routine' }))
  // Nothing to offer: it is new, and no day was made from it.
  expect(screen.queryByRole('button', { name: 'Update them' })).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Edit Training' }))
  await user.clear(screen.getByRole('textbox', { name: 'Time on Day shift' }))
  await user.type(screen.getByRole('textbox', { name: 'Time on Day shift' }), '18:00')
  await user.click(screen.getByRole('button', { name: 'Save routine' }))

  expect(screen.getByRole('status')).toHaveTextContent('Training changed')
  await user.click(screen.getByRole('button', { name: 'Leave them' }))
  expect(screen.queryByRole('button', { name: 'Update them' })).toBeNull()
})

test('a routine saved with the same rule offers nothing', async () => {
  const user = userEvent.setup()
  render(<RoutinesSection />)
  await writeGym(user)
  await user.click(screen.getByRole('button', { name: 'Save routine' }))

  await user.click(screen.getByRole('button', { name: 'Edit Training' }))
  await user.click(screen.getByRole('button', { name: 'Save routine' }))
  expect(screen.queryByRole('button', { name: 'Update them' })).toBeNull()
})
