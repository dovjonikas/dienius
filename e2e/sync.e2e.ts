import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { openFresh, quickAdd, tick } from './app'

/**
 * Two devices, one server, one task.
 *
 * The sync design was verified by hand in a browser and nowhere else - see
 * STATE.md's list of debts - because a second device is the one thing jsdom
 * cannot be. Here the two devices are two browser contexts with their own
 * storage, and the server is the real `server/sync-server.mjs` started on a
 * spare port with a throwaway data directory, whose token the test reads the
 * way a person would, from `token.txt`.
 */

const PORT = 8791
let server: ChildProcess
let dataDir: string
let token: string

test.beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'dienius-sync-'))
  server = spawn(process.execPath, ['server/sync-server.mjs', '--port', String(PORT), '--data', dataDir, '--origin', 'http://localhost:4190'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the sync server did not start')), 15_000)
    server.stdout!.on('data', chunk => {
      if (String(chunk).includes('Dienius sync on')) {
        clearTimeout(timer)
        resolve()
      }
    })
    server.on('exit', code => reject(new Error(`the sync server exited with ${code}`)))
  })
  token = readFileSync(join(dataDir, 'token.txt'), 'utf8').trim()
})

test.afterAll(() => {
  server?.kill()
  rmSync(dataDir, { recursive: true, force: true })
})

async function turnSyncOn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click()
  // Scoped to the Sync section: Backup has a Token field of its own now.
  const sync = page.locator('#settings-sync')
  await sync.getByLabel('Server address').fill(`http://localhost:${PORT}`)
  await sync.getByLabel('Token').fill(token)
  await page.getByRole('button', { name: 'Turn on' }).click()
  await expect(page.getByRole('button', { name: 'Sync now' })).toBeVisible()
}

async function syncNow(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click()
  const button = page.getByRole('button', { name: 'Sync now' })
  await button.click()
  await expect(button).toBeEnabled()
}

async function device(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await openFresh(page)
  return page
}

test('a task added on one device arrives on the other through the server', async ({ browser }) => {
  const phone = await device(browser)
  const pc = await device(browser)

  await turnSyncOn(phone)
  await phone.getByRole('button', { name: 'Today' }).click()
  await quickAdd(phone, 'Synced walk')
  await expect(phone.getByRole('checkbox', { name: 'Synced walk' })).toBeAttached()
  await syncNow(phone)

  await turnSyncOn(pc)
  await syncNow(pc)
  await pc.getByRole('button', { name: 'Today' }).click()
  await expect(pc.getByRole('checkbox', { name: 'Synced walk' })).toBeAttached()

  // And back the other way: a tick on the PC reaches the phone.
  await tick(pc, 'Synced walk')
  await syncNow(pc)
  await syncNow(phone)
  await phone.getByRole('button', { name: 'Today' }).click()
  await expect(phone.getByRole('button', { name: /^Done \d+$/ })).toContainText('1')
})
/**
 * The three things two devices actually do to each other in a day: one
 * ticks, the other edits something else, and one of them deletes.
 *
 * The merge is per entity and last-write-wins, which is only worth
 * anything if a tick on the phone and an edit on the PC both survive the
 * same round trip - the exact case ARCHITECTURE section 7 says the naive
 * whole-state version gets wrong. A delete is the other half: without a
 * tombstone the device that still has the task looks like the one with the
 * newer information and hands it straight back.
 */
test('a tick here and an edit there both survive, and a delete stays deleted', async ({ browser }) => {
  const phone = await device(browser)
  const pc = await device(browser)

  await turnSyncOn(phone)
  await phone.getByRole('button', { name: 'Today' }).click()
  await quickAdd(phone, '09:00 Morning pages 20min')
  await quickAdd(phone, '11:00 Ring the bank 15min')
  await quickAdd(phone, '15:00 Cancel the trial 10min')
  await syncNow(phone)

  await turnSyncOn(pc)
  await syncNow(pc)
  await pc.getByRole('button', { name: 'Today' }).click()
  await expect(pc.getByRole('checkbox', { name: 'Ring the bank' })).toBeAttached()

  // One ticks. The other edits a different task, without seeing the tick.
  // Both are on Settings after syncing, so each goes back to the day first.
  await phone.getByRole('button', { name: 'Today' }).click()
  await tick(phone, 'Morning pages')
  await pc.getByRole('button', { name: 'More actions for Ring the bank' }).click()
  await pc.getByRole('button', { name: /Details/ }).first().click()
  const title = pc.getByLabel('Title')
  await title.fill('Ring the bank about the standing order')
  await title.blur()
  await pc.getByRole('button', { name: 'Close details' }).click()

  // And one deletes a third task the other still has.
  await pc.getByRole('button', { name: 'More actions for Cancel the trial' }).click()
  await pc.getByRole('button', { name: 'Delete Cancel the trial' }).click()

  await syncNow(pc)
  await syncNow(phone)
  await syncNow(pc)

  for (const page of [phone, pc]) {
    await page.getByRole('button', { name: 'Today' }).click()
    // The edit survived the tick's round trip, and the delete stuck rather
    // than being handed back by the device that still had it.
    await expect(page.getByRole('checkbox', { name: 'Ring the bank about the standing order' })).toBeAttached()
    await expect(page.getByRole('checkbox', { name: 'Cancel the trial' })).toHaveCount(0)
    // And the tick survived the edit's. Read from the store rather than the
    // Done count, which is about the whole day rather than this one task.
    const morning = await page.evaluate(() => {
      const now = new Date()
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const data = JSON.parse(localStorage.getItem('dienius:data') ?? '{}')
      const tasks = data.days?.[key]?.tasks ?? []
      return tasks.find((t: { title: string }) => t.title === 'Morning pages')
    })
    expect(morning?.done).toBe(true)
  }
})
