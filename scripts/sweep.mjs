/**
 * `npm run sweep` - every screen, measured.
 *
 * The test suite cannot see layout and a screenshot cannot be asserted on,
 * which leaves a gap this walks: a real browser opens every screen at every
 * size the project promises, on a realistic full day, and `audit.js` reports
 * what a person would actually hit - text cut off, a control with something
 * on top of it, two pieces of text painted over each other, anything past
 * the right edge, a screen that should fit and does not, and every visible
 * string's contrast against whatever is actually painted under it.
 *
 * It found fourteen defects the first time it ran, including a task list
 * squeezed to zero pixels with seven tasks in it. Zero findings is the
 * expected state; anything else is a wave's worth of work.
 *
 *   npm run sweep                  three desktop sizes, both themes
 *   npm run sweep -- --phone       390x844 as well, with the 44px audit
 *   npm run sweep -- --heavy       twenty tasks, thirty backlog, fifteen books
 *   npm run sweep -- --only=Today  one screen, while working on it
 *   npm run sweep -- --self-check  plant defects and prove the audit sees them
 *
 * Needs the production build served: `npm run build && npm run preview`, or
 * pass PORT for a server already up.
 */
import { chromium, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT ?? '4173'
const BASE = `http://localhost:${PORT}/dienius/`
const HEAVY = process.argv.includes('--heavy')
const PHONE = process.argv.includes('--phone')
const SELF_CHECK = process.argv.includes('--self-check')
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7)

const SEED = readFileSync(join(here, 'sample-day.js'), 'utf8')
const AUDIT = readFileSync(join(here, 'audit.js'), 'utf8')

/** The sizes the project promises, plus the phone when asked for. */
const DESKTOP = [
  { w: 1920, h: 1080 },
  { w: 1600, h: 900 },
  { w: 1366, h: 768 },
]

/**
 * Controls allowed under 44px on a coarse pointer, each for a reason
 * written down in STATE.md's debt table. Anything else is a finding.
 */
const SMALL_ON_PURPOSE = ['week-block', 'year-cell', 'link-button']

/** @param {Page} page @param {string} name */
async function tab(page, name) {
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()
  // Park the pointer away from the rail before anything is measured. The rail
  // opens under a resting mouse and draws its labels over the left of the
  // page, which is a flyout doing its job and not a state any screen is ever
  // found in - leaving the cursor on it reported nine covered mini-calendar
  // cells and then hung the next click on a point the flyout was over.
  const size = page.viewportSize() ?? { width: 1200, height: 800 }
  await page.mouse.move(size.width / 2, size.height / 2)
  await page.waitForTimeout(350)
}

/** @param {Page} page @param {string|RegExp} name */
async function press(page, name) {
  // A regular expression is matched loosely on purpose: some of these
  // controls carry a sentence beside their label (the kind question's two
  // cards do), and an exact match on those is a match on the sentence too.
  const b = typeof name === 'string'
    ? page.getByRole('button', { name, exact: true }).first()
    : page.getByRole('button', { name }).first()
  if (await b.count()) await b.click().catch(() => {})
  await page.waitForTimeout(350)
}

/** @typedef {import('@playwright/test').Page} Page */
/** What scripts/audit.js puts on the page's own window. */
/** @typedef {{ hScroll: number, vScroll: number, clipped: any[], covered: any[], overlap: any[], offscreen: any[], faint: any[] }} Audit */
/** @typedef {Window & { __audit: (label: string) => Audit, __brief: (label: string) => Record<string, number> }} AuditWindow */
/** @typedef {{ name: string, go: (page: Page) => Promise<unknown> }} Screen */

