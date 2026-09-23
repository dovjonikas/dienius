/**
 * The one-look audit's report, from what `node scripts/sweep.mjs --unify`
 * measured: a markdown section per screen and size, each rule by its number,
 * the pictures beside it. Written for docs/DESIGN-AUDIT.md.
 *
 *   node scripts/unify-report.mjs BEFORE.json [AFTER.json] > section.md
 *
 * With one file it is the audit - what each screen breaks. With two it is the
 * audit closed: what each screen broke, and what is left, rule by rule.
 */
import { readFileSync } from 'node:fs'

const [beforePath, afterPath] = process.argv.slice(2)
/** @type {{ size: string, screen: string, report: any }[]} */
const before = JSON.parse(readFileSync(beforePath, 'utf8'))
/** @type {{ size: string, screen: string, report: any }[] | null} */
const after = afterPath ? JSON.parse(readFileSync(afterPath, 'utf8')) : null

/**
 * The owner's screens, in the order the brief names them, and which of the walked screens are each.
 * @type {[string, RegExp][]}
 */
const GROUPS = [
  ['Day', /^Today|^Gap offers|^Focus$|^Timer$|^Replan|^Low day$/],
  ['Week', /^Calendar week|^Calendar agenda/],
  ['Month', /^Calendar month/],
  ['Templates and the editor', /^Templates|^Template editor|^Template colour|^Week template editor/],
  ['Roster', /^Calendar \((the roster|what Apply will do|a cycle)\)/],
  ['Kitchen and a recipe', /^Kitchen/],
  ['Books', /^Library/],
  ['Picture', /^North/],
  ['Review', /^Review/],
  ['Search', /^Command palette/],
  ['Notes', /^Scratch|^Header: notes/],
  ['Journal', /^Header: journal|^Journal/],
  ['Settings', /^Settings/],
  ['Dialogs', /^Task detail|^Shortcut card/],
]

/**
 * Where a screen's page may scroll: on a phone, the screens that are long by
 * nature. The template's colour is the editor's own page with its palette
 * open, and the roster is the month with its legend, its cycle and what
 * Apply will do under it - a month's worth of rows on a 375px screen.
 */
const PHONE_MAY_SCROLL = /^Today|^Calendar agenda|^Calendar \((what Apply will do|a cycle)\)|^Templates|^Template editor|^Template colour|^Week template editor|^Library|^Kitchen|^Review|^Settings|^North|^Journal|^Task detail|^Gap offers|^Focus$|^Timer$|^Replan|^Low day$|^Command palette|^Scratch|^Header|^Shortcut card/

const slug = (/** @type {string} */ s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * The rules a screen breaks, each a list of findings under its number.
 * @param {any} r
 * @param {string} size
 * @param {string} screen
 */
function breaks(r, size, screen) {
  const phone = size.startsWith('375')
  /** @type {Record<number, string[]>} */
  const out = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] }
  // 1. Values off the four-pixel grid, gathered by value.
  /** @type {Map<string, Set<string>>} */
  const byValue = new Map()
  for (const f of r.r1) {
    const parts = f.split(' ')
    const value = parts.pop()
    const px = Math.abs(parseFloat(value))
    if (px % 4 === 0) continue
    parts.pop()
    const set = byValue.get(value) ?? new Set()
    set.add(parts.join(' '))
    byValue.set(value, set)
  }
  for (const [value, where] of byValue) out[1].push(`${value} in ${[...where].slice(0, 6).join(', ')}${where.size > 6 ? ` and ${where.size - 6} more` : ''}`)
  out[2] = r.r2
  out[3] = [...r.r3, ...(r.corners.length > 1 ? [`${r.corners.length} corners: ${r.corners.join(', ')}`] : []), ...(r.sizes.length > 5 ? [`${r.sizes.length} type sizes: ${r.sizes.join(', ')}`] : [])]
  out[4] = r.r4
  out[5] = r.r5
  if (r.r6.sideways > 0) out[6].push(`scrolls sideways ${r.r6.sideways}px`)
  if (r.r6.down > 0 && (!phone || !PHONE_MAY_SCROLL.test(screen))) out[6].push(`the page scrolls ${r.r6.down}px`)
  return out
}

