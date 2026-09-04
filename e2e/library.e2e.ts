import { expect, test } from '@playwright/test'
import { openFreshAt, stampWorkingDay, tick, wednesdayAt } from './app'

/**
 * A book, bound to a template, arriving on a day by name and moving on when
 * its session is ticked. This is the one library feature that crosses three
 * tabs - Library, Templates, Today - so it is the one worth seeing end to
 * end: each tab's part has a unit test, and none of those can show that the
 * block a template carries turns into the actual book on the actual day.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('a list bound to a template puts the current book on the day, and a tick advances it', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  await page.getByRole('navigation').getByRole('button', { name: 'Library' }).click()
  await page.getByRole('button', { name: 'Start a Books list' }).click()
  const add = page.getByLabel('Add to Books')
  await add.fill('Dune, 12 chapters')
  await add.press('Enter')
  await expect(page.getByRole('button', { name: 'Dune, ch 0/12' })).toBeVisible()

  // Onto the Working day template, in the evening, from the book's own panel.
  await page.getByRole('button', { name: 'Dune, ch 0/12' }).click()
  await page.getByRole('button', { name: 'Add to template' }).click()
  await page.getByLabel('At', { exact: true }).fill('21:00')
  await page.getByRole('button', { name: 'Add block' }).click()

  // Stamping the template again onto today adds only what the day is
  // missing, and what it is missing arrives named after the book.
  await page.getByRole('navigation').getByRole('button', { name: 'Today' }).click()
  await page.getByRole('button', { name: 'Working day', pressed: true }).click()
  const dune = page.getByRole('checkbox', { name: 'Dune' })
  await expect(dune).toBeAttached()
  await expect(page.getByRole('listitem').filter({ has: dune })).toContainText('21:00')
  await expect(page.getByText('ch 0/12')).toBeVisible()

  await tick(page, 'Dune')
  await expect(dune).toBeChecked()

  await page.getByRole('navigation').getByRole('button', { name: 'Library' }).click()
  await expect(page.getByRole('button', { name: 'Dune, ch 1/12' })).toBeVisible()

  // Two taps from the library to a day: the panel, then the day.
  await page.getByRole('button', { name: 'Dune, ch 1/12' }).click()
  await page.getByRole('button', { name: 'Onto tomorrow' }).click()
  await expect(page.getByRole('heading', { name: 'Thursday, September 17' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Dune' })).toBeAttached()
})
