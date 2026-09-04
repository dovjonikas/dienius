import { expect, test } from '@playwright/test'
import { openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * Seven columns of one timeline, and a block dragged from one day to the
 * next. The drag is pointer events resolved by elementFromPoint on the
 * document, which no unit test can see; here it is a real mouse.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('a block dragged onto another day moves there, and says so', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  await page.getByRole('navigation').getByRole('button', { name: 'Calendar' }).click()
  await page.getByRole('group', { name: 'Calendar view' }).getByRole('button', { name: 'Week' }).click()

  const block = page.getByRole('button', { name: 'Standup, 11:00 on Wed' })
  const from = await block.boundingBox()
  const thursday = await page.locator('[data-week-date="2026-09-17"] .week-track').boundingBox()
  if (!from || !thursday) throw new Error('the week did not lay out')

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  // In steps, so the eight-pixel threshold is crossed the way a hand does it.
  await page.mouse.move(thursday.x + thursday.width / 2, from.y + from.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect(page.getByRole('button', { name: 'Standup, 11:00 on Thu' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Standup, 11:00 on Wed' })).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Standup moved to Thu' })).toBeVisible()
})