/** Where the frame stands on each screen of a size, for rule 7. */
function frames(/** @type {typeof before} */ runs, /** @type {string} */ size) {
  const main = runs.filter(u => u.size === size && !/\(|^Header|^Replan|^Gap|^Focus|^Timer|^Low|^Command|^Scratch|^Shortcut|^Task/.test(u.screen))
  const heads = new Map()
  for (const u of main) {
    const h = u.report.r7.heading
    if (!h) continue
    // Where the title stands: its left, and its centre line down the page
    // from main's top (a measure from before the centre was kept has its top).
    const key = `${h.left},${h.centre ?? h.top}`
    heads.set(key, [...(heads.get(key) ?? []), u.screen])
  }
  return heads
}

const count = (/** @type {Record<number, string[]>} */ b) => Object.values(b).reduce((n, list) => n + list.length, 0)

/** @type {string[]} */
const lines = []
const put = (/** @type {string} */ s = '') => lines.push(s)

// ---- the count -------------------------------------------------------------------------------------
put('### The count')
put()
put(after ? '| Screen | Size | Found | Left |' : '| Screen | Size | 1 | 2 | 3 | 4 | 5 | 6 | Found |')
put(after ? '|---|---|---|---|' : '|---|---|---|---|---|---|---|---|---|')
let total = 0
let left = 0
for (const [group, match] of GROUPS) {
  for (const u of before.filter(x => match.test(x.screen))) {
    const b = breaks(u.report, u.size, u.screen)
    const n = count(b)
    total += n
    if (after) {
      const a = after.find(x => x.size === u.size && x.screen === u.screen)
      const m = a ? count(breaks(a.report, a.size, a.screen)) : n
      left += m
      put(`| ${group}: ${u.screen} | ${u.size} | ${n} | ${m} |`)
    } else {
      put(`| ${group}: ${u.screen} | ${u.size} | ${[1, 2, 3, 4, 5, 6].map(k => b[k].length || '').join(' | ')} | ${n} |`)
    }
  }
}
put()
put(after ? `**${total} found, ${left} left.**` : `**${total} found**, and rule 7 below, which is one finding for the app.`)
put()

// ---- rule 7 --------------------------------------------------------------------------------------------
put('### Rule 7, the frame')
put()
for (const size of ['1920x1080', '375x812']) {
  const heads = frames(after ?? before, size)
  put(`- **${size}**: the page title stands at ${heads.size} ${heads.size === 1 ? 'place' : 'places'} - ${[...heads.entries()].map(([at, screens]) => `${at} (${screens.join(', ')})`).join('; ')}.`)
}
put()

// ---- screen by screen ------------------------------------------------------------------------------------
put('### Screen by screen')
for (const [group, match] of GROUPS) {
  put()
  put(`#### ${group}`)
  for (const u of before.filter(x => match.test(x.screen) && x.size === '1920x1080')) {
    put()
    put(`**${u.screen}**`)
    put()
    const shots = [`screenshots/unify/before/1920-${slug(u.screen)}.jpg`, `screenshots/unify/before/375-${slug(u.screen)}.jpg`]
    put(`Before: [1920x1080](${shots[0]}) | [375x812](${shots[1]})${after ? ` - after: [1920x1080](${shots[0].replace('/before/', '/after/')}) | [375x812](${shots[1].replace('/before/', '/after/')})` : ''}`)
    put()
    for (const size of ['1920x1080', '375x812']) {
      const b = before.find(x => x.size === size && x.screen === u.screen)
      if (!b) continue
      const found = breaks(b.report, size, u.screen)
      const a = after?.find(x => x.size === size && x.screen === u.screen)
      const still = a ? breaks(a.report, size, u.screen) : null
      for (const rule of [1, 2, 3, 4, 5, 6]) {
        for (const f of found[rule]) {
          const open = still ? still[rule].includes(f) : true
          put(`- ${size}, rule ${rule}: ${f.replace(/\|/g, '/')}${still ? (open ? ' - **open**' : ' - closed') : ''}`)
        }
      }
    }
  }
}
console.log(lines.join('\n'))
