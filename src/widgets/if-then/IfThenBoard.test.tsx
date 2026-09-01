import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IfThenBoard } from './IfThenBoard'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('creates an if-then entry with a tag', async () => {
  const user = userEvent.setup()
  render(<IfThenBoard />)
  await user.click(screen.getByRole('button', { name: 'New if-then' }))
  await user.type(
    screen.getByPlaceholderText(/I get home and the kitchen/i),
    'I get home and the kitchen is a mess',
  )
  await user.type(
    screen.getByPlaceholderText(/I set a timer for ten minutes/i),
    'I set a timer for ten minutes and do only the sink',
  )
  await user.click(screen.getByRole('button', { name: 'Tag Blue' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const saved = getData().ifThens
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({
    trigger: 'I get home and the kitchen is a mess',
    action: 'I set a timer for ten minutes and do only the sink',
    color: '#a7c4f5',
  })
  expect(screen.getByText('I get home and the kitchen is a mess')).toBeInTheDocument()
})

test('the save button stays disabled until both trigger and action are filled in', async () => {
  const user = userEvent.setup()
  render(<IfThenBoard />)
  await user.click(screen.getByRole('button', { name: 'New if-then' }))
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  await user.type(screen.getByPlaceholderText(/I get home and the kitchen/i), 'A trigger')
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  await user.type(screen.getByPlaceholderText(/I set a timer for ten minutes/i), 'An action')
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
})

test('editing an entry happens in place, without hiding the rest of the board', async () => {
  const user = userEvent.setup()
  actions.addIfThen({ trigger: 'Old trigger', action: 'Old action' })
  actions.addIfThen({ trigger: 'Other entry', action: 'Other action' })
  render(<IfThenBoard />)

  await user.click(screen.getByRole('button', { name: 'Edit "Old trigger"' }))
  // The other card stays on screen while this one is being edited - no modal.
  expect(screen.getByText('Other entry')).toBeInTheDocument()

  const triggerInput = screen.getByDisplayValue('Old trigger')
  await user.clear(triggerInput)
  await user.type(triggerInput, 'New trigger')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const saved = getData().ifThens
  expect(saved.find(e => e.action === 'Old action')?.trigger).toBe('New trigger')
})

test('cancel discards the edit without touching stored data', async () => {
  const user = userEvent.setup()
  actions.addIfThen({ trigger: 'Untouched', action: 'Stays the same' })
  render(<IfThenBoard />)
  await user.click(screen.getByRole('button', { name: 'Edit "Untouched"' }))
  const triggerInput = screen.getByDisplayValue('Untouched')
  await user.clear(triggerInput)
  await user.type(triggerInput, 'Changed but not saved')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(getData().ifThens[0].trigger).toBe('Untouched')
  expect(screen.getByText('Untouched')).toBeInTheDocument()
})

test('deleting an entry requires a confirming second tap', async () => {
  const user = userEvent.setup()
  actions.addIfThen({ trigger: 'Delete me', action: 'Some action' })
  render(<IfThenBoard />)
  await user.click(screen.getByRole('button', { name: 'Delete "Delete me"' }))
  expect(getData().ifThens).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Confirm delete "Delete me"' }))
  expect(getData().ifThens).toHaveLength(0)
})

test('filter chips narrow the board to entries with the selected tag', async () => {
  const user = userEvent.setup()
  actions.addIfThen({ trigger: 'Blue one', action: 'Blue action', color: '#a7c4f5' })
  actions.addIfThen({ trigger: 'Coral one', action: 'Coral action', color: '#f5b0a7' })
  actions.addIfThen({ trigger: 'Untagged one', action: 'Untagged action' })
  render(<IfThenBoard />)

  expect(screen.getByText('Blue one')).toBeInTheDocument()
  expect(screen.getByText('Coral one')).toBeInTheDocument()
  expect(screen.getByText('Untagged one')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Blue' }))
  expect(screen.getByText('Blue one')).toBeInTheDocument()
  expect(screen.queryByText('Coral one')).not.toBeInTheDocument()
  expect(screen.queryByText('Untagged one')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'No tag' }))
  expect(screen.getByText('Untagged one')).toBeInTheDocument()
  expect(screen.queryByText('Blue one')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'All' }))
  expect(screen.getByText('Blue one')).toBeInTheDocument()
  expect(screen.getByText('Coral one')).toBeInTheDocument()
  expect(screen.getByText('Untagged one')).toBeInTheDocument()
})

