import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeGallery } from './ThemeGallery'
import { actions } from '../lib/store'
import { defaultData } from '../lib/storage'
import { PRESETS } from '../lib/themes'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('renders one card per preset, growing automatically as presets are added', () => {
  render(<ThemeGallery />)
  for (const preset of PRESETS) {
    expect(screen.getByRole('button', { name: new RegExp(preset.name) })).toBeInTheDocument()
  }
  expect(screen.getAllByRole('button')).toHaveLength(PRESETS.length)
})

test('the active preset is the only one announced as selected', () => {
  render(<ThemeGallery />)
  expect(screen.getByRole('button', { name: /Dark/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Midnight/ })).toHaveAttribute('aria-pressed', 'false')
})

test('tapping a card applies the whole preset instantly, with no confirm step', async () => {
  const user = userEvent.setup()
  render(<ThemeGallery />)
  await user.click(screen.getByRole('button', { name: /Midnight/ }))
  expect(actions).toBeDefined()
  const { getData } = await import('../lib/store')
  expect(getData().settings.theme.presetId).toBe('midnight')
})

test('re-renders to reflect the newly selected preset as selected', async () => {
  const user = userEvent.setup()
  render(<ThemeGallery />)
  await user.click(screen.getByRole('button', { name: /Midnight/ }))
  expect(screen.getByRole('button', { name: /Midnight/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Dark/ })).toHaveAttribute('aria-pressed', 'false')
})

test('a card previews its own preset\'s stored override, not the stock preset color - the card never lies about the room', async () => {
  actions.setThemeOverride('midnight', 'accent', '#ff6600')
  render(<ThemeGallery />)
  const card = screen.getByRole('button', { name: /Midnight/ })
  expect(card.style.getPropertyValue('--pv-accent')).toBe('#ff6600')
})

test('an override on one preset never shows up on another preset\'s card', async () => {
  actions.setThemeOverride('midnight', 'accent', '#ff6600')
  render(<ThemeGallery />)
  const slateCard = screen.getByRole('button', { name: /Dark/ })
  expect(slateCard.style.getPropertyValue('--pv-accent')).not.toBe('#ff6600')
})
