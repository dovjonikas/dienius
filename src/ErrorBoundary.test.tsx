import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'
import { STORAGE_KEY, defaultData } from './lib/storage'

function Boom(): never {
  throw new Error('boom')
}

beforeEach(() => {
  localStorage.clear()
})

test('shows a recovery screen instead of a blank page when a child throws', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  )
  expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Export backup' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reset app data' })).toBeInTheDocument()
  spy.mockRestore()
})

test('renders children normally when nothing throws', () => {
  render(
    <ErrorBoundary>
      <p>All good</p>
    </ErrorBoundary>,
  )
  expect(screen.getByText('All good')).toBeInTheDocument()
})

test('reset requires a second confirming tap before it clears storage and reloads', async () => {
  const user = userEvent.setup()
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData()))

  const reload = vi.fn()
  const originalLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload },
  })

  render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  )

  await user.click(screen.getByRole('button', { name: 'Reset app data' }))
  expect(screen.getByRole('button', { name: 'Confirm reset?' })).toBeInTheDocument()
  expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  expect(reload).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Confirm reset?' }))
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  expect(reload).toHaveBeenCalledTimes(1)

  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  consoleSpy.mockRestore()
})

test('export builds a download of whatever is currently in the store', async () => {
  const user = userEvent.setup()
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const url = 'blob:mock-url'
  const createObjectURL = vi.fn(() => url)
  const revokeObjectURL = vi.fn()
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  try {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    await user.click(screen.getByRole('button', { name: 'Export backup' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  } finally {
    clickSpy.mockRestore()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    consoleSpy.mockRestore()
  }
})
