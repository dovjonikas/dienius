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
