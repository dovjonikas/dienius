import { expect, test } from '@playwright/test'
import { openFreshAt, wednesdayAt } from './app'

/**
 * A week template, built and then stamped.
 *
 * The two halves that no unit test can see are here: the drag that moves a
 * block from one column to another, which is pointer events resolved by
 * elementFromPoint on the real document, and the stamp - which is the whole
 * point of the feature and the one place a week template and a day template
 * genuinely differ. A date takes its own weekday's column and nothing else.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('a week template is built once and stamps each day its own column', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Templates' }).click()
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A week/ }).click()
  await page.getByPlaceholder('Week name').fill('My week')

  // One block on every weekday, in one press. This is what the feature is
  // for: most of a week is the same on several days.
  await page.getByPlaceholder('09:00').fill('08:00')
  await page.getByPlaceholder('What happens').fill('Commute')
  await page.getByRole('group', { name: 'Add to' }).getByRole('button', { name: 'Weekdays' }).click()
  await page.getByRole('button', { name: 'Add a block' }).click()

  // And one that is only on a Thursday, which is what makes a week worth
  // having over a day template stamped five times.
  await page.getByRole('region', { name: 'Thursday' }).getByRole('button', { name: /^Thursday/ }).click()
  await page.getByPlaceholder('09:00').fill('14:00')
  await page.getByPlaceholder('What happens').fill('Physio')
  // One press back to a single day, from the five the preset above left
  // switched on.
  await page.getByRole('group', { name: 'Add to' }).getByRole('button', { name: 'Just one day' }).click()
  await page.getByRole('button', { name: 'Add a block' }).click()

  await expect(page.getByRole('region', { name: 'Thursday' }).getByText('Physio')).toBeVisible()

  // Dragged from Thursday to Friday with a real mouse.
  // The block on the week picture, which is what a drag now takes hold of.
  const block = page.getByRole('button', { name: /^Physio at .* on Thursday/ })
  const from = await block.boundingBox()
  // The track, not the column: a column is display: contents, so it has no
  // box of its own - its three parts are placed straight into the grid.
  // The drop still finds the column, because closest() walks the DOM and
  // not the layout.
  const friday = await page.locator('[data-wt-day="5"] .week-track').boundingBox()
  if (!from || !friday) throw new Error('the week editor did not lay out')

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(friday.x + friday.width / 2, friday.y + friday.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect(page.getByRole('region', { name: 'Friday' }).getByText('Physio')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Thursday' }).getByText('Physio')).toHaveCount(0)

  await page.getByRole('button', { name: 'Save template' }).click()
  // "A week" and nothing after it: the card's meta line ended in a block
  // count until v2.20, and the preview line above it already ends in
  // "+N more", which is the same number read rather than told.
  await expect(page.getByText('A week', { exact: true })).toBeVisible()

  // Stamped onto the week. Wednesday takes the weekday column; Friday takes
  // the weekday column and the one block that is only its own.
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: 'My week', exact: true }).click()
  await page.getByRole('gridcell', { name: /September 16/ }).click()
  await page.getByRole('gridcell', { name: /September 18/ }).click()
  await page.getByRole('button', { name: 'Save' }).click()

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('checkbox', { name: 'Commute' })).toBeAttached()
  await expect(page.getByRole('checkbox', { name: 'Physio' })).toHaveCount(0)

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('checkbox', { name: 'Physio' })).toBeAttached()
  await expect(page.getByRole('checkbox', { name: 'Commute' })).toBeAttached()
})

test('the day switches put a rotation on two days at once, and hold for the next block', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(9))
  await page.getByRole('button', { name: 'Templates', exact: true }).first().click()
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A week/ }).click()
  await page.getByPlaceholder('Week name').fill('My week')

  const where = page.getByRole('group', { name: 'Add to' })
  // Wednesday is on because the editor opened on it, so the rotation needs
  // it switched off - which is exactly what the line under the switches is
  // for, and what this asserts.
  await where.getByRole('button', { name: 'Wednesday' }).click()
  await where.getByRole('button', { name: 'Monday' }).click()
  await where.getByRole('button', { name: 'Thursday' }).click()
  await expect(page.getByText('Adds to Mon, Thu')).toBeVisible()

  await page.getByPlaceholder('What happens').fill('Training A')
  await page.getByRole('button', { name: 'Add a block' }).click()
  // Set once. The second block of the rotation is a title and a press.
  await expect(page.getByText('Adds to Mon, Thu')).toBeVisible()
  await page.getByPlaceholder('What happens').fill('Training B')
  await page.getByRole('button', { name: 'Add a block' }).click()

  for (const day of ['Monday', 'Thursday']) {
    const column = page.getByRole('region', { name: day })
    await expect(column.getByText('Training A')).toBeVisible()
    await expect(column.getByText('Training B')).toBeVisible()
  }
  await expect(page.getByRole('region', { name: 'Wednesday' }).getByText('Training A')).toHaveCount(0)
})

/**
 * A list bound to a block that already exists, and the book that lands.
 *
 * Until v2.17 the binding control was only on the add row, so this whole
 * path - build the block, then decide what it draws from - did not exist:
 * the block had to be removed and made again. The owner looked for it on an
 * open block and took the feature for missing.
 *
 * The half a unit test cannot see is the last line: a block bound to a list
 * stamps a day with the *book's* title, not the block's, and that goes
 * through the real stamp on a real date.
 */
