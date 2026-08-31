import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { actions } from './lib/store'
import { defaultData } from './lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('renders brand and nav tabs', () => {
  render(<App />)
  expect(screen.getByText('Dienius')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Calendar' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Templates' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
})

test('settings view toggles theme', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('button', { name: 'Dark' }))
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#191a1d')
})

test('picking system mode resolves against the live OS preference and updates the resolved token block', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('button', { name: 'System' }))
  // jsdom has no real matchMedia, so systemPrefersDark() falls back to
  // false the same way it does for a person whose browser lacks it too -
  // the resolved theme should be light, not left at whatever it was before.
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#fafaf8')
})

test('the day tab renders widgets through the registry, driven by enabledWidgets', () => {
  const data = defaultData()
  data.settings.enabledWidgets = []
  actions.resetForTests(data)
  render(<App />)
  expect(screen.queryByPlaceholderText(/add a task/i)).not.toBeInTheDocument()
})
