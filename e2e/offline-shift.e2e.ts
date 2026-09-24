import { devices, expect, test } from '@playwright/test'
import { quickAdd, tick, wednesdayAt } from './app'
import { fakeRepo, type Repo } from './fakeRepo'

/**
 * A phone with no network in the middle of a shift - the owner's shift brief
 * of 2026-09-25, stage 5. The phone is opened with sync and the backup on,
 * a block is ticked with no connection, and the connection comes back: sync
 * carries the tick to the repo, and the next morning the archive writes the
 * day with the tick and the moment it was made. Nothing is lost for having
 * been done offline. The repo is GitHub's Contents API held in the test
 * (e2e/fakeRepo.ts). Every name here is invented.
 */

const BASE = 'http://localhost:4190/dienius/'
const REPO = 'someone/plans'
const WEDNESDAY = '2026-09-16'

/** Whether the sync file holds a task of this title, ticked. */
function tickedInSync(repo: Repo, title: string): boolean {
  const file = repo.files.get('data/sync.json')
  if (!file) return false
  const plan = JSON.parse(file.text) as { days: Record<string, { tasks: { title: string; done?: boolean }[] }> }
  return Object.values(plan.days).some(day => day.tasks.some(t => t.title === title && t.done === true))
}

test('ticked with no network, sent when the network is back, and archived the next morning with the moment of the tick', async ({ browser }) => {
  test.setTimeout(150_000)
  const repo = fakeRepo()
  // The phone project's profile without its browser, at 375px wide.
  const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 13']
  void _ignored
  const context = await browser.newContext({ ...iphone, viewport: { width: 375, height: 812 }, hasTouch: true, timezoneId: 'Europe/Vilnius', serviceWorkers: 'block' })
  await repo.serve(context)
  const page = await context.newPage()
  await page.clock.setFixedTime(wednesdayAt(10))
  await page.goto(BASE)
  await page.evaluate(repoName => {
    localStorage.clear()
    localStorage.setItem('dienius:cloud-backup', JSON.stringify({ repo: repoName, token: 'test-token', lastBackupAt: null }))
    localStorage.setItem('dienius:sync', JSON.stringify({ url: '', token: '', enabled: true, via: 'github' }))
  }, REPO)
  await page.reload()
  await quickAdd(page, 'Pack the bag')
  await expect.poll(() => repo.titles(), { timeout: 20_000 }).toEqual(['Pack the bag'])

  // The shift, with no network: the tick is made all the same, and waits.
  await context.setOffline(true)
  await tick(page, 'Pack the bag')
  await expect(page.getByRole('checkbox', { name: 'Pack the bag', exact: true })).toBeChecked()
  expect(tickedInSync(repo, 'Pack the bag')).toBe(false)

  // The network back: what waited goes up by itself.
  await context.setOffline(false)
  await expect.poll(() => tickedInSync(repo, 'Pack the bag'), { timeout: 30_000 }).toBe(true)

  // The next morning the day is over, and the archive writes it - the tick and its moment in it.
  await page.clock.setFixedTime(new Date(Date.UTC(2026, 8, 17, 5, 0)))
  await page.reload()
  const path = `archive/days/2026/09/${WEDNESDAY}.json`
  await expect.poll(() => repo.files.has(path), { timeout: 30_000 }).toBe(true)
  const day = JSON.parse(repo.files.get(path)!.text) as { date: string; tasks: { title: string; done: boolean; doneAt?: string }[] }
  expect(day.date).toBe(WEDNESDAY)
  expect(day.tasks.find(t => t.title === 'Pack the bag')).toMatchObject({ done: true, doneAt: expect.stringMatching(/^2026-09-16T/) })
  await context.close()
})
