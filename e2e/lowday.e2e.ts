import { expect, test } from '@playwright/test'
import { card, openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * A low day, walked in a real browser against the starter Working day with
 * the clock pinned to ten on a Wednesday: one key task marked, one press
 * beside Replan, the proposal read, Accept, and the day as it is after -
 * the key task at 40% of its length, the mark under the date, the routine
 * blocks where they were. lowDay.test.ts owns the arithmetic; this is the
 * three presses and what they leave behind.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test.beforeEach(async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)
})

test('one press keeps the key task at 40%, marks the day, and leaves the routine alone', async ({ page }) => {
  // "Deep work block", 09:00 to 11:00 on the starter day, made key from its sheet.
  await card(page, 'Deep work block').getByRole('button', { name: /^More actions for Deep work block/ }).click()
  await page.getByRole('button', { name: /Details/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Mark as key' }).click()
  await sheet.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: 'Low day' }).click()
  const low = page.getByRole('dialog', { name: 'Replan' })
  await expect(low.getByRole('heading', { name: 'Low day' })).toBeVisible()
  const summary = low.getByRole('status')
  await expect(summary).toContainText('Key task stays: Deep work block 50 min.')
  await expect(summary).not.toContainText(/missed|failed|behind|only|should/i)

  await low.getByRole('button', { name: 'Accept' }).click()
  await expect(low).toBeHidden()

  // The mark under the date, the door gone, and the key task at its new
  // length on its card. Undo is offered, as for every replan.
  await expect(page.getByText('Low day', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Low day' })).toHaveCount(0)
  await expect(card(page, 'Deep work block')).toContainText('50 min')
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
})
