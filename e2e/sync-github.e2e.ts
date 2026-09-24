import { devices, expect, test } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { quickAdd } from './app'
import { fakeRepo, type Repo } from './fakeRepo'

/**
 * Two devices and one repo, in real browsers - docs/SYNC-AUDIT.md.
 *
 * The repo is GitHub's Contents API held in this test, with its lock: a
 * write names the version it read, and a stale one is refused. The desktop
 * is a desktop; the phone is the iPhone profile the phone project uses, at
 * its size, with a finger. Both run in one test because the thing under
 * test is what one of them does to the other.
 *
 * Path 7 is the one only a browser can show: a change made on the phone
 * just before its tab is closed. The page makes its exit push as it goes -
 * one PUT with `keepalive`, over the version it last read - and that is
 * asserted by watching the page's own fetch. What becomes of that request
 * after the page is gone cannot be watched from here: Playwright's routing
 * does not see a closed page's requests. So the phone is taken offline as
 * the tab closes, which is the case that matters - a request the browser
 * dropped - and the change must still reach the desktop, through the next
 * open, which sends what is owed before anything else.
 */

const BASE = 'http://localhost:4190/dienius/'
const REPO = 'someone/plans'

async function desktop(browser: Browser, repo: Repo): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    timezoneId: 'Europe/Vilnius',
    serviceWorkers: 'block',
  })
  await repo.serve(context)
  return context
}

async function phone(browser: Browser, repo: Repo): Promise<BrowserContext> {
  // The profile without its browser: the phone project runs it in Chromium.
  const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 13']
  void _ignored
  const context = await browser.newContext({ ...iphone, hasTouch: true, timezoneId: 'Europe/Vilnius', serviceWorkers: 'block' })
  await repo.serve(context)
  return context
}

/** A first open on a device, with Backup's repo and token in it and sync switched on through the repo. */
async function openWithSync(context: BrowserContext): Promise<Page> {
  const page = await context.newPage()
  await page.goto(BASE)
  await page.evaluate(repo => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('dienius:cloud-backup', JSON.stringify({ repo, token: 'test-token', lastBackupAt: null }))
    localStorage.setItem('dienius:sync', JSON.stringify({ url: '', token: '', enabled: true, via: 'github' }))
  }, REPO)
  await page.reload()
  return page
}

test('a change made on the phone just before its tab closes reaches the desktop', async ({ browser }) => {
  test.setTimeout(90_000)
  const repo = fakeRepo()

  // The desktop, first: a task, and sync on through the repo.
  const desk = await desktop(browser, repo)
  const deskPage = await openWithSync(desk)
  await quickAdd(deskPage, 'Book the dentist')
  await expect.poll(() => repo.titles(), { timeout: 20_000 }).toEqual(['Book the dentist'])

  // The phone joins. It has nothing of its own, so it takes the desktop's
  // plan whole and writes nothing.
  const pocket = await phone(browser, repo)
  const phonePage = await openWithSync(pocket)
  await expect(phonePage.locator('.task-title', { hasText: 'Book the dentist' })).toBeVisible({ timeout: 15_000 })
  const shaBefore = repo.files.get('data/sync.json')!.sha

  // The page's own requests as it goes, written down where the next open
  // of the same phone can read them.
  await phonePage.evaluate(() => {
    const send = window.fetch
    window.fetch = (input, init) => {
      if (init?.keepalive) localStorage.setItem('e2e:exit-push', `${init.method} ${String(input).replace(/^.*\/contents\//, '')}`)
      return send(input, init)
    }
  })

  // A change, and the tab closed before the phone's short wait is up - with
  // the connection gone as it closes, so whatever the page sends is lost.
  await quickAdd(phonePage, 'Buy stamps')
  await pocket.setOffline(true)
  // A blank tab first, so the phone is not left with no page at all.
  const again = await pocket.newPage()
  // With its unload handlers run, a close does not wait for the page to go.
  const gone = phonePage.waitForEvent('close')
  await phonePage.close({ runBeforeUnload: true })
  await gone
  await pocket.setOffline(false)
  expect(repo.files.get('data/sync.json')!.sha).toBe(shaBefore)

  // Picked up again: the page did make its exit push, and what did not
  // leave with the tab leaves now.
  await again.goto(BASE)
  expect(await again.evaluate(() => localStorage.getItem('e2e:exit-push'))).toBe('PUT data/sync.json')
  await expect.poll(() => repo.titles(), { timeout: 20_000 }).toEqual(['Book the dentist', 'Buy stamps'])
  await expect(again.locator('.task-title', { hasText: 'Buy stamps' })).toBeVisible()

  // And the desktop has it, on its next look.
  await deskPage.reload()
  await expect(deskPage.locator('.task-title', { hasText: 'Buy stamps' })).toBeVisible({ timeout: 15_000 })
  await expect(deskPage.locator('.task-title', { hasText: 'Book the dentist' })).toBeVisible()

  await desk.close()
  await pocket.close()
})

test('a phone with a plan of its own is asked which plan to keep, on its own screen, and taking writes nothing', async ({ browser }) => {
  test.setTimeout(90_000)
  const repo = fakeRepo()

  const desk = await desktop(browser, repo)
  const deskPage = await openWithSync(desk)
  await quickAdd(deskPage, 'Book the dentist')
  await expect.poll(() => repo.titles(), { timeout: 20_000 }).toEqual(['Book the dentist'])
  const writes = repo.files.get('data/sync.json')!.sha

  // A phone used on its own for a while, then switched on in Settings.
  const pocket = await phone(browser, repo)
  const phonePage = await pocket.newPage()
  await phonePage.goto(BASE)
  await phonePage.evaluate(repoName => {
    localStorage.clear()
    localStorage.setItem('dienius:cloud-backup', JSON.stringify({ repo: repoName, token: 'test-token', lastBackupAt: null }))
  }, REPO)
  await phonePage.reload()
  await quickAdd(phonePage, 'Water the plants')
  await phonePage.evaluate(() => {
    localStorage.setItem('dienius:sync', JSON.stringify({ url: '', token: '', enabled: true, via: 'github' }))
  })
  await phonePage.reload()

  // The line at the top says it is waiting, and its button opens the question.
  await phonePage.getByRole('button', { name: 'Choose' }).click()
  const choice = phonePage.getByRole('group', { name: 'Which plan this device keeps' })
  await expect(choice).toBeVisible()
  await expect(choice).toContainText('GitHub: 1 task')
  await expect(choice).toContainText('This device: 1 task')
  // It fits the phone: nothing on the page scrolls sideways.
  expect(await phonePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  // And its three answers stand one to a line, the card's width, rather
  // than two on a line and one left alone under them.
  const answers = await Promise.all(
    ['Merge', 'Keep this one', 'Take from GitHub'].map(name => choice.getByRole('button', { name, exact: true }).boundingBox()),
  )
  expect(new Set(answers.map(box => Math.round(box!.x))).size).toBe(1)
  expect(new Set(answers.map(box => Math.round(box!.width))).size).toBe(1)
  expect(answers[0]!.y).toBeLessThan(answers[1]!.y)
  expect(answers[1]!.y).toBeLessThan(answers[2]!.y)
  expect(repo.files.get('data/sync.json')!.sha).toBe(writes)

  await choice.getByRole('button', { name: 'Take from GitHub' }).click()
  await expect(choice).toBeHidden()
  expect(repo.files.get('data/sync.json')!.sha).toBe(writes)

  await desk.close()
  await pocket.close()
})
