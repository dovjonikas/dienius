import { expect, test } from '@playwright/test'
import { quickAdd, stampWorkingDay } from './app'

/**
 * The day the app is standing on, when the clock goes past midnight under it.
 *
 * Every other test in this suite moves time by reloading - `reopenAt` - which
 * is what opening the app in the morning does on a phone that has swapped the
 * tab out. It is not what happens on the desk the owner works at all day, or
 * on a PWA the system keeps warm: the tab open at 07:00 is the tab that was
 * open at 23:00, and until v2.17 the day it decided on at mount was the one it
 * kept for ever. The header said "Today" over yesterday's date, and the first
 * task typed that morning was written onto the day before.
 *
 * These install the clock rather than pinning it, which is the one place in
 * this suite that is right: `openFreshAt` pins on purpose, so debounces and
 * the undo toast behave as they do for a person, but a pinned clock does not
 * fire the timeout aimed at midnight, and the timeout is the thing under test.
 * The second test covers the other half - a laptop asleep at midnight, whose
 * timeout never fires at all, and which finds out on the lid opening.
 */

/** 23:50 on the Wednesday every other test uses, Vilnius time. */
function wednesdayNight(): Date {
  return new Date(Date.UTC(2026, 8, 16, 23 - 3, 50))
}

/** A first open at a chosen instant, with the clock installed rather than pinned. */
async function openInstalledAt(page: import('@playwright/test').Page, time: Date): Promise<void> {
  await page.clock.install({ time })
  await page.goto('./')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload()
  await page.getByRole('button', { name: 'Take the tour' }).waitFor()
}

test('the day view left open overnight moves to the new day on its own', async ({ page }) => {
  await openInstalledAt(page, wednesdayNight())
  await stampWorkingDay(page)
  await expect(page.getByRole('heading', { name: 'Today', level: 2 })).toBeVisible()
  await expect(page.locator('.day-subtitle')).toContainText('September 16')

  // No reload: the same tab, seven hours later.
  await page.clock.fastForward('07:10:00')

  await expect(page.getByRole('heading', { name: 'Today', level: 2 })).toBeVisible()
  await expect(page.locator('.day-subtitle')).toContainText('September 17')
})

test('a task typed the morning after lands on the morning, not on the night before', async ({ page }) => {
  await openInstalledAt(page, wednesdayNight())
  await stampWorkingDay(page)

  await page.clock.fastForward('07:10:00')
  await expect(page.locator('.day-subtitle')).toContainText('September 17')
  await quickAdd(page, 'Ring the dentist')
  // Counted rather than seen: the real input is visually hidden behind the
  // drawn box, the same reason `tick` in app.ts aims at its sibling.
  await expect(page.getByRole('checkbox', { name: 'Ring the dentist', exact: true })).toHaveCount(1)

  // Wednesday is one press back, and it must not be holding it.
  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(page.locator('.day-subtitle')).toContainText('September 16')
  await expect(page.getByRole('checkbox', { name: 'Ring the dentist', exact: true })).toHaveCount(0)
})

test('a day somebody walked forward to is not taken away from them at midnight', async ({ page }) => {
  await openInstalledAt(page, wednesdayNight())
  await stampWorkingDay(page)
  // Friday, two presses ahead: a day being looked at on purpose.
  await page.getByRole('button', { name: 'Next day' }).click()
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.locator('.day-subtitle')).toContainText('September 18')

  await page.clock.fastForward('07:10:00')

  await expect(page.locator('.day-subtitle')).toContainText('September 18')
})

test('a machine that was asleep at midnight finds out when the tab comes back', async ({ page }) => {
  await openInstalledAt(page, wednesdayNight())
  await stampWorkingDay(page)

  // A sleeping machine fires no timeout: the clock jumps and nothing runs.
  await page.clock.setFixedTime(new Date(Date.UTC(2026, 8, 17, 7 - 3, 0)))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))

  await expect(page.getByRole('heading', { name: 'Today', level: 2 })).toBeVisible()
  await expect(page.locator('.day-subtitle')).toContainText('September 17')
})
