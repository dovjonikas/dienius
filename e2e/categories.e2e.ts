import { expect, test } from '@playwright/test'
import { card, openFreshAt, quickAdd, stampWorkingDay, wednesdayAt } from './app'

/**
 * The categories the owner owns, walked end to end: one made with a colour
 * picked by hand, used on a real task, and then deleted so its tasks land on
 * the one they were moved to.
 *
 * The delete is the reason this test exists. Everything else here is a form,
 * and a form is what the unit tests are for; a delete rewrites tasks,
 * template blocks and backlog items in one commit, and the only honest way to
 * know that reached the day view is to look at the day view.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test.beforeEach(async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)
})

test('a category is made with a picked colour, used on a task, and deleted onto another', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Categories', exact: true }).click()

  await page.getByRole('button', { name: 'Add a category' }).click()
  await page.getByLabel('Name').fill('Gym')
  await page.getByRole('group', { name: 'Colour', exact: true }).getByRole('button', { name: 'Green' }).click()
  await page.getByRole('button', { name: 'Add it' }).click()

  await expect(page.getByText('Gym')).toBeVisible()

  // Back to the day, and the new one is offered where the next task's colour
  // is chosen - the swatch row is the list, so this is the whole of what
  // "the owner owns them" has to mean on the screen they use every morning.
  await page.getByRole('navigation').getByRole('button', { name: 'Today' }).click()
  // The colour is chosen before the title is typed, which is the ordinary
  // path - CONVENTIONS section 16. The swatch row is the list itself, so
  // this is the whole of what "the owner owns them" has to mean on the
  // screen they look at every morning.
  await page.getByRole('group', { name: 'Category for the next task' }).getByRole('button', { name: 'Gym' }).click()
  await quickAdd(page, 'Squats')

  await expect(card(page, 'Squats')).toContainText('Gym')

  // And now delete it, with the one task pointing at it.
  await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Categories', exact: true }).click()
  const row = page.getByRole('listitem').filter({ hasText: 'Gym' })
  await row.getByRole('button', { name: 'Delete' }).click()

  const dialog = page.getByRole('group', { name: 'Delete Gym' })
  await expect(dialog).toContainText('1 task use it.')
  await dialog.getByRole('button', { name: 'Personal' }).click()
  await dialog.getByRole('button', { name: 'Delete and move' }).click()

  await expect(page.getByText('Gym')).toHaveCount(0)

  await page.getByRole('navigation').getByRole('button', { name: 'Today' }).click()
  await expect(card(page, 'Squats')).toContainText('Personal')
})
