import { expect, test } from '@playwright/test'
import { openFreshAt, quickAdd, stampWorkingDay, tick, tickEverything, wednesdayAt } from './app'

// wednesdayAt is a Vilnius clock time, so the zone has to match it.
test.use({ timezoneId: 'Europe/Vilnius' })

/**
 * The first ten minutes of a first day, end to end: the starter offer, a day
 * from one click, a task from one line, a tick, and the evening close
 * arriving the moment the last thing is ticked. Each of these has a unit
 * test; this is the one place they are seen to happen in sequence, in a
 * browser, on the production build.
 */
test('a first day: stamp, add, tick, and the day closes when the list is done', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))

  await stampWorkingDay(page)
  // Nine blocks, and the morning's commute already over - 08:15 to 08:45 -
  // so it is done without a tick and folded into Done.
  await expect(page.getByRole('checkbox')).toHaveCount(8)

  await quickAdd(page, 'Walk')
  // The real input is visually hidden behind a drawn box, so it is attached
  // and checkable rather than visible.
  const walk = page.getByRole('checkbox', { name: 'Walk' })
  await expect(walk).toBeAttached()
  await expect(page.getByPlaceholder('Add a task')).toHaveValue('')

  await tick(page, 'Walk')
  await expect(walk).toBeChecked()
  // Folds into Done, where the count says two with the commute.
  await expect(page.getByRole('button', { name: /^Done \d+$/ })).toContainText('2')

  // Nothing about the day is appraised while it is open.
  await expect(page.getByLabel('Closing the day')).toHaveCount(0)

  await tickEverything(page)
  const close = page.getByLabel('Closing the day')
  await expect(close).toBeVisible()
  // The words this app never uses near a day's outcome - CONVENTIONS section 15.
  await expect(close).not.toContainText(/missed|failed|behind|only|should|incomplete|overdue/i)
})
