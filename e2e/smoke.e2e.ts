import { expect, test } from '@playwright/test'
import { openFresh, quickAdd, stampWorkingDay, tick, tickEverything } from './app'

/**
 * The first ten minutes of a first day, end to end: the starter offer, a day
 * from one click, a task from one line, a tick, and the evening close
 * arriving the moment the last thing is ticked. Each of these has a unit
 * test; this is the one place they are seen to happen in sequence, in a
 * browser, on the production build.
 */
test('a first day: stamp, add, tick, and the day closes when the list is done', async ({ page }) => {
  await openFresh(page)

  await stampWorkingDay(page)
  await expect(page.getByRole('checkbox')).toHaveCount(9)

  await quickAdd(page, 'Walk')
  // The real input is visually hidden behind a drawn box, so it is attached
  // and checkable rather than visible.
  const walk = page.getByRole('checkbox', { name: 'Walk' })
  await expect(walk).toBeAttached()
  await expect(page.getByPlaceholder('Add a task')).toHaveValue('')

  await tick(page, 'Walk')
  await expect(walk).toBeChecked()
  // Folds into Done, where the count says one.
  await expect(page.getByRole('button', { name: /^Done \d+$/ })).toContainText('1')

  // Nothing about the day is appraised while it is open.
  await expect(page.getByLabel('Closing the day')).toHaveCount(0)

  await tickEverything(page)
  const close = page.getByLabel('Closing the day')
  await expect(close).toBeVisible()
  // The words this app never uses near a day's outcome - CONVENTIONS section 15.
  await expect(close).not.toContainText(/missed|failed|behind|only|should|incomplete|overdue/i)
})

test('the reading plan arrives from the palette, and never on its own', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: 'Library' }).click()
  await expect(page.getByRole('button', { name: 'Start a Books list' })).toBeVisible()

  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Commands and search' })
  await palette.getByRole('combobox').fill('reading plan')
  await palette.getByRole('option', { name: /Load my reading plan/ }).click()

  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
  await expect(page.getByText('The War of Art')).toBeVisible()
  await expect(page.getByText('9 going')).toBeVisible()
})
