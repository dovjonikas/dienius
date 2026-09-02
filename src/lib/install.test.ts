import { beforeEach, expect, test, vi } from 'vitest'
import { canInstall, isInstalled, onInstallAvailabilityChange, promptInstall, resetInstallForTests, watchInstallPrompt } from './install'

beforeEach(() => {
  resetInstallForTests()
})

/** The event Chromium fires, and nothing else does. */
function fireInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome })
  window.dispatchEvent(event)
  return event
}

test('nothing is installable until a browser says so', () => {
  watchInstallPrompt()
  expect(canInstall()).toBe(false)
})

test('a fired prompt is held, and prevented so the browser does not show its own', () => {
  watchInstallPrompt()
  const event = fireInstallPrompt()
  expect(canInstall()).toBe(true)
  expect(event.defaultPrevented).toBe(true)
})

// The browser will not hand the event over twice, so a button that looked
// live and did nothing is exactly what holding it past the first use gives.
test('the held event is spent by one prompt and not offered again', async () => {
  watchInstallPrompt()
  const event = fireInstallPrompt('accepted')

  await expect(promptInstall()).resolves.toBe('accepted')
  expect(event.prompt).toHaveBeenCalledTimes(1)
  expect(canInstall()).toBe(false)
  await expect(promptInstall()).resolves.toBe('unavailable')
})

test('a dismissed prompt is reported as dismissed, not as a failure', async () => {
  watchInstallPrompt()
  fireInstallPrompt('dismissed')
  await expect(promptInstall()).resolves.toBe('dismissed')
})

test('prompting with nothing held says so rather than throwing', async () => {
  watchInstallPrompt()
  await expect(promptInstall()).resolves.toBe('unavailable')
})

// Fired on the page that triggered the install and on every other open copy.
// Dropping the held event here is what stops Settings offering to install
// something that already is.
test('an install completing elsewhere drops the offer', () => {
  watchInstallPrompt()
  fireInstallPrompt()
  window.dispatchEvent(new Event('appinstalled'))
  expect(canInstall()).toBe(false)
})

test('listeners hear the offer arrive and leave, and stop when unsubscribed', () => {
  const heard = vi.fn()
  watchInstallPrompt()
  const unsubscribe = onInstallAvailabilityChange(heard)

  fireInstallPrompt()
  expect(heard).toHaveBeenCalledTimes(1)

  window.dispatchEvent(new Event('appinstalled'))
  expect(heard).toHaveBeenCalledTimes(2)

  unsubscribe()
  fireInstallPrompt()
  expect(heard).toHaveBeenCalledTimes(2)
})

test('watching twice does not arm two listeners for one event', () => {
  const heard = vi.fn()
  watchInstallPrompt()
  watchInstallPrompt()
  onInstallAvailabilityChange(heard)
  fireInstallPrompt()
  expect(heard).toHaveBeenCalledTimes(1)
})

// A display-mode query that throws, or a navigator with no standalone flag,
// is a browser this app still has to open in.
test('being installed is answered, not guessed, and never throws', () => {
  expect(typeof isInstalled()).toBe('boolean')
})
