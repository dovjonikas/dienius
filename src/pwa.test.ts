import { expect, test, vi } from 'vitest'
import { createControllerChangeHandler, onUpdateReady } from './pwa'

test('raises the update-ready flag when a new service worker takes control', () => {
  const onReady = vi.fn()
  const handleControllerChange = createControllerChangeHandler(onReady, true)

  handleControllerChange()

  expect(onReady).toHaveBeenCalledTimes(1)
})

test('does not raise the flag again if the event fires more than once', () => {
  const onReady = vi.fn()
  const handleControllerChange = createControllerChangeHandler(onReady, true)

  handleControllerChange()
  handleControllerChange()
  handleControllerChange()

  expect(onReady).toHaveBeenCalledTimes(1)
})

test('the very first controllerchange a browser ever sees is not treated as an update', () => {
  // hadController: false means this page had no service worker controller
  // at all when it loaded - a fresh install (or cleared site data), not a
  // deploy landing under an already-running app.
  const onReady = vi.fn()
  const handleControllerChange = createControllerChangeHandler(onReady, false)

  handleControllerChange()

  expect(onReady).not.toHaveBeenCalled()
})

test('a real update still fires after that first, suppressed claim', () => {
  const onReady = vi.fn()
  const handleControllerChange = createControllerChangeHandler(onReady, false)

  handleControllerChange() // the initial claim - suppressed
  handleControllerChange() // a later deploy taking over - a real update

  expect(onReady).toHaveBeenCalledTimes(1)
})

test('onUpdateReady notifies subscribed listeners and can be unsubscribed', () => {
  const listener = vi.fn()
  const unsubscribe = onUpdateReady(listener)
  const handleControllerChange = createControllerChangeHandler(undefined, true)

  handleControllerChange()
  expect(listener).toHaveBeenCalledTimes(1)

  unsubscribe()
  const anotherHandler = createControllerChangeHandler(undefined, true)
  anotherHandler()
  expect(listener).toHaveBeenCalledTimes(1)
})
