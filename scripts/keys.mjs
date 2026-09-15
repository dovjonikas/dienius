/**
 * Every screen, on a keyboard alone.
 *
 * The v2.10 hunt walked the app this way once, as throwaway tooling, and
 * found two focus defects nothing in the suite could see: two popovers and
 * the task's detail sheet dropped focus on the body when Escape closed them,
 * so the next Tab started again from the top of the document. That pass was
 * written down as worth keeping and then thrown away. This is it kept.
 *
 * Four questions, per screen, in both themes:
 *
 * 1. **Every stop shows a ring.** A tab stop with no visible focus is a stop
 *    a keyboard user cannot find.
 * 2. **The order does not climb.** Tab should read down the screen. It may
 *    jump up to start a new column to the right - a rail, a day, a task list
 *    - but a stop that lands above the previous one in the same column is a
 *    DOM order that disagrees with the picture.
 * 3. **Escape closes an overlay and gives focus back.** For every button on
 *    the screen that opens a dialog, opening it and pressing Escape must
 *    leave focus on something - the opener, ideally - and never on the body.
 * 4. **Nothing is reachable only with a pointer.** Every button and link on
 *    the screen is in the Tab order somewhere. (A control taken out of it on
 *    purpose carries tabindex="-1" and is skipped here.)
 *
 * A pass that has not been made to fail is not a pass yet: the ring check
 * and the body check were both planted before the first zero was believed.
 *
 * `npm run keys`
 */
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const PORT = 4295
const BASE = `http://localhost:${PORT}/dienius/`
const FIXED = new Date('2026-09-16T12:00:00Z')

/** More stops than any screen has; a guard against a focus trap looping. */
const MAX_STOPS = 400

/** A stop this far above the previous one, without moving right, is a climb. */
const CLIMB_PX = 40

/** @typedef {import('@playwright/test').Page} Page */
/** @type {{ name: string, go: (p: Page) => Promise<unknown> }[]} */
const SCREENS = [
  { name: 'Today', go: p => tab(p, 'Today') },
  { name: 'Calendar month', go: async p => { await tab(p, 'Calendar'); await p.getByRole('button', { name: 'Month', exact: true }).click() } },
  { name: 'Calendar week', go: async p => { await tab(p, 'Calendar'); await p.getByRole('button', { name: 'Week', exact: true }).click() } },
  { name: 'Templates', go: p => tab(p, 'Templates') },
  { name: 'Library', go: p => tab(p, 'Library') },
  { name: 'Review', go: p => tab(p, 'Review') },
  { name: 'North', go: p => tab(p, 'North') },
  { name: 'Settings', go: p => tab(p, 'Settings') },
]

/** @param {Page} p @param {string} name */
const tab = (p, name) => p.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

/** What the focused element looks like, read in the page. */
const focused = (/** @type {Page} */ page) => page.evaluate(() => {
  const el = document.activeElement
  if (!el || el === document.body || !(el instanceof HTMLElement)) return null
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  // A ring is an outline, or a box-shadow standing in for one. Either counts;
  // neither is a ring if it is drawn at zero width or fully transparent.
  const ringOn = (/** @type {CSSStyleDeclaration} */ c) =>
    (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0 && !/rgba?\([^)]*,\s*0\)$/.test(c.outlineColor)) || c.boxShadow !== 'none'
  // The ring may be drawn by the box the control sits in rather than by the
  // control: the time stepper takes the outline off its own two inputs and
  // its toggle and draws one ring around the whole box with :focus-within,
  // which is one ring where three would have been. So an outline on one of
  // the three boxes above the element counts too - an outline only, because
  // in this stylesheet a focus ring is an outline and a box-shadow is
  // elevation. Crediting a box-shadow above credited the rail's own shadow
  // to every button in it, and a nav with no rings at all read as fine.
  // Found by planting.
  let ring = ringOn(cs)
  for (let a = el.parentElement, up = 0; a && up < 3 && !ring; a = a.parentElement, up++) {
    const ac = getComputedStyle(a)
    ring = ac.outlineStyle !== 'none' && parseFloat(ac.outlineWidth) > 0
  }
  const name = el.getAttribute('aria-label') || (el.textContent ?? '').trim().slice(0, 30) || el.tagName
  // Stamped, so the same element is the same stop wherever it has moved to
  // since. The rail widens while it holds focus, so a nav button's position
  // at the moment Tab lands on it is not its position a second later, and a
  // key built from coordinates called all eight of them pointer-only.
  const w = /** @type {Window & { __keysStops?: number }} */ (window)
  if (!el.dataset.keysStop) el.dataset.keysStop = String((w.__keysStops = (w.__keysStops ?? 0) + 1))
  return {
    tag: el.tagName,
    cls: el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : '',
    name,
    ring,
    // Position in the document rather than in the viewport: focusing a stop
    // that is off screen scrolls it into view, and a viewport-relative top
    // read after that scroll cannot be compared with one read before it.
    // Settings read as "Tab climbs the screen" five times over for that
    // reason alone. offsetTop does not move when a box scrolls.
    top: (() => { let t = 0; for (let o = /** @type {HTMLElement | null} */ (el); o; o = /** @type {HTMLElement | null} */ (o.offsetParent)) t += o.offsetTop; return Math.round(t) })(),
    left: (() => { let l = 0; for (let o = /** @type {HTMLElement | null} */ (el); o; o = /** @type {HTMLElement | null} */ (o.offsetParent)) l += o.offsetLeft; return Math.round(l) })(),
    visible: r.width > 0 && r.height > 0,
    key: el.dataset.keysStop,
  }
})

