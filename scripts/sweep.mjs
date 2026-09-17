/**
 * `npm run sweep` - every screen, measured.
 *
 * The test suite cannot see layout and a screenshot cannot be asserted on,
 * which leaves a gap this walks: a real browser opens every screen at every
 * size the project promises, on a realistic full day, and `audit.js` reports
 * what a person would actually hit - text cut off, a control with something
 * on top of it, two pieces of text painted over each other, anything past
 * the right edge, a screen that should fit and does not, every visible
 * string's contrast against whatever is actually painted under it, a chosen
 * swatch's ring cut off by a scroller or drawn on the wrong ground, and a
 * chosen control drawn exactly like the ones beside it.
 *
 * It found fourteen defects the first time it ran, including a task list
 * squeezed to zero pixels with seven tasks in it. Zero findings is the
 * expected state; anything else is a wave's worth of work.
 *
 *   npm run sweep                  three desktop sizes, both themes
 *   npm run sweep -- --phone       390x844 as well, with the 44px audit
 *   npm run sweep -- --heavy       twenty tasks, thirty-two in Later, fifteen books
 *   npm run sweep -- --only=Today  one screen, while working on it
 *   npm run sweep -- --width=1366  one desktop size, while working on it
 *   npm run sweep -- --shots=DIR   a PNG of every screen it reaches, into DIR
 *
 * The pictures are for looking at. Every hole this pass has had was found
 * by a person looking at a screenshot rather than by the pass, so the walk
 * that reaches every screen can leave one of each behind - the same seed,
 * the same minute, the same route as the measuring.
 *   npm run sweep -- --self-check  plant defects and prove the audit sees them
 *
 * Needs the production build: `npm run build`. It serves `dist` itself, or
 * pass PORT for a server already up.
 */
import { chromium, devices } from '@playwright/test'
import { preview } from 'vite'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT ?? '4173'
const BASE = `http://localhost:${PORT}/dienius/`
const HEAVY = process.argv.includes('--heavy')
const PHONE = process.argv.includes('--phone')
const SELF_CHECK = process.argv.includes('--self-check')
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7)
const WIDTH = Number(process.argv.find(a => a.startsWith('--width='))?.slice(8) ?? 0)
const SHOTS = process.argv.find(a => a.startsWith('--shots='))?.slice(8)
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

/**
 * The hour the sample day is walked at, pinned rather than taken from
 * whatever time the sweep happens to be run.
 *
 * Half of what this app draws depends on the hour: the Focus screen only
 * exists while a task is running, the now line only sits over the day if
 * the day is happening, and the replan doors grey out the parts of the day
 * that have already gone. A sweep run at night sees none of it and reports
 * clean, which it did - twice. The v2.2 phone sweeps passed at night and
 * the same build at 15:00 had the Explain bubble sitting over the running
 * card; v2.5's disabled replan chips were read off a screenshot by eye
 * because the midnight run had nothing disabled to look at.
 *
 * 15:00 is the hour that has the most of the app switched on at once: a
 * task running, a morning behind it, an evening ahead. `--hour=` walks
 * another one - worth doing at 09:00 and 22:00 once per wave, since no
 * single hour shows everything.
 */
const HOUR = Number(process.argv.find(a => a.startsWith('--hour='))?.slice(7) ?? 15)

// Wednesday 16 September 2026, Vilnius, like scripts/shots.mjs - so a
// finding here and a screenshot of it name the same minute.
const FIXED_TIME = new Date(Date.UTC(2026, 8, 16, HOUR - 3, 0))

const SEED = readFileSync(join(here, 'sample-day.js'), 'utf8')
const AUDIT = readFileSync(join(here, 'audit.js'), 'utf8')

/**
 * The sizes the project promises, plus the phone when asked for.
 *
 * 1024 is the newest and the one that had never been looked at. It is where
 * the wide layout turns on, which makes it the width at which a layout built
 * for wide screens is at its tightest - and it is an iPad in landscape, and a
 * window half a large screen across. Its three columns plus their gaps came
 * to more than the window had, twice over; both times the sum was done by
 * hand and both times it was wrong. The page scrolled sideways at exactly
 * that width and nowhere else, so nothing measuring 1366 and up could see it.
 * A breakpoint is worth measuring at the point it turns on.
 */
const DESKTOP = [
  { w: 1920, h: 1080 },
  { w: 1600, h: 900 },
  { w: 1366, h: 768 },
  { w: 1024, h: 768 },
]

