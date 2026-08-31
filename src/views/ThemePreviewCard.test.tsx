import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemePreviewCard } from './ThemePreviewCard'
import { findPreset } from '../lib/themes'

test('shows the preset name so a theme is never identifiable by colour alone', () => {
  render(<ThemePreviewCard preset={findPreset('sketchbook')} mode="dark" selected={false} onSelect={vi.fn()} />)
  expect(screen.getByText('Sketchbook')).toBeInTheDocument()
})

test('renders the room from the same variant data the app resolves, not a re-guessed copy', () => {
  const preset = findPreset('sketchbook')
  const variant = preset.dark!
  render(<ThemePreviewCard preset={preset} mode="dark" selected={false} onSelect={vi.fn()} />)

  const button = screen.getByRole('button', { name: /Sketchbook/ })
  const style = button.style
  expect(style.getPropertyValue('--pv-bg')).toBe(variant.tokens.bg)
  expect(style.getPropertyValue('--pv-accent')).toBe(variant.tokens.accent)
  expect(style.getPropertyValue('--pv-mark')).toBe(variant.tokens.mark)
  expect(style.getPropertyValue('--pv-font-display')).toBe(variant.tokens.fontDisplay)
})

test('renders the light variant when asked for light mode', () => {
  const preset = findPreset('sketchbook')
  const variant = preset.light!
  render(<ThemePreviewCard preset={preset} mode="light" selected={false} onSelect={vi.fn()} />)
  const button = screen.getByRole('button', { name: /Sketchbook/ })
  expect(button.style.getPropertyValue('--pv-bg')).toBe(variant.tokens.bg)
})

test('an accent chip and a highlighted item are both present in the miniature', () => {
  const preset = findPreset('sketchbook')
  render(<ThemePreviewCard preset={preset} mode="dark" selected={false} onSelect={vi.fn()} />)
  const button = screen.getByRole('button', { name: /Sketchbook/ })
  expect(button.querySelector('.theme-card-chip')).toBeInTheDocument()
  expect(button.querySelector('.theme-card-mark')).toBeInTheDocument()
})

test('the selected card announces as selected via aria-pressed', () => {
  render(<ThemePreviewCard preset={findPreset('slate')} mode="light" selected onSelect={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Slate/ })).toHaveAttribute('aria-pressed', 'true')
})

test('an unselected card announces as not selected', () => {
  render(<ThemePreviewCard preset={findPreset('slate')} mode="light" selected={false} onSelect={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Slate/ })).toHaveAttribute('aria-pressed', 'false')
})

test('the accessible name is just the preset name, not the miniature\'s sample copy read aloud on every card', () => {
  render(<ThemePreviewCard preset={findPreset('sketchbook')} mode="dark" selected={false} onSelect={vi.fn()} />)
  const button = screen.getByRole('button', { name: 'Sketchbook' })
  expect(button).toBeInTheDocument()
  expect(button.querySelector('.theme-card-room')).toHaveAttribute('aria-hidden', 'true')
})

test('tapping the card selects it immediately, with no confirm step', async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  render(<ThemePreviewCard preset={findPreset('sketchbook')} mode="dark" selected={false} onSelect={onSelect} />)
  await user.click(screen.getByRole('button', { name: /Sketchbook/ }))
  expect(onSelect).toHaveBeenCalledWith('sketchbook')
  expect(onSelect).toHaveBeenCalledTimes(1)
})
