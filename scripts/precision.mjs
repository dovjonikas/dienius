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

/**
 * The band in which two stacked left edges read as a mistake. Exactly equal
 * is aligned; a difference past the top of the band is an indent somebody
 * meant. In between is the thing the eye catches and cannot name.
 */
const NEAR_MISS_PX = [2, 12]

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
const measure = page => page.evaluate(([offCentre, rhythm, nearMiss]) => {
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

  // ---- things stacked in one column share a left edge -------------------
  //
  // The third check, written from the third defect: the goal's line began
  // over the mini calendar and ran into the timeline, a sentence crossing two
  // columns it had nothing to do with. That one was a long way off - a whole
  // column - and is held by a browser test of its own, because "which two
  // things should share an edge" is a design fact. What can be measured
  // without one is the near miss: two blocks of text, one directly below the
  // other, whose left edges differ by a few pixels. Nobody means a few
  // pixels. They mean zero, or they mean an indent.
  /** @type {{ el: HTMLElement, r: DOMRect }[]} */
  const blocks = []
  for (const el of document.querySelectorAll('main *')) {
    if (!(el instanceof HTMLElement)) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'inline' || cs.display === 'contents' || cs.display === 'none' || cs.visibility === 'hidden') continue
    if (cs.position === 'absolute' || cs.position === 'fixed') continue
    // Only a block that draws its own text: a wrapper's edge is its child's.
    const own = [...el.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim() !== '')
    if (!own) continue
    // A centred block has no left edge to keep: the month's name over the
    // mini calendar sits in the middle of its row and the weekday letters
    // under it sit in columns, and 2.4px between those two edges is nothing.
    // Only text that starts at the left is measured from the left.
    if (!['start', 'left'].includes(cs.textAlign)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 24 || r.height < 8) continue
    blocks.push({ el, r })
  }
  blocks.sort((a, b) => a.r.top - b.r.top)
  for (let i = 0; i < blocks.length; i++) {
    const a = blocks[i]
    // The nearest block below that starts in the same column: it overlaps
    // this one across most of its width, and the gap between them is a gap
    // rather than a section break.
    let below = null
    for (let j = i + 1; j < blocks.length; j++) {
      const b = blocks[j]
      if (b.r.top < a.r.bottom - 1) continue
      if (b.r.top - a.r.bottom > 40) break
      const overlap = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
      if (overlap < Math.min(a.r.width, b.r.width) * 0.6) continue
      // Stacked inside the same box, not across two. The pace line at the
      // foot of one card and the title at the head of the next are 8px
      // apart because the title sits beside a checkbox, and that is two
      // cards, not one misaligned column. A shared parent or grandparent is
      // the plainest reading of "the same box".
      const ap = a.el.parentElement, bp = b.el.parentElement
      if (!(ap === bp || ap?.parentElement === bp || bp?.parentElement === ap || ap?.parentElement === bp?.parentElement)) continue
      below = b
      break
    }
    if (!below) continue
    const gap = Math.abs(a.r.left - below.r.left)
    if (gap >= nearMiss[0] && gap <= nearMiss[1]) {
      const name = (/** @type {HTMLElement} */ e) => e.className || e.tagName
      found.push(`${name(a.el)} and ${name(below.el)} below it are ${round(gap)}px out of line ("${(a.el.textContent ?? '').trim().slice(0, 24)}" / "${(below.el.textContent ?? '').trim().slice(0, 24)}")`)
    }
  }

  return [...new Set(found)]
}, /** @type {[number, number, number[]]} */ ([OFF_CENTRE_PX, RHYTHM_PX, NEAR_MISS_PX]))

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
  console.log(findings.length ? `${findings.length} findings\n${findings.join('\n')}` : '0 findings: every mark is centred, every repeated row keeps its rhythm, and nothing stacked is a few pixels out of line')
}

main()