/**
 * Controls allowed under 44px on a coarse pointer, each for a reason
 * written down in STATE.md's debt table. Anything else is a finding.
 */
const SMALL_ON_PURPOSE = ['week-block', 'link-button']

/** @param {Page} page @param {string} name */
async function tab(page, name) {
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()
  // Park the pointer away from the rail before anything is measured. The rail
  // opens under a mouse that moves in it and draws its labels over the left
  // of the page, which is a flyout doing its job and not a state any screen
  // is ever found in - leaving the cursor on it reported nine covered
  // mini-calendar cells and then hung the next click on a point the flyout
  // was over.
  //
  // At the top edge of the window rather than its centre, since v2.25. The
  // centre of 1366x768 is North's first heading, so the North screen measured
  // the heading's lines opened over the page, with the signature and Edit
  // faded under them - never the page at rest. A screen that means to
  // measure something under the pointer puts the pointer there itself.
  const size = page.viewportSize() ?? { width: 1200, height: 800 }
  await page.mouse.move(size.width / 2, 1)
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
/** @typedef {{ hScroll: number, vScroll: number, clipped: any[], covered: any[], overlap: any[], offscreen: any[], faint: any[], chosen: { sel: string, text: string, like: string, attr: string }[], rings: { kind: 'cut' | 'gap', sel: string, detail: string }[], offCentre: { sel: string, child: string, text: string, off: number }[], sideways: { sel: string, over: number, detail: string }[], mismatched: { sel: string, detail: string }[] }} Audit */
/** @typedef {Window & { __audit: (label: string) => Audit, __brief: (label: string) => Record<string, number> }} AuditWindow */
/** `pointerOnly`: the surface only exists where there is a pointer to rest on it, so the phone run skips it. */
/** @typedef {{ name: string, go: (page: Page) => Promise<unknown>, pointerOnly?: boolean }} Screen */

/** One screen: how to get to it, and what it is called in the report. */
/** @type {Screen[]} */
const SCREENS = [
  { name: 'Today', go: /** @param {Page} p */ p => tab(p, 'Today') },
  {
    name: 'Today (notice dismissed)',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      // Only the close's own button. The evening notice used to offer
      // "Later" as well, and since v2.7 a fold under the task list is
      // called "Later N" - a pattern that still matched it would open the
      // shelf instead of dismissing the notice, and the screen would be
      // audited with the wrong thing on it.
      const c = p.getByRole('button', { name: /Close the day/ }).first()
      if (await c.count()) await c.click().catch(() => {})
      await p.waitForTimeout(300)
    },
  },
  { name: 'Calendar month', go: async /** @param {Page} p */ p => { await tab(p, 'Calendar'); await press(p, 'Month') } },
  {
    // What a day says when a pointer rests on it. Only ever drawn on a
    // hover, so nothing else in this sweep would have seen it - and it is a
    // raised surface with four sizes of grey on it, which is exactly the
    // shape a contrast pass is for.
    name: 'Calendar month (day peek)',
    pointerOnly: true,
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Calendar')
      await press(p, 'Month')
      await p.locator('[aria-current="date"]').hover()
      await p.waitForSelector('.day-peek')
      // Past its own fade, like every other surface here: measured mid-
      // animation the layer is still part-transparent, and what the pass
      // then reads is the month showing through its own text.
      await p.waitForTimeout(300)
    },
  },
  { name: 'Calendar week', go: async /** @param {Page} p */ p => { await tab(p, 'Calendar'); await press(p, 'Week') } },
  { name: 'Templates', go: /** @param {Page} p */ p => tab(p, 'Templates') },
  {
    name: 'Template editor',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Templates')
      await press(p, /^Edit /)
    },
  },
  {
    // The template's colour popover: eight swatches on a raised panel.
    name: 'Template colour',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Templates')
      await press(p, /^Edit /)
      await press(p, /Change it[.]$/)
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
        await press(p, 'Add a block')
      }
      await p.waitForTimeout(300)
    },
  },
  {
    // And the panel that opens on one of those blocks - a header carrying
    // three controls of three shapes, a note editor and a where-to row.
    // The sweep opened the grid and never a block on it, which is how the
    // owner's own screenshot found a Close eleven pixels above the buttons
    // beside it before any measuring pass did.
    name: 'Week template editor (block open)',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Templates')
      await press(p, 'New template')
      await press(p, /^A week/)
      const field = p.getByPlaceholder('What happens')
      if (await field.count()) {
        await field.fill('Breakfast')
        await press(p, 'All days')
        await press(p, 'Add a block')
      }
      // A block added with no time is drawn on the untimed strip and named
      // "Breakfast, no time, on Mon. Open it." rather than "Breakfast at ..."
      await press(p, /^Breakfast[,.]/)
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
  {
    // A list's settings, for the row of colour dots and the chosen one's
    // ring on the wash they sit on.
    name: 'Library (list settings)',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Library')
      await press(p, /^Settings for /)
    },
  },
  { name: 'Review week', go: /** @param {Page} p */ p => tab(p, 'Review') },
  { name: 'Review month', go: async /** @param {Page} p */ p => { await tab(p, 'Review'); await press(p, 'Month') } },
  {
    // North on the day with a heading's card out: in the rail on a desktop,
    // a press showing its lines on a card beside it; on the phone, the
    // folded line under the day's top pressed first and the card under the
    // heading. The card is painted only then.
    name: 'Today (North open)',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      const line = p.locator('button.north-day-line')
      if (await line.count()) await line.first().click()
      await p.locator('.north-day button.north-day-heading').first().click()
      await p.waitForTimeout(300)
    },
  },
  // The page, read: since v2.26 every heading's lines are on it at rest, so
  // this one screen measures all of them - the scene that rested a pointer
  // on a heading to paint its lines went with the fold.
  { name: 'North', go: /** @param {Page} p */ p => tab(p, 'North') },
  {
    // The app coming into view after sleep, when the text has an
    // introduction: the window over the day. The device remembers when the
    // app was last in view and when the window was last shown, so both are
    // set back six hours and the page opened again.
    name: 'Today (North after sleep)',
    go: async /** @param {Page} p */ p => {
      // Written after the app's own pagehide, which records the moment the
      // page leaves view and would otherwise make the reload no break at all.
      await p.evaluate(() => {
        window.addEventListener('pagehide', () => {
          localStorage.setItem('dienius:north-seen', String(Date.now() - 6 * 60 * 60 * 1000))
          localStorage.removeItem('dienius:north-window')
        })
      })
      await p.reload()
      await p.waitForSelector('nav')
      // A reload of its own throws away the audit the walk had just added.
      await p.addScriptTag({ content: AUDIT })
      await p.waitForTimeout(300)
    },
  },
  {
    // The text's field, open on the sample's text: the drawing under the
    // field, the heading lines and the signature's mark drawn heavier, and
    // the grey line over it saying both rules.
    name: 'North (writing)',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'North')
      await press(p, 'Edit')
      await p.waitForSelector('.north-editor-field')
      await p.waitForTimeout(300)
    },
  },
  // Kitchen's list, and a meal chosen - the chips wrap on a phone, and the
  // pressed one is the only chip with a ground of its own.
  { name: 'Kitchen', go: /** @param {Page} p */ p => tab(p, 'Kitchen') },
  {
    name: 'Kitchen (a meal chosen)',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Kitchen')
      await press(p, 'Snack')
    },
  },
  // A recipe's page - its lines, the ingredients' dots and the steps'
  // numbers - and its form with More open, every field of the recipe in it.
  {
    name: 'Kitchen (a recipe)',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Kitchen')
      await p.getByRole('button', { name: /Overnight oats/ }).click()
      await p.waitForTimeout(200)
    },
  },
  // Cook over everything, one ingredient and one step ticked, so the struck
  // line and the box's tick are measured with the rest.
  {
    name: 'Kitchen (cooking)',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Kitchen')
      await p.getByRole('button', { name: /Overnight oats/ }).click()
      await press(p, 'Cook')
      // A line is ticked the way a finger ticks it, on the line: the box
      // itself is drawn, and the real input under it is out of sight.
      const lines = p.getByRole('dialog', { name: /^Cook:/ }).locator('.kitchen-cook-item')
      await lines.first().click()
      await lines.nth(4).click()
      await p.waitForTimeout(200)
    },
  },
  {
    name: 'Kitchen (writing)',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Kitchen')
      await p.getByRole('button', { name: /Overnight oats/ }).click()
      await press(p, 'Edit')
      await p.waitForTimeout(200)
    },
  },
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
  // The three header popovers. Reachable from every tab and therefore on
  // screen more often than most of the list above. Notes and Journal were
  // tabs of the clock's panel until v2.7 and this list still opened the
  // clock and pressed their names inside it - which found nothing to press,
  // so for fourteen versions the two most-used popovers in the app were
  // measured as a picture of the timer. Found by looking at the pictures.
  {
    name: 'Timer',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      await press(p, 'Timer and stopwatch')
    },
  },
  .../** @type {Screen[]} */ (['Notes', 'Journal'].map(panel => ({
    name: `Header: ${panel.toLowerCase()}`,
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      await p.locator('.header-tools').getByRole('button', { name: panel, exact: true }).click()
      await p.waitForTimeout(300)
    },
  }))),
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
    // The fourth door: the low day's proposal, read before Accept.
    name: 'Low day',
    go: async /** @param {Page} p */ p => {
      await tab(p, 'Today')
      await press(p, 'Low day')
    },
  },
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

