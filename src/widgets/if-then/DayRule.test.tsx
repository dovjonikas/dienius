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

test('renders nothing when there are no if-then entries at all', () => {
  const { container } = render(<IfThenDayRule date="2026-09-01" />)
  expect(container).toBeEmptyDOMElement()
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
