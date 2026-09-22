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
 * **A form's answers start on one edge.** From the owner's reading of the
 * week editor's add form: the category dots, the library list and the day
 * switches under three labels stood at three different edges, and the owner
 * asked that every start corner line up with another start corner.
 *
 * **A quiet word at a row's end stands on the row's edge.** A button with no
 * ground is its word to the eye, so at either end of a row the word, not the
 * box, stands on the edge. From the owner's reading of the Library: the
 * list's Edit ended 12px short of the Save over it.
 *
 * **Every page is framed one way.** Measured across the pages rather than on
 * one, empty and full: every page's title drawn alike and standing at one
 * height, and no page's name or action moving when its first thing arrives.
 * And since one look's stage 3, the owner's rule 7 - "going from Templates to
 * Kitchen to the day nothing jumps": every page's title starts at one left,
 * and every page's action ends at one right, on a laptop, a desktop and a
 * 375px phone.
 * From the owner going through the pages as somebody new to them - an empty
 * North's name was a caption with its button under its line, and an empty
 * Kitchen stood 160px right of where it stands with a recipe in it.
 *
 * Reports differences rather than absolutes wherever it can, for the reason
 * written at the top of text-scale-check.mjs: a pass that has not been made
 * to fail is not a pass yet. Every check below was confirmed against its own
 * defect before that defect was fixed.
 *
 * `npm run precision`
 */
import { readFileSync } from 'node:fs'
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
/** v2.33's Templates as JSON, filled: two invented kinds, a roster with a date nobody's kind. */
const TEMPLATE_JSON = JSON.stringify({ templates: [{ name: 'Early', kind: 'E', blocks: [{ time: '06:00', title: 'Start', minutes: 60 }] }, { name: 'Late', kind: 'L', blocks: [{ time: '01:00', title: 'Last hour', minutes: 60, afterMidnight: true }] }], roster: { '2030-01-07': 'E', '2030-01-08': 'X' } }, null, 2)
/** Kitchen v2.32's Paste many, filled: two generic recipes and a piece with no name. */
const PASTED = ['NAME: Lunch: A bean bowl', '520 kcal, 38 g protein', 'INGREDIENTS', 'beans', 'rice', 'STEPS', 'Cook the rice.', 'NAME: A plain porridge', '380 kcal', '---', '450 kcal', 'INGREDIENTS', 'water'].join('\n')

