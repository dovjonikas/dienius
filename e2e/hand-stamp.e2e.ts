import { expect, test, type Page } from '@playwright/test'
import { openFreshAt } from './app'

/**
 * A kind of day put on a date by hand, over what the roster gave it - the
 * owner's report of 2026-09-23: a free day by the roster, a shift put on it
 * by hand, and sometimes both days' blocks on the date, or the free day's not
 * gone. On a desktop the hand is the rail's chip beside the day; on a phone
 * it is the month's own stamp bar. Both doors, and the day read afterwards.
 * Every name and time is invented.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

/** Wednesday 16 September 2026, nine in the morning in Vilnius. */
const WEDNESDAY_NINE = new Date(Date.UTC(2026, 8, 16, 6, 0))

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

/** A day template made a kind of day: its name, its letter and one block. */
async function kind(page: Page, name: string, letter: string, block: { time: string; title: string; minutes: number }) {
  await tab(page, 'Templates')
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A day/ }).click()
  await page.getByPlaceholder('Template name').fill(name)
  await page.getByRole('textbox', { name: 'Letter on the roster' }).fill(letter)
  await page.getByPlaceholder('09:00').fill(block.time)
  const length = page.getByRole('button', { name: /long\. Change how long\.$/ }).first()
  await length.click()
  await page.getByRole('textbox', { name: 'How long, in minutes' }).fill(String(block.minutes))
  await length.click()
  await page.getByPlaceholder('What happens').fill(block.title)
  await page.getByPlaceholder('What happens').press('Enter')
  await page.getByRole('button', { name: 'Save template' }).click()
}

/** The month, in the roster. */
async function roster(page: Page) {
  await tab(page, 'Calendar')
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  const on = page.getByRole('button', { name: 'Roster', exact: true })
  if ((await on.getAttribute('aria-pressed')) !== 'true') await on.click()
}

/** The titles of the tasks on a date, read off the plan. */
async function titlesOn(page: Page, date: string): Promise<string[]> {
  return page.evaluate(date => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    return ((data.days?.[date]?.tasks ?? []) as { title: string }[]).map(t => t.title).sort()
  }, date)
}

test('a free day made a shift by hand holds the shift only, its gym moved, and made free again holds the free day only', async ({ page }, info) => {
  test.slow()
  await openFreshAt(page, WEDNESDAY_NINE)

  await kind(page, 'Day shift', 'D', { time: '07:00', title: 'Shift', minutes: 720 })
  await kind(page, 'Free day', 'L', { time: '09:00', title: 'Long breakfast', minutes: 45 })

  // The gym, once: at 20:10 on a day shift, at 11:30 on a free day.
  await page.getByRole('button', { name: 'New routine' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Gym')
  const days = page.getByRole('group', { name: 'On these days' })
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    await days.getByRole('button', { name: day }).click()
  }
  await page.getByRole('textbox', { name: 'Time on Day shift' }).fill('20:10')
  await page.getByRole('textbox', { name: 'Time on Free day' }).fill('11:30')
  await page.getByRole('button', { name: 'Save routine' }).click()

  // The roster: today a free day, tomorrow a shift.
  await roster(page)
  await page.getByRole('button', { name: 'Cycle', exact: true }).click()
  const cycle = page.getByRole('group', { name: 'The cycle' })
  await cycle.getByRole('button', { name: /^L / }).click()
  await cycle.getByRole('button', { name: /^D / }).click()
  await page.getByRole('button', { name: 'Fill to the end of the month' }).click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await page.getByRole('group', { name: 'What Apply will do' }).getByRole('button', { name: /^Apply \d+ days$/ }).click()
  expect(await titlesOn(page, '2026-09-16')).toEqual(['Gym', 'Long breakfast'])

  // By hand: the shift on today. On a desktop the rail's chip, which asks
  // first since the day carries a template; on a phone the month's stamp
  // bar, which stages the date and saves.
  const phone = info.project.name === 'phone'
  if (phone) {
    await tab(page, 'Calendar')
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    const on = page.getByRole('button', { name: 'Roster', exact: true })
    // The Roster button, pressed, is the way out of the roster as well.
    if ((await on.getAttribute('aria-pressed')) === 'true') await on.click()
    await page.locator('.stamp-bar').getByRole('button', { name: 'Day shift' }).click()
    await page.locator('[data-date="2026-09-16"]').click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
  } else {
    await tab(page, 'Today')
    await page.locator('.template-rail').getByRole('button', { name: 'Day shift' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Replace Free day with Day shift?' })).toBeVisible()
    await page.getByRole('button', { name: 'Replace', exact: true }).click()
  }
  await tab(page, 'Today')
  expect(await titlesOn(page, '2026-09-16')).toEqual(['Gym', 'Shift'])
  // The gym moved with the kind, and the shift is here once.
  await expect(page.getByRole('checkbox', { name: 'Gym', exact: true }).locator('xpath=ancestor::li[1]')).toContainText('20:10')
  await expect(page.getByRole('checkbox', { name: 'Shift', exact: true })).toHaveCount(1)
  await expect(page.getByRole('checkbox', { name: 'Long breakfast' })).toHaveCount(0)

  // And back to a free day by the same door: the shift goes, the breakfast
  // returns, and the gym is at the free day's time.
  if (phone) {
    await tab(page, 'Calendar')
    await page.locator('.stamp-bar').getByRole('button', { name: 'Free day' }).click()
    await page.locator('[data-date="2026-09-16"]').click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
  } else {
    await page.locator('.template-rail').getByRole('button', { name: 'Free day' }).click()
    await page.getByRole('button', { name: 'Replace', exact: true }).click()
  }
  await tab(page, 'Today')
  expect(await titlesOn(page, '2026-09-16')).toEqual(['Gym', 'Long breakfast'])
  await expect(page.getByRole('checkbox', { name: 'Gym', exact: true }).locator('xpath=ancestor::li[1]')).toContainText('11:30')
  await expect(page.getByRole('checkbox', { name: 'Shift', exact: true })).toHaveCount(0)
})
