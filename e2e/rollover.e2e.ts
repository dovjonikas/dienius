import { expect, test } from '@playwright/test'
import { card, openFreshAt, quickAdd, reopenAt, stampWorkingDay } from './app'

/**
 * A night passes. A task set to repeat every day is there the next morning
 * as a real task; what yesterday left is said once, in a banner, and moved
 * forward in one press - never on its own. The clock is pinned to a Tuesday
 * evening and then to the Wednesday morning, because the app has no midnight
 * timer on purpose: a plan that rewrites itself while you sleep is a plan
 * you did not make, and the next open is when the day is looked at.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

const TUESDAY_EVENING = new Date(Date.UTC(2026, 8, 15, 17, 0))
const WEDNESDAY_MORNING = new Date(Date.UTC(2026, 8, 16, 6, 0))

test('a daily repeat is on the next morning, and yesterday is pushed forward in one press', async ({ page }) => {
  await openFreshAt(page, TUESDAY_EVENING)
  await stampWorkingDay(page)
  await quickAdd(page, 'Water the plants')

  await page.getByRole('button', { name: 'More actions for Water the plants' }).click()
  await page.getByRole('button', { name: 'Details' }).click()
  const detail = page.getByRole('dialog', { name: 'Water the plants' })
  await detail.getByRole('group', { name: 'Repeats' }).getByRole('button', { name: 'Every day' }).click()
  await expect(detail.getByRole('group', { name: 'Changes apply to' })).toBeVisible()
  await page.getByRole('button', { name: 'Close details' }).click()

  await reopenAt(page, WEDNESDAY_MORNING)
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByText('Wednesday, September 16')).toBeVisible()

  // The series owes Wednesday an instance, and Wednesday has exactly one.
  await expect(page.getByRole('checkbox', { name: 'Water the plants' })).toHaveCount(1)

  // The same status element before and after the press: it swaps its own
  // sentence for what it did, so the filter has to accept both.
  const banner = page.getByRole('status').filter({ hasText: /^(Yesterday: \d+ unfinished|Moved \d+ to today)/ })
  await expect(banner).toContainText(/^Yesterday: \d+ unfinished/)
  await expect(banner).not.toContainText(/missed|failed|behind|overdue/i)
  await banner.getByRole('button', { name: 'Push to today' }).click()
  await expect(banner).toContainText(/Moved \d+ to today\./)
  await banner.getByRole('button', { name: 'Close' }).click()
  await expect(banner).toHaveCount(0)

  // Standup came forward carrying its count; the plants were not doubled.
  await expect(card(page, 'Standup')).toContainText('pushed once')
  await expect(page.getByRole('checkbox', { name: 'Water the plants' })).toHaveCount(1)
})
