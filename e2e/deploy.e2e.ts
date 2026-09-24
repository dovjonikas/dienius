import { mkdtempSync, cpSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * A new version taking over after a deploy - the freeze's point 3, the half
 * offline.e2e.ts leaves. The build the other tests run is copied into a
 * folder served under /dienius/ the way GitHub Pages serves it, and a deploy
 * is that folder written over by a build that differs the way the next one
 * will: its script and its stylesheet under new names, a page that names
 * them, a worker with a cache of its own. Nothing is pressed here to get the
 * new version.
 */

// A port of its own for each worker: the desktop and the phone run this
// file side by side.
let HERE = ''
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

let root: string
let server: Server

test.beforeEach(async ({}, info) => {
  const port = 4197 + info.parallelIndex
  HERE = `http://localhost:${port}/dienius/`
  root = mkdtempSync(join(tmpdir(), 'dienius-deploy-'))
  cpSync('dist', join(root, 'dienius'), { recursive: true })
  server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', HERE).pathname)
    const file = join(root, path.endsWith('/') ? `${path}index.html` : path)
    try {
      const body = readFileSync(file)
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
      res.end(body)
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise<void>(resolve => server.listen(port, resolve))
})

test.afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
  rmSync(root, { recursive: true, force: true })
})

/** The deploy: every asset under a new name, the page naming them, a worker with its own cache - and the old files gone, as Pages leaves them. */
function deploy(): void {
  const dir = join(root, 'dienius')
  let page = readFileSync(join(dir, 'index.html'), 'utf8')
  let worker = readFileSync(join(dir, 'sw.js'), 'utf8')
  for (const name of readdirSync(join(dir, 'assets'))) {
    const next = name.replace(/\.(js|css)$/, '-next.$1')
    renameSync(join(dir, 'assets', name), join(dir, 'assets', next))
    page = page.split(`assets/${name}`).join(`assets/${next}`)
    worker = worker.split(`assets/${name}`).join(`assets/${next}`)
  }
  worker = worker.replace(/const CACHE_NAME = '([^']+)'/, "const CACHE_NAME = '$1-next'")
  writeFileSync(join(dir, 'index.html'), page)
  writeFileSync(join(dir, 'sw.js'), worker)
}

/** The script this page is running. */
const running = (page: Page) => page.evaluate(() => document.querySelector('script[type="module"]')?.getAttribute('src') ?? '')

async function workerInCharge(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 })
}

test('opened after a deploy, the app is the new version - its cache the only one, and nothing asking for a reload', async ({ page, context }, info) => {
  test.slow()
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(HERE)
  await workerInCharge(page)
  expect(await running(page)).not.toContain('-next')

  deploy()
  await page.reload()
  await expect.poll(() => running(page)).toContain('-next')
  // The new worker in charge, and the old version's cache gone with it.
  await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 30_000 }).toEqual([expect.stringMatching(/-next$/)])
  // The page is already what the new worker serves: there is nothing to
  // reload into, so nothing says there is.
  await page.waitForTimeout(1_000)
  await expect(page.getByText('An update is ready.')).toHaveCount(0)

  // And with no network, the new version is the one that opens.
  await context.setOffline(true)
  await page.reload()
  await expect.poll(() => running(page)).toContain('-next')
  await expect(page.getByRole('navigation', { name: 'Views' })).toBeVisible()
})

test('an app left open over a deploy learns of it when it comes back into view, and the next open is the new version', async ({ page }, info) => {
  test.slow()
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(HERE)
  await workerInCharge(page)

  deploy()
  // Back from another app or tab. No navigation: the page still runs the
  // version it opened with, and asks whether there is a newer one.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByText('An update is ready.')).toBeVisible({ timeout: 30_000 })
  expect(await running(page)).not.toContain('-next')

  await page.reload()
  await expect.poll(() => running(page)).toContain('-next')
  await page.waitForTimeout(1_000)
  await expect(page.getByText('An update is ready.')).toHaveCount(0)
})
