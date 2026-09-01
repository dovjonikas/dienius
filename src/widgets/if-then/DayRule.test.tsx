import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IfThenDayRule } from './DayRule'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  vi.setSystemTime(new Date(2026, 8, 1, 9, 0)) // 09:00, morning band
})

afterEach(() => {
  vi.useRealTimers()
})

test('offers a way to add the first if-then rule when none exist yet', async () => {
  const user = userEvent.setup()
  render(<IfThenDayRule date="2026-09-01" />)
  const opener = screen.getByRole('button', { name: 'No if-then rules yet - add one' })
  expect(opener).toBeInTheDocument()

  // The only door into IfThenSheet with zero entries - without it, a
  // fresh install could never write its first rule at all.
  await user.click(opener)
  expect(screen.getByRole('dialog', { name: 'If-then rules' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New if-then' })).toBeInTheDocument()
})

test('the empty-state opener creates a real entry that surfaces afterward', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<IfThenDayRule date="2026-09-01" />)
  await user.click(screen.getByRole('button', { name: 'No if-then rules yet - add one' }))
  await user.click(screen.getByRole('button', { name: 'New if-then' }))
  await user.type(screen.getByPlaceholderText('I get home and the kitchen is a mess'), 'A trigger')
  await user.type(screen.getByPlaceholderText('I set a timer for ten minutes and do only the sink'), 'An action')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await user.click(screen.getByRole('button', { name: 'Close' }))

  rerender(<IfThenDayRule date="2026-09-01" />)
  expect(screen.getByRole('button', { name: /A trigger/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'No if-then rules yet - add one' })).not.toBeInTheDocument()
})

test('the sheet stays open after saving a first entry that is not eligible for the current moment', async () => {
  const user = userEvent.setup()
  // 09:00 - morning band, per the outer beforeEach - so an entry scoped to
  // the evening is real but not eligible right now: writing it flips
  // data.ifThens.length from zero to one without ever making `rule` itself
  // non-null, the exact crossing that used to unmount the sheet mid-edit.
  render(<IfThenDayRule date="2026-09-01" />)
  await user.click(screen.getByRole('button', { name: 'No if-then rules yet - add one' }))
  await user.click(screen.getByRole('button', { name: 'New if-then' }))
  await user.type(screen.getByPlaceholderText('I get home and the kitchen is a mess'), 'Evening trigger')
  await user.type(screen.getByPlaceholderText('I set a timer for ten minutes and do only the sink'), 'Evening action')
  await user.click(screen.getByRole('button', { name: 'Evening' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  // The sheet must still be open, with a real, still-usable "New if-then"
  // control - not unmounted out from under whoever is still writing a
  // second entry inside it.
  expect(screen.getByRole('dialog', { name: 'If-then rules' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New if-then' })).toBeInTheDocument()
  expect(screen.getByText('Evening trigger')).toBeInTheDocument()
})

test('renders nothing when no entry is eligible for today', () => {
  actions.addIfThen({ trigger: 'Night trigger', action: 'Night action', dayTypes: ['night'] })
  const { container } = render(<IfThenDayRule date="2026-09-01" />)
  expect(container).toBeEmptyDOMElement()
})

test('surfaces the one eligible rule as a quiet button', () => {
  actions.addIfThen({ trigger: 'I get home and the kitchen is a mess', action: 'Set a ten minute timer' })
  render(<IfThenDayRule date="2026-09-01" />)
  const button = screen.getByRole('button', {
    name: 'If I get home and the kitchen is a mess, then Set a ten minute timer. Open if-then rules.',
  })
  expect(button).toBeInTheDocument()
  expect(button).toHaveAttribute('aria-expanded', 'false')
})

test('carries no checkbox, done flag, or count of any kind', () => {
  actions.addIfThen({ trigger: 'Trigger', action: 'Action' })
  render(<IfThenDayRule date="2026-09-01" />)
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

test('tapping the rule opens the full list in a dialog, and the close button closes it', async () => {
  const user = userEvent.setup()
  actions.addIfThen({ trigger: 'Trigger', action: 'Action' })
  render(<IfThenDayRule date="2026-09-01" />)
  await user.click(screen.getByRole('button', { name: /Open if-then rules/ }))
  expect(screen.getByRole('dialog', { name: 'If-then rules' })).toBeInTheDocument()
  // The full board's own heading and "New if-then" control are reachable
  // inside the sheet - editing lives here, per docs/TIMELINE.md section 6.
  expect(screen.getByRole('button', { name: 'New if-then' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('marks the surfaced rule as shown for this date, once, without inventing a use counter', () => {
  const entry = actions.addIfThen({ trigger: 'Trigger', action: 'Action' })
  render(<IfThenDayRule date="2026-09-01" />)
  const saved = getData().ifThens.find(e => e.id === entry.id)
  expect(saved?.lastSurfaced).toBe('2026-09-01')
  // Nothing beyond the one date key is stored - no count, no history.
  expect(Object.keys(saved ?? {})).not.toContain('surfacedCount')
})

test('a rule scoped to the evening does not surface in the morning, but does once evening arrives', () => {
  actions.addIfThen({ trigger: 'Wind down', action: 'Dim the lights', when: 'evening' })
  const { rerender } = render(<IfThenDayRule date="2026-09-01" />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()

  vi.setSystemTime(new Date(2026, 8, 1, 19, 0)) // 19:00, evening band
  rerender(<IfThenDayRule date="2026-09-01" />)
  expect(screen.getByRole('button', { name: /Wind down/ })).toBeInTheDocument()
})
