import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeModeControl } from './ThemeModeControl'

test('shows the active mode as pressed', () => {
  render(<ThemeModeControl mode="dark" availableModes={['light', 'dark']} onChange={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'false')
})

test('clicking an available mode calls onChange with it', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<ThemeModeControl mode="light" availableModes={['light', 'dark']} onChange={onChange} />)
  await user.click(screen.getByRole('button', { name: 'Dark' }))
  expect(onChange).toHaveBeenCalledWith('dark')
})

test('neither light nor dark is disabled when the preset ships both', () => {
  render(<ThemeModeControl mode="light" availableModes={['light', 'dark']} onChange={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Light' })).not.toBeDisabled()
  expect(screen.getByRole('button', { name: 'Dark' })).not.toBeDisabled()
})

test('a preset that only ships dark disables the light option rather than offering a broken variant', () => {
  render(<ThemeModeControl mode="dark" availableModes={['dark']} onChange={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Light' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Dark' })).not.toBeDisabled()
})

test('system stays selectable even when the preset only ships one mode - it still resolves to something real', () => {
  render(<ThemeModeControl mode="dark" availableModes={['dark']} onChange={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'System' })).not.toBeDisabled()
})

test('a disabled mode button cannot be clicked into onChange', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<ThemeModeControl mode="dark" availableModes={['dark']} onChange={onChange} />)
  await user.click(screen.getByRole('button', { name: 'Light' }))
  expect(onChange).not.toHaveBeenCalled()
})
