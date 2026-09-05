import { expect, test } from '@playwright/test'
import { openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * Something came up, for any day of the week, walked the way the phone call
 * happens: with the clock pinned to ten on a Wednesday and the starter
 * Working day stamped, so the same blocks are ahead of now on every run.
 *
 * Two walks. On a desktop the week is the screen that shows Friday, so the
 * door is in the week's bar and the plan lands on a Friday nobody has
 * opened. On a phone the promise is the whole point of the feature - from
 * the door to Accept in three presses, with nothing scrolled - so that is
 * what is measured, not read: the three controls and Accept all inside the
 * viewport, the sheet's body not scrolled, the page not scrolled.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('desktop: from the week, Friday afternoon is gone, and Friday is made and marked in one press', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the desktop walk')
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Calendar' }).click()
  await page.getByRole('group', { name: 'Calendar view' }).getByRole('button', { name: 'Week' }).click()
  await page.getByRole('button', { name: 'Something came up' }).click()

  const sheet = page.getByRole('dialog', { name: 'Replan' })
  await expect(sheet.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
  // The pinned clock is a Wednesday, so Thursday is the Tomorrow chip and
  // Friday is the first day named by its weekday.
  await sheet.getByRole('button', { name: 'Fri 18' }).click()
  await sheet.getByRole('button', { name: 'Afternoon gone' }).click()

  // Friday has nothing on it in a fresh install, so the line is the whole
  // day around the loss, said the way it would be said into the phone.
  const status = sheet.getByRole('status')
  await expect(status).toContainText('Free on Friday: 07:00-13:00, after 18:00.')
  await expect(status).toContainText('Nothing in the way. It goes straight in.')
  await expect(status).not.toContainText(/missed|failed|behind|only|should/i)

  await sheet.getByRole('button', { name: 'Accept' }).click()
  await expect(sheet).toHaveCount(0)

  // The week is still the screen, Friday carries the block and the word.
  await expect(page.getByRole('button', { name: 'Something came up, 13:00 on Fri' })).toBeVisible()
  await expect(page.locator('[data-week-date="2026-09-18"]').getByText('replanned')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Friday replanned' })).toBeVisible()

  // Opening Friday shows the day as accepted, not a note about one.
  await page.getByRole('button', { name: 'Open Fri 18' }).click()
  await expect(page.getByRole('checkbox', { name: 'Something came up' })).toBeAttached()
})

test('phone: the phone rings, and from the door to Accept is three presses with nothing scrolled', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the phone walk')
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  await page.getByRole('button', { name: 'Replan' }).click()
  const sheet = page.getByRole('dialog', { name: 'Replan' })
  await sheet.getByRole('button', { name: 'Something came up' }).click()

  // Press one and two: the day, the shape.
  const tomorrow = sheet.getByRole('button', { name: 'Tomorrow' })
  const morning = sheet.getByRole('button', { name: 'Morning gone' })
  const accept = sheet.getByRole('button', { name: 'Accept' })
  await tomorrow.click()
  await morning.click()
  await expect(sheet.getByRole('status')).toContainText('Free tomorrow: after 13:00.')

  // Measured, not read: every control the three presses need is inside the
  // 390x844 viewport, the sheet's own scroller is at its top, and the page
  // under the sheet was not scrolled to get there - the day view itself may
  // be taller than a phone, which is allowed and beside the point.
  const viewport = page.viewportSize()!
  for (const control of [tomorrow, morning, accept]) {
    const box = await control.boundingBox()
    expect(box, 'the control is laid out').toBeTruthy()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
  const scrolled = await page.evaluate(() => ({
    body: document.querySelector('.replan-body')?.scrollTop ?? 0,
    page: window.scrollY,
  }))
  expect(scrolled.body).toBe(0)
  expect(scrolled.page).toBe(0)

  // Press three.
  await accept.click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Tomorrow replanned' })).toBeVisible()

  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.getByRole('checkbox', { name: 'Something came up' })).toBeAttached()
})
