import { beforeEach, expect, test } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeOverridePanel } from './ThemeOverridePanel'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { findPreset } from '../lib/themes'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('the panel is collapsed by default, so the normal path stays one tap in the gallery above it', () => {
  render(<ThemeOverridePanel />)
  expect(screen.getByRole('button', { name: /Adjust this theme/ })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByLabelText('Accent')).not.toBeInTheDocument()
})

test('opening the disclosure reveals the controls and announces its own state', async () => {
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))
  expect(screen.getByRole('button', { name: /Adjust this theme/ })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByLabelText('Accent')).toBeInTheDocument()
})

test('every color control is pre-filled with the active preset\'s own stock value', async () => {
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))
  const slateLight = findPreset('slate').light!.tokens
  expect(screen.getByLabelText('Accent')).toHaveValue(slateLight.accent)
  expect(screen.getByLabelText('Highlight')).toHaveValue(slateLight.mark)
  expect(screen.getByLabelText('Paper')).toHaveValue(slateLight.bg)
  expect(screen.getByLabelText('Text')).toHaveValue(slateLight.text)
})

test('changing the accent color writes exactly one token into the overrides for the active preset', async () => {
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))

  // Native color inputs do not accept keystroke typing in jsdom the way a
  // text input does - firing the browser's own change event with the
  // picked value is how a real color picker commits its result.
  const accentInput = screen.getByLabelText('Accent') as HTMLInputElement
  fireEvent.change(accentInput, { target: { value: '#ff6600' } })

  expect(getData().settings.theme.overrides.slate).toEqual({ accent: '#ff6600' })
})

test('a changed token shows a dot that is also announced to a screen reader, not conveyed by colour alone', async () => {
  actions.setThemeOverride('slate', 'accent', '#ff6600')
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))

  const accentInput = screen.getByLabelText('Accent')
  expect(accentInput).toHaveAccessibleDescription(/changed/i)
})

test('an unchanged token carries no changed description', async () => {
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))
  const accentInput = screen.getByLabelText('Accent')
  expect(accentInput).not.toHaveAccessibleDescription(/changed/i)
})

test('reset to preset clears the patch for the active preset only', async () => {
  actions.setThemeOverride('slate', 'accent', '#ff6600')
  actions.setThemeOverride('sketchbook', 'accent', '#00ff00')
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))

  await user.click(screen.getByRole('button', { name: 'Reset to preset' }))

  expect(getData().settings.theme.overrides.slate).toBeUndefined()
  expect(getData().settings.theme.overrides.sketchbook).toEqual({ accent: '#00ff00' })
})

test('overrides are scoped per preset - switching the active preset never leaks one preset\'s patch onto another', async () => {
  actions.setThemeOverride('sketchbook', 'accent', '#00ff00')
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))
  // Active preset is still Slate (default) - Sketchbook's override must not
  // show up as Slate's own pre-filled value or changed-dot.
  const accentInput = screen.getByLabelText('Accent')
  expect(accentInput).not.toHaveValue('#00ff00')
  expect(accentInput).not.toHaveAccessibleDescription(/changed/i)

  act(() => actions.setThemePreset('sketchbook'))
  expect(screen.getByLabelText('Accent')).toHaveValue('#00ff00')
  expect(screen.getByLabelText('Accent')).toHaveAccessibleDescription(/changed/i)
})

test('picking a corner option writes the edge token', async () => {
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))
  await user.click(screen.getByRole('button', { name: 'Sharp' }))
  expect(getData().settings.theme.overrides.slate?.edge).toBeTruthy()
  expect(Object.keys(getData().settings.theme.overrides.slate ?? {})).toEqual(['edge'])
})

test('picking a type option writes the font-body token, and none of the options is a script or novelty face', async () => {
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))
  const typeGroup = screen.getByRole('group', { name: 'Type' })
  expect(within(typeGroup).queryByRole('button', { name: /handwritten/i })).not.toBeInTheDocument()
  await user.click(within(typeGroup).getByRole('button', { name: 'Mono' }))
  expect(getData().settings.theme.overrides.slate).toEqual({ fontBody: expect.stringMatching(/mono/i) })
})

test('picking a ruling style writes ruleStyle, and spacing/opacity only appear once ruling is on', async () => {
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))
  // Slate ships with no ruling - spacing and opacity have nothing to control yet.
  expect(screen.queryByLabelText('Ruling spacing')).not.toBeInTheDocument()

  const rulingGroup = screen.getByRole('group', { name: 'Ruling' })
  await user.click(within(rulingGroup).getByRole('button', { name: 'Lines' }))

  expect(getData().settings.theme.overrides.slate?.ruleStyle).toBe('lines')
  expect(screen.getByLabelText('Ruling spacing')).toBeInTheDocument()
  expect(screen.getByLabelText('Ruling opacity')).toBeInTheDocument()
})

test('a contrast warning appears for a hand-picked color that would fail the readability gate', async () => {
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))

  act(() => actions.setThemeOverride('slate', 'text', '#fbfbfa'))
  expect(await screen.findByText(/hard to read/i)).toBeInTheDocument()
})

test('setting an unreadable color is still allowed - the warning never blocks the write', async () => {
  const user = userEvent.setup()
  render(<ThemeOverridePanel />)
  await user.click(screen.getByRole('button', { name: /Adjust this theme/ }))
  act(() => actions.setThemeOverride('slate', 'text', '#fbfbfa'))
  expect(getData().settings.theme.overrides.slate).toEqual({ text: '#fbfbfa' })
})
