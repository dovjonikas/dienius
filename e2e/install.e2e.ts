import { expect, test } from '@playwright/test'

/**
 * The install offer, and the race it kept losing.
 *
 * A browser fires `beforeinstallprompt` once, early, and never again on that
 * page. The manifest is linked in the head, which is all a browser needs to
 * decide the site is installable - so the event can arrive while the app's
 * own bundle is still coming over the network. `lib/install.ts` armed its
 * listener inside that bundle, so on a fast load nobody was listening, the
 * offer was gone for the session, and Settings said "Not available here" with
 * no way to get it back except a slower load.
 *
 * The owner, after resetting a browser profile - which is exactly the load
 * where the service worker is warm and the page is quickest: "nebegaliu
 * install on device desktope, dingo tiesiog".
 *
 * This test makes that race certain rather than likely. The module is held
 * back at the network, and the event is fired the moment the head has run and
 * before the bundle can arrive. A page that only listens from inside the
 * bundle cannot pass it.
 *
 * The event itself has to be a synthetic one: a real `beforeinstallprompt`
 * comes from the browser's own installability check, which does not run in a
 * headless browser at all. What is being tested is the app's half - catching
 * it and holding it - which is the half that was broken.
 */
test.use({ timezoneId: 'Europe/Vilnius' })

test('an install offer that arrives before the app has loaded still reaches Settings', async ({ page }) => {
  // Held back long enough that the offer below lands first, every time.
  await page.route(/\/dienius\/assets\/.*\.js$/, async route => {
    await new Promise(resolve => setTimeout(resolve, 700))
    await route.continue()
  })

  // Fired as soon as the head's listener exists, which is the earliest a real
  // browser could fire it, and long before the bundle is running.
  await page.addInitScript(() => {
    const fire = () => {
      const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
      }
      event.prompt = () => Promise.resolve()
      event.userChoice = Promise.resolve({ outcome: 'accepted' as const })
      window.dispatchEvent(event)
    }
    const waitForTheHead = () => {
      if ('__dieniusInstallOffer' in window) fire()
      else setTimeout(waitForTheHead, 5)
    }
    waitForTheHead()
  })

  await page.goto('./')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.getByRole('button', { name: 'Take the tour' }).waitFor()

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Settings', exact: true }).click()
  const install = page.getByRole('button', { name: 'Install', exact: true })
  await expect(install).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Not available here' })).toHaveCount(0)
})