/** @type {{ name: string, go: (p: Page) => Promise<unknown> }[]} */
const SCREENS = [
  { name: 'Today', go: p => tab(p, 'Today') },
  { name: 'Calendar month', go: async p => { await tab(p, 'Calendar'); await p.getByRole('button', { name: 'Month', exact: true }).click() } },
  { name: 'Calendar week', go: async p => { await tab(p, 'Calendar'); await p.getByRole('button', { name: 'Week', exact: true }).click() } },
  { name: 'Templates', go: p => tab(p, 'Templates') },
  { name: 'Templates (a day)', go: async p => { await tab(p, 'Templates'); await p.getByRole('button', { name: /^Edit Working day/ }).first().click() } },
  { name: 'Templates (a week)', go: async p => { await tab(p, 'Templates'); await p.getByRole('button', { name: 'New template' }).click(); await p.getByRole('button', { name: /^A week/ }).click() } },
  { name: 'Calendar (the roster)', go: async p => { await tab(p, 'Templates'); await p.getByRole('button', { name: /^Edit Working day/ }).first().click(); await p.getByRole('textbox', { name: 'Letter on the roster' }).fill('D'); await p.getByRole('button', { name: 'Save template' }).click(); await tab(p, 'Calendar'); await p.getByRole('button', { name: 'Roster', exact: true }).click() } },
  { name: 'Calendar (a cycle)', go: async p => { await tab(p, 'Templates'); await p.getByRole('button', { name: /^Edit Working day/ }).first().click(); await p.getByRole('textbox', { name: 'Letter on the roster' }).fill('D'); await p.getByRole('button', { name: 'Save template' }).click(); await tab(p, 'Calendar'); await p.getByRole('button', { name: 'Roster', exact: true }).click(); await p.getByRole('button', { name: 'Cycle', exact: true }).click() } },
  { name: 'Calendar (what Apply will do)', go: async p => { await tab(p, 'Templates'); await p.getByRole('button', { name: /^Edit Working day/ }).first().click(); await p.getByRole('textbox', { name: 'Letter on the roster' }).fill('D'); await p.getByRole('button', { name: 'Save template' }).click(); await tab(p, 'Calendar'); await p.getByRole('button', { name: 'Roster', exact: true }).click(); const cells = await p.locator('.cell:not(.outside)').all(); for (const cell of cells.slice(20, 23)) await cell.click(); await p.getByRole('button', { name: 'Apply', exact: true }).click() } },
  { name: 'Templates (a routine)', go: async p => { await tab(p, 'Templates'); await p.getByRole('button', { name: /^Edit Working day/ }).first().click(); await p.getByRole('textbox', { name: 'Letter on the roster' }).fill('D'); await p.getByRole('button', { name: 'Save template' }).click(); await p.getByRole('button', { name: 'New routine' }).click() } },
  { name: 'Library', go: p => tab(p, 'Library') },
  { name: 'Library (a new list)', go: async p => { await tab(p, 'Library'); await p.getByRole('button', { name: 'New list' }).click() } },
  { name: 'Library (an item)', go: async p => { await tab(p, 'Library'); await p.locator('.library-item-open').first().click() } },
  { name: 'Library (a list edited)', go: async p => { await tab(p, 'Library'); await p.locator('.library-list-edit').first().click() } },
  { name: 'Library (to a template)', go: async p => { await tab(p, 'Library'); await p.locator('.library-item-open').first().click(); await p.getByRole('button', { name: 'Add to template', exact: true }).click() } },
  { name: "Today (a task's details)", go: async p => { await tab(p, 'Today'); await p.locator('[aria-label^="More actions for"]').first().click(); await p.getByRole('button', { name: 'Details', exact: true }).click() } },
  { name: 'Review', go: p => tab(p, 'Review') },
  { name: 'North', go: p => tab(p, 'North') },
  { name: 'Kitchen', go: p => tab(p, 'Kitchen') },
  { name: 'Kitchen (paste many)', go: async p => { await tab(p, 'Kitchen'); await p.getByRole('button', { name: 'Paste many', exact: true }).click(); await p.getByRole('textbox', { name: 'Recipes' }).fill(PASTED) } },
  { name: "Kitchen (a card's meals)", go: async p => { await tab(p, 'Kitchen'); await p.getByRole('button', { name: /^Meals for Overnight oats/ }).first().click() } },
  { name: 'Kitchen (select)', go: async p => { await tab(p, 'Kitchen'); await p.getByRole('button', { name: 'Select', exact: true }).click(); await p.locator('.kitchen-card-open').nth(0).click(); await p.locator('.kitchen-card-open').nth(1).click() } },
  { name: 'Kitchen (a recipe)', go: async p => { await tab(p, 'Kitchen'); await p.getByRole('button', { name: /Overnight oats/ }).first().click() } },
  { name: 'Kitchen (writing)', go: async p => { await tab(p, 'Kitchen'); await p.getByRole('button', { name: /Overnight oats/ }).first().click(); await p.getByRole('button', { name: 'Edit', exact: true }).click() } },
  { name: 'Kitchen (to a template)', go: async p => { await tab(p, 'Kitchen'); await p.getByRole('button', { name: /Overnight oats/ }).first().click(); await p.getByRole('button', { name: 'Add to template', exact: true }).click() } },
  { name: "Templates (a meal's recipes)", go: async p => { await tab(p, 'Templates'); await p.getByRole('button', { name: /^Edit Working day/ }).first().click(); await p.getByRole('button', { name: /^Recipes for Lunch: / }).first().click(); await p.getByRole('button', { name: 'Overnight oats', exact: true }).first().click() } },
  { name: 'Settings', go: p => tab(p, 'Settings') },
  { name: 'Settings (templates as JSON)', go: async p => { await tab(p, 'Settings'); await p.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(TEMPLATE_JSON); await p.getByRole('button', { name: 'Preview', exact: true }).click() } },
  // The morning after a night shift, rotating shifts stage 9: the shift's
  // last hours at the top of the day's grid and of the week's column. The
  // shift stays on yesterday for every screen after these.
  { name: 'Today (after a night shift)', go: async p => { await nightShiftYesterday(p); await tab(p, 'Today') } },
  { name: 'Calendar week (after a night shift)', go: async p => { await nightShiftYesterday(p); await tab(p, 'Calendar'); await p.getByRole('button', { name: 'Week', exact: true }).click() } },
  { name: 'Templates (a night shift)', go: async p => { await nightShiftYesterday(p); await tab(p, 'Templates'); await p.getByRole('button', { name: 'Edit Night shift' }).click() } },
  // The owner's own case: nothing in the library yet, so the list's answer is
  // the worded New list rather than a select. Last, because it empties the
  // demo's library for every screen after it in the same context.
  { name: 'Templates (a week, no lists)', go: async p => { await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('dienius:demo') ?? '{}'); d.library = []; for (const t of d.templates ?? []) for (const b of t.blocks ?? []) delete b.libraryListId; localStorage.setItem('dienius:demo', JSON.stringify(d)) }); await p.reload(); await p.waitForSelector('nav'); await tab(p, 'Templates'); await p.getByRole('button', { name: 'New template' }).click(); await p.getByRole('button', { name: /^A week/ }).click() } },
]

