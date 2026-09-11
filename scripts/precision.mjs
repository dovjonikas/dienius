/**
 * Two kinds of untidiness the sweep cannot see, on every screen.
 *
 * The sweep measures whether a thing is readable, reachable and inside its
 * box. It says nothing about whether a thing is *placed well*, and that is
 * what the owner keeps reporting: a tick drawn against the left wall of its
 * own checkbox, a column of figures with a different amount of air on every
 * row. Both were found by a person looking at the screen, twice, and neither
 * would have been found by any pass in this repo.
 *
 * So: two checks, each written from a defect that actually happened.
 *
 * **A mark sits in the middle of its box.** An icon inside a control, or a
 * drawn mark inside a checkbox, should have the same air on both sides. The
 * tick was a five by ten box turned forty-five degrees about its own top
 * left corner, which swings it down and left out of where its `left` and
 * `top` say it is - so it ran from -0.1px to 10.5px across a twenty pixel
 * box while the numbers looked reasonable.
 *
 * **Repeated rows keep the same rhythm.** Where the same row is drawn several
 * times, the gap between the same two parts should be the same gap. The day's
 * digest gave each part a column and right-aligned it, which keeps three
 * straight edges and lets the air between them change on every line.
 *
 * Reports differences rather than absolutes wherever it can, for the reason
 * written at the top of text-scale-check.mjs: a pass that has not been made
 * to fail is not a pass yet. Both checks below were confirmed against the two
 * defects before they were fixed.
 *
 * `npm run precision`
 */
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const PORT = 4290
const BASE = `http://localhost:${PORT}/dienius/`
const FIXED = new Date('2026-09-16T12:00:00Z')

/** How far off centre a mark may sit before it reads as misplaced. */
const OFF_CENTRE_PX = 1.5

/** How much the same gap may vary between two drawings of the same row. */
const RHYTHM_PX = 3

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