async function main() {
  const server = await createServer({ configFile: resolve('vite.config.ts'), server: { port: PORT, strictPort: true }, logLevel: 'error' })
  await server.listen()
  const browser = await chromium.launch()
  /** @type {string[]} */
  const findings = []
  try {
    for (const theme of ['dark', 'light']) {
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, timezoneId: 'Europe/Vilnius', locale: 'en-GB' })
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
        await screen.go(page)
        await page.waitForTimeout(300)
        const where = `${theme} ${screen.name}`

        // ---- walk the Tab order ------------------------------------------
        await page.evaluate(() => {
          /** @type {Window & { __keysStops?: number }} */ (window).__keysStops = 0
          for (const el of document.querySelectorAll('[data-keys-stop]')) delete (/** @type {HTMLElement} */ (el)).dataset.keysStop
          // From the top. blur() alone leaves the browser's sequential
          // navigation starting point on the element that had focus, so the
          // first Tab skipped it - and the nav's current button, focused on
          // load, was reported as reachable only with a pointer.
          document.body.setAttribute('tabindex', '-1')
          document.body.focus()
          document.body.removeAttribute('tabindex')
        })
        /** @type {NonNullable<Awaited<ReturnType<typeof focused>>>[]} */
        const stops = []
        const seen = new Set()
        for (let i = 0; i < MAX_STOPS; i++) {
          await page.keyboard.press('Tab')
          const f = await focused(page)
          if (!f) break
          if (seen.has(f.key)) break
          seen.add(f.key)
          stops.push(f)
        }
        if (stops.length === 0) {
          findings.push(`  [${where}] nothing takes focus at all`)
          continue
        }

        // 1. Every stop shows a ring.
        for (const f of stops) {
          if (f.visible && !f.ring) findings.push(`  [${where}] no focus ring on ${f.tag}${f.cls ? '.' + f.cls : ''} "${f.name}"`)
        }

        // 2. The order does not climb within a column.
        for (let i = 1; i < stops.length; i++) {
          const a = stops[i - 1]
          const b = stops[i]
          if (!a.visible || !b.visible) continue
          const climbed = a.top - b.top > CLIMB_PX
          const movedRight = b.left - a.left > 80
          if (climbed && !movedRight) {
            findings.push(`  [${where}] Tab climbs the screen: "${a.name}" (y ${a.top}) then "${b.name}" (y ${b.top})`)
          }
        }

        // 4. Nothing is reachable only with a pointer.
        const unreached = await page.evaluate(() => {
          const out = []
          for (const el of document.querySelectorAll('main button, main a[href], nav button')) {
            if (!(el instanceof HTMLElement)) continue
            if (el.tabIndex < 0 || el.hasAttribute('disabled')) continue
            const cs = getComputedStyle(el)
            if (cs.display === 'none' || cs.visibility === 'hidden') continue
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) continue
            const name = el.getAttribute('aria-label') || (el.textContent ?? '').trim().slice(0, 30) || el.tagName
            if (!el.dataset.keysStop) out.push(`${el.tagName} "${name}"`)
          }
          return out.slice(0, 8)
        })
        for (const u of unreached) findings.push(`  [${where}] reachable only with a pointer: ${u}`)

        // 3. Escape closes an overlay and gives focus back. Only buttons the
        // walk reached, pressed with Enter; anything that opened a dialog is
        // closed again with Escape, and focus must land on an element.
        const openers = stops.filter(s => s.tag === 'BUTTON').slice(0, 40)
        for (const opener of openers) {
          // Refocus that exact stop by walking to it again, from the top.
          await page.evaluate(() => {
            document.body.setAttribute('tabindex', '-1')
            document.body.focus()
            document.body.removeAttribute('tabindex')
          })
          let at = null
          for (let i = 0; i < stops.length; i++) {
            await page.keyboard.press('Tab')
            at = await focused(page)
            if (!at || at.key === opener.key) break
          }
          if (!at || at.key !== opener.key) continue
          await page.keyboard.press('Enter')
          await page.waitForTimeout(150)
          const opened = await page.evaluate(() => !!document.querySelector('[role="dialog"], [role="menu"], [aria-modal="true"]'))
          if (!opened) {
            // A press that did something on the spot, or navigated away. Only
            // the second needs the screen put back, and only that: a reload
            // here would throw away the state every other opener depends on.
            const here = await page.evaluate(() => document.querySelector('nav [aria-current]')?.textContent?.trim() ?? '')
            if (here && !screen.name.startsWith(here)) {
              await screen.go(page)
              await page.waitForTimeout(200)
            }
            continue
          }
          await page.keyboard.press('Escape')
          await page.waitForTimeout(150)
          const after = await page.evaluate(() => ({
            onBody: document.activeElement === document.body || document.activeElement === null,
            stillOpen: !!document.querySelector('[role="dialog"], [role="menu"], [aria-modal="true"]'),
          }))
          if (after.stillOpen) {
            findings.push(`  [${where}] Escape does not close what "${opener.name}" opened`)
            // Leave it the only way left, so the next opener starts clean.
            await page.reload()
            await page.waitForSelector('nav')
            await screen.go(page)
            await page.waitForTimeout(200)
          } else if (after.onBody) {
            findings.push(`  [${where}] focus dropped on the body after Escape closed what "${opener.name}" opened`)
          }
        }
      }
      await ctx.close()
    }
  } finally {
    await browser.close()
    await server.close()
  }
  console.log(findings.length ? `${findings.length} findings\n${[...new Set(findings)].join('\n')}` : '0 findings: every stop has a ring, the order reads down, Escape gives focus back, and nothing is pointer-only')
}

main()