test('a list bound to a block already on the week puts the book on the stamped day', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))

  // A list with one thing in it, made the way library.e2e.ts makes one: the
  // preset an empty Library offers, which is the door most people take.
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Library' }).click()
  await page.getByRole('button', { name: 'Start a Books list' }).click()
  const add = page.getByLabel('Add to Books')
  await add.fill('Deep Work, 12 chapters')
  await add.press('Enter')
  await expect(page.getByRole('button', { name: 'Deep Work, ch 0/12' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Templates' }).click()
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A week/ }).click()
  await page.getByPlaceholder('Week name').fill('Reading week')
  await page.getByPlaceholder('09:00').fill('20:00')
  await page.getByPlaceholder('What happens').fill('Reading')
  await page.getByRole('group', { name: 'Add to' }).getByRole('button', { name: 'All days' }).click()
  await page.getByRole('button', { name: 'Add a block' }).click()

  // The block exists. Now bind it, from its own panel - the thing that could
  // not be done at all before.
  await page.getByRole('region', { name: 'Wednesday' }).getByRole('button', { name: /^Reading[ ,]/ }).click()
  // Scoped to the open block: since v2.17 the add row carries the same
  // labelled field, so a bare query finds two. On screen they are never
  // confusable - one is under the block's name, the other under WHAT.
  await page.locator('.wt-note').getByLabel('Library list').selectOption({ label: 'From Books' })
  await expect(page.getByText('Next: Deep Work')).toBeVisible()

  await page.getByRole('button', { name: 'Save template' }).click()

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: 'Reading week', exact: true }).click()
  await page.getByRole('gridcell', { name: /September 16/ }).click()
  await page.getByRole('button', { name: 'Save' }).click()

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Today' }).click()
  // The book, not the block: a bound block stamps what is next in the list.
  await expect(page.getByRole('checkbox', { name: 'Deep Work' })).toBeAttached()
  await expect(page.getByRole('checkbox', { name: 'Reading' })).toHaveCount(0)
})

/**
 * The other order, which is the one that was broken.
 *
 * The test above binds a list that already has a book in it and then stamps.
 * The owner did it the way a person actually does: stamped the week first,
 * and put the books in afterwards. The days went on saying "Reading" with
 * nothing behind them, because the binding was resolved once at stamp time
 * and never asked again - "speju is naujo turiu idet".
 *
 * A block bound to a list does not say a book. It says "whatever is next in
 * that list", and what is next changes while the day sits there waiting.
 */
test('books put in the list after the week was stamped reach the day that is waiting', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))

  // An empty list. Nothing to point at yet, which is the whole setup.
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Library' }).click()
  await page.getByRole('button', { name: 'Start a Books list' }).click()

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Templates' }).click()
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A week/ }).click()
  await page.getByPlaceholder('Week name').fill('Reading week')
  await page.getByPlaceholder('09:00').fill('20:00')
  await page.getByPlaceholder('What happens').fill('Reading')
  await page.getByRole('group', { name: 'Add to' }).getByRole('button', { name: 'All days' }).click()
  await page.getByRole('button', { name: 'Add a block' }).click()
  await page.getByRole('region', { name: 'Wednesday' }).getByRole('button', { name: /^Reading[ ,]/ }).click()
  await page.locator('.wt-note').getByLabel('Library list').selectOption({ label: 'From Books' })
  await page.getByRole('button', { name: 'Save template' }).click()

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: 'Reading week', exact: true }).click()
  await page.getByRole('gridcell', { name: /September 16/ }).click()
  await page.getByRole('button', { name: 'Save' }).click()

  // Stamped with the block's own title, because there was nothing else to
  // say. This much always worked.
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('checkbox', { name: 'Reading' })).toBeAttached()

  // The book arrives now, after the day is already on the calendar.
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Library' }).click()
  const add = page.getByLabel('Add to Books')
  await add.fill('Deep Work, 12 chapters')
  await add.press('Enter')

  // And the day that was already stamped is holding the book, with no
  // re-stamp and nothing to press.
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('checkbox', { name: 'Deep Work' })).toBeAttached()
  await expect(page.getByRole('checkbox', { name: 'Reading' })).toHaveCount(0)
})