/** One screen: how to get to it, and what it is called in the report. */
/** @type {Screen[]} */
const SCREENS = [
  { name: 'Today', go: /** @param {Page} p */ p => tab(p, 'Today') },
  {
    name: 'Today (notice dismissed)',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      const c = p.getByRole('button', { name: /Not tonight|Later|Close the day/ }).first()
      if (await c.count()) await c.click().catch(() => {})
      await p.waitForTimeout(300)
    },
  },
  { name: 'Calendar month', go: async /** @param {Page} p */ p => { await tab(p, 'Calendar'); await press(p, 'Month') } },
  { name: 'Calendar week', go: async /** @param {Page} p */ p => { await tab(p, 'Calendar'); await press(p, 'Week') } },
  { name: 'Calendar year', go: async /** @param {Page} p */ p => { await tab(p, 'Calendar'); await press(p, 'Year') } },
  { name: 'Templates', go: /** @param {Page} p */ p => tab(p, 'Templates') },
  {
    name: 'Template editor',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Templates')
      await press(p, /^Edit /)
    },
  },
  {
    // Seven columns of blocks is the widest thing this app draws, and it is
    // drawn inside a card inside a reading-width view - which is exactly the
    // shape that overflows quietly.
    name: 'Week template editor',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Templates')
      await press(p, 'New template')
      await press(p, /^A week/)
      const field = p.getByPlaceholder('What happens')
      if (await field.count()) {
        await field.fill('Deep work block, and a long title to push a column')
        await press(p, 'All days')
        await press(p, 'Add block')
      }
      await p.waitForTimeout(300)
    },
  },
  { name: 'Library', go: /** @param {Page} p */ p => tab(p, 'Library') },
  {
    name: 'Library (item panel)',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Library')
      const row = p.locator('.library-item.is-active .library-item-open').first()
      if (await row.count()) await row.click()
      await p.waitForTimeout(300)
    },
  },
  { name: 'Review week', go: /** @param {Page} p */ p => tab(p, 'Review') },
  { name: 'Review month', go: async /** @param {Page} p */ p => { await tab(p, 'Review'); await press(p, 'Month') } },
  { name: 'North', go: /** @param {Page} p */ p => tab(p, 'North') },
  { name: 'Settings', go: /** @param {Page} p */ p => tab(p, 'Settings') },
  {
    name: 'Task detail',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      await p.getByRole('button', { name: /^More actions for / }).first().click()
      await p.waitForTimeout(250)
      const d = p.getByRole('button', { name: /Details/ }).first()
      if (await d.count()) await d.click().catch(() => {})
      await p.waitForTimeout(400)
    },
  },
  {
    name: 'Gap offers',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      const f = p.locator('.task-list .task-title-select').first()
      if (await f.count()) await f.click().catch(() => {})
      await p.waitForTimeout(400)
    },
  },
  {
    name: 'Focus',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      const f = p.getByRole('button', { name: /^Focus/ }).first()
      if (await f.count()) await f.click().catch(() => {})
      await p.waitForTimeout(400)
    },
  },
  .../** @type {Screen[]} */ (['Something came up', 'Shift the rest', 'I was away'].map(door => ({
    name: `Replan: ${door.toLowerCase()}`,
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      await p.getByRole('button', { name: 'Replan', exact: true }).click()
      await p.waitForTimeout(250)
      const b = p.getByRole('button').filter({ hasText: door }).first()
      if (await b.count()) await b.click().catch(() => {})
      await p.waitForTimeout(400)
    },
  }))),
  {
    name: 'Command palette',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      await p.keyboard.press('Control+k')
      await p.waitForTimeout(300)
    },
  },
  {
    name: 'Scratch',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      await p.locator('.app-header').click({ position: { x: 5, y: 5 } })
      await p.keyboard.press('s')
      await p.waitForTimeout(350)
    },
  },
  {
    name: 'Shortcut card',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      await p.locator('.app-header').click({ position: { x: 5, y: 5 } })
      await p.keyboard.press('?')
      await p.waitForTimeout(300)
    },
  },
]

/** @typedef {{ size: string, theme: string, screen: string }} Where */
/** @type {{ size: string, theme: string, screen: string, kind: string, detail: string }[]} */
const findings = []
/**
 * @param {Where} where
 * @param {string} kind
 * @param {string} detail
 */
function found(where, kind, detail) {
  findings.push({ ...where, kind, detail })
}

const browser = await chromium.launch()

if (SELF_CHECK) {
  // Before trusting a clean report, prove the pass can still see a defect.
  // Four planted ones, on a real screen, in the four shapes it looks for.
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.evaluate(([s]) => eval(`(${s})`)({}), [SEED])
  await page.reload()
  await page.waitForSelector('nav')
  await page.addScriptTag({ content: AUDIT })
  const clean = await page.evaluate(() => /** @type {AuditWindow} */ (/** @type {unknown} */ (window)).__brief('before'))
  await page.evaluate(() => {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'position:fixed;left:100px;top:300px;width:600px;height:60px;background:#123456;z-index:5'
    wrap.innerHTML =
      '<span style="position:absolute;left:10px;top:10px">Planted text one</span>' +
      '<span style="position:absolute;left:14px;top:12px">Planted text two</span>' +
      '<div style="width:60px;overflow:hidden;white-space:nowrap;position:absolute;left:220px;top:10px">A sentence far too long for sixty pixels</div>' +
      '<span style="position:absolute;left:400px;top:34px;color:#123a56">Nearly invisible</span>'
    document.body.appendChild(wrap)
    const wide = document.createElement('div')
    wide.style.cssText = 'width:3000px;height:4px;background:#0f0'
    document.body.appendChild(wide)
  })
  const planted = await page.evaluate(() => /** @type {AuditWindow} */ (/** @type {unknown} */ (window)).__brief('after'))
  await browser.close()
  const sees = {
    'sideways scroll': planted.hScroll > 0,
    'text cut off': planted.clipped > clean.clipped,
    'text over text': planted.overlap > clean.overlap,
    'a control covered': planted.covered > clean.covered,
    'text under AA': planted.faint > clean.faint,
  }
  for (const [what, ok] of Object.entries(sees)) console.log(`${ok ? 'sees  ' : 'BLIND '} ${what}`)
  const blind = Object.values(sees).filter(v => !v).length
  console.log(`\n${5 - blind}/5 shapes still detected`)
  process.exit(blind ? 1 : 0)
}

