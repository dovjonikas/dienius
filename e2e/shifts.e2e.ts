import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, reopenAt, tick } from './app'

/**
 * Rotating shifts in one browser, on the desktop and the phone - v2.29 stage
 * 10, the walk docs/RESEARCH-SHIFTS.md section 8.4 asks for. Four kinds of day
 * made on the Templates tab, a gym that moves with them, a month laid out by a
 * cycle, what Apply will do and Apply, one date changed by hand and asked
 * about, and Undo; then the morning after a night shift at one o'clock, and the
 * night the clocks go back. What no unit test can see is the doors between the
 * parts, and every one of them is walked here. Every name is a generic one.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

/** Wednesday 16 September 2026, nine in the morning in Vilnius. */
const WEDNESDAY_NINE = new Date(Date.UTC(2026, 8, 16, 6, 0))
/** One in the morning on Saturday 19 September, after the night of the 18th. */
const SATURDAY_ONE = new Date(Date.UTC(2026, 8, 18, 22, 0))
/** One in the morning on Sunday 25 October, the night the clocks go back at four. */
const CLOCKS_BACK_ONE = new Date(Date.UTC(2026, 9, 24, 22, 0))

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

/** A day template made a kind of day: its name, its letter and at most one block. */
async function kind(page: Page, name: string, letter: string, block?: { time: string; title: string; minutes: number }) {
  await tab(page, 'Templates')
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A day/ }).click()
  await page.getByPlaceholder('Template name').fill(name)
  await page.getByRole('textbox', { name: 'Letter on the roster' }).fill(letter)
  if (block) {
    await page.getByPlaceholder('09:00').fill(block.time)
    // The length's own panel: the number typed, and the panel closed again,
    // since it stands over the editor's last row while it is open.
    const length = page.getByRole('button', { name: /long\. Change how long\.$/ }).first()
    await length.click()
    await page.getByRole('textbox', { name: 'How long, in minutes' }).fill(String(block.minutes))
    await length.click()
    await page.getByPlaceholder('What happens').fill(block.title)
    await page.getByPlaceholder('What happens').press('Enter')
  }
  await page.getByRole('button', { name: 'Save template' }).click()
}

/** The day's timeline, opened where a phone keeps it folded. */
async function timeline(page: Page) {
  const show = page.getByRole('button', { name: 'Show timeline' })
  if (await show.count()) await show.click()
}

/** The month, in the roster. */
async function roster(page: Page) {
  await tab(page, 'Calendar')
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  const on = page.getByRole('button', { name: 'Roster', exact: true })
  if ((await on.getAttribute('aria-pressed')) !== 'true') await on.click()
}

test('four kinds, a gym that moves with them, a month by its cycle, one day changed by hand and undone, and the nights after', async ({ page }) => {
  test.slow()
  await openFreshAt(page, WEDNESDAY_NINE)

  await kind(page, 'Day shift', 'D', { time: '07:00', title: 'Shift', minutes: 720 })
  await kind(page, 'Night shift', 'N', { time: '19:00', title: 'Shift', minutes: 720 })
  await kind(page, 'After nights', 'A')
  await kind(page, 'Rest day', 'R')

  // The gym, written once: at 18:00 on a day shift, which runs into the shift;
  // none after nights, which needs one; its own time on the other two.
  await page.getByRole('button', { name: 'New routine' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Gym')
  const days = page.getByRole('group', { name: 'On these days' })
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    await days.getByRole('button', { name: day }).click()
  }
  await page.getByRole('textbox', { name: 'Time on Day shift' }).fill('18:00')
  await page.getByRole('textbox', { name: 'Time on Night shift' }).fill('14:00')
  await page.getByRole('textbox', { name: 'Time on Rest day' }).fill('10:00')
  await page.getByRole('button', { name: 'Save routine' }).click()

  // The month by its cycle - two days, two nights, one after, two off - from
  // today to the end of September.
  await roster(page)
  await page.getByRole('button', { name: 'Cycle', exact: true }).click()
  const cycle = page.getByRole('group', { name: 'The cycle' })
  for (const letter of ['D', 'D', 'N', 'N', 'A', 'R', 'R']) {
    await cycle.getByRole('button', { name: new RegExp(`^${letter} `) }).click()
  }
  await expect(page.getByLabel('The cycle so far')).toHaveText('D D N N A R R')
  await page.getByRole('button', { name: 'Fill to the end of the month' }).click()

  // What Apply will do: the weeks' letters, a routine with no time, a conflict.
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  const preview = page.getByRole('group', { name: 'What Apply will do' })
  await expect(preview).toContainText(/routines? needs? a time/)
  await expect(preview).toContainText(/into something/)
  await preview.getByRole('button', { name: /^Apply 15 days$/ }).click()

  // Today is a day shift: its block, and the gym saying where its time went.
  await tab(page, 'Today')
  await expect(page.getByRole('checkbox', { name: 'Shift', exact: true })).toBeAttached()
  await expect(page.getByText('Runs into Shift').first()).toBeAttached()

  // Changed by hand: the shift ticked. The roster then makes today a night,
  // and Apply says what the tick is before it goes with the day shift's block.
  await tick(page, 'Shift')
  await roster(page)
  await page.locator('[data-date="2026-09-16"]').click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  const again = page.getByRole('group', { name: 'What Apply will do' })
  await expect(again).toContainText('changed by hand')
  await again.getByRole('button', { name: /^Apply 1 day$/ }).click()
  await tab(page, 'Today')
  await expect(page.getByRole('checkbox', { name: 'Shift', exact: true })).not.toBeChecked()

  // Undo gives the day shift back, tick and all - the tick folds the shift
  // into Done, so it is read off the plan, and the day says its kind again.
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('.day-template').first()).toHaveText(/D\s*Day shift/)
  const shifts = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    return (data.days['2026-09-16']?.tasks ?? []).filter((t: { title: string }) => t.title === 'Shift').map((t: { time: string; done: boolean }) => `${t.time} ${t.done}`)
  })
  expect(shifts).toEqual(['07:00 true'])

  // One in the morning after the night of the 18th: last night's shift runs
  // on at the top of the day, and it is what is running.
  await reopenAt(page, SATURDAY_ONE)
  await tab(page, 'Today')
  await timeline(page)
  await expect(page.getByText('Shift, from yesterday').first()).toBeAttached()
  await expect(page.locator('.day-now-task').first()).toHaveText('Shift')

  // The night the clocks go back: a night shift on 24 October, stamped from the
  // roster in its own month, is thirteen hours long on the wall's twelve. At
  // one in the morning it has seven real hours left, not the wall's six.
  await roster(page)
  await page.getByRole('button', { name: 'Next month' }).click()
  const night = page.locator('[data-date="2026-10-24"]')
  await night.click()
  await night.click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await page.getByRole('group', { name: 'What Apply will do' }).getByRole('button', { name: /^Apply 1 day$/ }).click()
  await reopenAt(page, CLOCKS_BACK_ONE)
  await tab(page, 'Today')
  await timeline(page)
  await expect(page.getByText('Shift, from yesterday').first()).toBeAttached()
  await expect(page.getByText(/7h left/).first()).toBeAttached()
})
