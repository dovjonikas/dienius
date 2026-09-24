import { expect, test, vi } from 'vitest'
import { askForUpdatesOnReturn, createControllerChangeHandler, onUpdateReady, servesThisPage } from './pwa'

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

// --- the freeze's point 3: a deploy taking over with nothing pressed ------

test('a new worker that serves the very page already running is no update: nothing to reload into, nothing said', async () => {
  const onReady = vi.fn()
  const handleControllerChange = createControllerChangeHandler(onReady, true, async () => true)

  handleControllerChange()
  await Promise.resolve()
  await Promise.resolve()

  expect(onReady).not.toHaveBeenCalled()
})

test('a new worker that serves another build than the one running raises the flag, once', async () => {
  const onReady = vi.fn()
  const handleControllerChange = createControllerChangeHandler(onReady, true, async () => false)

  handleControllerChange()
  handleControllerChange()
  await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1))
})

test('the page is the build that is served when its script and stylesheet are the ones the served page names', async () => {
  const running = new DOMParser().parseFromString(
    '<html><head><script type="module" src="/dienius/assets/index-a.js"></script><link rel="stylesheet" href="/dienius/assets/index-a.css"></head></html>',
    'text/html',
  )
  const same = running.documentElement.outerHTML
  const next = same.replace(/index-a\./g, 'index-b.')
  expect(await servesThisPage(async () => same, running)).toBe(true)
  expect(await servesThisPage(async () => next, running)).toBe(false)
})

test('a page left open asks for a newer version each time it comes back into view, and not while it is away', () => {
  const update = vi.fn(async () => undefined)
  let state: DocumentVisibilityState = 'hidden'
  const doc = Object.defineProperty(new EventTarget(), 'visibilityState', { get: () => state }) as unknown as Document
  const stop = askForUpdatesOnReturn({ update } as unknown as ServiceWorkerRegistration, doc)

  doc.dispatchEvent(new Event('visibilitychange'))
  expect(update).not.toHaveBeenCalled()

  state = 'visible'
  doc.dispatchEvent(new Event('visibilitychange'))
  expect(update).toHaveBeenCalledTimes(1)

  stop()
  doc.dispatchEvent(new Event('visibilitychange'))
  expect(update).toHaveBeenCalledTimes(1)
})