/** @param {Page} p @param {string} name */
const tab = (p, name) => p.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

/**
 * Last night's shift on yesterday - 22:00 for eight hours, in the plan the page
 * holds - and the page opened again, so the morning after draws its
 * continuation. Rotating shifts, stage 9.
 *
 * @param {import('@playwright/test').Page} page
 */
async function nightShiftYesterday(page) {
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('dienius:demo') ?? '{}')
    const now = new Date()
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const date = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    // A night shift's template with its meal at one on the next day - the
    // night's own hours, section 10 of RESEARCH-SHIFTS - stamped on yesterday.
    d.templates = d.templates ?? []
    if (!d.templates.some((/** @type {{ id: string }} */ x) => x.id === 'sweep-night')) {
      d.templates.push({
        id: 'sweep-night',
        name: 'Night shift',
        color: '#c9b3f0',
        type: 'night',
        dayKind: { letter: 'N', order: 9 },
        blocks: [
          { id: 'shift', time: '22:00', title: 'Night shift', minutes: 480, category: 'core' },
          { id: 'meal', time: '01:00', title: 'Night meal', minutes: 30, category: 'meal', afterMidnight: true },
        ],
      })
    }
    const day = d.days[date] ?? { date, tasks: [] }
    day.templateId = 'sweep-night'
    if (!day.tasks.some((/** @type {{ id: string }} */ x) => x.id === 'night-shift')) {
      day.tasks.push({ id: 'night-shift', title: 'Night shift', time: '22:00', minutes: 480, done: false, category: 'core' })
    }
    d.days[date] = day
    const morning = d.days[today] ?? { date: today, tasks: [] }
    if (!morning.tasks.some((/** @type {{ id: string }} */ x) => x.id === 'night-meal')) {
      morning.tasks.push({
        id: 'night-meal',
        title: 'Night meal',
        time: '01:00',
        minutes: 30,
        done: false,
        category: 'meal',
        fromTemplate: true,
        nightOf: date,
        origin: { type: 'template', sourceId: 'sweep-night', blockId: 'meal' },
      })
    }
    d.days[today] = morning
    localStorage.setItem('dienius:demo', JSON.stringify(d))
    // A focus session or a timer an earlier screen left running stands its
    // bar over the page on every screen after it; this one is the morning
    // after a night shift and nothing else.
    localStorage.removeItem('dienius:clock-tools')
  })
  await page.reload()
  await page.waitForSelector('nav')
}


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
  const ownText = (/** @type {Element} */ el) => [...el.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim() !== '')
  const clear = (/** @type {string} */ c) => c === 'transparent' || /,\s*0\)$/.test(c)
  /** Whether an element puts anything on the screen of its own. */
  const drawn = (/** @type {Element} */ el) => {
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.display === 'contents') return false
    if (el.matches('button, input, select, textarea, img, svg, [role="button"]')) return true
    if (ownText(el)) return true
    if (cs.backgroundImage !== 'none' || !clear(cs.backgroundColor)) return true
    return ['top', 'right', 'bottom', 'left'].some(s => parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0 && cs.getPropertyValue(`border-${s}-style`) !== 'none')
  }
  /** Whether anything in an element's box is drawn: an empty box has no centre to keep. */
  const inked = (/** @type {Element} */ el) => drawn(el) || [...el.querySelectorAll('*')].some(drawn)
  for (const box of document.querySelectorAll('main *, .app-header *')) {
    if (!(box instanceof HTMLElement)) continue
    const cs = getComputedStyle(box)
    const flexRow = (cs.display === 'flex' || cs.display === 'inline-flex') && !cs.flexDirection.startsWith('column')
    const grid = cs.display === 'grid' || cs.display === 'inline-grid'
    if (!flexRow && !grid) continue
    if (cs.alignItems === 'baseline' || cs.alignItems.includes('baseline')) continue
    // Only what is drawn. The week editor's seven column feet are one grid
    // row, top-aligned, and six of them are empty: a box with nothing in it
    // has no centre line to be off.
    let items = itemsOf(box).filter(inked).map(el => ({ el, r: el.getBoundingClientRect() }))
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

  // ---- a form's answers start on one edge -------------------------------
  //
  // The sixth check, written from the owner's reading of the week editor's
  // add form: Category, Library list and Add to hung their answers off three
  // edges - the dots at 382, the list at 362 and the days at 378 - because
  // "Library list" was the one label without the column's width, and the dots
  // stood a ring's width in from the day switches under them. In the owner's
  // words, every start corner lines up with another start corner.
  //
  // A label is anything drawn in the field label's register, read off a
  // .field-label put on the page for the purpose, so a density or a theme
  // moves both sides at once. A labelled row is a label with something level
  // with it on its right, in whichever flex or grid box they share, up to
  // three wrappers out: a label inside an Explain is still the row's label.
  // Where an answer starts is where the first thing drawn in it starts, not
  // its box - padding is invisible, and a dot's edge is not. Rows whose labels
  // share a left edge and stand one under the other on one surface are one
  // form, and their answers start on one edge, or, for a column of controls
  // set against the right, end on one.
  const probe = document.createElement('span')
  probe.className = 'field-label'
  probe.textContent = 'Label'
  ;(document.querySelector('main') ?? document.body).appendChild(probe)
  const reg = getComputedStyle(probe)
  const register = [reg.fontSize, reg.fontWeight, reg.color].join('|')
  probe.remove()
  const inRegister = (/** @type {Element} */ el) => {
    const cs = getComputedStyle(el)
    return [cs.fontSize, cs.fontWeight, cs.color].join('|') === register
  }
  /** The nearest thing behind an element that is a surface - a card, a panel. */
  const surfaceOf = (/** @type {Element} */ el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (a.tagName === 'MAIN' || !clear(cs.backgroundColor) || cs.boxShadow !== 'none' || cs.backgroundImage !== 'none') return a
    }
    return null
  }
  /** @type {{ label: HTMLElement, lr: DOMRect, left: number, right: number, surface: Element | null }[]} */
  const answered = []
  for (const el of document.querySelectorAll('main *')) {
    if (!(el instanceof HTMLElement) || !ownText(el) || !inRegister(el)) continue
    if (el.closest('button, [role="button"], option, select')) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const lr = el.getBoundingClientRect()
    if (lr.width < 1 || lr.height < 1) continue
    const centre = (lr.top + lr.bottom) / 2
    /** @type {HTMLElement | null} */
    let answer = null
    /** @type {HTMLElement} */
    let item = el
    for (let up = 0; up < 3 && item.parentElement && !answer; up++) {
      const box = item.parentElement
      const bcs = getComputedStyle(box)
      const rowBox = ((bcs.display === 'flex' || bcs.display === 'inline-flex') && !bcs.flexDirection.startsWith('column')) || bcs.display === 'grid' || bcs.display === 'inline-grid'
      if (rowBox) {
        const next = itemsOf(box)
          .filter(o => o !== item && !o.contains(el))
          .map(o => ({ o, r: o.getBoundingClientRect() }))
          .filter(({ r }) => r.left >= lr.right - 1 && r.top <= centre && r.bottom >= centre)
          .sort((a, b) => a.r.left - b.r.left)[0]
        if (next) answer = next.o
      }
      item = box
    }
    if (!answer) continue
    // What is drawn in the answer and stands level with the label. Another
    // label there means two stacked fields side by side, not a labelled row.
    let left = Infinity, right = -Infinity, another = false
    for (const part of [answer, ...answer.querySelectorAll('*')]) {
      if (!drawn(part)) continue
      const r = part.getBoundingClientRect()
      if (r.width < 1 || r.height < 1 || r.top > centre || r.bottom < centre) continue
      if (ownText(part) && inRegister(part)) another = true
      left = Math.min(left, r.left)
      right = Math.max(right, r.right)
    }
    if (another || !Number.isFinite(left)) continue
    answered.push({ label: el, lr, left, right, surface: surfaceOf(el) })
  }
  answered.sort((a, b) => a.lr.top - b.lr.top)
  const said = (/** @type {HTMLElement} */ e) => (e.textContent ?? '').trim().slice(0, 24)
  for (let i = 0; i < answered.length; i++) {
    const a = answered[i]
    const b = answered.slice(i + 1).find(o => o.lr.top >= a.lr.bottom - 1 && Math.abs(o.lr.left - a.lr.left) <= 0.5 && o.surface === a.surface)
    if (!b || b.lr.top - a.lr.bottom > 160) continue
    if (Math.abs(a.left - b.left) > 1 && Math.abs(a.right - b.right) > 1) {
      found.push(`the answers to "${said(a.label)}" and "${said(b.label)}" under it start ${round(Math.abs(a.left - b.left))}px apart (${round(a.left)} and ${round(b.left)})`)
    }
  }

  // ---- a quiet word at a row's end stands on the row's edge ---------------
  //
  // The seventh check, written from the owner's reading of the Library: the
  // list's Edit ended 12px short of the Save over it, because a quiet button
  // stood its box on the card's edge and its word its padding in from it. A
  // button with no ground is its word to the eye, so at the start or the end
  // of a row the word stands on the edge and the padding goes outside - the
  // ground under the pointer reaching past, the way North's Edit and
  // Kitchen's Back already stood. The first run of this found four more:
  // every template's Edit, and the Delete at the start of three forms' last
  // rows. A word is two letters or more: a cross or an arrow is a mark in a
  // square target, and the square is what stands on the edge.
  for (const btn of document.querySelectorAll('main button, main [role="button"]')) {
    if (!(btn instanceof HTMLElement)) continue
    const cs = getComputedStyle(btn)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const words = (btn.textContent ?? '').trim()
    if (!/[A-Za-z]{2}/.test(words)) continue
    const edged = ['top', 'right', 'bottom', 'left'].some(s => parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0 && cs.getPropertyValue(`border-${s}-style`) !== 'none' && !clear(cs.getPropertyValue(`border-${s}-color`)))
    if (edged || !clear(cs.backgroundColor) || cs.backgroundImage !== 'none') continue
    // A segment, a chip in a group or a tab is one of a set, spaced by the set.
    if (btn.closest('.segmented, [role="group"], [role="tablist"], nav')) continue
    const row = btn.parentElement
    if (!row) continue
    const rcs = getComputedStyle(row)
    if (!((rcs.display === 'flex' || rcs.display === 'inline-flex') && !rcs.flexDirection.startsWith('column')) && rcs.display !== 'grid') continue
    const kids = itemsOf(row)
    if (kids.length < 2) continue
    const rr = row.getBoundingClientRect()
    const start = rr.left + parseFloat(rcs.paddingLeft) + parseFloat(rcs.borderLeftWidth)
    const end = rr.right - parseFloat(rcs.paddingRight) - parseFloat(rcs.borderRightWidth)
    // And the row's end is an edge only where the row reaches its column's:
    // a group of buttons wrapped round its own two, standing at the right of
    // a form, starts where its first button does, which is no edge at all.
    const column = row.parentElement
    const ccs = column ? getComputedStyle(column) : null
    const cr = column?.getBoundingClientRect()
    const reachesStart = !!(cr && ccs && Math.abs(rr.left - (cr.left + parseFloat(ccs.paddingLeft) + parseFloat(ccs.borderLeftWidth))) <= 1)
    const reachesEnd = !!(cr && ccs && Math.abs(rr.right - (cr.right - parseFloat(ccs.paddingRight) - parseFloat(ccs.borderRightWidth))) <= 1)
    const b = btn.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(btn)
    const w = range.getBoundingClientRect()
    if (reachesEnd && kids.at(-1) === btn && Math.abs(b.right - end) <= 1 && w.right < end - 2) {
      found.push(`${label(btn)} at the end of ${label(row)} stands its word ${round(end - w.right)}px in from the row's edge`)
    }
    if (reachesStart && kids[0] === btn && Math.abs(b.left - start) <= 1 && w.left > start + 2) {
      found.push(`${label(btn)} at the start of ${label(row)} stands its word ${round(w.left - start)}px in from the row's edge`)
    }
  }

  return [...new Set(found)]
}, /** @type {[number, number, number[]]} */ ([OFF_CENTRE_PX, RHYTHM_PX, NEAR_MISS_PX]))

