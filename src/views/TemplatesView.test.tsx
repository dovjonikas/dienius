import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplatesView } from './TemplatesView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('creates a template with a block', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Work day')
  await user.type(screen.getByPlaceholderText('09:00'), '09:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  const saved = getData().templates
  expect(saved).toHaveLength(1)
  expect(saved[0].name).toBe('Work day')
  expect(saved[0].blocks[0]).toMatchObject({ time: '09:00', title: 'Gym' })
})

test('deleting a template requires a confirming second tap', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Old', color: '#f9d48a', blocks: [] })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Delete Old' }))
  expect(getData().templates).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Confirm delete Old' }))
  expect(getData().templates).toHaveLength(0)
})

test('the delete confirmation resets when focus moves elsewhere', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Old', color: '#f9d48a', blocks: [] })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Delete Old' }))
  expect(screen.getByRole('button', { name: 'Confirm delete Old' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Edit Old' }))
  expect(getData().templates).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('button', { name: 'Delete Old' })).toBeInTheDocument()
})

test('editing an existing template and saving updates it in place', async () => {
  const user = userEvent.setup()
  actions.addTemplate({
    name: 'Morning',
    color: '#f9d48a',
    blocks: [{ time: '08:00', title: 'Wake up' }],
  })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Morning' }))
  const nameInput = screen.getByPlaceholderText('Template name')
  await user.clear(nameInput)
  await user.type(nameInput, 'Weekday morning')
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  const saved = getData().templates
  expect(saved).toHaveLength(1)
  expect(saved[0].name).toBe('Weekday morning')
  expect(saved[0].blocks[0]).toMatchObject({ time: '08:00', title: 'Wake up' })
})

test('cancel discards the draft without touching stored data', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Old', color: '#f9d48a', blocks: [] })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Old' }))
  const nameInput = screen.getByPlaceholderText('Template name')
  await user.clear(nameInput)
  await user.type(nameInput, 'Changed but not saved')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  const saved = getData().templates
  expect(saved).toHaveLength(1)
  expect(saved[0].name).toBe('Old')
})

test('removing a block from a draft leaves it out of the saved template', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Work day')
  await user.type(screen.getByPlaceholderText('09:00'), '09:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.type(screen.getByPlaceholderText('09:00'), '13:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Lunch')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Remove Gym' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  const saved = getData().templates
  expect(saved).toHaveLength(1)
  expect(saved[0].blocks).toHaveLength(1)
  expect(saved[0].blocks[0]).toMatchObject({ time: '13:00', title: 'Lunch' })
})

test('a new template defaults to full day and saves that type explicitly', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Ordinary day')
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].type).toBe('full')
})

test('the core toggle is not shown on a full-day template, so a block cannot be marked core there', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  expect(screen.queryByRole('button', { name: /mark new block as core/i })).not.toBeInTheDocument()
})

test('picking a day type reveals the core toggle, and a block marked core saves that way', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Night shift')
  await user.click(screen.getByRole('button', { name: 'Shift' }))
  await user.type(screen.getByPlaceholderText('09:00'), '19:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Clock in')
  await user.click(screen.getByRole('button', { name: /mark new block as core/i }))
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.type(screen.getByPlaceholderText('What happens'), 'Snack')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))

  const saved = getData().templates[0]
  expect(saved.type).toBe('shift')
  expect(saved.blocks.find(b => b.title === 'Clock in')?.core).toBe(true)
  expect(saved.blocks.find(b => b.title === 'Snack')?.core).toBeFalsy()
})

test('editing a shift template loads its type and each block\'s core state', async () => {
  const user = userEvent.setup()
  actions.addTemplate({
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [{ time: '19:00', title: 'Clock in', core: true }],
  })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Night shift' }))
  expect(screen.getByRole('button', { name: 'Shift' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Clock in is core' })).toBeInTheDocument()
})

test('switching a template from shift back to full hides the core toggles without losing the data underneath', async () => {
  const user = userEvent.setup()
  actions.addTemplate({
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [{ time: '19:00', title: 'Clock in', core: true }],
  })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Night shift' }))
  await user.click(screen.getByRole('button', { name: 'Full day' }))
  expect(screen.queryByRole('button', { name: 'Clock in is core' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].type).toBe('full')
  // The block itself, and its core flag, are untouched by the type switch.
  expect(getData().templates[0].blocks[0]).toMatchObject({ title: 'Clock in', core: true })
})

test('editing a template keeps each surviving block\'s id and mints a fresh one only for a block added during the edit', async () => {
  const user = userEvent.setup()
  const created = actions.addTemplate({
    name: 'Morning',
    color: '#f9d48a',
    blocks: [
      { time: '08:00', title: 'Wake up' },
      { time: '08:30', title: 'Shower' },
    ],
  })
  const [wakeId, showerId] = created.blocks.map(b => b.id)

  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Morning' }))
  await user.type(screen.getByPlaceholderText('09:00'), '09:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Commute')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))

  const saved = getData().templates[0]
  expect(saved.blocks.find(b => b.title === 'Wake up')?.id).toBe(wakeId)
  expect(saved.blocks.find(b => b.title === 'Shower')?.id).toBe(showerId)
  const commuteId = saved.blocks.find(b => b.title === 'Commute')?.id
  expect(commuteId).toBeTruthy()
  expect([wakeId, showerId]).not.toContain(commuteId)
})

test('block-add fields do not leak between editing sessions', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'A', color: '#f9d48a', blocks: [] })
  actions.addTemplate({ name: 'B', color: '#a7c4f5', blocks: [] })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit A' }))
  await user.type(screen.getByPlaceholderText('09:00'), '10:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Half-typed')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(screen.getByRole('button', { name: 'Edit B' }))
  expect(screen.getByPlaceholderText('09:00')).toHaveValue('')
  expect(screen.getByPlaceholderText('What happens')).toHaveValue('')
})
