import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, devices } from '@playwright/test'
import { createServer } from 'vite'

/**
 * The README's screenshots, produced rather than taken.
 *
 * `npm run shots` starts the dev server, opens the sample fortnight, and
 * writes eight PNGs into docs/screenshots/. Every one of them is of the same
 * afternoon: the clock is pinned to a Wednesday at 15:00 before the page
 * loads, so the demo seeds around that day, the now line sits where it sits,
 * the running block is the same block, and running this twice produces the
 * same files. A screenshot that depends on when somebody ran the script is a
 * screenshot nobody can regenerate.
 *
 * Demo mode rather than a hand-built store, deliberately: what the README
 * shows is what the demo link shows, and if the demo's first screen is not
 * worth a screenshot, the demo is what needs fixing, not the script. The one
 * thing done on top of the seed is pressing Focus on the running card for
 * the hero, which is the state the whole day view is built around.
 *
 * Time zone and locale are fixed too. The seed is built from the browser's
 * own clock, and a machine set to Tokyo would seed a different "today" from
 * one set to Vilnius; pinning the zone makes the fixed instant mean the same
 * wall-clock time everywhere.
 */

const PORT = 4191
const BASE = `http://localhost:${PORT}/dienius/`
const OUT = resolve('docs/screenshots')
/** 15:00 on Wednesday 16 September 2026, Vilnius time (UTC+3 in September). */
const FIXED_TIME = new Date('2026-09-16T12:00:00Z')
const TIMEZONE = 'Europe/Vilnius'
const LOCALE = 'en-GB'

const DESKTOP = { width: 1440, height: 900 }
const HERO = { width: 1920, height: 1080 }
const PHONE = { width: 390, height: 844 }

async function main() {
  mkdirSync(OUT, { recursive: true })

  const server = await createServer({
    configFile: resolve('vite.config.ts'),
    server: { port: PORT, strictPort: true },
    logLevel: 'error',
  })
  await server.listen()

  const browser = await chromium.launch()
  try {
    await shoot(browser, { viewport: HERO, colorScheme: 'dark' }, async page => {
      await openDemo(page)
      // Focus on the running card: the ring on the block, the bar under the
      // header, and the card's own countdown, all from one press.
      await page.getByRole('button', { name: 'Focus', exact: true }).click()
      await page.getByRole('button', { name: 'Expand' }).waitFor()
      await settle(page)
      await save(page, 'hero.png')
    })

    await shoot(browser, { viewport: DESKTOP, colorScheme: 'dark' }, async page => {
      await openDemo(page)
      await save(page, 'today-dark.png')
      await reportScroll(page, 'today-dark')

      await tab(page, 'Calendar')
      await page.getByRole('group', { name: 'Calendar view' }).waitFor()
      await settle(page)
      await save(page, 'calendar-month.png')

      await page.getByRole('button', { name: 'Week', exact: true }).click()
      await page.getByRole('button', { name: 'Week', exact: true, pressed: true }).waitFor()
      await settle(page)
      await save(page, 'calendar-week.png')

      await tab(page, 'Library')
      await page.getByText('Thinking, Fast and Slow').first().waitFor()
      await settle(page)
      await save(page, 'library.png')

      await tab(page, 'Review')
      await page.getByRole('heading', { name: 'Review' }).waitFor()
      await settle(page)
      await save(page, 'review.png')
    })

    await shoot(browser, { viewport: DESKTOP, colorScheme: 'light' }, async page => {
      await openDemo(page, { presetId: 'light', mode: 'light' })
      await save(page, 'today-light.png')
    })

    await shoot(
      browser,
      { ...devices['iPhone 13'], viewport: PHONE, deviceScaleFactor: 2, colorScheme: 'dark' },
      async page => {
        await openDemo(page)
        await save(page, 'phone-today.png')
      },
    )
  } finally {
    await browser.close()
    await server.close()
  }
}

/** One context per shot group: its own storage, its own pinned clock. */
/**
 * @param {import('@playwright/test').Browser} browser
 * @param {import('@playwright/test').BrowserContextOptions} options
 * @param {(page: import('@playwright/test').Page) => Promise<void>} run
 */
async function shoot(browser, options, run) {
  const context = await browser.newContext({
    timezoneId: TIMEZONE,
    locale: LOCALE,
    reducedMotion: 'reduce',
    ...options,
  })
  await context.clock.setFixedTime(FIXED_TIME)
  const page = await context.newPage()
  try {
    await run(page)
  } finally {
    await context.close()
  }
}

/**
 * Opens the sample fortnight and waits until the day is drawn. The theme is
 * written into the demo's own key and the page reloaded, which is exactly
 * what Settings would do, minus the clicks. Every preset ships one mode
 * (themes.ts), so Light is a preset rather than a switch on Dark.
 */
/**
 * @param {import('@playwright/test').Page} page
 * @param {{ presetId: string, mode: 'light' | 'dark' }} [theme]
 */
async function openDemo(page, theme) {
  await page.goto(`${BASE}?demo=1`)
  await page.getByRole('status').filter({ hasText: 'Demo data' }).waitFor()
  await page.getByRole('checkbox', { name: 'Draft the launch email' }).waitFor({ state: 'attached' })
  if (theme) {
    await page.evaluate(/** @param {{ presetId: string, mode: string }} patch */ patch => {
      const key = 'dienius:demo'
      const data = JSON.parse(localStorage.getItem(key) ?? '{}')
      data.settings.theme = { ...data.settings.theme, ...patch }
      localStorage.setItem(key, JSON.stringify(data))
    }, theme)
    await page.reload()
    await page.getByRole('checkbox', { name: 'Draft the launch email' }).waitFor({ state: 'attached' })
  }
  await settle(page)
}

/** Fonts loaded, network quiet, one frame painted with the final layout. */
/** @param {import('@playwright/test').Page} page */
async function settle(page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function save(page, name) {
  await page.screenshot({ path: resolve(OUT, name), animations: 'disabled', caret: 'hide' })
  console.log(`shots: ${name}`)
}

/**
 * The day view at the wide breakpoint is meant to fit its window - the rule
 * in CONVENTIONS.md section 4. Said here rather than asserted, because a
 * screenshot of a day that scrolls is still a screenshot; the e2e suite is
 * where it fails.
 */
/**
 * @param {import('@playwright/test').Page} page
 * @param {string} label
 */
async function reportScroll(page, label) {
  const { scrollHeight, clientHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }))
  if (scrollHeight > clientHeight) {
    console.warn(`shots: ${label} scrolls - ${scrollHeight}px of content in a ${clientHeight}px window`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

/** The tab bar's button, and not the day view's own control of the same name. */
/**
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function tab(page, name) {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
}
