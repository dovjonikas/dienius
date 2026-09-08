import { expect, test } from '@playwright/test'
import { openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * The day's arrows against the month they stand over.
 *
 * Not at the project's own 1366: below about 1460 the header sits in the
 * task column with the rail beside it, so there is no month underneath the
 * arrows to leave. From there up the header spans both columns and its left
 * edge is the month's left edge, which is where the owner reads them
 * together - and where the right arrow used to land 113px past the month,
 * out in the middle of the row. jsdom has no layout, so this is the only
 * level the measurement can be made at.
 */
test.use({ viewport: { width: 1500, height: 900 }, timezoneId: 'Europe/Vilnius' })

async function edges(page: import('@playwright/test').Page) {
  const month = await page.locator('.mini-calendar').boundingBox()
  const prev = await page.getByRole('button', { name: 'Previous day' }).boundingBox()
  const next = await page.getByRole('button', { name: 'Next day' }).boundingBox()
  if (!month || !prev || !next) throw new Error('the header or the month is not on the screen')
  return { month, prev, next }
}

test('both day arrows stand inside the month, on every day of the year', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  const first = await edges(page)
  for (const arrow of [first.prev, first.next]) {
    expect(arrow.x).toBeGreaterThanOrEqual(first.month.x - 1)
    expect(arrow.x + arrow.width).toBeLessThanOrEqual(first.month.x + first.month.width + 1)
    // The touch target is not traded away for the fit - CONVENTIONS section 9.
    expect(arrow.width).toBeGreaterThanOrEqual(44)
  }

  // And they do not move as the day's name changes length. Wednesday,
  // September 16 is the day above; five presses forward reaches Monday,
  // September 21, which prints eight characters shorter.
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.getByRole('heading', { name: 'Monday, September 21' })).toBeVisible()

  const later = await edges(page)
  expect(later.prev.x).toBeCloseTo(first.prev.x, 0)
  expect(later.next.x).toBeCloseTo(first.next.x, 0)
  expect(later.next.x + later.next.width).toBeLessThanOrEqual(later.month.x + later.month.width + 1)
})
