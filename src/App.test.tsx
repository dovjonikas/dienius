import { beforeEach, expect, test } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { actions } from './lib/store'
import { defaultData } from './lib/storage'
import { PRESETS } from './lib/themes'

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

// --- stress test: every theme preset, with two years of stamped data loaded

// Genuinely heavy, not artificially slow: the year strip renders roughly
// 700 cells, and this re-renders it through every one of 11 presets and
// their modes in turn. Comfortably under 2s on its own, but full-suite runs
// have every test file's own worker rendering at once - the same
// contention that already pushed two other YearStrip-adjacent tests over
// the default 5s timeout (see CalendarView.test.tsx's own comment on the
// same class of test). An explicit timeout here is the honest fix: the
// work itself is real and worth doing, not something to trim down just to
// fit inside a budget meant for ordinary tests.
test('every theme preset and mode applies cleanly on the year view with roughly two years of stamped days loaded, with no crash', async () => {
  const user = userEvent.setup({ delay: null })
  const work = actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [] })
  const rest = actions.addTemplate({ name: 'Rest', color: '#cde39e', blocks: [] })
  const stamps: Record<string, string> = {}
  let d = new Date(2024, 0, 1)
  for (let i = 0; i < 700; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    stamps[key] = i % 2 === 0 ? work.id : rest.id
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  }
  actions.stamp(stamps)

  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Calendar' }))
  await user.click(screen.getByRole('button', { name: 'Year' }))

  for (const preset of PRESETS) {
    act(() => actions.setThemePreset(preset.id))
    for (const mode of preset.modes) {
      act(() => actions.setTheme(mode))
      // Every preset must actually resolve to a real, non-empty background
      // token - a preset missing its own mode would otherwise silently
      // paint the page with an empty custom property value.
      expect(document.documentElement.style.getPropertyValue('--bg')).not.toBe('')
    }
  }
}, 15000)
