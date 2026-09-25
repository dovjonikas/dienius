import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, reopenAt } from './app'

/**
 * The app opened in the middle of a night shift - the owner's shift brief of
 * 2026-09-25, stage 5 - on a desktop and a 375px phone. At half past two in
 * the morning the calendar says it is the day after the night, and what the
 * owner needs on the screen is the night's own hours - the snack at 02:30,
 * the journey home at 07:15 - with the shift still running, not an empty new
 * date. Every name here is invented.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

/** Vilnius, on a date in September 2026, at an hour. */
const september = (day: number, hours: number, minutes = 0) => new Date(Date.UTC(2026, 8, day, hours - 3, minutes))

const FILE = JSON.stringify({
  templates: [
    {
      name: 'Night shift',
      type: 'night',
      kind: 'N',
      sleep: { from: '08:30', to: '15:30' },
      blocks: [
        { time: '18:00', title: 'Travel in', minutes: 45 },
        { time: '19:00', title: 'Shift', minutes: 720, core: true, ongoing: true },
        { time: '02:30', title: 'Snack', minutes: 20, afterMidnight: true },
        { time: '07:15', title: 'Travel home', minutes: 25, afterMidnight: true },
      ],
    },
    { name: 'After nights', type: 'rest', kind: 'P', sleep: { from: '08:30', to: '15:30' }, blocks: [{ time: '16:00', title: 'Walk', minutes: 60 }] },
  ],
  roster: { '2026-09-16': 'N', '2026-09-17': 'P' },
})

test("opened at half past two in a night shift, today is the night's morning: its snack, its journey home, and the shift still running", async ({ page }, info) => {
  await openFreshAt(page, september(16, 10))
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })
  await tab(page, 'Settings')
  await page.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(FILE)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText(/^Applied\./)).toBeVisible()

  await reopenAt(page, september(17, 2, 30))
  await tab(page, 'Today')
  // The night's own hours are this morning's tasks, there to be ticked.
  await expect(page.getByRole('checkbox', { name: 'Snack', exact: true })).toBeAttached()
  await expect(page.getByRole('checkbox', { name: 'Travel home', exact: true })).toBeAttached()
  await expect(page.getByRole('checkbox', { name: 'Walk', exact: true })).toBeAttached()
  // And the shift from last night is what is running now, not done yet.
  const shift = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}') as { days: Record<string, { tasks: { title: string; done?: boolean }[] }> }
    return data.days['2026-09-16'].tasks.find(t => t.title === 'Shift')
  })
  expect(shift?.done).toBeFalsy()
  // What is running now is said on the first screen: the night's snack, with its minutes left.
  await expect(page.getByText(/Snack/).filter({ visible: true }).first()).toBeVisible()
  // And on a desktop, where the grid stands beside the list, the shift's last hours at its top.
  if (info.project.name === 'desktop') await expect(page.getByText(/Shift/).filter({ visible: true }).first()).toBeVisible()
})

/**
 * The night's close - the owner's decisions before the freeze, 2026-09-25,
 * stage 2. A night's day ends when its sleep begins the next morning, so its
 * card comes half an hour before that sleep, on the morning's page, and
 * closes the night - not while the shift runs, and not the morning.
 */
test('at eight the morning after, the card on the morning page closes the night; at half past two it was not there', async ({ page }, info) => {
  await openFreshAt(page, september(16, 10))
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })
  await tab(page, 'Settings')
  await page.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(FILE)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText(/^Applied\./)).toBeVisible()

  await reopenAt(page, september(17, 2, 30))
  await tab(page, 'Today')
  await expect(page.getByRole('checkbox', { name: 'Snack', exact: true })).toBeAttached()
  await expect(page.getByLabel('Closing the day')).toHaveCount(0)

  await reopenAt(page, september(17, 8, 0))
  await tab(page, 'Today')
  const card = page.getByLabel('Closing the day')
  await expect(card).toContainText('That was the night')
  await card.getByRole('button', { name: 'Close the day' }).click()
  await expect(page.getByLabel('Closing the day')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('dienius:evening-dismissed'))).toBe('2026-09-16')
})
