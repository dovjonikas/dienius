import { expect, test } from '@playwright/test'
import { openFreshAt, reopenAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * Blocks that end by themselves, in the browser - the owner's brief of
 * 2026-09-22, part 1. The starter working day has a commute each way; the
 * morning's is over by ten and done without a tick, and the one home is
 * said not to happen and stays undone after its time. On a desktop and on
 * the phone, where it has to fit.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('a commute is done once it is over, and one said not to happen stays undone', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  // 08:15 to 08:45, over an hour ago: done, and nobody ticked it - folded
  // into Done like anything ticked.
  const done = page.getByRole('button', { name: /^Done \d+$/ })
  await expect(done).toContainText('1')
  await done.click()
  await expect(page.getByRole('checkbox', { name: 'Commute', exact: true })).toBeChecked()
  const home = page.getByRole('checkbox', { name: 'Commute home' })
  await expect(home).not.toBeChecked()

  // The drive home is not happening today.
  await page.getByRole('button', { name: 'More actions for Commute home' }).click()
  await page.getByRole('button', { name: 'Commute home did not happen' }).click()
  await expect(page.locator('.task-missed-note')).toHaveText('did not happen')

  // Opened again after its time: still undone, still said.
  await reopenAt(page, wednesdayAt(18))
  await expect(page.getByRole('checkbox', { name: 'Commute home' })).not.toBeChecked()
  await expect(page.locator('.task-missed-note')).toHaveText('did not happen')
  await expect(page.getByRole('button', { name: /^Done \d+$/ })).toContainText('1')

  // And the day fits its screen: nothing scrolls sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
