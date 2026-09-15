import { expect, test } from '@playwright/test'
import { openFreshAt, wednesdayAt } from './app'

/**
 * A block moved on the template editor's own picture.
 *
 * The picture has drawn the day since v2.5, and until v2.21 only drew it: a
 * block was moved by retyping its time in the list under the picture. Now
 * the block itself can be dragged to another hour and its bottom edge pulled
 * to another length - the two gestures the day view has had since v2.0, on
 * the same grid, through the same hook. The jsdom tests hold the wiring; what
 * they cannot see is the same thing the week editor's drag test could not: a
 * real pointer on a real grid with real geometry. This holds the gesture.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('a block dragged down the editor\'s picture lands later, and the length pulled longer stays that way when saved', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Templates' }).click()
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A day/ }).click()
  await page.getByPlaceholder('Template name').fill('Deep day')
  await page.getByPlaceholder('09:00').fill('10:00')
  await page.getByPlaceholder('What happens').fill('Deep work')
  await page.getByRole('button', { name: 'Add a block' }).click()

  const row = page.locator('.block-list li').filter({ hasText: 'Deep work' })
  await expect(row.locator('.task-time')).toHaveText('10:00')
  const sizeBefore = await row.locator('.task-size').textContent()

  // Taken hold of near its top edge: the grab strip along the bottom is the
  // other gesture.
  const block = page.locator('.template-timeline .timeline-anchor').filter({ hasText: 'Deep work' })
  await block.scrollIntoViewIfNeeded()
  const from = await block.boundingBox()
  if (!from) throw new Error('the editor did not draw the block')
  await page.mouse.move(from.x + from.width / 2, from.y + 6)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, from.y + 6 + 120, { steps: 12 })
  await page.mouse.up()

  // How much later depends on the grid's own scale on this screen, which is
  // not the point; later is.
  const moved = await row.locator('.task-time').textContent()
  expect(moved).toMatch(/^\d\d:\d\d$/)
  expect(moved! > '10:00').toBe(true)

  // And the bottom edge, pulled down, makes the block longer.
  const strip = block.locator('.timeline-anchor-resize')
  const edge = await strip.boundingBox()
  if (!edge) throw new Error('the block has no edge to pull')
  await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2)
  await page.mouse.down()
  await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2 + 90, { steps: 9 })
  await page.mouse.up()
  await expect(row.locator('.task-size')).not.toHaveText(sizeBefore ?? '')
  const sizeAfter = await row.locator('.task-size').textContent()

  // Saved as dragged, and still so when the template is opened again.
  await page.getByRole('button', { name: 'Save template' }).click()
  await page.getByRole('button', { name: 'Edit Deep day' }).click()
  await expect(row.locator('.task-time')).toHaveText(moved!)
  await expect(row.locator('.task-size')).toHaveText(sizeAfter ?? '')
})
