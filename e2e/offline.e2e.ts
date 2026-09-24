import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, quickAdd, tick } from './app'

/**
 * The phone with no network - the freeze's point 3. The production build on
 * the path it is deployed at (/dienius/, playwright.config.ts) and its
 * service worker, on a desktop and a phone: the app opens with no network
 * once it has been opened with one, the day and the roster work, and a
 * backup is saved as a file - and all of it again when the network goes in
 * the middle of a session rather than before it. deploy.e2e.ts has the other
 * half: a new version taking over after a deploy.
 *
 * Every name and date is invented.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

/** Wednesday 16 September 2026, nine in the morning. */
const WEDNESDAY_NINE = new Date(Date.UTC(2026, 8, 16, 6, 0))

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

/** Two kinds of day, so the month offers the roster. */
async function withKinds(page: Page): Promise<void> {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') ?? 'null') ?? { days: {}, settings: { theme: { presetId: 'dark', overrides: {}, mode: 'dark' } } }
    data.templates = [
      { id: 'kind-day', name: 'Day shift', color: '#a7c4f5', type: 'shift', blocks: [{ id: 'b1', time: '07:00', title: 'Shift', minutes: 600 }], dayKind: { letter: 'D', order: 0 } },
      { id: 'kind-rest', name: 'Rest day', color: '#a7e3bd', type: 'rest', blocks: [], dayKind: { letter: 'R', order: 1 } },
    ]
    localStorage.setItem('dienius:data', JSON.stringify(data))
  })
}

/** Until the service worker is in charge of the page, nothing here is offline. */
async function workerInCharge(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null && navigator.serviceWorker?.controller !== undefined, null, { timeout: 30_000 })
}

/**
 * Proof that the network really is gone for the page and for its worker: a
 * request for something nothing has cached fails. Without it a test could
 * pass on a worker that was quietly still reaching the server.
 */
async function expectNoNetwork(page: Page): Promise<void> {
  const answer = await page.evaluate(() => fetch(`./nothing-cached-${Date.now()}.txt`).then(r => r.status, () => 'no network'))
  expect(answer).toBe('no network')
}

/** A roster date laid by a tap and applied - the month's roster, Apply and its confirmation. */
async function applyRoster(page: Page, date: string): Promise<void> {
  await tab(page, 'Calendar')
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await page.getByRole('button', { name: 'Roster', exact: true }).click()
  await page.locator(`[data-date="${date}"]`).click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await page.getByRole('button', { name: 'Apply 1 day' }).click()
}

async function kindOn(page: Page, date: string): Promise<string | undefined> {
  return page.evaluate(date => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    return data.days?.[date]?.templateId
  }, date)
}

/** Export backup from Settings; the file as saved. */
async function exportBackup(page: Page): Promise<string> {
  await tab(page, 'Settings')
  const saved = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const file = await saved
  return readFileSync((await file.path())!, 'utf8')
}

test('opened once, the app opens with no network: the day, the roster and a backup all work', async ({ page, context }, info) => {
  test.slow()
  await openFreshAt(page, WEDNESDAY_NINE)
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })
  await workerInCharge(page)
  await withKinds(page)

  await context.setOffline(true)
  await page.reload()
  await expectNoNetwork(page)
  await tab(page, 'Today')
  await quickAdd(page, 'Water the plants')
  await tick(page, 'Water the plants')
  await expect(page.getByRole('checkbox', { name: 'Water the plants', exact: true })).toBeChecked()

  await applyRoster(page, '2026-09-18')
  expect(await kindOn(page, '2026-09-18')).toBe('kind-day')

  const backup = JSON.parse(await exportBackup(page))
  expect(backup.days['2026-09-16'].tasks.map((t: { title: string }) => t.title)).toContain('Water the plants')
  expect(backup.days['2026-09-18'].templateId).toBe('kind-day')
})

test('the network gone in the middle of a session: every page, the day, the roster and a backup go on', async ({ page, context }, info) => {
  test.slow()
  await openFreshAt(page, WEDNESDAY_NINE)
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })
  await workerInCharge(page)
  await withKinds(page)
  await page.reload()
  await tab(page, 'Today')
  await quickAdd(page, 'Before the network went')

  await context.setOffline(true)
  await expectNoNetwork(page)
  for (const name of ['Calendar', 'Templates', 'Library', 'Review', 'North', 'Kitchen', 'Settings', 'Today']) {
    await tab(page, name)
    await expect(page.locator('main')).not.toContainText('could not be shown')
  }
  await quickAdd(page, 'After the network went')
  await tick(page, 'Before the network went')
  await applyRoster(page, '2026-09-19')

  const backup = JSON.parse(await exportBackup(page))
  const titles = backup.days['2026-09-16'].tasks.map((t: { title: string }) => t.title)
  expect(titles).toEqual(expect.arrayContaining(['Before the network went', 'After the network went']))
  expect(backup.days['2026-09-19'].templateId).toBe('kind-day')

  // And back online, nothing was lost on the way.
  await context.setOffline(false)
  await page.reload()
  await tab(page, 'Today')
  await expect(page.getByRole('checkbox', { name: 'After the network went', exact: true })).toBeAttached()
})
