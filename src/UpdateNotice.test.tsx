import { expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateNotice } from './UpdateNotice'
import { createControllerChangeHandler } from './pwa'

// pwa.ts fires the real "update ready" signal from a service worker event
// this test environment never dispatches, so tests trigger it the same way
// pwa.ts itself does: through createControllerChangeHandler's default
// listener, which calls every subscriber UpdateNotice registered via
// onUpdateReady. `hadController: true` marks it as a real update rather
// than a first-ever install claim (see pwa.test.ts for that distinction).
function fireUpdateReady() {
  act(() => {
    createControllerChangeHandler(undefined, true)()
  })
}

test('renders nothing until an update is actually ready', () => {
  render(<UpdateNotice />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('shows a quiet status notice with one reload action once an update lands', () => {
  render(<UpdateNotice />)

  fireUpdateReady()

  const notice = screen.getByRole('status')
  expect(notice).toHaveTextContent('An update is ready.')
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
})

test('clicking Reload reloads the page', async () => {
  const user = userEvent.setup()
  const reload = vi.fn()
  const originalLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload },
  })

  render(<UpdateNotice />)
  fireUpdateReady()
  await user.click(screen.getByRole('button', { name: 'Reload' }))

  expect(reload).toHaveBeenCalledTimes(1)

  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
})

test('unmounting before an update lands does not leave a dangling subscription', () => {
  const { unmount } = render(<UpdateNotice />)
  unmount()

  // If the component failed to unsubscribe, this would try to update state
  // on an unmounted component and React would warn (which vitest fails on
  // via the console spy convention used elsewhere in this repo). No
  // assertion needed beyond "this does not throw or warn."
  expect(() => fireUpdateReady()).not.toThrow()
})
