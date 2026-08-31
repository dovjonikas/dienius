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

test('deletes a template', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Old', color: '#f9d48a', blocks: [] })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Delete Old' }))
  expect(getData().templates).toHaveLength(0)
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