/**
 * `--frame` runs the frame alone - the pass across pages - which is what
 * somebody changing a page's title row wants back in a minute, not three.
 */
const FRAME_ONLY = process.argv.includes('--frame')

/** The pages the rail opens, in its order. */
const VIEWS = ['Today', 'Calendar', 'Templates', 'Library', 'Review', 'North', 'Kitchen', 'Settings']

/**
 * Every page's frame - its title and its action - as a first visit sees it
 * and as a full plan does. The full plan is the sample one the pictures use,
 * written under the real key, rather than the demo: the demo's banner stands
 * over every page and would put every title of a full plan 41px lower.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {number} width
 * @param {number} height
 * @returns {Promise<string[]>}
 */
async function frames(browser, width, height) {
  const phone = width < 600
  const seed = readFileSync(resolve('scripts/sample-day.js'), 'utf8')
  /** @param {boolean} full */
  const read = async full => {
    // Dark on both sides: a first visit follows the system's scheme, and the
    // sample plan carries the dark theme.
    const ctx = await browser.newContext({
      viewport: { width, height },
      timezoneId: 'Europe/Vilnius',
      locale: 'en-GB',
      colorScheme: 'dark',
      // A phone is a finger's: the touch sizes and the bar along the bottom.
      ...(phone ? { hasTouch: true, isMobile: true } : {}),
    })
    await ctx.clock.setFixedTime(FIXED)
    const page = await ctx.newPage()
    await page.goto(BASE)
    if (full) {
      await page.evaluate(s => { eval(`(${s})`)({}) }, seed)
      await page.reload()
    }
    await page.waitForSelector('nav')
    /** @type {Record<string, { left: number, centre: number, look: string, action: number | null } | null>} */
    const out = {}
    for (const name of VIEWS) {
      await tab(page, name)
      await page.waitForTimeout(300)
      out[name] = await page.evaluate(() => {
        const h = document.querySelector('main h2')
        if (!(h instanceof HTMLElement)) return null
        // The words' own box, not the heading's: a heading stretched across
        // its row, or one control tall, has its words somewhere inside it.
        const range = document.createRange()
        range.selectNodeContents(h)
        const r = range.getBoundingClientRect()
        const cs = getComputedStyle(h)
        // The page's action: the last button in the title's row, by where its
        // ink ends - a quiet button's word, a filled button's ground, and a
        // segment's track, which is where a segmented control's ink ends. A
        // title with no row of its own - Settings' stands alone in its page -
        // has no action.
        const row = h.parentElement
        const rcs = row ? getComputedStyle(row) : null
        const isRow = !!row && !!rcs && row.tagName !== 'SECTION' && row.tagName !== 'MAIN' && ((rcs.display.includes('flex') && !rcs.flexDirection.startsWith('column')) || rcs.display.includes('grid'))
        const buttons = isRow ? [...row.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width > 0 && !h.contains(b)) : []
        const last = buttons.at(-1)
        let action = null
        if (last) {
          const track = last.closest('.segmented, [role="group"]')
          const inked = (/** @type {Element} */ el) => {
            const bg = getComputedStyle(el).backgroundColor
            return !(bg === 'transparent' || /,\s*0\)$/.test(bg))
          }
          if (track && row && row.contains(track) && inked(track)) action = track.getBoundingClientRect().right
          else if (!inked(last)) {
            const words = document.createRange()
            words.selectNodeContents(last)
            action = words.getBoundingClientRect().right
          } else action = last.getBoundingClientRect().right
        }
        return { left: r.left, centre: (r.top + r.bottom) / 2, look: `${cs.fontSize} ${cs.fontWeight} ${cs.color}`, action }
      })
    }
    await ctx.close()
    return out
  }
  const empty = await read(false)
  const full = await read(true)
  /** @type {string[]} */
  const found = []
  const round = (/** @type {number} */ n) => Math.round(n * 10) / 10
  // North over its words is the one title drawn quieter, asked for - see
  // docs/DESIGN.md, the frame. Every other title, empty or full, is one.
  const titles = [
    ...VIEWS.map(v => ({ where: `${v} on a first visit`, t: empty[v] })),
    ...VIEWS.filter(v => v !== 'North').map(v => ({ where: `${v} with a plan`, t: full[v] })),
  ].filter(x => x.t)
  const looks = titles.map(x => /** @type {NonNullable<typeof x.t>} */ (x.t).look)
  const usual = looks.sort((a, b) => looks.filter(l => l === b).length - looks.filter(l => l === a).length)[0]
  const centres = titles.map(x => /** @type {NonNullable<typeof x.t>} */ (x.t).centre).sort((a, b) => a - b)
  const middle = centres[Math.floor(centres.length / 2)]
  for (const { where, t } of titles) {
    if (!t) continue
    if (t.look !== usual) found.push(`the title of ${where} is drawn ${t.look}, where every other page's is ${usual}`)
    if (Math.abs(t.centre - middle) > 1) found.push(`the title of ${where} stands ${round(t.centre - middle)}px off the height every other page's stands at`)
  }
  for (const v of VIEWS) {
    const a = empty[v], b = full[v]
    if (!a || !b) { if (a || b) found.push(`${v} has a title only ${a ? 'on a first visit' : 'with a plan'}`); continue }
    if (Math.abs(a.left - b.left) > 1) found.push(`${v}'s title moves ${round(b.left - a.left)}px when its first thing arrives`)
    if (a.action !== null && b.action !== null && Math.abs(a.action - b.action) > 1) found.push(`${v}'s action moves ${round(b.action - a.action)}px when its first thing arrives`)
  }
  // One look, rule 7: from one page to the next the title and the action
  // stand still. The place most pages have is the place; a page elsewhere is
  // named with how far off it stands.
  const most = (/** @type {number[]} */ xs) => {
    const counts = new Map()
    for (const x of xs) counts.set(Math.round(x), (counts.get(Math.round(x)) ?? 0) + 1)
    return [...counts].sort((p, q) => q[1] - p[1])[0]?.[0]
  }
  const withPlan = VIEWS.map(v => ({ v, t: full[v] })).filter(x => x.t)
  const lefts = withPlan.map(x => /** @type {NonNullable<typeof x.t>} */ (x.t).left)
  const left = most(lefts)
  for (const { v, t } of withPlan) {
    if (t && left !== undefined && Math.abs(t.left - left) > 1) found.push(`${v}'s title starts at ${round(t.left)}, where every other page's starts at ${left} - it moves when a page is changed`)
  }
  const acted = withPlan.filter(x => x.t && x.t.action !== null)
  const right = most(acted.map(x => /** @type {number} */ (/** @type {NonNullable<typeof x.t>} */ (x.t).action)))
  for (const { v, t } of acted) {
    if (t && t.action !== null && right !== undefined && Math.abs(t.action - right) > 1) found.push(`${v}'s action ends at ${round(t.action)}, where every other page's ends at ${right}`)
  }
  return found
}

async function main() {
  const server = await createServer({ configFile: resolve('vite.config.ts'), server: { port: PORT, strictPort: true }, logLevel: 'error' })
  await server.listen()
  const browser = await chromium.launch()
  /** @type {string[]} */
  const findings = []
  try {
    for (const [width, height] of /** @type {const} */ ([[1366, 820], [1920, 1080], [375, 812]])) {
      for (const f of await frames(browser, width, height)) findings.push(`  [${width} the frame] ${f}`)
    }
    // A laptop and a desktop monitor. The rows and the headers lay out
    // differently at the two, and the owner works at the wider one.
    const passes = /** @type {const} */ ([['dark', 1366, 820], ['light', 1366, 820], ['dark', 1920, 1080]])
    for (const [theme, width, height] of FRAME_ONLY ? [] : passes) {
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
  console.log(findings.length ? `${findings.length} findings\n${findings.join('\n')}` : '0 findings: every mark is centred, every repeated row keeps its rhythm, nothing stacked is a few pixels out of line, every row of controls has one centre line with nothing floating in it, every form hangs its answers off one edge, every quiet word at either end of a row stands on its edge, and every page is framed one way')
}

main()
