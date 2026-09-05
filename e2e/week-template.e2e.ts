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
  await page.getByPlaceholder('What happens').fill('Commute')
  await page.getByRole('group', { name: 'Add to' }).getByRole('button', { name: 'Weekdays' }).click()
  await page.getByRole('button', { name: 'Add block' }).click()

  // And one that is only on a Thursday, which is what makes a week worth
  // having over a day template stamped five times.
  await page.getByRole('region', { name: 'Thursday' }).getByRole('button', { name: /^Thursday/ }).click()
  await page.getByPlaceholder('What happens').fill('Physio')
  await page.getByRole('group', { name: 'Add to' }).getByRole('button', { name: 'Thursday' }).click()
  await page.getByRole('button', { name: 'Add block' }).click()

  await expect(page.getByRole('region', { name: 'Thursday' }).getByText('Physio')).toBeVisible()

  // Dragged from Thursday to Friday with a real mouse.
  const block = page.getByRole('button', { name: 'Physio on Thursday. Drag to another day.' })
  const from = await block.boundingBox()
  const friday = await page.locator('[data-wt-day="5"]').boundingBox()
  if (!from || !friday) throw new Error('the week editor did not lay out')

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(friday.x + friday.width / 2, friday.y + friday.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect(page.getByRole('region', { name: 'Friday' }).getByText('Physio')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Thursday' }).getByText('Physio')).toHaveCount(0)

  await page.getByRole('button', { name: 'Save template' }).click()
  await expect(page.getByText('A week ·')).toBeVisible()

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

  await page.getByRole('button', { name: 'Next day' }).click()
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.getByRole('checkbox', { name: 'Physio' })).toBeAttached()
  await expect(page.getByRole('checkbox', { name: 'Commute' })).toBeAttached()
})
