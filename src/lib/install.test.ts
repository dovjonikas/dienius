import { beforeEach, expect, test, vi } from 'vitest'
import { canInstall, isInstalledElsewhere, isInstalled, onInstallAvailabilityChange, promptInstall, resetInstallForTests, watchInstallPrompt } from './install'

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

/**
 * The offer that arrived before this module did.
 *
 * A browser fires `beforeinstallprompt` once and early - early enough to come
 * and go while the bundle is still being fetched, since the manifest link in
 * the head is all it needs to decide. index.html keeps it on the window under
 * `#catch-install-offer`, and arming takes it from there. Without this the
 * offer is simply lost for the session, which is what the owner reported
 * after resetting a browser profile: "nebegaliu install on device desktope,
 * dingo tiesiog".
 */
function holdEarlyOffer() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome: 'accepted' as const })
  ;(window as Window & { __dieniusInstallOffer?: unknown }).__dieniusInstallOffer = event
  return event
}

test('an offer caught in the head before this module armed is taken up', () => {
  holdEarlyOffer()
  expect(canInstall()).toBe(false)
  watchInstallPrompt()
  expect(canInstall()).toBe(true)
})

test('the offer the head is holding is shown, and only once', async () => {
  const event = holdEarlyOffer()
  watchInstallPrompt()

  expect(await promptInstall()).toBe('accepted')
  expect(event.prompt).toHaveBeenCalledTimes(1)
  // Spent. A browser refuses a second prompt on the same event, so the copy
  // the head is holding has to go with it - otherwise arming again in another
  // tab of the same page would pick a dead event back up and offer a button
  // that does nothing.
  expect(canInstall()).toBe(false)
  expect((window as Window & { __dieniusInstallOffer?: unknown }).__dieniusInstallOffer).toBeNull()
  expect(await promptInstall()).toBe('unavailable')
})

/**
 * The third way it can already be installed: sitting in the launcher while
 * this page is an ordinary tab.
 *
 * `isInstalled` answers a narrower question than its name - whether *this
 * page* is the installed app - so that case read as neither installed nor
 * installable, and the row said "Not available here" on a browser where it
 * was installed and done. The owner found it in edge://apps the same
 * minute.
 */
test('the browser is asked whether this app is installed, not just this window', async () => {
  vi.stubGlobal('navigator', Object.assign(Object.create(Object.getPrototypeOf(navigator)), navigator, {
    getInstalledRelatedApps: async () => [{ platform: 'webapp', url: 'https://example.com/manifest.webmanifest' }],
  }))
  expect(await isInstalledElsewhere()).toBe(true)
})

test('a browser with no such question answers no, which is where the row already was', async () => {
  vi.stubGlobal('navigator', Object.assign(Object.create(Object.getPrototypeOf(navigator)), navigator, {
    getInstalledRelatedApps: undefined,
  }))
  expect(await isInstalledElsewhere()).toBe(false)
})

test('a related app that is not this app is not this app', async () => {
  vi.stubGlobal('navigator', Object.assign(Object.create(Object.getPrototypeOf(navigator)), navigator, {
    getInstalledRelatedApps: async () => [{ platform: 'play', id: 'com.example.other' }],
  }))
  expect(await isInstalledElsewhere()).toBe(false)
})

test('a browser that refuses the question is not read as an answer', async () => {
  vi.stubGlobal('navigator', Object.assign(Object.create(Object.getPrototypeOf(navigator)), navigator, {
    getInstalledRelatedApps: async () => {
      throw new DOMException('Not allowed', 'NotAllowedError')
    },
  }))
  expect(await isInstalledElsewhere()).toBe(false)
})
