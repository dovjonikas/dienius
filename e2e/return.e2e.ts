import { expect, test } from '@playwright/test'
import { card, openFreshAt, wednesdayAt } from './app'

/**
 * Return adds the thing, in every row that adds a thing.
 *
 * The week rehearsal counted the cost of not knowing: a hundred and
 * thirty-eight presses to build a week against ninety-seven, and
 * twenty-two of the difference were reaching for Add with the hand already
 * on the keys. So this walks two promises at once in each row - that the
 * mark is on the screen with nothing pressed and nothing hovered, and that
 * the key it names really does add.
 *
 * A browser rather than jsdom because "visible without pressing anything"
 * is a statement about layout, and jsdom has none.
 */
// Desktop only, and by the config rather than by a skip here: the phone
// project runs a named handful of files and this is not one of them.
test.use({ timezoneId: 'Europe/Vilnius' })

test('every row that Return adds to says so, and does it', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))

  // --- quick-add, on the day -------------------------------------------
  const quick = page.getByPlaceholder('Add a task')
  await expect(mark(page, quick)).toBeVisible()
  await expect(quick).toHaveAttribute('aria-keyshortcuts', 'Enter')

  await quick.fill('Call the plumber')
  await quick.press('Enter')
  await expect(card(page, 'Call the plumber')).toBeVisible()

  // --- the day template editor -----------------------------------------
  await page.getByRole('navigation').getByRole('button', { name: 'Templates' }).click()
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A day/ }).click()
  await page.getByPlaceholder('Template name').fill('Weekday')

  const blockTitle = page.getByPlaceholder('What happens')
  await expect(mark(page, blockTitle)).toBeVisible()
  await expect(blockTitle).toHaveAttribute('aria-keyshortcuts', 'Enter')

  await page.getByPlaceholder('09:00').fill('07:00')
  await blockTitle.fill('Get up')
  await blockTitle.press('Enter')
  await expect(page.getByRole('button', { name: 'Remove Get up' })).toBeVisible()
  // The button it does not replace is still there.
  await expect(page.getByRole('button', { name: 'Add a block' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  // --- the week template editor ----------------------------------------
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A week/ }).click()
  await page.getByPlaceholder('Week name').fill('My week')

  const weekTitle = page.getByPlaceholder('What happens')
  await expect(mark(page, weekTitle)).toBeVisible()
  await expect(weekTitle).toHaveAttribute('aria-keyshortcuts', 'Enter')

  await weekTitle.fill('Gym')
  await weekTitle.press('Enter')
  await expect(page.getByText('Gym').first()).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  // --- the library's add line ------------------------------------------
  await page.getByRole('navigation').getByRole('button', { name: 'Library' }).click()
  // An empty library offers to start one rather than showing New list.
  await page.getByRole('button', { name: 'Start a Books list' }).click()

  const add = page.getByRole('textbox', { name: 'Add to Books' })
  await expect(mark(page, add)).toBeVisible()
  await expect(add).toHaveAttribute('aria-keyshortcuts', 'Enter')

  await add.fill('Deep Work')
  await add.press('Enter')
  await expect(page.getByText('Deep Work').first()).toBeVisible()
})

/**
 * The one thing Return did that the button refused.
 *
 * The week editor's day switches can all be off, and Add block is disabled
 * in that state. Return was not: it added nothing and cleared the title
 * anyway, so the press looked like it had worked and the typing was gone.
 */
test('Return in the week editor refuses what the button refuses', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await page.getByRole('navigation').getByRole('button', { name: 'Templates' }).click()
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A week/ }).click()

  // Wednesday is on by default, because that is the day this test opens on.
  await page.getByRole('button', { name: 'Wednesday', exact: true }).click()
  await expect(page.getByText('No days chosen - nothing to add to.')).toBeVisible()

  const title = page.getByPlaceholder('What happens')
  await title.fill('Gym')
  await title.press('Enter')
  await expect(title).toHaveValue('Gym')
})

/** The mark inside a field, which is a sibling of the input in its wrapper. */
function mark(page: import('@playwright/test').Page, field: import('@playwright/test').Locator) {
  return field.locator('xpath=following-sibling::*[1]').getByText('Return')
}
