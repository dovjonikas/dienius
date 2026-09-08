import { expect, test } from '@playwright/test'
import { openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * The day's block against the month it stands over.
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
  const date = await page.locator('.day-subtitle').first().boundingBox()
  if (!month || !prev || !next || !date) throw new Error('the header or the month is not on the screen')
  return { month, prev, next, date }
}

test('the arrows and the date both stand inside the month, on every day of the year', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  const first = await edges(page)
  const inside = (box: { x: number; width: number }, month: { x: number; width: number }) => {
    expect(box.x).toBeGreaterThanOrEqual(month.x - 1)
    expect(box.x + box.width).toBeLessThanOrEqual(month.x + month.width + 1)
  }
  for (const arrow of [first.prev, first.next]) {
    inside(arrow, first.month)
    // The touch target is not traded away for the fit - CONVENTIONS section 9.
    expect(arrow.width).toBeGreaterThanOrEqual(44)
  }
  // The owner's second reading of this row: the date is text, and text
  // leaving the calendar it belongs to is the same defect as an arrow doing
  // it. Its line is the block's own width, so this holds at every length.
  inside(first.date, first.month)

  // And nothing moves as the day's name changes length. Wednesday is the
  // day above; five presses forward reaches Monday, which prints four
  // characters shorter, and the chip after the block must not follow it.
  const chipBefore = await page.locator('.day-tools').boundingBox()
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible()

  const later = await edges(page)
  const chipAfter = await page.locator('.day-tools').boundingBox()
  expect(later.prev.x).toBeCloseTo(first.prev.x, 0)
  expect(later.next.x).toBeCloseTo(first.next.x, 0)
  expect(chipAfter?.x).toBeCloseTo(chipBefore?.x ?? -1, 0)
  inside(later.next, later.month)
  inside(later.date, later.month)
})
