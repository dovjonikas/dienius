import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemePreviewCard } from './ThemePreviewCard'
import { findPreset } from '../lib/themes'

function sketchbookDark() {
  const variant = findPreset('sketchbook').dark!
  return { tokens: variant.tokens, ruleStyle: variant.ruleStyle }
}

test('shows the preset name so a theme is never identifiable by colour alone', () => {
  const { tokens, ruleStyle } = sketchbookDark()
  render(<ThemePreviewCard name="Sketchbook" tokens={tokens} ruleStyle={ruleStyle} selected={false} onSelect={vi.fn()} />)
  expect(screen.getByText('Sketchbook')).toBeInTheDocument()
})

test('renders the room from exactly the tokens it was given, not a re-guessed copy', () => {
  const { tokens, ruleStyle } = sketchbookDark()
  render(<ThemePreviewCard name="Sketchbook" tokens={tokens} ruleStyle={ruleStyle} selected={false} onSelect={vi.fn()} />)

  const button = screen.getByRole('button', { name: /Sketchbook/ })
  const style = button.style
  expect(style.getPropertyValue('--pv-bg')).toBe(tokens.bg)
  expect(style.getPropertyValue('--pv-accent')).toBe(tokens.accent)
  expect(style.getPropertyValue('--pv-mark')).toBe(tokens.mark)
  expect(style.getPropertyValue('--pv-font-display')).toBe(tokens.fontDisplay)
})

test('renders the light variant tokens it is handed, same as any other resolved variant', () => {
  const variant = findPreset('sketchbook').light!
  render(<ThemePreviewCard name="Sketchbook" tokens={variant.tokens} ruleStyle={variant.ruleStyle} selected={false} onSelect={vi.fn()} />)
  const button = screen.getByRole('button', { name: /Sketchbook/ })
  expect(button.style.getPropertyValue('--pv-bg')).toBe(variant.tokens.bg)
})

test('shows an overridden accent, not the stock preset color, when handed one', () => {
  const { tokens, ruleStyle } = sketchbookDark()
  const overridden = { ...tokens, accent: '#ff6600' }
  render(<ThemePreviewCard name="Sketchbook" tokens={overridden} ruleStyle={ruleStyle} selected={false} onSelect={vi.fn()} />)
  const button = screen.getByRole('button', { name: /Sketchbook/ })
  expect(button.style.getPropertyValue('--pv-accent')).toBe('#ff6600')
})

test('an accent chip and a highlighted item are both present in the miniature', () => {
  const { tokens, ruleStyle } = sketchbookDark()
  render(<ThemePreviewCard name="Sketchbook" tokens={tokens} ruleStyle={ruleStyle} selected={false} onSelect={vi.fn()} />)
  const button = screen.getByRole('button', { name: /Sketchbook/ })
  expect(button.querySelector('.theme-card-chip')).toBeInTheDocument()
  expect(button.querySelector('.theme-card-mark')).toBeInTheDocument()
})

test('the selected card announces as selected via aria-pressed', () => {
  const variant = findPreset('slate').light!
  render(<ThemePreviewCard name="Slate" tokens={variant.tokens} ruleStyle={variant.ruleStyle} selected onSelect={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Slate/ })).toHaveAttribute('aria-pressed', 'true')
})

test('an unselected card announces as not selected', () => {
  const variant = findPreset('slate').light!
  render(<ThemePreviewCard name="Slate" tokens={variant.tokens} ruleStyle={variant.ruleStyle} selected={false} onSelect={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Slate/ })).toHaveAttribute('aria-pressed', 'false')
})

test('the accessible name is just the preset name, not the miniature\'s sample copy read aloud on every card', () => {
  const { tokens, ruleStyle } = sketchbookDark()
  render(<ThemePreviewCard name="Sketchbook" tokens={tokens} ruleStyle={ruleStyle} selected={false} onSelect={vi.fn()} />)
  const button = screen.getByRole('button', { name: 'Sketchbook' })
  expect(button).toBeInTheDocument()
  expect(button.querySelector('.theme-card-room')).toHaveAttribute('aria-hidden', 'true')
})

test('tapping the card selects it immediately, with no confirm step', async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  const { tokens, ruleStyle } = sketchbookDark()
  render(<ThemePreviewCard name="Sketchbook" tokens={tokens} ruleStyle={ruleStyle} selected={false} onSelect={onSelect} />)
  await user.click(screen.getByRole('button', { name: /Sketchbook/ }))
  expect(onSelect).toHaveBeenCalledTimes(1)
})