/**
 * The built app has to be served, and this serves it if nothing else is.
 *
 * It used to need `npm run preview` left running in another window, and
 * that window died twice in one day without saying so - the sweep then fell
 * over with a connection error rather than a finding, which is the right
 * failure and still a failure. precision and textscale start their own
 * server; this does now too, on the same port it always used, and leaves a
 * server alone if one is already answering there.
 */
const served = await (async () => {
  try {
    const res = await fetch(BASE, { method: 'HEAD' })
    if (res.ok) return null
  } catch {
    // Nothing on the port: start one.
  }
  return preview({ preview: { port: Number(PORT), strictPort: true }, logLevel: 'error' })
})()

const browser = await chromium.launch()

if (SELF_CHECK) {
  // Before trusting a clean report, prove the pass can still see a defect.
  // Six planted ones, on a real screen, in the seven shapes it looks for.
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await ctx.clock.setFixedTime(FIXED_TIME)
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.evaluate(([s]) => eval(`(${s})`)({}), [SEED])
  await page.reload()
  await page.waitForSelector('nav')
  // The app fades its first screen in, and this took its baseline reading
  // during that - fourteen strings mid-animation, counted as faint, gone by
  // the time the plants went in. The before-and-after then compared two
  // different pages and reported the contrast pass blind while it was
  // working perfectly. Every real screen in the list below settles before it
  // is read; this one has to as well.
  await page.waitForTimeout(600)
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
    // A chosen swatch at the corner of a scroller, on a ground that is not
    // the one its ring's gap is drawn in: two shapes from one plant.
    const box = document.createElement('div')
    box.style.cssText = 'position:fixed;left:100px;top:400px;width:200px;height:40px;overflow:auto;background:#222'
    box.innerHTML = '<button type="button" class="category-swatch selected" style="--cat:#7aa2f7;display:block" aria-label="Planted swatch"></button>'
    document.body.appendChild(box)
    // The owner's own bug, planted: a row of chips where one is chosen and
    // all of them are drawn identically, so nothing but the attribute says
    // which. The style is inline and the same on both.
    // Past the left edge: a word whose whole box is left of the window,
    // in a fixed box, the way the rail's icons were.
    const gone = document.createElement('div')
    gone.style.cssText = 'position:fixed;left:-300px;top:520px;width:200px;height:30px'
    gone.innerHTML = '<span>Planted past the left edge</span>'
    document.body.appendChild(gone)
    // Partly past it: a layer anchored too far left, the way the Notes
    // popover was on a phone, its first characters cut.
    const partly = document.createElement('div')
    partly.style.cssText = 'position:absolute;left:-40px;top:600px;width:300px;height:30px;background:#222;z-index:5'
    partly.innerHTML = '<span>Planted partly past the left edge</span>'
    document.body.appendChild(partly)
    const row = document.createElement('div')
    row.style.cssText = 'position:fixed;left:100px;top:460px;background:#333;padding:4px;display:flex;gap:4px'
    const chip = 'border:1px solid #555;background:#222;color:#ccc;padding:4px 8px;font-weight:400'
    row.innerHTML =
      '<button type="button" aria-pressed="true" style="' + chip + '">Chosen</button>' +
      '<button type="button" aria-pressed="false" style="' + chip + '">Not chosen</button>'
    document.body.appendChild(row)
  })
  const planted = await page.evaluate(() => /** @type {AuditWindow} */ (/** @type {unknown} */ (window)).__brief('after'))
  await browser.close()
  const sees = {
    'sideways scroll': planted.hScroll > 0,
    'text cut off': planted.clipped > clean.clipped,
    'text over text': planted.overlap > clean.overlap,
    'a control covered': planted.covered > clean.covered,
    'text under AA': planted.faint > clean.faint,
    'the chosen one looks unchosen': planted.chosen > clean.chosen,
    'a ring cut off': planted.ringCut > clean.ringCut,
    'a ring gap off its ground': planted.ringGap > clean.ringGap,
    'past an edge of the window': planted.offscreen > clean.offscreen,
    'partly past the left edge': planted.offscreenPartly > clean.offscreenPartly,
  }
  for (const [what, ok] of Object.entries(sees)) console.log(`${ok ? 'sees  ' : 'BLIND '} ${what}`)
  const blind = Object.values(sees).filter(v => !v).length
  // Counted rather than written down: the seven became eight when the
  // chosen-looks-unchosen shape went in, and a hardcoded total is a line
  // that quietly starts lying the first time the list changes.
  const shapes = Object.keys(sees).length
  console.log(`\n${shapes - blind}/${shapes} shapes still detected`)
  process.exit(blind ? 1 : 0)
}

