/**
 * The untidiness the sweep cannot see, on every screen.
 *
 * The sweep measures whether a thing is readable, reachable and inside its
 * box. It says nothing about whether a thing is *placed well*, and that is
 * what the owner keeps reporting: a tick drawn against the left wall of its
 * own checkbox, a column of figures with a different amount of air on every
 * row. Both were found by a person looking at the screen, twice, and neither
 * would have been found by any pass in this repo.
 *
 * So: checks, each written from a defect that actually happened.
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
 * **A row of controls has one centre line, and nothing floats in it.** From
 * the owner's reading of the v2.25 sheets: a template chip 10.5px under the
 * title beside it, and a toggle floating in the middle of a bar with 151px
 * of nothing on each side. See the checks themselves for how a row is found.
 *
 * Reports differences rather than absolutes wherever it can, for the reason
 * written at the top of text-scale-check.mjs: a pass that has not been made
 * to fail is not a pass yet. Every check below was confirmed against its own
 * defect before that defect was fixed.
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
  { name: 'Kitchen', go: p => tab(p, 'Kitchen') },
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

  // ---- a row of controls has one centre line, and nothing floats in it ---
  //
  // The fourth and fifth checks, written from the owner's reading of the
  // v2.25 sheets: Today's template chip and doors stood 10.5px under the
  // title beside them, because the row centred them on a two-line block;
  // and Month and Week floated in the middle of the week's bar with 151px of
  // nothing on either side, because both toggles carried an auto margin and
  // the row's slack was split between them. "Random centring", "random gaps
  // between the buttons".
  //
  // A line is the laid-out items of one flex or grid box that share a band
  // of height - a display: contents wrapper's children count as the box's
  // own, which is how the day's masthead places its arrows. Only lines that
  // hold a control, and only items no taller than a control on a finger:
  // a card beside its checkbox is a layout, not a row.
  const interactive = (/** @type {Element} */ el) =>
    el.matches('button, select, input, a[href], [role="button"], [role="group"], .segmented') ||
    !!el.querySelector('button, select, input, a[href], [role="button"]')
  /** @param {Element} box @returns {HTMLElement[]} */
  const itemsOf = box => {
    /** @type {HTMLElement[]} */
    const out = []
    for (const child of box.children) {
      if (!(child instanceof HTMLElement)) continue
      const cs = getComputedStyle(child)
      if (cs.display === 'contents') { out.push(...itemsOf(child)); continue }
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'absolute' || cs.position === 'fixed') continue
      const r = child.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      out.push(child)
    }
    return out
  }
  const label = (/** @type {HTMLElement} */ e) =>
    `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : ''} "${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 20)}"`
  for (const box of document.querySelectorAll('main *, .app-header *')) {
    if (!(box instanceof HTMLElement)) continue
    const cs = getComputedStyle(box)
    const flexRow = (cs.display === 'flex' || cs.display === 'inline-flex') && !cs.flexDirection.startsWith('column')
    const grid = cs.display === 'grid' || cs.display === 'inline-grid'
    if (!flexRow && !grid) continue
    if (cs.alignItems === 'baseline' || cs.alignItems.includes('baseline')) continue
    let items = itemsOf(box).map(el => ({ el, r: el.getBoundingClientRect() }))
    // An item a grid lays across two of its rows is centred on both of them
    // by design - a card's menu beside its title line and its meta line - and
    // is not on either row's centre line. The tracks are read back as the
    // browser resolved them.
    if (grid) {
      const tracks = cs.gridTemplateRows.split(' ').map(parseFloat).filter(n => Number.isFinite(n))
      if (tracks.length > 1) {
        const outer = box.getBoundingClientRect()
        let y = outer.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop)
        const gap = parseFloat(cs.rowGap) || 0
        const bands = tracks.map(size => { const band = [y, y + size]; y += size + gap; return band })
        items = items.filter(i => bands.filter(([top, bottom]) => Math.min(bottom, i.r.bottom) - Math.max(top, i.r.top) > 1).length < 2)
      }
    }
    if (items.length < 2) continue
    // Lines: items whose centres are closer than half the shorter item's
    // height. A card's title line and the meta line under it are two lines
    // of one grid, twelve pixels apart; a chip ten pixels under a title is
    // one line drawn badly.
    items.sort((a, b) => a.r.top - b.r.top)
    /** @type {{ el: HTMLElement, r: DOMRect }[][]} */
    const lines = []
    const mid = (/** @type {DOMRect} */ r) => (r.top + r.bottom) / 2
    for (const item of items) {
      const line = lines.find(l => l.some(o => Math.abs(mid(o.r) - mid(item.r)) < Math.min(o.r.height, item.r.height) / 2))
      if (line) line.push(item)
      else lines.push([item])
    }
    for (const line of lines) {
      if (line.length < 2) continue
      if (line.some(i => i.r.height > 48)) continue
      if (!line.some(i => interactive(i.el))) continue
      if (line.some(i => getComputedStyle(i.el).alignSelf.includes('baseline'))) continue

      const centres = line.map(i => (i.r.top + i.r.bottom) / 2).sort((a, b) => a - b)
      const median = centres[Math.floor(centres.length / 2)]
      for (const i of line) {
        const off = (i.r.top + i.r.bottom) / 2 - median
        if (Math.abs(off) > offCentre) {
          found.push(`${label(box)}: ${label(i.el)} sits ${round(off)}px off the row's centre line`)
        }
      }

      // Nothing floats: at most one open gap in a row. Two are allowed only
      // around words standing between two single controls at the row's
      // edges - a title between its arrows. Month and Week were exactly
      // centred between their two gaps, 151px each side, and still floating:
      // a group of controls in the middle of a bar is never meant.
      const across = [...line].sort((a, b) => a.r.left - b.r.left)
      const gaps = across.slice(1).map((i, k) => ({ gap: i.r.left - across[k].r.right, after: across[k], before: i }))
      const open = gaps.filter(g => g.gap > 48)
      if (open.length >= 2) {
        const [first, second] = open
        const between = across.slice(across.indexOf(first.before), across.indexOf(second.after) + 1)
        const bracketed = open.length === 2 && across.indexOf(first.after) === 0 && across.indexOf(second.before) === across.length - 1 &&
          !between.some(i => interactive(i.el)) && Math.abs(first.gap - second.gap) <= 2
        if (!bracketed) {
          found.push(`${label(box)}: ${label(first.before.el)} floats between gaps of ${round(first.gap)}px and ${round(second.gap)}px`)
        }
      }
    }
  }

  // A heading and the controls in its band. The row check above compares
  // the items of one box, and the chip under Today's title was not an item
  // of the title's box: the title sat in a two-line block and the chip beside
  // the block, so the row was two items and one of them was 60px tall. What
  // the eye compares is the title and the controls level with it, whichever
  // boxes hold them - so every heading is measured against the controls in
  // the rows it belongs to, up to the first box taller than a header.
  for (const h of document.querySelectorAll('main h1, main h2, main h3')) {
    if (!(h instanceof HTMLElement)) continue
    const hr = h.getBoundingClientRect()
    if (hr.width < 1 || getComputedStyle(h).visibility === 'hidden') continue
    const hc = (hr.top + hr.bottom) / 2
    /** @type {Set<Element>} */
    const controls = new Set()
    for (let a = h.parentElement, up = 0; a && up < 5; a = a.parentElement, up++) {
      if (a.getBoundingClientRect().height > 160) break
      for (const c of a.querySelectorAll('button, select, [role="group"], .day-template')) {
        const group = c.parentElement?.closest('[role="group"]')
        if (group && a.contains(group)) continue
        if (!h.contains(c) && !c.contains(h)) controls.add(c)
      }
    }
    for (const c of controls) {
      if (!(c instanceof HTMLElement)) continue
      const cr = c.getBoundingClientRect()
      if (cr.width < 1) continue
      if (Math.min(hr.bottom, cr.bottom) - Math.max(hr.top, cr.top) < hr.height / 2) continue
      const off = (cr.top + cr.bottom) / 2 - hc
      if (Math.abs(off) > offCentre) {
        found.push(`${label(c)} sits ${round(off)}px off the centre line of the heading "${(h.textContent ?? '').trim().slice(0, 24)}"`)
      }
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
    // A laptop and a desktop monitor. The rows and the headers lay out
    // differently at the two, and the owner works at the wider one.
    for (const [theme, width, height] of /** @type {const} */ ([['dark', 1366, 820], ['light', 1366, 820], ['dark', 1920, 1080]])) {
      const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'Europe/Vilnius', locale: 'en-GB' })
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
        for (const f of await measure(page)) findings.push(`  [${theme} ${width} ${screen.name}] ${f}`)
      }
      await ctx.close()
    }
  } finally {
    await browser.close()
    await server.close()
  }
  console.log(findings.length ? `${findings.length} findings\n${findings.join('\n')}` : '0 findings: every mark is centred, every repeated row keeps its rhythm, nothing stacked is a few pixels out of line, and every row of controls has one centre line with nothing floating in it')
}

main()
