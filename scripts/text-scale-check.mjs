/**
 * Every screen at all three text sizes, looking for the two things a larger
 * size breaks: text cut off inside its own box, and a page that scrolls
 * sideways.
 *
 * The sweep walks four widths in two themes and is the app's main measuring
 * pass, but it runs at one text size. `textScale` is a setting a person turns
 * up because they need it, and turning it up is exactly what pushes a label
 * past its container - so it gets its own pass rather than being assumed.
 *
 * It reports differences, not absolutes. A box that clips at every size is
 * doing that on purpose - a visually-hidden heading is a 1px box by
 * construction, and a short timeline block trims its own title by design.
 * Neither is a finding at any size, and neither can be told apart from a real
 * break by looking at one size alone. What the pass looks for is a box that
 * held its text at `s` and stopped holding it at `m` or `l`, which is the
 * thing the setting broke. The discriminator is in the pass rather than in a
 * list of exceptions, so it keeps working as screens are added.
 *
 * `node scripts/text-scale-check.mjs`
 */
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const PORT = 4210
const BASE = `http://localhost:${PORT}/dienius/`
const FIXED = new Date('2026-09-16T12:00:00Z')

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

/**
 * One screen, one text size: every clipped box on it, keyed by where it is in
 * the tree so the same box can be found again at the next size up.
 * @param {Page} page
 */
const measure = page => page.evaluate(() => {
  /** @param {Element} el */
  const path = el => {
    /** @type {string[]} */
    const steps = []
    for (let node = /** @type {Element | null} */ (el); node && node !== document.body; node = node.parentElement) {
      const i = node.parentElement ? [...node.parentElement.children].indexOf(node) : 0
      steps.unshift(`${node.tagName}:${i}`)
    }
    return steps.join('/')
  }
  const de = document.documentElement
  /** @type {Record<string, { cutX: number, cutY: number, what: string }>} */
  const boxes = {}
  for (const el of document.querySelectorAll('main *, nav *')) {
    if (!(el instanceof HTMLElement)) continue
    if (el.querySelector('*')) continue
    const text = (el.textContent ?? '').trim()
    if (!text) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue

    // Follow the text up to whatever actually cuts it. A box with
    // `overflow: visible` does not clip its own text - it hands the spill to
    // its parent, and the parent's parent, until something hides it. The
    // sidebar digest overflowed its own three columns by 21px at Large and
    // was cut by a panel four levels up, which is invisible to anything that
    // only compares an element against itself.
    let cutX = 0
    let cutY = 0
    // Once an axis can be scrolled, the spill above it is reachable rather
    // than lost, so that axis stops being measured any further up.
    let openX = false
    let openY = false
    for (let a = /** @type {HTMLElement | null} */ (el); a && a !== document.body && !(openX && openY); a = a.parentElement) {
      const acs = getComputedStyle(a)
      // A 1px box holding a sentence is the visually-hidden technique, by its
      // shape rather than by its class name.
      if (a.clientWidth <= 1 && a.clientHeight <= 1) { cutX = 0; cutY = 0; break }
      const ar = a.getBoundingClientRect()
      /** @param {string} side */
      const edge = side => parseFloat(acs.getPropertyValue(`border-${side}-width`)) || 0
      // A single line ending in an ellipsis is truncated on purpose and says
      // so on the screen. Sideways is that box's design; downwards is not.
      const trims = acs.textOverflow === 'ellipsis' && acs.whiteSpace === 'nowrap'
      if (!openX) {
        if (['auto', 'scroll'].includes(acs.overflowX)) openX = true
        else if (acs.overflowX === 'hidden' && !trims) cutX = Math.max(cutX, Math.round(r.right - (ar.right - edge('right'))), Math.round(ar.left + edge('left') - r.left))
      }
      if (!openY) {
        if (['auto', 'scroll'].includes(acs.overflowY)) openY = true
        else if (acs.overflowY === 'hidden') cutY = Math.max(cutY, Math.round(r.bottom - (ar.bottom - edge('bottom'))), Math.round(ar.top + edge('top') - r.top))
      }
    }
    boxes[path(el)] = { cutX: Math.max(0, cutX), cutY: Math.max(0, cutY), what: `${el.className || el.tagName} "${text.slice(0, 40)}"` }
  }
  // Sideways scroll, everywhere rather than only on the page. A panel that
  // can be scrolled sideways is hiding text behind its own edge, which is the
  // same defect as clipping it and is harder to see: the digest's three
  // columns grew past the sidebar at Large and the last word of "7h 45 min"
  // went under the rail's edge, reachable only by scrolling a sidebar
  // sideways. CONVENTIONS section 4. The one strip that is allowed to scroll
  // sideways does it at every text size, so the comparison lets it through
  // without needing to be named here.
  /** @type {Record<string, { over: number, what: string }>} */
  const strips = {}
  for (const el of document.querySelectorAll('main *, nav *')) {
    if (!(el instanceof HTMLElement)) continue
    if (!['auto', 'scroll'].includes(getComputedStyle(el).overflowX)) continue
    const over = el.scrollWidth - el.clientWidth
    if (over > 1) strips[path(el)] = { over, what: el.className || el.tagName }
  }
  return { sideways: de.scrollWidth - de.clientWidth, boxes, strips }
})

