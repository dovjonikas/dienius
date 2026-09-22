import { expect, test, type Page } from '@playwright/test'
import { openFreshAt } from './app'

/**
 * The night's own hours, in one browser, on the desktop and the phone -
 * docs/RESEARCH-SHIFTS.md section 10. A night shift written with its meal at
 * one in the morning on the next day; the roster making Thursday a night and
 * Friday a rest day; the meal on Friday morning, marked as last night's and
 * drawn in the night's colour; and Thursday made a rest day again, which takes
 * the meal off Friday. Every name is a generic one.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

/** Wednesday 16 September 2026, nine in the morning in Vilnius. */
const WEDNESDAY_NINE = new Date(Date.UTC(2026, 8, 16, 6, 0))

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

interface Block {
  time: string
  title: string
  minutes: number
  nextDay?: boolean
}

/** A day template made a kind of day, with its blocks - a night's own hours put on the next day. */
async function kind(page: Page, name: string, letter: string, blocks: Block[] = []) {
  await tab(page, 'Templates')
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A day/ }).click()
  await page.getByPlaceholder('Template name').fill(name)
  await page.getByRole('textbox', { name: 'Letter on the roster' }).fill(letter)
  for (const block of blocks) {
    await page.getByPlaceholder('09:00').fill(block.time)
    const length = page.getByRole('button', { name: /long\. Change how long\.$/ }).first()
    await length.click()
    await page.getByRole('textbox', { name: 'How long, in minutes' }).fill(String(block.minutes))
    await length.click()
    await page.getByPlaceholder('What happens').fill(block.title)
    if (block.nextDay) await page.getByRole('button', { name: 'Put the new block on the next day' }).click()
    await page.getByPlaceholder('What happens').press('Enter')
  }
  await page.getByRole('button', { name: 'Save template' }).click()
}

/** The month, in the roster. */
async function roster(page: Page) {
  await tab(page, 'Calendar')
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  const on = page.getByRole('button', { name: 'Roster', exact: true })
  if ((await on.getAttribute('aria-pressed')) !== 'true') await on.click()
}

/** Friday 18 September: its cell in the month beside the day, or two presses on on a phone. */
async function friday(page: Page) {
  await tab(page, 'Today')
  const cell = page.locator('.mini-calendar [data-date="2026-09-18"]')
  if (await cell.isVisible().catch(() => false)) {
    await cell.click()
  } else {
    await page.getByRole('button', { name: 'Next day' }).click()
    await page.getByRole('button', { name: 'Next day' }).click()
  }
}

test("a night's meal after midnight is written in the night shift, lands on the morning after as last night's, and goes with the night", async ({ page }, info) => {
  test.slow()
  await openFreshAt(page, WEDNESDAY_NINE)

  await kind(page, 'Night shift', 'N', [
    { time: '21:00', title: 'On shift', minutes: 600 },
    { time: '01:00', title: 'Night meal', minutes: 30, nextDay: true },
  ])
  await kind(page, 'Rest day', 'R')

  // The editor says the meal is on the next day, where the block is: in its
  // row on a wide screen, and in the one word for its marks on a phone.
  await tab(page, 'Templates')
  await page.getByRole('button', { name: 'Edit Night shift' }).click()
  if (info.project.name === 'phone') {
    await expect(page.getByRole('button', { name: 'Marks for Night meal: Next day' })).toBeVisible()
  } else {
    await expect(page.getByRole('button', { name: 'Night meal is on the next day' })).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(page.getByText('After midnight: 01:00 Night meal')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  // Thursday a night, Friday a rest day: a tap walks the kinds in their order.
  await roster(page)
  await page.locator('[data-date="2026-09-17"]').click()
  await page.locator('[data-date="2026-09-18"]').click()
  await page.locator('[data-date="2026-09-18"]').click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await page.getByRole('group', { name: 'What Apply will do' }).getByRole('button', { name: /^Apply 2 days$/ }).click()

  // Friday morning: the night's meal is on it, marked as last night's.
  await friday(page)
  const meal = page.getByRole('checkbox', { name: 'Night meal', exact: true }).locator('xpath=ancestor::li[1]')
  await expect(meal).toContainText('01:00')
  await expect(meal).toContainText('last night')
  await expect(meal.locator('.task-night-mark')).toHaveText('N')

  // Thursday made a rest day: the night goes, and its meal with it.
  await roster(page)
  await page.locator('[data-date="2026-09-17"]').click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await page.getByRole('group', { name: 'What Apply will do' }).getByRole('button', { name: /^Apply 1 day$/ }).click()
  await friday(page)
  await expect(page.getByRole('checkbox', { name: 'Night meal', exact: true })).toHaveCount(0)
})