test('the filter row is not shown when every entry falls into the same tag group', async () => {
  actions.addIfThen({ trigger: 'Only one', action: 'Only action' })
  render(<IfThenBoard />)
  expect(screen.queryByRole('group', { name: 'Filter by tag' })).not.toBeInTheDocument()
})

test('an empty board nudges toward writing a specific entry rather than a vague one', () => {
  render(<IfThenBoard />)
  expect(screen.getByText(/no if-then entries yet/i)).toBeInTheDocument()
})

test('the trigger and action placeholders model a concrete, specific plan', async () => {
  const user = userEvent.setup()
  render(<IfThenBoard />)
  await user.click(screen.getByRole('button', { name: 'New if-then' }))
  expect(screen.getByPlaceholderText(/I get home and the kitchen is a mess/i)).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/I set a timer for ten minutes/i)).toBeInTheDocument()
})

test('an entry carries no done checkbox or completion control of any kind', () => {
  actions.addIfThen({ trigger: 'Trigger', action: 'Action' })
  render(<IfThenBoard />)
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

test('a tag renders as visible text, not color alone', () => {
  actions.addIfThen({ trigger: 'Tagged entry', action: 'Some action', color: '#a7e3bd' })
  render(<IfThenBoard />)
  expect(screen.getByText('Green')).toBeInTheDocument()
})

test('the trigger and action inputs have accessible names, not just example placeholders', async () => {
  const user = userEvent.setup()
  render(<IfThenBoard />)
  await user.click(screen.getByRole('button', { name: 'New if-then' }))
  const triggerInput = screen.getByRole('textbox', { name: 'Trigger' })
  const actionInput = screen.getByRole('textbox', { name: 'Action' })
  expect(triggerInput).toHaveAttribute('placeholder', 'I get home and the kitchen is a mess')
  expect(actionInput).toHaveAttribute('placeholder', 'I set a timer for ten minutes and do only the sink')
})

test('opening the new-entry form moves focus into the trigger field', async () => {
  const user = userEvent.setup()
  render(<IfThenBoard />)
  await user.click(screen.getByRole('button', { name: 'New if-then' }))
  expect(screen.getByRole('textbox', { name: 'Trigger' })).toHaveFocus()
})

test('opening an in-place edit moves focus into the trigger field', async () => {
  const user = userEvent.setup()
  actions.addIfThen({ trigger: 'Existing trigger', action: 'Existing action' })
  render(<IfThenBoard />)
  await user.click(screen.getByRole('button', { name: 'Edit "Existing trigger"' }))
  expect(screen.getByRole('textbox', { name: 'Trigger' })).toHaveFocus()
})

test('a new entry defaults to every day type and any time, with nothing toggled on', async () => {
  const user = userEvent.setup()
  render(<IfThenBoard />)
  await user.click(screen.getByRole('button', { name: 'New if-then' }))
  expect(screen.getByRole('button', { name: 'Full day' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Night' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Any time' })).toHaveAttribute('aria-pressed', 'true')
})

test('picking day types and a time band saves them on the entry', async () => {
  const user = userEvent.setup()
  render(<IfThenBoard />)
  await user.click(screen.getByRole('button', { name: 'New if-then' }))
  await user.type(screen.getByPlaceholderText(/I get home and the kitchen/i), 'Shift starts')
  await user.type(screen.getByPlaceholderText(/I set a timer for ten minutes/i), 'Lay out the sleep mask')
  await user.click(screen.getByRole('button', { name: 'Night' }))
  await user.click(screen.getByRole('button', { name: 'Evening' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const saved = getData().ifThens[0]
  expect(saved.dayTypes).toEqual(['night'])
  expect(saved.when).toBe('evening')
  expect(screen.getByText('Night · Evening')).toBeInTheDocument()
})

test('toggling a day type back off returns the entry to applying every day', async () => {
  const user = userEvent.setup()
  render(<IfThenBoard />)
  await user.click(screen.getByRole('button', { name: 'New if-then' }))
  await user.type(screen.getByPlaceholderText(/I get home and the kitchen/i), 'Trigger')
  await user.type(screen.getByPlaceholderText(/I set a timer for ten minutes/i), 'Action')
  await user.click(screen.getByRole('button', { name: 'Night' }))
  await user.click(screen.getByRole('button', { name: 'Night' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().ifThens[0].dayTypes).toBeUndefined()
})

test('an entry with no day type or time restriction shows no scope note on its card', () => {
  actions.addIfThen({ trigger: 'Unrestricted', action: 'Unrestricted' })
  render(<IfThenBoard />)
  expect(screen.queryByText(/Full day|Shift|Night|Rest/)).not.toBeInTheDocument()
})
