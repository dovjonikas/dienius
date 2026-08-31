import { expect, test, vi } from 'vitest'
import { createControllerChangeHandler } from './pwa'

test('reloads once when a new service worker takes control', () => {
  const reload = vi.fn()
  const handleControllerChange = createControllerChangeHandler(reload)

  handleControllerChange()

  expect(reload).toHaveBeenCalledTimes(1)
})

test('does not reload again if the event fires more than once', () => {
  const reload = vi.fn()
  const handleControllerChange = createControllerChangeHandler(reload)

  handleControllerChange()
  handleControllerChange()
  handleControllerChange()

  expect(reload).toHaveBeenCalledTimes(1)
})