const runs = [
  ...DESKTOP.filter(size => !WIDTH || size.w === WIDTH).flatMap(size => ['dark', 'light'].map(theme => ({ size, theme, phone: false }))),
  ...(PHONE ? ['dark', 'light'].map(theme => ({ size: { w: 390, h: 844 }, theme, phone: true })) : []),
]

for (const run of runs) {
  const ctx = await browser.newContext(
    run.phone
      ? { ...devices['iPhone 13'], isMobile: true, hasTouch: true }
      : { viewport: { width: run.size.w, height: run.size.h } },
  )
  await ctx.clock.setFixedTime(FIXED_TIME)
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
    // A screen that only exists where there is a pointer to rest on it. Not
    // a way of excusing a phone from a check - the surface genuinely is not
    // drawn there, and reaching for it would time out rather than find
    // anything to measure.
    if (run.phone && screen.pointerOnly) continue
    const where = { size: `${run.size.w}x${run.size.h}`, theme: run.theme, screen: screen.name }
    try {
      // A fresh page per screen: a sheet left open by the screen before this
      // one would be measured as part of it, and a dismissal would carry.
      await page.reload()
      await page.waitForSelector('nav')
      await page.addScriptTag({ content: AUDIT })
      await screen.go(page)
      if (SHOTS) {
        const slug = screen.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        await page.screenshot({ path: join(SHOTS, `${run.size.w}-${run.theme}-${slug}.png`) })
      }
    } catch (err) {
      found(where, 'could not reach', String(err).split('\n')[0].slice(0, 120))
      continue
    }

    const a = await page.evaluate(name => /** @type {AuditWindow} */ (/** @type {unknown} */ (window)).__audit(name), screen.name)
    if (a.hScroll > 0) found(where, 'scrolls sideways', `${a.hScroll}px`)
    for (const c of a.clipped) found(where, 'text cut off', `${c.sel} +${c.overX}x${c.overY} "${c.text}"`)
    for (const c of a.covered) found(where, 'control covered', `${c.sel} "${c.t}" under ${c.by}`)
    for (const o of a.overlap) found(where, 'text over text', `${o.a} "${o.ta}" over ${o.b} "${o.tb}"`)
    for (const o of a.offscreen) {
      if (o.side === 'left-partly') found(where, 'partly past the left edge', `${o.sel} left edge at ${o.left} "${o.text}"`)
      else found(where, o.side === 'left' ? 'past the left edge' : 'past the right edge', `${o.sel} right edge at ${o.right} "${o.text}"`)
    }
    for (const f of a.faint) found(where, 'text under AA', `${f.sel} ${f.ratio}:1 (needs ${f.need}) "${f.text}"`)
    for (const r of a.rings) found(where, r.kind === 'cut' ? 'ring cut off' : 'ring gap off its ground', r.detail)
    for (const c of a.chosen) found(where, 'the chosen one looks unchosen', `${c.sel} "${c.text}" is drawn exactly like "${c.like}" beside it, though ${c.attr} says otherwise`)
    for (const o of a.offCentre) found(where, 'not centred in a row that centres', `${o.sel} > ${o.child} "${o.text}" sits ${o.off > 0 ? o.off + 'px low' : -o.off + 'px high'}`)
    for (const m of a.mismatched) found(where, 'two heights in one row', `${m.sel}: ${m.detail}`)
    for (const s of a.sideways) found(where, 'a scroller that goes sideways', `${s.sel} +${s.over}px: ${s.detail}`)

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
            // And nothing else that is visually hidden either: the file
            // input behind the + in a note is 1px on purpose and is opened
            // by the button, which is the target and is measured.
            if (el.closest('.visually-hidden')) return false
            // And nothing else that is visually hidden either: the file
            // input behind the + in a note is 1px on purpose and is opened
            // by the button, which is the target and is measured.
            if (el.closest('.visually-hidden')) return false
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
await served?.close()

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
