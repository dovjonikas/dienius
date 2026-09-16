import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * The day's masthead, measured where it can be: jsdom has no layout.
 *
 * Two rows over the day and the task column since v2.25, each row one
 * centre line and two groups standing on the column's two edges. What it
 * replaced was one wrapping row whose day block was the rail's 240px: over
 * the day column its arrows stood 150px after the word "Today", the
 * template chip sat nine pixels under the title it belongs to, and the
 * clock began wherever a right-anchored group happened to end. The owner
 * read all three as random. From 1500px that row spanned the rail as well,
 * which is why this test measures at 1500 - where it used to hold the
 * arrows over the month, before the month had a column of its own.
 */
test.use({ viewport: { width: 1500, height: 900 }, timezoneId: 'Europe/Vilnius' })

type Box = { x: number; y: number; width: number; height: number }

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox()
  if (!b) throw new Error('not on the screen')
  return b
}

const centre = (b: Box) => b.y + b.height / 2
const right = (b: Box) => b.x + b.width

test("the day's name, its doors and its arrows share one line, and nothing on it moves when the day changes", async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  const row = async () => ({
    title: await box(page.locator('.day-header h2')),
    tools: await box(page.locator('.day-tools')),
    prev: await box(page.getByRole('button', { name: 'Previous day' })),
    next: await box(page.getByRole('button', { name: 'Next day' })),
  })

  const first = await row()
  const day = await box(page.locator('.timeline-grid-wrap'))
  const tasks = await box(page.locator('.task-pane'))

  // One centre line: the chip and the doors are not a few pixels under the
  // title they belong to, and neither are the arrows.
  expect(Math.abs(centre(first.tools) - centre(first.title))).toBeLessThanOrEqual(1)
  expect(Math.abs(centre(first.prev) - centre(first.title))).toBeLessThanOrEqual(1)
  expect(Math.abs(centre(first.next) - centre(first.title))).toBeLessThanOrEqual(1)

  // Two edges: the name on the day column's left edge, the last arrow on the
  // task column's right edge.
  expect(Math.abs(first.title.x - day.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(right(first.next) - right(tasks))).toBeLessThanOrEqual(1)

  // The touch target is not traded away for the fit - CONVENTIONS section 9.
  for (const arrow of [first.prev, first.next]) expect(arrow.width).toBeGreaterThanOrEqual(44)

  // And nothing moves as the day's name and its doors change. Wednesday is
  // the day above, stamped, with Replan and Low day; five presses forward
  // reaches Monday, four characters shorter, unstamped, with a different
  // door. The arrows stay where they were, and the doors keep their right
  // edge against them.
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible()

  const later = await row()
  expect(Math.abs(later.prev.x - first.prev.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(later.next.x - first.next.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(right(later.tools) - right(first.tools))).toBeLessThanOrEqual(1)
  expect(Math.abs(later.title.x - first.title.x)).toBeLessThanOrEqual(1)
})
