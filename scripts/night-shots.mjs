/**
 * The before and after of the night pass, one image per screen per theme.
 *
 * `node scripts/night-shots.mjs before` and `... after`, into
 * docs/screenshots/night/<side>/. The v2.20 brief asks for the pair on every
 * screen it changes, and the reason is the one every audit here has: a
 * tidying wave is the kind that feels like progress and can quietly cost
 * something, and two images side by side is the cheapest way to be honest
 * about which happened.
 *
 * 1366x768 rather than 1920, and the demo's own fortnight, so a run is
 * repeatable and the files are small enough to live in the repo.
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const SIDE = process.argv[2]
if (SIDE !== 'before' && SIDE !== 'after') {
  console.error('usage: node scripts/night-shots.mjs before|after')
  process.exit(1)
}

const PORT = 4208
const BASE = `http://localhost:${PORT}/dienius/`
const OUT = resolve('docs/screenshots/night', SIDE)
/** The same afternoon shots.mjs pins, so the running block is the same block. */
const FIXED = new Date('2026-09-16T12:00:00Z')
const SIZE = { width: 1366, height: 768 }

/** @param {import('@playwright/test').Page} p @param {string} name */
const tab = (p, name) => p.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

/** @typedef {import('@playwright/test').Page} Page */
/** @type {{ name: string, go: (p: Page) => Promise<unknown> }[]} */
const SCREENS = [
  { name: 'today', go: p => tab(p, 'Today') },
  { name: 'calendar-month', go: async p => { await tab(p, 'Calendar'); await p.getByRole('button', { name: 'Month', exact: true }).click() } },
  { name: 'calendar-week', go: async p => { await tab(p, 'Calendar'); await p.getByRole('button', { name: 'Week', exact: true }).click() } },
  { name: 'templates', go: p => tab(p, 'Templates') },
  { name: 'library', go: p => tab(p, 'Library') },
  { name: 'review', go: p => tab(p, 'Review') },
  { name: 'north', go: p => tab(p, 'North') },
  { name: 'settings', go: p => tab(p, 'Settings') },
]

async function main() {
  mkdirSync(OUT, { recursive: true })
  const server = await createServer({ configFile: resolve('vite.config.ts'), server: { port: PORT, strictPort: true }, logLevel: 'error' })
  await server.listen()
  const browser = await chromium.launch()
  try {
    for (const theme of /** @type {const} */ (['dark', 'light'])) {
      const ctx = await browser.newContext({ viewport: SIZE, colorScheme: theme, timezoneId: 'Europe/Vilnius', locale: 'en-GB' })
      await ctx.clock.setFixedTime(FIXED)
      const page = await ctx.newPage()
      await page.goto(`${BASE}?demo=1`)
      await page.getByRole('status').filter({ hasText: 'Demo data' }).waitFor()
      await page.evaluate(t => {
        const key = 'dienius:demo'
        const d = JSON.parse(localStorage.getItem(key) ?? '{}')
        d.settings.theme = { presetId: t, mode: t, overrides: {} }
        localStorage.setItem(key, JSON.stringify(d))
      }, theme)

      for (const screen of SCREENS) {
        await page.reload()
        await page.waitForSelector('nav')
        // The demo strip is the same on every screen and is not the app.
        await page.evaluate(() => document.querySelector('.demo-banner')?.remove())
        await screen.go(page)
        await page.waitForTimeout(350)
        await page.evaluate(() => document.fonts.ready)
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
        await page.screenshot({ path: `${OUT}/${screen.name}-${theme}.png` })
      }
      await ctx.close()
    }
  } finally {
    await browser.close()
    await server.close()
  }
  console.log(`${SCREENS.length * 2} images in docs/screenshots/night/${SIDE}/`)
}

main()