/** @param {Page} page */
const measure = page => page.evaluate(([offCentre, rhythm]) => {
  /** @type {string[]} */
  const found = []
  const round = (/** @type {number} */ n) => Math.round(n * 10) / 10

  // ---- a mark sits in the middle of its box -----------------------------
  for (const box of document.querySelectorAll('button, label, .check, [role="button"]')) {
    if (!(box instanceof HTMLElement)) continue
    const cs = getComputedStyle(box)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = box.getBoundingClientRect()
    if (r.width < 8 || r.height < 8) continue

    /** @type {{ what: string, left: number, right: number, top: number, bottom: number } | null} */
    let mark = null

    // An icon, where it is the only thing drawn in the control. A control
    // with words in it is centred by its own text layout and is not this.
    const svgs = box.querySelectorAll(':scope > svg')
    const words = (box.textContent ?? '').trim()
    if (svgs.length === 1 && words === '') {
      const ir = svgs[0].getBoundingClientRect()
      if (ir.width > 0) {
        mark = {
          what: 'icon',
          left: ir.left - (r.left + parseFloat(cs.borderLeftWidth)),
          right: r.right - parseFloat(cs.borderRightWidth) - ir.right,
          top: ir.top - (r.top + parseFloat(cs.borderTopWidth)),
          bottom: r.bottom - parseFloat(cs.borderBottomWidth) - ir.bottom,
        }
      }
    }

    // A drawn mark: a pseudo-element with a size and, usually, a rotation.
    // Its corners are worked out rather than measured, because there is no
    // way to ask the browser for a pseudo-element's box.
    const after = getComputedStyle(box, '::after')
    const w = parseFloat(after.width)
    const h = parseFloat(after.height)
    if (!mark && w > 0 && h > 0 && after.content !== 'none' && after.position === 'absolute') {
      const left = parseFloat(after.left)
      const top = parseFloat(after.top)
      if (Number.isFinite(left) && Number.isFinite(top)) {
        // The transform as a matrix, applied to the four corners. Covers a
        // rotation about any origin, which is what a drawn tick is.
        const m = new DOMMatrixReadOnly(after.transform === 'none' ? undefined : after.transform)
        const [ox, oy] = after.transformOrigin.split(' ').map(parseFloat)
        const corner = (/** @type {number} */ x, /** @type {number} */ y) => {
          const p = m.transformPoint({ x: x - (ox || 0), y: y - (oy || 0) })
          return [left + p.x + (ox || 0), top + p.y + (oy || 0)]
        }
        const pts = [corner(0, 0), corner(w, 0), corner(0, h), corner(w, h)]
        const xs = pts.map(p => p[0])
        const ys = pts.map(p => p[1])
        mark = {
          what: 'mark',
          left: Math.min(...xs),
          right: box.clientWidth - Math.max(...xs),
          top: Math.min(...ys),
          bottom: box.clientHeight - Math.max(...ys),
        }
      }
    }

    if (!mark) continue
    const offX = Math.abs(mark.left - mark.right)
    const offY = Math.abs(mark.top - mark.bottom)
    if (offX > offCentre || offY > offCentre) {
      found.push(`${box.className || box.tagName} ${mark.what} off centre by ${round(offX)}x${round(offY)} (left ${round(mark.left)}, right ${round(mark.right)}, top ${round(mark.top)}, bottom ${round(mark.bottom)})`)
    }
  }

  // ---- repeated rows keep the same rhythm -------------------------------
  /** @type {Map<string, Element[]>} */
  const families = new Map()
  for (const el of document.querySelectorAll('main *')) {
    const parent = el.parentElement
    if (!parent || !el.className || typeof el.className !== 'string') continue
    const key = `${parent.className}>${el.className}`
    families.set(key, [...(families.get(key) ?? []), el])
  }
  for (const [key, rows] of families) {
    if (rows.length < 3) continue
    // Only rows drawn the same way: the same number of parts, in order.
    const shape = rows.map(r => [...r.children].map(c => c.tagName).join(','))
    if (new Set(shape).size !== 1 || rows[0].children.length < 2) continue
    const gapsPerRow = rows.map(row => {
      const kids = [...row.children].map(c => c.getBoundingClientRect())
      if (kids.some(k => k.width === 0)) return null
      return kids.slice(1).map((k, i) => k.left - kids[i].right)
    })
    const solid = /** @type {number[][]} */ (gapsPerRow.filter(Boolean))
    if (solid.length < 3) continue
    // One gap in a row is the leader: the space a label and its control are
    // pushed apart by, which is meant to be whatever is left over and to
    // differ on every row. Every other gap holds parts that read as a unit,
    // and those are the ones that must not drift. A row of two parts is all
    // leader and has nothing to check.
    //
    // Chosen once for the family, on the average, rather than per row. Per
    // row was wrong in the way that matters: a drifting gap is largest on
    // some row or other, so on that row it called itself the leader and
    // excused itself - which is exactly how the digest's own defect would
    // have walked past this pass. Found by planting it.
    const means = solid[0].map((_, i) => solid.reduce((sum, g) => sum + g[i], 0) / solid.length)
    const leader = means.indexOf(Math.max(...means))
    for (let i = 0; i < solid[0].length; i++) {
      if (i === leader) continue
      const column = solid.map(g => g[i])
      // Overlapping parts are placed rather than flowed, and the distance
      // between them is not a gap.
      if (column.some(g => g < 0)) continue
      const spread = Math.max(...column) - Math.min(...column)
      if (spread > rhythm) {
        found.push(`${key} gap ${i + 1} varies by ${round(spread)}px across ${solid.length} rows (${column.map(round).join(', ')})`)
      }
    }
  }

  return [...new Set(found)]
}, /** @type {[number, number]} */ ([OFF_CENTRE_PX, RHYTHM_PX]))

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
        await page.waitForTimeout(350)
        for (const f of await measure(page)) findings.push(`  [${theme} ${screen.name}] ${f}`)
      }
      await ctx.close()
    }
  } finally {
    await browser.close()
    await server.close()
  }
  console.log(findings.length ? `${findings.length} findings\n${findings.join('\n')}` : '0 findings: every mark is centred and every repeated row keeps its rhythm')
}

main()
