import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { goToDay, openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * The day's masthead, measured where it can be: jsdom has no layout.
 *
 * Since v2.25 it is laid on the columns under it, and since one look's
 * stage 3 its first row runs across the rail's column too: the day's name,
 * its date and the time on one line from the frame's left edge, where every
 * page's title stands, and the rail begins under it. Over the tasks: what
 * the day came from on the column's left edge and its doors on its right,
 * and under them the day's progress starting on the left edge and the view
 * toggle ending on the right. Every row is one centre line.
 *
 * What it replaced was a crowd in the page's right-hand corner - the chip,
 * two doors and the two day arrows pressed together, over a task column
 * whose edges none of them lined up with - and a clock standing alone at
 * the start of a second row. There are no day arrows at this width: the
 * month in the rail beside the masthead is the way to another day.
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

test("the masthead stands on the frame's left edge and the task column, and nothing on it moves when the day changes", async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  // The rail's first thing rather than the rail: its box reaches a step
  // out past the frame's edge, so a focus ring on the month is not cut.
  const rail = await box(page.locator('.rail > .mini-calendar'))
  const day = await box(page.locator('.timeline-grid-wrap'))
  const tasks = await box(page.locator('.task-pane'))
  const title = await box(page.locator('.day-header h2'))
  const time = await box(page.locator('.day-now-clock'))
  const chip = await box(page.locator('.day-template'))
  const doors = await box(page.locator('.day-doors'))
  const track = await box(page.locator('.day-progress-track'))
  const toggle = await box(page.getByRole('group', { name: 'Day layout focus' }))

  // No arrows at this width: the month beside the masthead moves the day.
  await expect(page.getByRole('button', { name: 'Previous day' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next day' })).toHaveCount(0)

  // The first row. The day's name on the frame's left edge, over the rail,
  // and the time on the same line ending inside the day's column; the chip
  // on the task column's left edge, the doors on its right; one centre line
  // across all of it. The rail begins under the row.
  expect(Math.abs(title.x - rail.x)).toBeLessThanOrEqual(1)
  expect(rail.y).toBeGreaterThan(title.y + title.height - 1)
  expect(Math.abs(centre(time) - centre(title))).toBeLessThanOrEqual(2)
  expect(right(time)).toBeLessThanOrEqual(right(day) + 1)
  expect(Math.abs(chip.x - tasks.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(right(doors) - right(tasks))).toBeLessThanOrEqual(1)
  expect(Math.abs(centre(chip) - centre(title))).toBeLessThanOrEqual(1)
  expect(Math.abs(centre(doors) - centre(title))).toBeLessThanOrEqual(1)

  // The second row, over the tasks: the bar starts where the column starts,
  // and the toggle ends where it ends.
  expect(Math.abs(track.x - tasks.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(right(toggle) - right(tasks))).toBeLessThanOrEqual(1)
  expect(Math.abs(centre(track) - centre(toggle))).toBeLessThanOrEqual(1)
  expect(toggle.y).toBeGreaterThan(chip.y + chip.height - 1)

  // And nothing moves as the day's name and its doors change. Monday, five
  // days on, is four characters shorter, unstamped, and has a different
  // door; the name, the doors' right edge and the toggle stay where they
  // were.
  await goToDay(page, '2026-09-21')
  await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible()

  const laterTitle = await box(page.locator('.day-header h2'))
  const laterDoors = await box(page.locator('.day-doors'))
  const laterToggle = await box(page.getByRole('group', { name: 'Day layout focus' }))
  expect(Math.abs(laterTitle.x - title.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(centre(laterTitle) - centre(title))).toBeLessThanOrEqual(1)
  expect(Math.abs(right(laterDoors) - right(doors))).toBeLessThanOrEqual(1)
  expect(Math.abs(right(laterToggle) - right(toggle))).toBeLessThanOrEqual(1)
  expect(Math.abs(laterToggle.y - toggle.y)).toBeLessThanOrEqual(1)
})
