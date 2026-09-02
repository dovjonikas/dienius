import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemePreviewCard } from './ThemePreviewCard'
import { findPreset } from '../lib/themes'

function midnightDark() {
  const variant = findPreset('midnight').dark!
  return { tokens: variant.tokens, ruleStyle: variant.ruleStyle }
}

test('shows the preset name so a theme is never identifiable by colour alone', () => {
  const { tokens, ruleStyle } = midnightDark()
  render(<ThemePreviewCard name="Midnight" tokens={tokens} ruleStyle={ruleStyle} mode="dark" selected={false} onSelect={vi.fn()} />)
  expect(screen.getByText("Midnight")).toBeInTheDocument()
})

test('renders the room from exactly the tokens it was given, not a re-guessed copy', () => {
  const { tokens, ruleStyle } = midnightDark()
  render(<ThemePreviewCard name="Midnight" tokens={tokens} ruleStyle={ruleStyle} mode="dark" selected={false} onSelect={vi.fn()} />)

  const button = screen.getByRole('button', { name: /Midnight/ })
  const style = button.style
  expect(style.getPropertyValue('--pv-bg')).toBe(tokens.bg)
  expect(style.getPropertyValue('--pv-accent')).toBe(tokens.accent)
  expect(style.getPropertyValue('--pv-mark')).toBe(tokens.mark)
  expect(style.getPropertyValue('--pv-font-display')).toBe(tokens.fontDisplay)
})

test('renders the light variant tokens it is handed, same as any other resolved variant', () => {
  const variant = findPreset('light').light!
  render(<ThemePreviewCard name="Midnight" tokens={variant.tokens} ruleStyle={variant.ruleStyle} mode="light" selected={false} onSelect={vi.fn()} />)
  const button = screen.getByRole('button', { name: /Midnight/ })
  expect(button.style.getPropertyValue('--pv-bg')).toBe(variant.tokens.bg)
})

test('shows an overridden accent, not the stock preset color, when handed one', () => {
  const { tokens, ruleStyle } = midnightDark()
  const overridden = { ...tokens, accent: '#ff6600' }
  render(<ThemePreviewCard name="Midnight" tokens={overridden} ruleStyle={ruleStyle} mode="dark" selected={false} onSelect={vi.fn()} />)
  const button = screen.getByRole('button', { name: /Midnight/ })
  expect(button.style.getPropertyValue('--pv-accent')).toBe('#ff6600')
})

test('an accent chip and a highlighted item are both present in the miniature', () => {
  const { tokens, ruleStyle } = midnightDark()
  render(<ThemePreviewCard name="Midnight" tokens={tokens} ruleStyle={ruleStyle} mode="dark" selected={false} onSelect={vi.fn()} />)
  const button = screen.getByRole('button', { name: /Midnight/ })
  expect(button.querySelector('.theme-card-chip')).toBeInTheDocument()
  expect(button.querySelector('.theme-card-mark')).toBeInTheDocument()
})

test('the selected card announces as selected via aria-pressed', () => {
  const variant = findPreset('light').light!
  render(<ThemePreviewCard name="Light" tokens={variant.tokens} ruleStyle={variant.ruleStyle} mode="light" selected onSelect={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Light/ })).toHaveAttribute('aria-pressed', 'true')
})

test('an unselected card announces as not selected', () => {
  const variant = findPreset('light').light!
  render(<ThemePreviewCard name="Light" tokens={variant.tokens} ruleStyle={variant.ruleStyle} mode="light" selected={false} onSelect={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Light/ })).toHaveAttribute('aria-pressed', 'false')
})

test('the accessible name is just the preset name, not the miniature\'s sample copy read aloud on every card', () => {
  const { tokens, ruleStyle } = midnightDark()
  render(<ThemePreviewCard name="Midnight" tokens={tokens} ruleStyle={ruleStyle} mode="dark" selected={false} onSelect={vi.fn()} />)
  const button = screen.getByRole('button', { name: 'Midnight' })
  expect(button).toBeInTheDocument()
  expect(button.querySelector('.theme-card-room')).toHaveAttribute('aria-hidden', 'true')
})

test('tapping the card selects it immediately, with no confirm step', async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  const { tokens, ruleStyle } = midnightDark()
  render(<ThemePreviewCard name="Midnight" tokens={tokens} ruleStyle={ruleStyle} mode="dark" selected={false} onSelect={onSelect} />)
  await user.click(screen.getByRole('button', { name: /Midnight/ }))
  expect(onSelect).toHaveBeenCalledTimes(1)
})