async function main() {
  const server = await createServer({ configFile: resolve('vite.config.ts'), server: { port: PORT, strictPort: true }, logLevel: 'error' })
  await server.listen()
  const browser = await chromium.launch()
  /** @type {string[]} */
  const findings = []
  try {
    for (const size of [{ w: 1366, h: 768 }, { w: 390, h: 844 }]) {
      /** @type {Record<string, Record<string, Awaited<ReturnType<typeof measure>>>>} */
      const runs = {}
      for (const scale of ['s', 'm', 'l']) {
        const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, timezoneId: 'Europe/Vilnius', locale: 'en-GB' })
        await ctx.clock.setFixedTime(FIXED)
        const page = await ctx.newPage()
        await page.goto(`${BASE}?demo=1`)
        await page.getByRole('status').filter({ hasText: 'Demo data' }).waitFor()
        await page.evaluate(s => {
          const key = 'dienius:demo'
          const d = JSON.parse(localStorage.getItem(key) ?? '{}')
          d.settings.textScale = s
          localStorage.setItem(key, JSON.stringify(d))
        }, scale)

        runs[scale] = {}
        for (const screen of SCREENS) {
          await page.reload()
          await page.waitForSelector('nav')
          await screen.go(page)
          await page.waitForTimeout(300)
          runs[scale][screen.name] = await measure(page)
        }
        await ctx.close()
      }

      // `s` is the baseline: whatever it clips, it clips on purpose.
      for (const scale of ['m', 'l']) {
        for (const screen of SCREENS) {
          const base = runs.s[screen.name]
          const now = runs[scale][screen.name]
          const where = `${size.w}x${size.h} scale ${scale} ${screen.name}`
          if (now.sideways > 1 && now.sideways > base.sideways + 1) findings.push(`  [${where}] page scrolls sideways by ${now.sideways}px (${base.sideways}px at s)`)
          for (const [key, strip] of Object.entries(now.strips)) {
            // A strip that already scrolls at the smallest text is one built
            // to scroll, and it holding more at a bigger size is the point.
            // The finding is a panel that held its content and stopped.
            if (base.strips[key]) continue
            findings.push(`  [${where}] ${strip.what} scrolls sideways by ${strip.over}px, did not at s`)
          }
          /** @type {string[]} */
          const seen = []
          for (const [key, box] of Object.entries(now.boxes)) {
            const was = base.boxes[key]
            // A box that was already cutting at `s` is cutting by design; only
            // one that starts cutting, or cuts meaningfully more, is the size.
            if (box.cutX <= 1 && box.cutY <= 1) continue
            if (was && box.cutX <= was.cutX + 1 && box.cutY <= was.cutY + 1) continue
            if (seen.includes(box.what)) continue
            seen.push(box.what)
            const before = was ? `was ${was.cutX}x${was.cutY} at s` : 'not clipped at s'
            findings.push(`  [${where}] ${box.what} cut ${box.cutX}x${box.cutY}, ${before}`)
          }
        }
      }
    }
  } finally {
    await browser.close()
    await server.close()
  }
  console.log(findings.length ? `${findings.length} findings\n${findings.join('\n')}` : '0 findings across three text sizes')
}

main()