const runs = [
  ...DESKTOP.flatMap(size => ['dark', 'light'].map(theme => ({ size, theme, phone: false }))),
  ...(PHONE ? ['dark', 'light'].map(theme => ({ size: { w: 390, h: 844 }, theme, phone: true })) : []),
]

for (const run of runs) {
  const ctx = await browser.newContext(
    run.phone
      ? { ...devices['iPhone 13'], isMobile: true, hasTouch: true }
      : { viewport: { width: run.size.w, height: run.size.h } },
  )
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.evaluate(([src, heavy]) => eval(`(${src})`)({ heavy }), [SEED, HEAVY])
  await page.evaluate(t => {
    const d = JSON.parse(localStorage.getItem('dienius:data') ?? '{}')
    d.settings.theme = { presetId: t, mode: t, overrides: {} }
    localStorage.setItem('dienius:data', JSON.stringify(d))
  }, run.theme)

  for (const screen of SCREENS) {
    if (ONLY && !screen.name.toLowerCase().includes(ONLY.toLowerCase())) continue
    const where = { size: `${run.size.w}x${run.size.h}`, theme: run.theme, screen: screen.name }
    try {
      // A fresh page per screen: a sheet left open by the screen before this
      // one would be measured as part of it, and a dismissal would carry.
      await page.reload()
      await page.waitForSelector('nav')
      await page.addScriptTag({ content: AUDIT })
      await screen.go(page)
    } catch (err) {
      found(where, 'could not reach', String(err).split('\n')[0].slice(0, 120))
      continue
    }

    const a = await page.evaluate(name => /** @type {AuditWindow} */ (/** @type {unknown} */ (window)).__audit(name), screen.name)
    if (a.hScroll > 0) found(where, 'scrolls sideways', `${a.hScroll}px`)
    for (const c of a.clipped) found(where, 'text cut off', `${c.sel} +${c.overX}x${c.overY} "${c.text}"`)
    for (const c of a.covered) found(where, 'control covered', `${c.sel} "${c.t}" under ${c.by}`)
    for (const o of a.overlap) found(where, 'text over text', `${o.a} "${o.ta}" over ${o.b} "${o.tb}"`)
    for (const o of a.offscreen) found(where, 'past the right edge', `${o.sel} right ${o.right} "${o.text}"`)
    for (const f of a.faint) found(where, 'text under AA', `${f.sel} ${f.ratio}:1 (needs ${f.need}) "${f.text}"`)

    // The screens that must fit - CONVENTIONS section 4. The day view's own
    // rule is for the wide breakpoint only: on a phone it scrolls
    // vertically and that is the design, not a finding.
    const mustFit = run.phone
      ? /Calendar month|Calendar week/.test(screen.name)
      : /Calendar month|Calendar week|^Today/.test(screen.name)
    if (mustFit && a.vScroll > 0) found(where, 'does not fit the window', `${a.vScroll}px of scroll`)

    // And on a phone, every control at 44px or carrying its hit area.
    if (run.phone) {
      const small = await page.evaluate(allowed =>
        [...document.querySelectorAll('button, [role="button"], input, select, textarea, a[href]')]
          .filter(el => {
            if (!(el instanceof HTMLElement) || !el.offsetParent) return false
            const r = el.getBoundingClientRect()
            if (r.height === 0 || r.height >= 44) return false
            // The real checkbox behind a drawn box is visually hidden and
            // is not the target - see .task input[type='checkbox'].
            if (el instanceof HTMLInputElement && el.type === 'checkbox') return false
            if (allowed.some(c => String(el.className).includes(c))) return false
            const after = getComputedStyle(el, '::after')
            return !(after.content !== 'none' && after.position === 'absolute')
          })
          .map(el => ({ h: Math.round(el.getBoundingClientRect().height), c: String(el.className).slice(0, 30), t: (el.textContent || el.ariaLabel || '').trim().slice(0, 24) })),
      SMALL_ON_PURPOSE)
      for (const s of small) found(where, 'under 44px on a finger', `${s.h}px ${s.c} "${s.t}"`)
    }
  }
  await ctx.close()
}

await browser.close()

/** @type {Record<string, typeof findings>} */
const byKind = {}
for (const f of findings) (byKind[f.kind] ??= []).push(f)
const label = [HEAVY && 'heavy day', PHONE && 'with the phone'].filter(Boolean).join(', ')
console.log(`${findings.length} findings${label ? ` [${label}]` : ''}\n`)
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`## ${kind} (${list.length})`)
  const seen = new Set()
  for (const f of list) {
    const key = f.screen + f.detail
    if (seen.has(key)) continue
    seen.add(key)
    console.log(`  [${f.size} ${f.theme}] ${f.screen}: ${f.detail}`)
  }
  console.log()
}
process.exitCode = findings.length ? 1 : 0
