import { expect, test } from '@playwright/test'
import { openFreshAt, reopenAt, wednesdayAt } from './app'

/**
 * North as a text: written on the page, read as blocks, and the first thing
 * the app opens on in the morning.
 *
 * The jsdom tests hold each piece; what they cannot see is the whole walk
 * on a real screen, and on the phone's screen in particular, since a text
 * read every morning is read on whichever device is in hand. Every line
 * typed here is a generic one: the app carries nobody's text and neither
 * does this test.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('the text is written on the page, reads back as blocks, and opens the next morning', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))

  // A fresh app opens on the day: there is no text to read yet.
  await expect(page.getByPlaceholder('Add a task')).toBeVisible()
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'North', exact: true }).click()

  // Nothing written: the page is the editor, and it says only where to write.
  const box = page.getByRole('textbox', { name: 'North' })
  await expect(box).toBeFocused()
  await expect(box).toHaveAttribute('placeholder', 'Write here.')
  await box.fill('First line here\nSecond line here\n\nThird line here')
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // Read: two blocks, the blank line between them kept as a gap.
  const blocks = page.locator('.north-block')
  await expect(blocks).toHaveCount(2)
  await expect(blocks.nth(0)).toHaveText('First line here\nSecond line here')
  await expect(blocks.nth(1)).toHaveText('Third line here')
  await expect(page.getByRole('button', { name: 'Start the day' })).toHaveCount(0)

  // The next morning the app opens on it, and Start the day is the way on.
  await reopenAt(page, wednesdayAt(7 + 24))
  await expect(page.getByRole('region', { name: 'North' })).toBeVisible()
  await expect(blocks.nth(0)).toHaveText('First line here\nSecond line here')
  await page.getByRole('button', { name: 'Start the day' }).click()
  await expect(page.getByPlaceholder('Add a task')).toBeVisible()

  // Opened again the same day, it is the day.
  await reopenAt(page, wednesdayAt(9 + 24))
  await expect(page.getByPlaceholder('Add a task')).toBeVisible()
  await expect(page.getByRole('region', { name: 'North' })).toHaveCount(0)
})
